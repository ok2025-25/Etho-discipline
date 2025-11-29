// === Tracker.js: Momentum & Streak Logic ===

// --------- DOM Elements (Declared globally, assigned later) ---------
let doughnutChartInstance; // Store the chart instance
let dashboardPct; // The text element
let dashboardLegend; // The legend list
let habitsList;
let addBtn;
let addInput;
let clearBtn;
let quoteElem;
let chartCanvas;

// Stats Elements
let statStreak;
let statToday;
let statTotal;

// --------- Constants ---------
const LS_KEY = "prod_momentum_data"; 
const MAX_HISTORY_DOTS = 5; 

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

// --------- Initialization ---------
document.addEventListener("DOMContentLoaded", () => {
  // 1. Assign DOM elements now that HTML is ready
  habitsList = document.getElementById("habits-list");
  addBtn = document.getElementById("add-habit-btn");
  addInput = document.getElementById("new-habit-input");
  clearBtn = document.getElementById("clear-data-btn");
  quoteElem = document.getElementById("motivational-quote");
  chartCanvas = document.getElementById("progress-chart");
  
  statStreak = document.getElementById("stat-streak");
  statToday = document.getElementById("stat-today");
  statTotal = document.getElementById("stat-total");
  document.addEventListener("DOMContentLoaded", () => {
  // ... existing selectors ...
  habitsList = document.getElementById("habits-list");
  // ... existing ...
  
  // NEW SELECTORS
  dashboardPct = document.getElementById("dashboard-percentage");
  dashboardLegend = document.getElementById("dashboard-legend-list");
  
  setupEventListeners();
  loadState();
  setupSidebar();
  renderUI(); // This will now call our new chart function
  renderQuote();
});

  // 2. Initialize App
  setupEventListeners(); // Attach clicks now
  loadState();
  setupSidebar();
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
}

// --------- Date Utilities ---------
const getTodayDate = () => new Date().toISOString().split('T')[0];

function getPastDates(days) {
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

// --------- Storage & Logic ---------
function loadState() {
  const raw = localStorage.getItem(LS_KEY);
  if (raw) {
    state = JSON.parse(raw);
  } else {
    state.habits = [
      { id: 1, name: "Drink 2L Water", history: {} },
      { id: 2, name: "Read 10 Pages", history: {} }
    ];
    saveState();
  }
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
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

  state.habits.push({
    id: Date.now(),
    name: name,
    history: {}
  });

  addInput.value = "";
  saveState();
  renderUI();
}

function deleteHabit(id) {
  if(confirm("Delete this habit and its history?")) {
    state.habits = state.habits.filter(h => h.id !== id);
    saveState();
    renderUI();
  }
}

function resetData() {
  if(confirm("Are you sure? This will wipe all habits and stats.")) {
    localStorage.removeItem(LS_KEY);
    location.reload();
  }
}

// --------- Statistics Logic ---------
function calculateStats() {
  const today = getTodayDate();
  const habits = state.habits;
  
  if(habits.length === 0) return { streak: 0, todayPct: 0, totalChecks: 0 };

  // 1. Today's Completion
  const doneToday = habits.filter(h => h.history[today]).length;
  const todayPct = Math.round((doneToday / habits.length) * 100);

  // 2. Total Check-ins
  let totalChecks = 0;
  habits.forEach(h => totalChecks += Object.keys(h.history).length);

  // 3. Streak Calculation
  let streak = 0;
  let d = new Date();
  
  while (true) {
    const dateStr = d.toISOString().split('T')[0];
    const anyDone = habits.some(h => h.history[dateStr]);
    
    if (dateStr === today) {
       if (anyDone) streak++; 
    } else {
       if (anyDone) streak++;
       else break;
    }
    d.setDate(d.getDate() - 1);
  }

  return { streak, todayPct, totalChecks };
}

function updateStats() {
  const stats = calculateStats();
  
  // Safety check if elements exist
  if(statStreak) statStreak.textContent = stats.streak;
  if(statToday) statToday.textContent = stats.todayPct + "%";
  if(statTotal) statTotal.textContent = stats.totalChecks;
}

// --------- Rendering ---------
function renderUI() {
  renderHabitList();
  renderChart();
  updateStats();
}

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
    
    const li = document.createElement("li");
    li.className = `checklist-task-item ${isDoneToday ? 'completed' : ''}`;
    
    // Checkbox
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "checklist-task-checkbox";
    checkbox.checked = isDoneToday;
    checkbox.onclick = () => toggleHabit(habit.id);

    // Label
    const label = document.createElement("span");
    label.className = "checklist-task-label";
    label.textContent = habit.name;

    // History Dots
    const dotsContainer = document.createElement("div");
    dotsContainer.className = "habit-history";
    dotsContainer.title = "Last 5 days activity";
    
    pastDays.forEach(date => {
        const dot = document.createElement("div");
        dot.className = `history-dot ${habit.history[date] ? 'done' : ''} ${date === today ? 'today' : ''}`;
        dotsContainer.appendChild(dot);
    });

    // Delete Button
    const delBtn = document.createElement("button");
    delBtn.className = "checklist-action-btn";
    delBtn.innerHTML = '<i class="fa-solid fa-times"></i>';
    delBtn.onclick = () => deleteHabit(habit.id);

    li.append(checkbox, label, dotsContainer, delBtn);
    habitsList.appendChild(li);
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

// --------- Extras ---------
function renderQuote() {
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  if(quoteElem) quoteElem.textContent = `"${q}"`;
}

function setupSidebar() {
  const burger = document.getElementById("sidebar-burger");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");

  if (!burger || !sidebar || !overlay) return;

  function toggleMenu() {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("active");
    burger.classList.toggle("active");
  }

  burger.addEventListener("click", toggleMenu);
  overlay.addEventListener("click", toggleMenu);
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
  renderChart(); // Your existing bar chart
  renderDoughnut(); // <--- ADD THIS LINE
  updateStats();
}