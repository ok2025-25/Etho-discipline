// === Tracker.js: Momentum & Streak Logic ===

// --------- DOM Elements (Declared globally, assigned later) ---------
let habitsList;
let addBtn;
let addInput;
let clearBtn;
let quoteElem;
let chartCanvas;
let templatesContainer;

// Stats Elements
let statStreak;
let statToday;
let statTotal;
let dashboardPct;
let dashboardLegend;
let doughnutChartInstance;

// --------- Constants ---------
const LS_KEY = "prod_momentum_data"; 
const MAX_HISTORY_DOTS = 5; 

const HABIT_TEMPLATES = [
  { name: "Workout", icon: "fa-solid fa-dumbbell" },
  { name: "Meditation", icon: "fa-solid fa-spa" },
  { name: "Journaling", icon: "fa-solid fa-pen-fancy" },
  { name: "Deep Work", icon: "fa-solid fa-brain" },
  { name: "Read 10 Pages", icon: "fa-solid fa-book-open" }
];

const QUOTES = [
  "We are what we repeatedly do. Excellence, then, is not an act, but a habit.",
  "You don't have to be great to start, but you have to start to be great.",
  "The secret of your future is hidden in your daily routine.",
  "Small steps in the right direction can turn out to be the biggest step of your life.",
  "Don't watch the clock; do what it does. Keep going."
];

// --------- State Management ---------
let state = {
  habits: []
};

// True real account gating for data, not just the CSS dim treatment: the
// site-wide [data-account-feature] lock only hides these visually, so a free
// user could still read real numbers via devtools/inspect/select-text.
// The 5 account stat tiles and the Habit Insights heatmap carry real
// personal data, so — same as Etho Score — free users get a neutral
// placeholder instead of the real computed value.
let trackerSignedIn = false;

// --------- Initialization ---------
document.addEventListener("DOMContentLoaded", async () => {
  await requireAuth();

  trackerSignedIn = typeof isSignedIn === "function" ? await isSignedIn() : false;

  // 1. Assign DOM elements now that HTML is ready
  habitsList = document.getElementById("habits-list");
  addBtn = document.getElementById("add-habit-btn");
  addInput = document.getElementById("new-habit-input");
  clearBtn = document.getElementById("clear-data-btn");
  quoteElem = document.getElementById("motivational-quote");
  chartCanvas = document.getElementById("progress-chart");
  templatesContainer = document.getElementById("habit-templates");

  statStreak = document.getElementById("stat-streak");
  statToday = document.getElementById("stat-today");
  statTotal = document.getElementById("stat-total");
  dashboardPct = document.getElementById("dashboard-percentage");
  dashboardLegend = document.getElementById("dashboard-legend-list");

  // 2. Initialize App
  setupEventListeners(); // Attach clicks now
  initHabitEditModal();
  initWeeklyPerfModal();
  await loadState();
  setupSidebar();
  setupHabitInsightsToggle();
  renderUI();
  renderQuote();
});

// --------- Event Listeners Setup ---------
function setupEventListeners() {
  if (addBtn) {
    addBtn.addEventListener("click", addHabit);
  }
  
  if (addInput) {
    addInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") addHabit();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", resetData);
  }

  const modalOverlay = document.getElementById("habit-modal-overlay");
  const modalCloseBtn = document.getElementById("habit-modal-close");
  if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeHabitModal);
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) closeHabitModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (modalOverlay && !modalOverlay.hidden) closeHabitModal();
    const editOverlay = document.getElementById("habit-edit-overlay");
    if (editOverlay && !editOverlay.hidden) closeHabitEditModal();
  });

  // Account stat tiles are clickable — jump down to the full Habit Insights
  // card so the summary numbers lead somewhere, not just decoration.
  document.querySelectorAll(".stat-tile-clickable").forEach(tile => {
    tile.addEventListener("click", () => {
      const insightsCard = document.getElementById("habit-insights-card");
      if (!insightsCard) return;
      insightsCard.scrollIntoView({ behavior: "smooth", block: "center" });
      insightsCard.classList.remove("jump-highlight");
      void insightsCard.offsetWidth;
      insightsCard.classList.add("jump-highlight");
    });
  });
}

// --------- Date Utilities ---------
// Local calendar day, matching checklist.js (new Date().toDateString()) and
// consistency.js (dateKey()) — NOT toISOString(), which is UTC and used to
// drift a habit's "today" from the rest of the app's near midnight for
// anyone outside UTC (e.g. checked off at 11pm local could already be
// "tomorrow" in UTC, silently splitting one day's check across two keys).
// Local calendar day, matching checklist.js (new Date().toDateString()) and
// consistency.js (dateKey()) — NOT toISOString(), which is UTC and used to
// drift a habit's "today" from the rest of the app's near midnight for
// anyone outside UTC (e.g. checked off at 11pm local could already be
// "tomorrow" in UTC, silently splitting one day's check across two keys).
function toLocalDateKey(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const getTodayDate = () => toLocalDateKey(new Date());

function getPastDates(days) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(toLocalDateKey(d));
  }
  return dates;
}

// --------- Scheduling (frequency / active days / pause) ---------
// A habit is "daily" (every day counts) unless it's explicitly set to
// "custom" with a specific set of weekdays (0 = Sun ... 6 = Sat). Older
// habits saved before this existed have neither field, which is treated
// as daily — so nothing already tracked silently changes behavior.
function isScheduledDate(habit, dateStr) {
  // Paused habits stop being "due" from the moment they were paused
  // onward — history before that point is untouched and still judged
  // against whatever schedule was active at the time.
  if (habit.paused && habit.pausedAt && dateStr >= habit.pausedAt) return false;

  if (habit.frequency === "custom" && Array.isArray(habit.activeDays) && habit.activeDays.length > 0) {
    const weekday = new Date(dateStr + "T00:00:00").getDay();
    return habit.activeDays.includes(weekday);
  }
  return true; // daily, or custom with no days picked (falls back to daily rather than never)
}

// --------- Storage & Logic ---------
async function loadState() {
  const today = getTodayDate();
  const defaultState = {
    habits: [
      { id: 1, name: "Drink 2L Water", history: {}, createdAt: today },
      { id: 2, name: "Read 10 Pages", history: {}, createdAt: today }
    ]
  };
  state = await cloudGet(LS_KEY, defaultState);
}

function saveState() {
  cloudSet(LS_KEY, state); // fire-and-forget: local cache updates synchronously inside cloudSet
  updateStats();
}

function toggleHabit(id) {
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return;

  const today = getTodayDate();
  if (habit.history[today]) {
    delete habit.history[today]; // Uncheck
  } else {
    habit.history[today] = true; // Check
    triggerMiniConfetti();
  }
  
  saveState();
  renderUI(); 
  checkAllDone();
}

function addHabit() {
  const name = addInput.value.trim();
  if (!name) return;

  addHabitByName(name);
  addInput.value = "";
}

function addHabitByName(name) {
  const alreadyExists = state.habits.some(
    h => h.name.trim().toLowerCase() === name.trim().toLowerCase()
  );
  if (alreadyExists) return false;

  state.habits.push({
    id: Date.now(),
    name: name,
    history: {},
    createdAt: getTodayDate()
  });

  saveState();
  renderUI();
  return true;
}

async function deleteHabit(id) {
  const ok = await customConfirm("Delete this habit and its history?", { danger: true, confirmText: "Delete" });
  if (ok) {
    state.habits = state.habits.filter(h => h.id !== id);
    saveState();
    renderUI();
  }
}

// Renaming or changing frequency/active days never touches `history` —
// only name/frequency/activeDays are reassigned, so every past check-in
// stays exactly where it was.
function editHabit(id, { name, frequency, activeDays }) {
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return false;

  const trimmed = (name || "").trim();
  if (!trimmed) return false;

  habit.name = trimmed;
  habit.frequency = frequency === "custom" ? "custom" : "daily";
  habit.activeDays = habit.frequency === "custom" ? (activeDays || []).slice().sort() : [];

  saveState();
  renderUI();
  return true;
}

// Pausing/resuming only ever touches `paused`/`pausedAt` — `history` is
// never written here, so nothing already checked off is affected.
function pauseHabit(id) {
  const habit = state.habits.find(h => h.id === id);
  if (!habit || habit.paused) return;
  habit.paused = true;
  habit.pausedAt = getTodayDate();
  saveState();
  renderUI();
}

function resumeHabit(id) {
  const habit = state.habits.find(h => h.id === id);
  if (!habit || !habit.paused) return;
  habit.paused = false;
  habit.pausedAt = null;
  saveState();
  renderUI();
}

async function resetData() {
  const ok = await customConfirm("This will wipe all habits and stats. This can't be undone.", { danger: true, confirmText: "Reset All Data" });
  if (ok) {
    await cloudDelete(LS_KEY);
    location.reload();
  }
}

// --------- Statistics Logic ---------

// Earliest date any habit has a recorded check-in — used to bound
// all-time scans (best streak, perfect days, heatmaps) instead of
// walking back indefinitely.
function getEarliestDate() {
  let min = null;
  state.habits.forEach(h => {
    Object.keys(h.history).forEach(dateStr => {
      if (h.history[dateStr] && (!min || dateStr < min)) min = dateStr;
    });
    if (h.createdAt && (!min || h.createdAt < min)) min = h.createdAt;
  });
  return min;
}

function calculateStats() {
  const today = getTodayDate();
  const habits = state.habits;
  
  if(habits.length === 0) return { streak: 0, todayPct: 0, totalChecks: 0, bestStreak: 0, perfectDays: 0 };

  // 1. Today's Completion
  const doneToday = habits.filter(h => h.history[today]).length;
  const todayPct = Math.round((doneToday / habits.length) * 100);

  // 2. Total Check-ins
  let totalChecks = 0;
  habits.forEach(h => totalChecks += Object.keys(h.history).length);

  // 3. Current Streak
  let streak = 0;
  let d = new Date();
  
  while (true) {
    const dateStr = toLocalDateKey(d);
    const anyDone = habits.some(h => h.history[dateStr]);
    
    if (dateStr === today) {
       if (anyDone) streak++; 
    } else {
       if (anyDone) streak++;
       else break;
    }
    d.setDate(d.getDate() - 1);
  }

  // 4. Best Streak (all-time) + Perfect Days — walk every day from the
  // earliest recorded check-in through today once.
  let bestStreak = streak;
  let perfectDays = 0;
  const earliest = getEarliestDate();
  if (earliest) {
    let run = 0;
    const cursor = new Date(earliest + "T00:00:00");
    const end = new Date(today + "T00:00:00");
    while (cursor <= end) {
      const dateStr = toLocalDateKey(cursor);
      const anyDone = habits.some(h => h.history[dateStr]);
      const allDone = habits.every(h => h.history[dateStr]);
      if (allDone) perfectDays++;
      if (anyDone) { run++; if (run > bestStreak) bestStreak = run; }
      else { run = 0; }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return { streak, todayPct, totalChecks, bestStreak, perfectDays };
}

// Per-habit analytics: streaks, completion rate, and total check-ins
// scoped to that single habit's own history. Non-scheduled days (outside
// the habit's active days, or after it was paused) are skipped rather
// than counted as a miss — they don't break a streak and don't count
// against completion rate, so a 2x/week habit isn't unfairly judged
// against a 7-day denominator.
function calculateHabitStats(habit) {
  const today = getTodayDate();
  const checkedDates = Object.keys(habit.history).filter(d => habit.history[d]);
  const totalChecks = checkedDates.length;
  const createdAt = habit.createdAt || checkedDates.sort()[0] || today;

  let scheduledDayCount = 0;
  {
    const cursor = new Date(createdAt + "T00:00:00");
    const end = new Date(today + "T00:00:00");
    while (cursor <= end) {
      if (isScheduledDate(habit, toLocalDateKey(cursor))) scheduledDayCount++;
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  const completionRate = scheduledDayCount > 0
    ? Math.min(100, Math.round((totalChecks / scheduledDayCount) * 100))
    : 0;

  // Current streak (bounded by the habit's creation date). Non-scheduled
  // days are skipped — they neither extend nor break the streak.
  let streak = 0;
  let d = new Date();
  while (true) {
    const dateStr = toLocalDateKey(d);
    if (dateStr < createdAt) break;
    const scheduled = isScheduledDate(habit, dateStr);
    const done = !!habit.history[dateStr];
    if (scheduled) {
      if (dateStr === today) { if (done) streak++; }
      else { if (done) streak++; else break; }
    }
    d.setDate(d.getDate() - 1);
  }

  // Best streak across the habit's whole life — same skip rule.
  let bestStreak = streak;
  let run = 0;
  const cursor = new Date(createdAt + "T00:00:00");
  const end = new Date(today + "T00:00:00");
  while (cursor <= end) {
    const dateStr = toLocalDateKey(cursor);
    if (isScheduledDate(habit, dateStr)) {
      if (habit.history[dateStr]) { run++; if (run > bestStreak) bestStreak = run; }
      else { run = 0; }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return { totalChecks, completionRate, streak, bestStreak, createdAt };
}

// Bumps a stat element's text with a small "pop" so numbers feel alive
// on every recalculation, not just a flat text swap.
function animateStatValue(el, newVal) {
  if (!el) return;
  el.textContent = newVal;
  el.classList.remove("count-pop");
  void el.offsetWidth; // force reflow so the animation can restart
  el.classList.add("count-pop");
}

function updateStats() {
  const stats = calculateStats();
  
  // Safety check if elements exist
  if(statStreak) animateStatValue(statStreak, stats.streak);
  if(statToday) animateStatValue(statToday, stats.todayPct + "%");
  if(statTotal) animateStatValue(statTotal, stats.totalChecks);

  // Account visual tiles (icon tiles + progress ring) — only present/visible
  // when [data-plan="account"] is set. Free users get a neutral placeholder
  // instead of the real number so the CSS dim/lock isn't the only thing
  // standing between them and the actual data.
  const statStreakAccount = document.getElementById("stat-streak-account");
  const statTodayAccount = document.getElementById("stat-today-account");
  const statTotalAccount = document.getElementById("stat-total-account");
  const statBestAccount = document.getElementById("stat-best-account");
  const statPerfectAccount = document.getElementById("stat-perfect-account");
  const ringToday = document.getElementById("stat-ring-today");

  if (trackerSignedIn) {
    if (statStreakAccount) animateStatValue(statStreakAccount, stats.streak);
    if (statTotalAccount) animateStatValue(statTotalAccount, stats.totalChecks);
    if (statTodayAccount) animateStatValue(statTodayAccount, stats.todayPct + "%");
    if (statBestAccount) animateStatValue(statBestAccount, stats.bestStreak);
    if (statPerfectAccount) animateStatValue(statPerfectAccount, stats.perfectDays);
    if (ringToday) ringToday.style.setProperty("--pct", stats.todayPct);
  } else {
    if (statStreakAccount) statStreakAccount.textContent = "—";
    if (statTotalAccount) statTotalAccount.textContent = "—";
    if (statTodayAccount) statTodayAccount.textContent = "—";
    if (statBestAccount) statBestAccount.textContent = "—";
    if (statPerfectAccount) statPerfectAccount.textContent = "—";
    if (ringToday) ringToday.style.setProperty("--pct", 0);
  }
}

// --------- Rendering ---------
function renderHabitList() {
  if (!habitsList) return; // Safety check

  habitsList.innerHTML = "";
  const today = getTodayDate();
  const pastDays = getPastDates(5); 

  if (state.habits.length === 0) {
    habitsList.innerHTML = `<div class="empty-state">No habits tracked yet.<br>Start your journey above!</div>`;
    return;
  }

  state.habits.forEach(habit => {
    const isDoneToday = !!habit.history[today];
    const scheduledToday = isScheduledDate(habit, today);

    const li = document.createElement("li");
    li.className = `checklist-task-item ${isDoneToday ? 'completed' : ''} ${habit.paused ? 'habit-paused-row' : ''}`;

    // Checkbox
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "checklist-task-checkbox";
    checkbox.checked = isDoneToday;
    checkbox.onclick = () => toggleHabit(habit.id);

    // Label (+ small status badges: Paused / Off today)
    const label = document.createElement("span");
    label.className = "checklist-task-label";
    label.textContent = habit.name;
    if (habit.paused) {
      const badge = document.createElement("span");
      badge.className = "habit-status-badge habit-status-paused";
      badge.innerHTML = '<i class="fa-solid fa-pause"></i> Paused';
      label.appendChild(badge);
    } else if (!scheduledToday) {
      const badge = document.createElement("span");
      badge.className = "habit-status-badge habit-status-off";
      badge.innerHTML = 'Not scheduled today';
      label.appendChild(badge);
    }

    // History Dots — a day is "done" (checked), "not-scheduled" (outside
    // this habit's active days, or after it was paused), or otherwise
    // left as the default "missed" look.
    const dotsContainer = document.createElement("div");
    dotsContainer.className = "habit-history";
    dotsContainer.title = "Last 5 days activity";

    pastDays.forEach(date => {
        const done = !!habit.history[date];
        const scheduled = isScheduledDate(habit, date);
        const dot = document.createElement("div");
        dot.className = `history-dot ${done ? 'done' : (!scheduled ? 'not-scheduled' : '')} ${date === today ? 'today' : ''}`;
        dot.title = done ? "Done" : (!scheduled ? "Not scheduled" : "Missed");
        dotsContainer.appendChild(dot);
    });

    // Edit button
    const editBtn = document.createElement("button");
    editBtn.className = "checklist-action-btn";
    editBtn.title = "Edit habit";
    editBtn.innerHTML = '<i class="fa-solid fa-pen"></i>';
    editBtn.onclick = () => openHabitEditModal(habit.id);

    // Pause/Resume button
    const pauseBtn = document.createElement("button");
    pauseBtn.className = "checklist-action-btn";
    pauseBtn.title = habit.paused ? "Resume habit" : "Pause habit";
    pauseBtn.innerHTML = habit.paused ? '<i class="fa-solid fa-play"></i>' : '<i class="fa-solid fa-pause"></i>';
    pauseBtn.onclick = () => (habit.paused ? resumeHabit(habit.id) : pauseHabit(habit.id));

    // Delete Button
    const delBtn = document.createElement("button");
    delBtn.className = "checklist-action-btn";
    delBtn.innerHTML = '<i class="fa-solid fa-times"></i>';
    delBtn.onclick = () => deleteHabit(habit.id);

    li.append(checkbox, label, dotsContainer, editBtn, pauseBtn, delBtn);
    habitsList.appendChild(li);
  });
}

function renderTemplates() {
  if (!templatesContainer) return; // Safety check

  templatesContainer.innerHTML = "";

  HABIT_TEMPLATES.forEach(tpl => {
    const isAdded = state.habits.some(
      h => h.name.trim().toLowerCase() === tpl.name.toLowerCase()
    );

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `template-chip ${isAdded ? 'added' : ''}`;
    chip.title = isAdded ? `${tpl.name} already added` : `Add "${tpl.name}"`;
    chip.innerHTML = `<i class="${tpl.icon}"></i> ${tpl.name}`;

    if (!isAdded) {
      chip.onclick = () => addHabitByName(tpl.name);
    }

    templatesContainer.appendChild(chip);
  });
}

// --------- Chart.js ---------
let myChart;

function renderChart() {
  if (!chartCanvas) return; // Safety check
  const ctx = chartCanvas.getContext('2d');
  const last7Days = getPastDates(7); 
  
  const dataPoints = last7Days.map(date => {
    return state.habits.filter(h => h.history[date]).length;
  });

  const labels = last7Days.map(date => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  });

  if (myChart) myChart.destroy();

  const gradient = ctx.createLinearGradient(0, 0, 0, 400);
  gradient.addColorStop(0, 'rgba(139, 92, 246, 0.5)'); 
  gradient.addColorStop(1, 'rgba(139, 92, 246, 0.0)');

  myChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Habits Completed',
        data: dataPoints,
        backgroundColor: gradient,
        borderColor: '#8b5cf6',
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: 0.6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8', stepSize: 1 }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

// --------- Weekly Performance: full breakdown popup ---------
// Reuses isScheduledDate() from the Habits chunk so a habit that wasn't
// due on a given day shows as "not scheduled" here too, instead of
// looking like a habit the user simply skipped.
function openWeeklyPerfModal() {
  const overlay = document.getElementById("weekly-perf-overlay");
  const list = document.getElementById("weekly-perf-days");
  if (!overlay || !list) return;

  const today = getTodayDate();
  const last7Days = getPastDates(7).slice().reverse(); // most recent first

  list.innerHTML = "";

  last7Days.forEach((date, idx) => {
    const scheduledHabits = state.habits.filter(h => isScheduledDate(h, date));
    const doneCount = scheduledHabits.filter(h => h.history[date]).length;
    const pct = scheduledHabits.length > 0 ? Math.round((doneCount / scheduledHabits.length) * 100) : 0;

    const d = new Date(date + "T00:00:00");
    const dayName = d.toLocaleDateString("en-US", { weekday: "long" });
    const dateLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const dayEl = document.createElement("div");
    dayEl.className = "weekly-perf-day" + (idx === 0 ? " expanded" : "");

    const head = document.createElement("div");
    head.className = "weekly-perf-day-head";
    head.innerHTML = `
      <div class="weekly-perf-day-label">${date === today ? "Today" : dayName}<span class="sub">${dateLabel}</span></div>
      <div class="weekly-perf-day-right">
        <span class="weekly-perf-day-pct">${doneCount}/${scheduledHabits.length} \u00b7 ${pct}%</span>
        <i class="fa-solid fa-chevron-down weekly-perf-day-chevron"></i>
      </div>
    `;
    head.addEventListener("click", () => dayEl.classList.toggle("expanded"));

    const body = document.createElement("div");
    body.className = "weekly-perf-day-body";

    if (state.habits.length === 0) {
      body.innerHTML = `<div class="weekly-perf-habit-row"><span class="name">No habits tracked yet.</span></div>`;
    } else {
      state.habits.forEach(h => {
        const scheduled = isScheduledDate(h, date);
        const done = !!h.history[date];
        const row = document.createElement("div");
        row.className = "weekly-perf-habit-row " + (!scheduled ? "not-scheduled" : (done ? "done" : "missed"));
        const icon = !scheduled ? "fa-minus" : (done ? "fa-circle-check" : "fa-circle-xmark");
        const tag = !scheduled ? "Not scheduled" : (done ? "Done" : "Missed");
        row.innerHTML = `<i class="fa-solid ${icon}"></i><span class="name">${escapeHtml(h.name)}</span><span class="tag">${tag}</span>`;
        body.appendChild(row);
      });
    }

    dayEl.append(head, body);
    list.appendChild(dayEl);
  });

  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add("open"));
}

function closeWeeklyPerfModal() {
  const overlay = document.getElementById("weekly-perf-overlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  setTimeout(() => { overlay.hidden = true; }, 200);
}

function initWeeklyPerfModal() {
  const overlay = document.getElementById("weekly-perf-overlay");
  if (!overlay) return;
  document.getElementById("weekly-perf-close")?.addEventListener("click", closeWeeklyPerfModal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeWeeklyPerfModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) closeWeeklyPerfModal();
  });

  const chartWrap = document.getElementById("weekly-perf-chart-wrap");
  const expandBtn = document.getElementById("weekly-perf-expand-btn");
  chartWrap?.addEventListener("click", openWeeklyPerfModal);
  chartWrap?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openWeeklyPerfModal(); }
  });
  expandBtn?.addEventListener("click", openWeeklyPerfModal);
}

// --------- Extras ---------
function renderQuote() {
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  if(quoteElem) quoteElem.textContent = `"${q}"`;
}

function setupSidebar() {
  const burger = document.getElementById("sidebar-burger");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");

  if (!burger || !sidebar || !overlay) return;

  function toggleMenu() {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("active");
    burger.classList.toggle("active");
  }

  burger.addEventListener("click", toggleMenu);
  overlay.addEventListener("click", toggleMenu);
}

// ----- Habit Insights mobile collapse -----
// The section is sized fine on desktop but is a lot of scroll on phones,
// so on mobile it starts collapsed and expands on tap. The toggle button
// itself is only visible on mobile (see .habit-insights-toggle in
// tracker.html); on desktop this just leaves the card expanded as always.
function setupHabitInsightsToggle() {
  const card = document.getElementById("habit-insights-card");
  const toggle = document.getElementById("habit-insights-toggle");
  if (!card || !toggle) return;

  if (window.innerWidth <= 599) card.classList.add("collapsed");

  toggle.addEventListener("click", () => {
    const collapsed = card.classList.toggle("collapsed");
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  });
}

// Confetti Effects
function triggerMiniConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 30,
      spread: 50,
      origin: { y: 0.7 },
      colors: ['#8b5cf6', '#ec4b9e', '#06b6d4']
    });
  }
}

function checkAllDone() {
  const today = getTodayDate();
  const allDone = state.habits.length > 0 && state.habits.every(h => h.history[today]);
  
  if (allDone && typeof confetti === 'function') {
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#8b5cf6', '#ec4b9e', '#ffffff']
      });
    }, 300);
  }

  // Habits alone don't decide a "perfect day" — the Consistency prompt
  // also checks today's Routine checklist, so this can safely fire every
  // time and let checkDailyCompletionAndPrompt() do the real gating.
  if (allDone && typeof checkDailyCompletionAndPrompt === "function") {
    checkDailyCompletionAndPrompt();
  }
}

function renderDoughnut() {
  const ctx = document.getElementById('doughnut-chart');
  if (!ctx) return;

  const today = getTodayDate();
  const habits = state.habits;
  const totalHabits = habits.length;

  if (totalHabits === 0) {
    // Handle empty state if needed, or just clear
    if(doughnutChartInstance) doughnutChartInstance.destroy();
    return;
  }

  // Calculate Data
  // We want equal segments for every habit (1 per habit)
  const dataValues = habits.map(() => 1);
  
  // Dynamic Colors: Neon if done, Dark if not
  const backgroundColors = habits.map(h => {
    return h.history[today] ? '#8b5cf6' : 'rgba(255, 255, 255, 0.05)';
  });
  
  const borderColors = habits.map(h => {
    return h.history[today] ? '#c4b5fd' : 'rgba(255, 255, 255, 0.1)';
  });

  // Calculate Percentage Text
  const doneCount = habits.filter(h => h.history[today]).length;
  const pct = Math.round((doneCount / totalHabits) * 100);
  if(dashboardPct) dashboardPct.textContent = `${pct}%`;

  // Render Legend List manually for custom styling
  if(dashboardLegend) {
    dashboardLegend.innerHTML = '';
    habits.forEach((h, index) => {
      const isDone = !!h.history[today];
      const li = document.createElement('li');
      li.className = `legend-item ${isDone ? 'active' : ''}`;
      li.innerHTML = `
        <span class="legend-dot" style="background: ${isDone ? '#8b5cf6' : 'transparent'}; box-shadow: 0 0 ${isDone ? '10px' : '0'} var(--primary);"></span>
        ${h.name}
      `;
      dashboardLegend.appendChild(li);
    });
  }

  // Destroy old chart to prevent overlay issues
  if (doughnutChartInstance) {
    doughnutChartInstance.destroy();
  }

  // Create Chart
  doughnutChartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: habits.map(h => h.name),
      datasets: [{
        data: dataValues, // Equal slices
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 2,
        hoverOffset: 10
      }]
    },
    options: {
      cutout: '75%', // Makes it a thin ring like the image
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }, // We built our own custom legend
        tooltip: {
          callbacks: {
            label: function(context) {
              const habitName = context.chart.data.labels[context.dataIndex];
              const isDone = context.chart.data.datasets[0].backgroundColor[context.dataIndex] !== 'rgba(255, 255, 255, 0.05)';
              return `${habitName}: ${isDone ? 'Completed' : 'Pending'}`;
            }
          }
        }
      },
      animation: {
        animateScale: true,
        animateRotate: true
      }
    }
  });
}

function renderUI() {
  renderHabitList();
  renderTemplates();
  renderChart(); // Your existing bar chart
  renderDoughnut();
  renderHabitInsights(); // Account: heatmap + per-habit analytics
  updateStats();
}

// --------- Habit Insights (account): heatmaps & per-habit analytics ---------

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Turns a "level for date" function into a flat list of cells, padded
// at the front so the grid always starts on a Sunday (needed for the
// GitHub-style column-per-week layout).
function buildHeatmapCells(days, levelFn) {
  const todayStr = getTodayDate();
  const pastDates = getPastDates(days);

  const firstDay = new Date(pastDates[0] + "T00:00:00").getDay(); // 0 = Sun
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push({ pad: true });

  pastDates.forEach(dateStr => {
    cells.push({ date: dateStr, level: levelFn(dateStr), today: dateStr === todayStr });
  });

  return cells;
}

function renderHeatmapInto(gridEl, monthsEl, cells) {
  if (!gridEl) return;
  gridEl.innerHTML = "";

  cells.forEach(c => {
    const div = document.createElement("div");
    if (c.pad) {
      div.className = "heatmap-cell pad";
    } else {
      div.className = "heatmap-cell" + (c.today ? " today" : "") + (c.level === "ns" ? " not-scheduled" : "");
      div.dataset.level = c.level;
      const d = new Date(c.date + "T00:00:00");
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      div.title = c.level === "ns" ? `${label}: not scheduled` : (c.level > 0 ? `${label}: active` : `${label}: no activity`);
    }
    gridEl.appendChild(div);
  });

  if (monthsEl) {
    monthsEl.innerHTML = "";
    const cols = Math.ceil(cells.length / 7);
    let lastMonth = null;
    for (let col = 0; col < cols; col++) {
      const first = cells[col * 7];
      const span = document.createElement("span");
      if (first && !first.pad) {
        const d = new Date(first.date + "T00:00:00");
        const m = d.toLocaleDateString("en-US", { month: "short" });
        if (m !== lastMonth) {
          span.textContent = m;
          lastMonth = m;
        }
      }
      monthsEl.appendChild(span);
    }
  }
}

// Aggregate level (0-4) across every habit for a given day, used for
// the top-level "all habits" heatmap.
function dailyLevel(dateStr) {
  const habits = state.habits;
  if (!habits.length) return 0;
  const done = habits.filter(h => h.history[dateStr]).length;
  const pct = done / habits.length;
  if (pct <= 0) return 0;
  if (pct < 0.34) return 1;
  if (pct < 0.67) return 2;
  if (pct < 1) return 3;
  return 4;
}

function renderHabitInsights() {
  const gridEl = document.getElementById("insights-heatmap-grid");
  const monthsEl = document.getElementById("insights-heatmap-months");
  const listEl = document.getElementById("habit-insight-list");

  // Real per-day and per-habit history is the whole product here — don't
  // build it for free users just to have CSS hide it (see stat tiles above).
  if (!trackerSignedIn) {
    if (gridEl) gridEl.innerHTML = "";
    if (listEl) listEl.innerHTML = "";
    return;
  }

  if (gridEl) {
    renderHeatmapInto(gridEl, monthsEl, buildHeatmapCells(98, dailyLevel));
  }

  if (!listEl) return;
  listEl.innerHTML = "";

  if (state.habits.length === 0) {
    listEl.innerHTML = `<div class="empty-state">Add a habit to start seeing insights.</div>`;
    return;
  }

  state.habits.forEach(habit => {
    const stats = calculateHabitStats(habit);

    const row = document.createElement("div");
    row.className = "habit-insight-row";
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", `View full history for ${habit.name}`);

    const info = document.createElement("div");
    info.className = "habit-insight-info";
    info.innerHTML = `
      <div class="habit-insight-name">${escapeHtml(habit.name)}</div>
      <div class="habit-insight-sub">
        <span><i class="fa-solid fa-fire"></i> ${stats.streak}d streak</span>
        <span><i class="fa-solid fa-medal"></i> best ${stats.bestStreak}d</span>
        <span><i class="fa-solid fa-percent"></i> ${stats.completionRate}%</span>
        <span><i class="fa-solid fa-check"></i> ${stats.totalChecks} total</span>
      </div>
    `;

    const mini = document.createElement("div");
    mini.className = "habit-mini-heatmap";
    renderHeatmapInto(mini, null, buildHeatmapCells(70, d => (habit.history[d] ? 4 : (isScheduledDate(habit, d) ? 0 : "ns"))));

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "habit-details-btn";
    btn.title = `View full history for ${habit.name}`;
    btn.tabIndex = -1; // the row itself is the click target now
    btn.innerHTML = '<i class="fa-solid fa-chart-simple"></i>';

    row.append(info, mini, btn);
    row.addEventListener("click", () => openHabitModal(habit.id));
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openHabitModal(habit.id);
      }
    });
    listEl.appendChild(row);
  });
}

function openHabitModal(id) {
  const habit = state.habits.find(h => h.id === id);
  const overlay = document.getElementById("habit-modal-overlay");
  if (!habit || !overlay) return;

  const stats = calculateHabitStats(habit);

  const titleEl = document.getElementById("habit-modal-title");
  if (titleEl) titleEl.textContent = habit.name;

  const statsEl = document.getElementById("habit-modal-stats");
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="habit-modal-stat"><div class="val">${stats.streak}</div><div class="lbl">Current Streak</div></div>
      <div class="habit-modal-stat"><div class="val">${stats.bestStreak}</div><div class="lbl">Best Streak</div></div>
      <div class="habit-modal-stat"><div class="val">${stats.completionRate}%</div><div class="lbl">Completion Rate</div></div>
      <div class="habit-modal-stat"><div class="val">${stats.totalChecks}</div><div class="lbl">Total Check-ins</div></div>
    `;
  }

  const gridEl = document.getElementById("habit-modal-heatmap-grid");
  const monthsEl = document.getElementById("habit-modal-heatmap-months");
  renderHeatmapInto(gridEl, monthsEl, buildHeatmapCells(182, d => (habit.history[d] ? 4 : (isScheduledDate(habit, d) ? 0 : "ns"))));

  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add("open"));
}

function closeHabitModal() {
  const overlay = document.getElementById("habit-modal-overlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  setTimeout(() => { overlay.hidden = true; }, 200);
}

// --------- Edit Habit modal ---------
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
let editingHabitId = null;
let editSelectedDays = [];

function openHabitEditModal(id) {
  const habit = state.habits.find(h => h.id === id);
  const overlay = document.getElementById("habit-edit-overlay");
  if (!habit || !overlay) return;

  editingHabitId = id;
  editSelectedDays = Array.isArray(habit.activeDays) ? habit.activeDays.slice() : [];

  const nameInput = document.getElementById("habit-edit-name");
  if (nameInput) nameInput.value = habit.name;

  const isCustom = habit.frequency === "custom";
  document.getElementById("habit-edit-freq-daily")?.classList.toggle("active", !isCustom);
  document.getElementById("habit-edit-freq-custom")?.classList.toggle("active", isCustom);
  document.getElementById("habit-edit-days")?.classList.toggle("shown", isCustom);

  renderHabitEditDayPicker();

  overlay.hidden = false;
  requestAnimationFrame(() => overlay.classList.add("open"));
  nameInput?.focus();
}

function renderHabitEditDayPicker() {
  const wrap = document.getElementById("habit-edit-days");
  if (!wrap) return;
  wrap.innerHTML = "";
  WEEKDAY_LABELS.forEach((label, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "habit-edit-day-btn" + (editSelectedDays.includes(i) ? " active" : "");
    btn.textContent = label;
    btn.onclick = () => {
      if (editSelectedDays.includes(i)) {
        editSelectedDays = editSelectedDays.filter(d => d !== i);
      } else {
        editSelectedDays.push(i);
      }
      renderHabitEditDayPicker();
    };
    wrap.appendChild(btn);
  });
}

function closeHabitEditModal() {
  const overlay = document.getElementById("habit-edit-overlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  setTimeout(() => { overlay.hidden = true; }, 200);
  editingHabitId = null;
}

function initHabitEditModal() {
  const overlay = document.getElementById("habit-edit-overlay");
  const form = document.getElementById("habit-edit-form");
  const dailyBtn = document.getElementById("habit-edit-freq-daily");
  const customBtn = document.getElementById("habit-edit-freq-custom");
  if (!overlay || !form) return;

  document.getElementById("habit-edit-close")?.addEventListener("click", closeHabitEditModal);
  document.getElementById("habit-edit-cancel")?.addEventListener("click", closeHabitEditModal);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeHabitEditModal(); });

  dailyBtn?.addEventListener("click", () => {
    dailyBtn.classList.add("active");
    customBtn?.classList.remove("active");
    document.getElementById("habit-edit-days")?.classList.remove("shown");
  });
  customBtn?.addEventListener("click", () => {
    customBtn.classList.add("active");
    dailyBtn?.classList.remove("active");
    document.getElementById("habit-edit-days")?.classList.add("shown");
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (editingHabitId == null) return;
    const name = document.getElementById("habit-edit-name").value;
    const frequency = customBtn?.classList.contains("active") ? "custom" : "daily";
    const ok = editHabit(editingHabitId, { name, frequency, activeDays: editSelectedDays });
    if (ok) closeHabitEditModal();
  });
}