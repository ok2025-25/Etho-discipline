// ----- GOALS.JS: Logic for SMART Goals Dashboard (v3 — visual redesign) -----
// Not wrapped in an IIFE on purpose: goal-reminders.js hooks into the
// global `allGoals`, `saveGoals`, and `renderGoals` the same way
// reminders.js hooks into checklist.js.
let selectedTemplate = null;
// ====== STATE & STORAGE ======
const LS_KEY = "productivity_goals_v2";
const LS_PLANS = "productivity_goal_plans_v2";

// Small fixed emoji set for the icon picker — deliberately short so
// choosing one is a single tap, not a search.
const GOAL_ICONS = ["🎯", "📚", "💪", "💰", "🎨", "🧘", "🚀", "🌱", "🎓", "🏃", "✈️", "🎵"];

// Every goal gets a palette index (0-3) derived from its id, cycling
// through the theme's 4 accent variables so cards stay colorful without
// storing a hardcoded hex per goal (keeps light/dark theming automatic).
function paletteIndex(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % 4;
}

const goalTemplates = [
  { icon: "🎓", title: "Complete 3 Certifications", type: "numeric", targetNumber: 3, meta: "Career · 3 items",
    desc: "Earn professional credentials to boost career.",
    steps: ["Choose the 3 certifications", "Finish the first certification", "Finish the second certification", "Finish the third certification", "Add certificates to portfolio / CV"] },
  { icon: "📖", title: "Publish a Book", type: "descriptive", meta: "Creative · 5 steps",
    desc: "Create my first book to share my story.",
    steps: ["Choose the topic", "Create the outline", "Write the first draft", "Edit the manuscript", "Publish the book"] },
  { icon: "🚀", title: "Launch 2 Side Projects", type: "numeric", targetNumber: 2, meta: "Career · 2 items",
    desc: "Ship two completed products or websites.",
    steps: ["Choose the project ideas", "Build MVP for project 1", "Launch project 1", "Build MVP for project 2", "Launch project 2"] },
  { icon: "🏃", title: "Run a Marathon", type: "descriptive", meta: "Health · 5 steps",
    desc: "Train for and complete a full 42.2km marathon.",
    steps: ["Select a marathon race and register", "Get a 16-week training plan", "Consistently hit weekly running targets", "Complete a 30km long practice run", "Cross the marathon finish line"] },
  { icon: "💰", title: "Save $5,000 Emergency Fund", type: "numeric", targetNumber: 5000, meta: "Finance · $5,000",
    desc: "Build a financial safety net for peace of mind.",
    steps: ["Set up a dedicated high-yield savings account", "Set a monthly savings target", "Automate monthly transfers", "Track savings progress regularly", "Reach $2,000", "Reach the $5,000 goal"] },
  { icon: "🎙️", title: "Launch 10 Podcast Episodes", type: "numeric", targetNumber: 10, meta: "Creative · 10 items",
    desc: "Start a podcast to share insights and build an audience.",
    steps: ["Define podcast concept and set up equipment", "Outline topics and outline first 5 episodes", "Record and edit the trailer and Episode 1", "Publish on main platforms (Spotify, Apple)",
      "Record and release episode 1", "Record and release episode 2", "Record and release episode 3", "Record and release episode 4", "Record and release episode 5",
      "Record and release episode 6", "Record and release episode 7", "Record and release episode 8", "Record and release episode 9", "Record and release episode 10"] },
  { icon: "🧘", title: "Meditate 100 Days", type: "numeric", targetNumber: 100, meta: "Health · 100 days",
    desc: "Build a lasting mindfulness habit, one day at a time.",
    steps: ["Pick a daily time slot", "Complete the first 7 days", "Reach a 30-day streak", "Reach a 60-day streak", "Reach the 100-day goal"] },
  { icon: "🌱", title: "Read 20 Books", type: "numeric", targetNumber: 20, meta: "Personal · 20 items",
    desc: "Grow your knowledge one book at a time.",
    steps: ["Build a reading list", "Finish the first 5 books", "Reach the halfway point (10 books)", "Finish 15 books", "Reach 20 books"] },
  // Account-exclusive templates — visible to everyone, locked for guests.
  { icon: "🏔️", title: "Career Pivot Roadmap", type: "descriptive", meta: "Career · 6 steps", locked: true,
    desc: "Plan and execute a full transition into a new field.",
    steps: ["Research target roles & required skills", "Close the biggest skill gap", "Rebuild resume & portfolio", "Network with 10 people in the field", "Land interviews", "Accept a new offer"] },
  { icon: "🏡", title: "Buy a Home", type: "numeric", targetNumber: 100, meta: "Finance · milestones", locked: true,
    desc: "Track the full journey from saving to closing.",
    steps: ["Set target down payment", "Get pre-approved", "Shop for homes", "Make an offer", "Complete inspection", "Close on the home"] }
];

let allGoals = [];
let plansCache = {};
let plannerGoalId = null;
let quickCreateType = "numeric"; // pill toggle state for the create/edit modal
let selectedIcon = GOAL_ICONS[0];

// ====== DOM ELEMENTS ======
const burgerMenu = document.getElementById('burger-menu');
const sidebar = document.getElementById('sidebar');
const sidebarOverlayEl = document.getElementById('overlay');
const summaryTotal = document.getElementById('goals-total');
const summaryCompleted = document.getElementById('goals-completed');
const summaryRemaining = document.getElementById('goals-remaining');
const overallProgressBar = document.getElementById('overall-progress-bar');
const overallProgressPercent = document.getElementById('overall-progress-percent');
const goalsList = document.getElementById('goals-list');
const emptyState = document.getElementById('empty-state');
const addGoalBtn = document.getElementById('add-goal-btn');
const modal = document.getElementById('goals-modal');
const modalTitle = document.getElementById('modal-title');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const goalForm = document.getElementById('goal-form');
const goalTitleField = document.getElementById('goal-title');
const goalTypePillNumeric = document.getElementById('goal-type-pill-numeric');
const goalTypePillMilestone = document.getElementById('goal-type-pill-milestone');
const targetNumberGroup = document.getElementById('target-number-group');
const goalTargetNumberField = document.getElementById('goal-target-number');
const currentProgressGroup = document.getElementById('current-progress-group');
const goalCurrentProgressField = document.getElementById('goal-current-progress');
const goalDescField = document.getElementById('goal-desc');
const goalDeadlineField = document.getElementById('goal-deadline');
const goalIconPicker = document.getElementById('goal-icon-picker');
const goalDeadlineChips = document.getElementById('goal-deadline-chips');
const moreDetailsToggle = document.getElementById('goal-more-details-toggle');
const moreDetailsPanel = document.getElementById('goal-more-details-panel');
const templatesList = document.getElementById('goal-templates-list');
const plannerSection = document.getElementById('goals-planner-section');
const plannerGoalTitle = document.getElementById('planner-goal-title');
const plannerStepsList = document.getElementById('planner-steps-list');
const plannerInput = document.getElementById('planner-step-input');
const plannerStepValueInput = document.getElementById('planner-step-value');
const plannerNumericHint = document.getElementById('planner-numeric-hint');
const plannerAddBtn = document.getElementById('planner-add-step-btn');
const closePlannerBtn = document.getElementById('close-planner-btn');

// ====== SIDEBAR TOGGLE ======
burgerMenu.addEventListener('click', () => {
    burgerMenu.classList.toggle('active');
    sidebar.classList.toggle('open');
    sidebarOverlayEl?.classList.toggle('active', sidebar.classList.contains('open'));
});
sidebarOverlayEl?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    burgerMenu.classList.remove('active');
    sidebarOverlayEl.classList.remove('active');
});

// ====== SMALL UTILITIES ======
function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function isSignedInUser() {
    return document.documentElement.getAttribute('data-plan') === 'account';
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
}

// Days between the start of today and a goal's deadline (local dates,
// time-of-day ignored). Returns null when there's no deadline.
function daysUntilDeadline(goal) {
    if (!goal || !goal.deadline) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(goal.deadline + "T00:00:00");
    if (isNaN(due.getTime())) return null;
    return Math.round((due.getTime() - today.getTime()) / 86400000);
}

// Returns { cls, label } describing deadline urgency for the chip + ring color.
function deadlineUrgency(goal) {
    if (goal.completed) return { cls: 'dl-done', label: 'Completed', icon: 'fa-check' };
    const d = daysUntilDeadline(goal);
    if (d === null) return { cls: 'dl-ok', label: 'No deadline', icon: 'fa-infinity' };
    if (d < 0) return { cls: 'dl-overdue', label: `Overdue ${Math.abs(d)}d`, icon: 'fa-triangle-exclamation' };
    if (d === 0) return { cls: 'dl-urgent', label: 'Due today', icon: 'fa-bolt' };
    if (d <= 3) return { cls: 'dl-urgent', label: `Due in ${d}d`, icon: 'fa-clock' };
    if (d <= 14) return { cls: 'dl-soon', label: `Due in ${d}d`, icon: 'fa-clock' };
    return { cls: 'dl-ok', label: new Date(goal.deadline + "T00:00:00").toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), icon: 'fa-calendar' };
}

// A tiny self-contained toast for informational messages (e.g. locked account
// templates) — independent from the deadline-reminder popups in
// goal-reminders.js so this file has no hard dependency on that one.
function flashMessage(text, icon = 'fa-circle-info') {
    const el = document.createElement('div');
    el.className = 'goal-reminder-popup soon';
    el.style.position = 'fixed';
    el.style.bottom = '1.25rem';
    el.style.top = 'auto';
    el.style.right = '1.25rem';
    el.innerHTML = `
      <div class="goal-reminder-popup-icon"><i class="fa-solid ${icon}"></i></div>
      <div style="flex:1;"><div class="goal-reminder-popup-text">${escapeHTML(text)}</div></div>
      <button type="button" class="goal-reminder-popup-close" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    const remove = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 350); };
    el.querySelector('.goal-reminder-popup-close').addEventListener('click', remove);
    setTimeout(remove, 3500);
}

// ====== GOALS CRUD ======
async function loadGoals() {
    allGoals = await cloudGet(LS_KEY, []);
}

function saveGoals() {
    cloudSet(LS_KEY, allGoals);
}

function updateDashboardSummary() {
    const total = allGoals.length;
    const completed = allGoals.filter(g => g.completed).length;
    const remaining = total - completed;

    summaryTotal.textContent = total;
    summaryCompleted.textContent = completed;
    summaryRemaining.textContent = remaining;

    // Overall progress
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    overallProgressBar.style.width = `${progress}%`;
    overallProgressPercent.textContent = `${progress}%`;

    const overdueEl = document.getElementById('goals-overdue-count');
    if (overdueEl) {
        const overdue = allGoals.filter(g => !g.completed && daysUntilDeadline(g) !== null && daysUntilDeadline(g) < 0).length;
        overdueEl.textContent = overdue;
    }

    renderAccountCharts();
}

// ====== ACCOUNT INSIGHTS (donuts + upcoming-deadlines list, account-only) ======
// Guests now see this section too — a real sample teaser (fixed demo
// numbers, not their own data) rather than the section vanishing outright.
// The [data-account-feature] class handles the grayscale/lock-badge/upgrade-modal
// treatment automatically; this just decides what content sits under it.
let completionChart = null;
let typeChart = null;

// Fixed sample donuts shown to free users as a teaser — same visual as the
// real account charts, but with clearly-demo numbers instead of live data
// (locked behind the account-locked grayscale/badge from applyAccountLocks()).
function renderDemoAccountCharts() {
    if (typeof Chart === 'undefined') return;
    const donutOptions = {
        cutout: '70%',
        plugins: { legend: { position: 'bottom', labels: { color: cssVar('--text-muted'), boxWidth: 10, font: { size: 11 } } } }
    };
    const completionCanvas = document.getElementById('goals-completion-donut');
    if (completionCanvas) {
        if (completionChart) { completionChart.data.datasets[0].data = [5, 3]; completionChart.update(); }
        else {
            completionChart = new Chart(completionCanvas, {
                type: 'doughnut',
                data: { labels: ['Completed', 'In progress'], datasets: [{ data: [5, 3], backgroundColor: [cssVar('--accent'), cssVar('--secondary')], borderWidth: 0 }] },
                options: donutOptions
            });
        }
    }
    const typeCanvas = document.getElementById('goals-type-donut');
    if (typeCanvas) {
        if (typeChart) { typeChart.data.datasets[0].data = [4, 4]; typeChart.update(); }
        else {
            typeChart = new Chart(typeCanvas, {
                type: 'doughnut',
                data: { labels: ['Numeric', 'Milestone'], datasets: [{ data: [4, 4], backgroundColor: [cssVar('--gold'), cssVar('--primary')], borderWidth: 0 }] },
                options: donutOptions
            });
        }
    }
}

function renderAccountCharts() {
    const container = document.getElementById('goals-account-charts');
    if (!container) return;

    container.style.display = 'block';
    const chartsGrid = document.getElementById('goals-account-charts-grid');
    const emptyMsg = document.getElementById('goals-account-charts-empty');

    if (!isSignedInUser()) {
        // Sample teaser: a fixed, clearly-demo split so it reads as "here's
        // what this looks like" rather than a real (and wrong) stat.
        if (chartsGrid) chartsGrid.style.display = 'grid';
        if (emptyMsg) emptyMsg.style.display = 'none';
        renderDemoAccountCharts();
        renderUpcomingDeadlinesList(true);
        return;
    }

    const total = allGoals.length;

    if (total === 0) {
        if (chartsGrid) chartsGrid.style.display = 'none';
        if (emptyMsg) emptyMsg.style.display = 'block';
        renderUpcomingDeadlinesList();
        return;
    }
    if (chartsGrid) chartsGrid.style.display = 'grid';
    if (emptyMsg) emptyMsg.style.display = 'none';

    if (typeof Chart !== 'undefined') {
        const completed = allGoals.filter(g => g.completed).length;
        const remaining = total - completed;
        const numericCount = allGoals.filter(g => g.type === 'numeric').length;
        const descriptiveCount = total - numericCount;

        const donutOptions = {
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: cssVar('--text-muted'), boxWidth: 10, font: { size: 11 } }
                }
            }
        };

        if (completionChart) {
            completionChart.data.datasets[0].data = [completed, remaining];
            completionChart.data.datasets[0].backgroundColor = [cssVar('--accent'), cssVar('--secondary')];
            completionChart.update();
        } else {
            const completionCanvas = document.getElementById('goals-completion-donut');
            if (completionCanvas) {
                completionChart = new Chart(completionCanvas, {
                    type: 'doughnut',
                    data: { labels: ['Completed', 'In progress'], datasets: [{ data: [completed, remaining], backgroundColor: [cssVar('--accent'), cssVar('--secondary')], borderWidth: 0 }] },
                    options: donutOptions
                });
            }
        }

        if (typeChart) {
            typeChart.data.datasets[0].data = [numericCount, descriptiveCount];
            typeChart.data.datasets[0].backgroundColor = [cssVar('--primary'), cssVar('--gold')];
            typeChart.update();
        } else {
            const typeCanvas = document.getElementById('goals-type-donut');
            if (typeCanvas) {
                typeChart = new Chart(typeCanvas, {
                    type: 'doughnut',
                    data: { labels: ['Numeric', 'Milestone-based'], datasets: [{ data: [numericCount, descriptiveCount], backgroundColor: [cssVar('--primary'), cssVar('--gold')], borderWidth: 0 }] },
                    options: donutOptions
                });
            }
        }
    }

    renderUpcomingDeadlinesList();
}

// Small text list of the soonest active deadlines — the kind of glanceable
// insight a chart can't show as clearly (which goals specifically, and how
// soon). Kept to the top 4 so it never dwarfs the donuts above it.
function renderUpcomingDeadlinesList(demo = false) {
    const list = document.getElementById('goals-account-upcoming-list');
    if (!list) return;

    if (demo) {
        list.innerHTML = [
            { icon: '📚', title: 'Finish course module 3', label: '2d left', color: '#f87171' },
            { icon: '💰', title: 'Save $500 this month', label: '9d left', color: 'var(--gold-text)' },
        ].map(d => `<div class="goal-account-list-item"><span>${d.icon} ${escapeHTML(d.title)}</span><span style="color:${d.color}; font-weight:700; flex-shrink:0;">${d.label}</span></div>`).join('');
        return;
    }

    const upcoming = allGoals
        .filter(g => !g.completed && g.deadline)
        .map(g => ({ g, d: daysUntilDeadline(g) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 4);

    if (upcoming.length === 0) {
        list.innerHTML = `<p style="text-align:center; color: var(--text-dim); font-size: 0.8rem; margin: 0.5rem 0 0;">No upcoming deadlines.</p>`;
        return;
    }
    list.innerHTML = upcoming.map(({ g, d }) => {
        const urgency = deadlineUrgency(g);
        const label = d < 0 ? `${Math.abs(d)}d overdue` : d === 0 ? 'Today' : `${d}d left`;
        const color = urgency.cls === 'dl-overdue' || urgency.cls === 'dl-urgent' ? '#f87171' : 'var(--gold-text)';
        return `<div class="goal-account-list-item"><span>${g.icon || '🎯'} ${escapeHTML(g.title)}</span><span style="color:${color}; font-weight:700; flex-shrink:0;">${label}</span></div>`;
    }).join('');
}

// account-base.js resolves isSignedIn() and sets data-plan="account"
// asynchronously, independently of this file's own init sequence below —
// so the very first renderAccountCharts() call can run before that
// attribute lands. Re-run once it actually changes so a freshly signed-in
// user doesn't need a refresh.
new MutationObserver(renderAccountCharts)
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-plan'] });

// ====== MODAL (Add / Edit) — simplified, visual quick-create ======
let modalMode = "add";
let editingGoalId = null;

function setQuickType(type) {
    quickCreateType = type;
    const isNumericType = type === "numeric";
    goalTypePillNumeric.classList.toggle('active', isNumericType);
    goalTypePillMilestone.classList.toggle('active', !isNumericType);
    targetNumberGroup.style.display = isNumericType ? "block" : "none";
    currentProgressGroup.style.display = isNumericType ? "block" : "none";
    const targetError = document.getElementById('goal-target-error');
    if (targetError) targetError.style.display = 'none';
    goalTargetNumberField.style.borderColor = 'var(--glass-border)';
}

function renderIconPicker() {
    goalIconPicker.innerHTML = GOAL_ICONS.map(icon =>
        `<button type="button" class="goal-icon-option${icon === selectedIcon ? ' active' : ''}" data-icon="${icon}">${icon}</button>`
    ).join('');
    goalIconPicker.querySelectorAll('.goal-icon-option').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedIcon = btn.dataset.icon;
            goalIconPicker.querySelectorAll('.goal-icon-option').forEach(b => b.classList.toggle('active', b === btn));
        });
    });
}

function deadlineChipDate(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
}

function renderDeadlineChips() {
    const presets = [
        { label: '1 week', days: 7 },
        { label: '1 month', days: 30 },
        { label: '3 months', days: 90 },
        { label: '1 year', days: 365 },
        { label: 'No deadline', days: null }
    ];
    goalDeadlineChips.innerHTML = presets.map(p =>
        `<button type="button" class="goal-deadline-chip-btn" data-days="${p.days ?? ''}">${p.label}</button>`
    ).join('');
    goalDeadlineChips.querySelectorAll('.goal-deadline-chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            goalDeadlineChips.querySelectorAll('.goal-deadline-chip-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            goalDeadlineField.value = btn.dataset.days === '' ? '' : deadlineChipDate(Number(btn.dataset.days));
        });
    });
}

function openGoalModal(mode, goal = null) {
    modalMode = mode;
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    goalForm.reset();
    moreDetailsPanel.classList.remove('open');
    moreDetailsToggle.classList.remove('open');
    renderIconPicker();
    renderDeadlineChips();

    // Reset any previous error states
    const titleError = document.getElementById('goal-title-error');
    const targetError = document.getElementById('goal-target-error');
    if (titleError) titleError.style.display = 'none';
    if (targetError) targetError.style.display = 'none';
    goalTitleField.style.borderColor = 'var(--glass-border)';
    goalTargetNumberField.style.borderColor = 'var(--glass-border)';
    goalCurrentProgressField.style.borderColor = 'var(--glass-border)';

    if (mode === "add") {
        modalTitle.innerHTML = '<i class="fa-solid fa-bullseye"></i> New Goal';
        editingGoalId = null;
        selectedIcon = GOAL_ICONS[Math.floor(Math.random() * GOAL_ICONS.length)];
        renderIconPicker();
        setQuickType("numeric");
    } else {
        modalTitle.innerHTML = '<i class="fa-solid fa-pen"></i> Edit Goal';
        editingGoalId = goal.id;
        goalTitleField.value = goal.title || "";
        selectedIcon = goal.icon || GOAL_ICONS[0];
        renderIconPicker();
        setQuickType(goal.type || "numeric");
        if (goal.type === "numeric") {
            goalTargetNumberField.value = goal.targetNumber || "";
            goalCurrentProgressField.value = goal.progress || 0;
        }
        goalDeadlineField.value = goal.deadline || "";
        goalDescField.value = goal.desc || "";
        if (goal.desc) { moreDetailsPanel.classList.add('open'); moreDetailsToggle.classList.add('open'); }
    }
    goalTitleField.focus();
}

function closeGoalModal() {
    modal.style.display = "none";
    document.body.style.overflow = "";
    editingGoalId = null;
    selectedTemplate = null;
}

goalTypePillNumeric.addEventListener('click', () => setQuickType('numeric'));
goalTypePillMilestone.addEventListener('click', () => setQuickType('descriptive'));

moreDetailsToggle.addEventListener('click', () => {
    moreDetailsToggle.classList.toggle('open');
    moreDetailsPanel.classList.toggle('open');
});

// Clear errors on input
goalTitleField.addEventListener('input', () => {
    const err = document.getElementById('goal-title-error');
    if (err) err.style.display = 'none';
    goalTitleField.style.borderColor = 'var(--glass-border)';
});

goalTargetNumberField.addEventListener('input', () => {
    const err = document.getElementById('goal-target-error');
    if (err) err.style.display = 'none';
    goalTargetNumberField.style.borderColor = 'var(--glass-border)';
});

// Cancel
modalCancelBtn.addEventListener('click', closeGoalModal);

// Add btn
addGoalBtn.addEventListener('click', () => { selectedTemplate = null; openGoalModal('add'); });
document.getElementById('empty-state-add-goal-btn')?.addEventListener('click', () => { selectedTemplate = null; openGoalModal('add'); });

// Form submit
goalForm.addEventListener('submit', e => {
    e.preventDefault();
    const title = goalTitleField.value.trim();
    const type = quickCreateType;
    const rawTarget = goalTargetNumberField.value.trim();
    const targetNumber = type === "numeric" ? Number(rawTarget) : undefined;
    const rawCurrentProgress = goalCurrentProgressField.value.trim();
    const desc = goalDescField.value.trim();
    const deadline = goalDeadlineField.value || "";
    const icon = selectedIcon;

    // Error elements
    const titleError = document.getElementById('goal-title-error');
    const targetError = document.getElementById('goal-target-error');

    // Reset errors
    titleError.style.display = 'none';
    goalTitleField.style.borderColor = 'var(--glass-border)';
    targetError.style.display = 'none';
    goalTargetNumberField.style.borderColor = 'var(--glass-border)';

    let hasError = false;

    if (!title) {
        titleError.style.display = 'block';
        goalTitleField.style.borderColor = '#f87171';
        goalTitleField.focus();
        hasError = true;
    }

    if (type === "numeric" && (rawTarget === "" || isNaN(targetNumber) || targetNumber < 1)) {
        targetError.style.display = 'block';
        goalTargetNumberField.style.borderColor = '#f87171';
        if (!hasError) goalTargetNumberField.focus();
        hasError = true;
    }

    if (hasError) return;

    // Where the user says they currently are, clamped to a sane [0, target] range.
    // Blank means "just starting", i.e. 0.
    let currentProgress = 0;
    if (type === "numeric") {
        currentProgress = rawCurrentProgress === "" ? 0 : Number(rawCurrentProgress);
        if (isNaN(currentProgress) || currentProgress < 0) currentProgress = 0;
        if (currentProgress > targetNumber) currentProgress = targetNumber;
    }
    const isNowComplete = type === "numeric" && currentProgress >= targetNumber;

    if (modalMode === "add") {
        const id = Date.now().toString(36) + Math.floor(Math.random() * 90000);
        allGoals.push({
            id, title, type, targetNumber, desc, deadline, icon,
            progress: currentProgress,
            completed: isNowComplete,
            milestones: [],
            createdAt: new Date().toISOString()
        });
        if (selectedTemplate?.steps?.length) {
            const plans = getPlans();
            plans[id] = selectedTemplate.steps.map(step => ({ text: step, done: false }));
            savePlans(plans);
        }
        selectedTemplate = null;
    } else if (modalMode === "edit" && editingGoalId) {
        allGoals = allGoals.map(g => g.id === editingGoalId ? {
            ...g, title, type, targetNumber, desc, deadline, icon,
            progress: type === "numeric" ? currentProgress : g.progress,
            completed: type === "numeric" ? isNowComplete : g.completed
        } : g);
    }

    saveGoals();
    renderGoals();
    updateDashboardSummary();
    closeGoalModal();
});

// ====== TEMPLATES (visual scroller gallery) ======
function renderGoalTemplates() {
    templatesList.innerHTML = '';
    const signedInUser = isSignedInUser();
    goalTemplates.forEach((tpl) => {
        const locked = !!tpl.locked && !signedInUser;
        const card = document.createElement('div');
        card.className = `goal-template-card goal-swatch-${Math.floor(Math.random() * 4)}${locked ? ' is-locked' : ''}`;
        card.innerHTML = `
            <div class="goal-template-icon">${tpl.icon}</div>
            <div class="goal-template-title">${escapeHTML(tpl.title)}</div>
            <div class="goal-template-meta"><i class="fa-solid ${tpl.type === 'numeric' ? 'fa-hashtag' : 'fa-list-check'}"></i> ${escapeHTML(tpl.meta || '')}</div>
            ${tpl.locked ? '<div class="goal-template-locked"><i class="fa-solid fa-crown"></i> Sign in to unlock</div>' : ''}
        `;
        card.onclick = () => {
            if (locked) { flashMessage('Sign in to unlock this template.', 'fa-crown'); return; }
            selectedTemplate = tpl;
            openGoalModal('add');
            goalTitleField.value = tpl.title;
            selectedIcon = tpl.icon;
            renderIconPicker();
            setQuickType(tpl.type);
            if (tpl.type === "numeric") goalTargetNumberField.value = tpl.targetNumber;
            goalDescField.value = tpl.desc || "";
            if (tpl.desc) { moreDetailsPanel.classList.add('open'); moreDetailsToggle.classList.add('open'); }
        };
        templatesList.append(card);
    });
}

// ====== CELEBRATION BURST ======
function celebrate(card) {
    card.classList.add('just-completed');
    const colors = [cssVar('--primary'), cssVar('--accent'), cssVar('--gold'), cssVar('--secondary')];
    for (let i = 0; i < 10; i++) {
        const p = document.createElement('span');
        p.className = 'goal-burst-particle';
        const angle = (Math.PI * 2 * i) / 10;
        const dist = 46 + Math.random() * 24;
        p.style.setProperty('--gx', `${Math.cos(angle) * dist}px`);
        p.style.setProperty('--gy', `${Math.sin(angle) * dist}px`);
        p.style.background = colors[i % colors.length];
        card.appendChild(p);
        setTimeout(() => p.remove(), 750);
    }
    setTimeout(() => card.classList.remove('just-completed'), 550);
}

// ====== RENDER GOALS (visual cards: rings, minimal text, quick-step) ======
function renderGoals() {
    goalsList.innerHTML = '';
    goalsList.classList.add('goals-grid-v2');

    if (allGoals.length === 0) {
        emptyState.style.display = 'block';
        goalsList.style.display = 'none';
        updateDashboardSummary();
        return;
    }

    emptyState.style.display = 'none';
    goalsList.style.display = 'grid';

    // Count upcoming agenda events linked to each goal (spec §7's
    // Goal → Schedule relationship) — read-only reference into
    // agendaEvents, no separate schedule data model for Goals.
    cloudGet("agendaEvents", {}).then(agendaEvents => {
        const todayIso = new Date().toISOString().slice(0, 10);
        const counts = {};
        Object.entries(agendaEvents).forEach(([iso, events]) => {
            if (iso < todayIso) return; // only count upcoming, not past, events
            events.forEach(ev => { if (ev.goalId) counts[ev.goalId] = (counts[ev.goalId] || 0) + 1; });
        });
        Object.entries(counts).forEach(([goalId, count]) => {
            const badge = document.querySelector(`.goal-card-schedule-badge[data-goal-id="${goalId}"]`);
            if (badge) {
                badge.innerHTML = `<i class="fa-solid fa-calendar-days"></i> ${count} scheduled`;
                badge.style.display = "flex";
                badge.style.alignItems = "center";
                badge.style.gap = "4px";
                badge.style.cursor = "pointer";
                badge.title = "Open Agenda";
                badge.addEventListener("click", (e) => { e.stopPropagation(); window.location.href = "agenda.html"; });
            }
        });
    });

    allGoals.forEach((goal, idx) => {
        const swatch = paletteIndex(goal.id);
        const card = document.createElement('div');
        card.className = `card goal-card-v2 goal-swatch-${swatch}`;
        card.style.animationDelay = `${Math.min(idx, 8) * 0.05}s`;
        card.dataset.goalId = goal.id;

        const urgency = deadlineUrgency(goal);
        const icon = goal.icon || '🎯';

        // ---- progress percent (numeric vs milestone) ----
        let percent = 0, fractionHTML = '';
        const plans = getPlans();
        if (goal.type === 'numeric') {
            percent = goal.targetNumber > 0 ? Math.round(100 * Math.min(1, (goal.progress || 0) / goal.targetNumber)) : 0;
            fractionHTML = `<span class="goal-card-fraction"><b>${goal.progress || 0}</b> / ${goal.targetNumber}</span>`;
        } else {
            const steps = plans[goal.id] || [];
            const done = steps.filter(s => s.done).length;
            percent = steps.length > 0 ? Math.round((done / steps.length) * 100) : 0;
            fractionHTML = `<span class="goal-card-fraction"><b>${done}</b> / ${steps.length || 0} steps</span>`;
        }

        const circumference = 2 * Math.PI * 34; // r=34
        const offset = circumference - (circumference * percent) / 100;

        card.innerHTML = `
            <div class="goal-card-top">
                <div class="goal-card-icon">${icon}</div>
                <div class="goal-card-title-wrap">
                    <div class="goal-card-title" title="${escapeHTML(goal.title)}">${escapeHTML(goal.title)}</div>
                    <span class="goal-deadline-chip ${urgency.cls}"><i class="fa-solid ${urgency.icon}"></i> ${urgency.label}</span>
                </div>
            </div>
            <div class="goal-card-body">
                <div class="goal-ring-wrap">
                    <svg viewBox="0 0 84 84">
                        <circle class="goal-ring-track" cx="42" cy="42" r="34"></circle>
                        <circle class="goal-ring-fill" cx="42" cy="42" r="34"
                            stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}"></circle>
                    </svg>
                    <div class="goal-ring-label">${percent}%</div>
                </div>
                <div class="goal-card-numbers">
                    ${fractionHTML}
                    <span class="goal-card-schedule-badge" data-goal-id="${goal.id}" style="display:none; font-size:0.75rem; color:var(--text-dim); margin-top:0.3rem;"><i class="fa-solid fa-calendar-days"></i> </span>
                    ${goal.type === 'numeric' && !goal.completed ? `
                        <div class="goal-quickstep">
                            <button type="button" class="goal-quickstep-btn qs-minus" title="Subtract 1"><i class="fa-solid fa-minus"></i></button>
                            <input type="number" class="goal-quickstep-input" value="${goal.progress || 0}" min="0" max="${goal.targetNumber}">
                            <button type="button" class="goal-quickstep-btn qs-plus" title="Add 1"><i class="fa-solid fa-plus"></i></button>
                        </div>` : ''}
                </div>
            </div>
            <div class="goal-card-actions" style="display:flex; gap:0.4rem; margin-top:0.85rem; padding-top:0.75rem; border-top:1px solid var(--glass-border);">
                <button class="checklist-action-btn plan-btn" style="flex:1;" title="Action plan"><i class="fa-solid fa-clipboard-list"></i></button>
                <button class="checklist-action-btn edit-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>
                ${!goal.completed ? `<button class="checklist-action-btn complete-btn" style="color: var(--accent);" title="Mark complete"><i class="fa-solid fa-check"></i></button>` : ''}
                <button class="checklist-action-btn delete-btn" style="color: var(--secondary);" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;

        goalsList.appendChild(card);

        // Animate the ring in on next frame (so the transition actually plays).
        requestAnimationFrame(() => {
            const fillCircle = card.querySelector('.goal-ring-fill');
            if (fillCircle) fillCircle.style.strokeDashoffset = String(offset);
        });

        // ---- handlers ----
        card.querySelector('.plan-btn').onclick = () => openPlanner(goal.id);
        card.querySelector('.edit-btn').onclick = () => openGoalModal('edit', goal);
        card.querySelector('.delete-btn').onclick = async () => {
            const ok = await customConfirm(`Delete "${goal.title}"?`, { danger: true, confirmText: "Delete" });
            if (ok) {
                allGoals = allGoals.filter(g => g.id !== goal.id);
                saveGoals();
                renderGoals();
                updateDashboardSummary();
            }
        };

        const completeBtn = card.querySelector('.complete-btn');
        if (completeBtn) {
            completeBtn.onclick = () => {
                goal.completed = true;
                if (goal.type === "numeric") goal.progress = goal.targetNumber;
                saveGoals();
                celebrate(card);
                setTimeout(() => { renderGoals(); updateDashboardSummary(); }, 500);
            };
        }

        if (goal.type === 'numeric' && !goal.completed) {
            const input = card.querySelector('.goal-quickstep-input');
            const applyProgress = (newVal) => {
                newVal = Math.max(0, Math.min(goal.targetNumber, Math.round(newVal)));
                goal.progress = newVal;
                const nowComplete = newVal >= goal.targetNumber;
                if (nowComplete && !goal.completed) {
                    goal.completed = true;
                    saveGoals();
                    celebrate(card);
                    setTimeout(() => { renderGoals(); updateDashboardSummary(); }, 500);
                } else {
                    saveGoals();
                    renderGoals();
                    updateDashboardSummary();
                }
            };
            card.querySelector('.qs-minus').onclick = () => applyProgress((goal.progress || 0) - 1);
            card.querySelector('.qs-plus').onclick = () => applyProgress((goal.progress || 0) + 1);
            input.addEventListener('change', () => applyProgress(Number(input.value)));
            input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); applyProgress(Number(input.value)); } });
        }
    });

    updateDashboardSummary();
    updateGoalsListToggle();
}

// Mobile-only "Show more" for the Goals grid — mirrors the Habit
// Insights / Lesson-view toggle idiom elsewhere in the app. Re-measures
// on every render since the card count (and therefore overflow) changes
// as goals are added/removed/completed.
function updateGoalsListToggle() {
    const toggle = document.getElementById('goals-list-toggle');
    if (!toggle || !goalsList) return;

    goalsList.classList.remove('expanded');
    toggle.classList.remove('expanded', 'show');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.querySelector('.glt-label').textContent = 'Show more';

    if (window.innerWidth > 599 || allGoals.length === 0) {
        goalsList.classList.remove('collapsible');
        return;
    }

    goalsList.classList.add('collapsible');
    requestAnimationFrame(() => {
        if (goalsList.scrollHeight > goalsList.clientHeight + 4) {
            toggle.classList.add('show');
        }
    });
}

document.getElementById('goals-list-toggle')?.addEventListener('click', () => {
    const toggle = document.getElementById('goals-list-toggle');
    const expanded = goalsList.classList.toggle('expanded');
    toggle.classList.toggle('expanded', expanded);
    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    toggle.querySelector('.glt-label').textContent = expanded ? 'Show less' : 'Show more';
    if (!expanded) toggle.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

// ====== PLANNER: STEPS/MILESTONES ======
function getPlans() {
    return plansCache;
}

function savePlans(plans) {
    plansCache = plans;
    cloudSet(LS_PLANS, plansCache);
}

function openPlanner(goalId) {
    plannerGoalId = goalId;
    const goal = allGoals.find(g => g.id === goalId);
    plannerGoalTitle.textContent = goal.title;
    plannerSection.style.display = "flex";
    document.body.style.overflow = "hidden";
    const isNumeric = goal.type === "numeric";
    plannerStepValueInput.style.display = isNumeric ? "block" : "none";
    plannerNumericHint.style.display = isNumeric ? "block" : "none";
    renderPlannerSteps();
}

function closePlanner() {
    plannerGoalId = null;
    plannerSection.style.display = "none";
    document.body.style.overflow = "";
    plannerStepsList.innerHTML = "";
    plannerInput.value = "";
    plannerStepValueInput.value = "";
}

closePlannerBtn.onclick = closePlanner;

function renderPlannerSteps() {
    if (!plannerGoalId) return;
    plannerStepsList.innerHTML = '';

    const goal = allGoals.find(g => g.id === plannerGoalId);
    const isNumeric = !!goal && goal.type === "numeric";

    let plans = getPlans();
    let steps = plans[plannerGoalId] || [];

    if (steps.length === 0) {
        plannerStepsList.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
        <i class="fa-solid fa-clipboard" style="font-size: 2.5rem; opacity: 0.3; margin-bottom: 0.75rem;"></i>
        <p style="font-size: 0.95rem;">No action steps yet. Add your first milestone below!</p>
      </div>
    `;
        if (!isNumeric) updateGoalProgress();
        return;
    }

    steps.forEach((step, idx) => {
        const div = document.createElement('div');
        div.style.cssText = `display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; 
                         background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); 
                         border: 1px solid var(--glass-border); transition: var(--transition);`;

        div.innerHTML = `
      <input type="checkbox" ${step.done ? "checked" : ""} 
             style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--primary);" 
             title="Mark as done">
      <span style="flex: 1; ${step.done ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${idx + 1}. ${escapeHTML(step.text)}</span>
      ${isNumeric ? `
        <input type="number" min="1" class="step-value-input" value="${step.value || 1}" title="Value this step adds to your target"
               style="width: 60px; background: rgba(0, 0, 0, 0.4); border: 1px solid var(--glass-border);
                      color: var(--text-main); padding: 0.4rem; border-radius: var(--radius-sm);
                      font-size: 0.85rem; text-align: center;">
      ` : ''}
      <button class="checklist-action-btn delete-step-btn" style="font-size: 0.9rem; color: var(--text-muted);" title="Remove step">
        <i class="fa-solid fa-times"></i>
      </button>
    `;

        div.querySelector('input[type="checkbox"]').onchange = e => {
            const nowDone = e.target.checked;
            steps[idx].done = nowDone;
            savePlans(plans);

            if (isNumeric) {
                const stepValue = step.value || 1;
                const delta = (nowDone ? 1 : -1) * stepValue;
                goal.progress = Math.max(0, Math.min(goal.targetNumber, (goal.progress || 0) + delta));
                goal.completed = goal.progress >= goal.targetNumber;
                saveGoals();
                renderGoals();
                updateDashboardSummary();
                renderPlannerSteps();
            } else {
                renderPlannerSteps();
                updateGoalProgress();
            }
        };

        if (isNumeric) {
            div.querySelector('.step-value-input').onchange = e => {
                let newValue = Number(e.target.value);
                if (isNaN(newValue) || newValue < 1) newValue = 1;
                const oldValue = step.value || 1;
                steps[idx].value = newValue;
                savePlans(plans);

                if (step.done) {
                    const delta = newValue - oldValue;
                    goal.progress = Math.max(0, Math.min(goal.targetNumber, (goal.progress || 0) + delta));
                    goal.completed = goal.progress >= goal.targetNumber;
                    saveGoals();
                    renderGoals();
                    updateDashboardSummary();
                }
                renderPlannerSteps();
            };
        }

        div.querySelector('.delete-step-btn').onclick = () => {
            const removed = steps[idx];
            steps.splice(idx, 1);
            savePlans(plans);

            if (isNumeric) {
                if (removed.done) {
                    const stepValue = removed.value || 1;
                    goal.progress = Math.max(0, Math.min(goal.targetNumber, (goal.progress || 0) - stepValue));
                    goal.completed = goal.progress >= goal.targetNumber;
                    saveGoals();
                    renderGoals();
                    updateDashboardSummary();
                }
                renderPlannerSteps();
            } else {
                renderPlannerSteps();
                updateGoalProgress();
            }
        };

        plannerStepsList.appendChild(div);
    });

    if (!isNumeric) updateGoalProgress();
}

function updateGoalProgress() {
    let goal = allGoals.find(g => g.id === plannerGoalId);
    if (!goal || goal.type !== "descriptive") return;

    let plans = getPlans();
    let steps = plans[plannerGoalId] || [];

    goal.milestones = steps.map(s => s.text);
    goal.progress = steps.filter(s => s.done).length;
    goal.completed = steps.length > 0 && steps.filter(s => s.done).length === steps.length;

    saveGoals();
    renderGoals();
    updateDashboardSummary();
}

// Add step
plannerAddBtn.onclick = () => {
    const txt = plannerInput.value.trim();
    if (!txt) return;

    const goal = allGoals.find(g => g.id === plannerGoalId);
    const isNumeric = !!goal && goal.type === "numeric";

    const step = { text: txt, done: false };
    if (isNumeric) {
        let value = Number(plannerStepValueInput.value);
        if (isNaN(value) || value < 1) value = 1;
        step.value = value;
    }

    let plans = getPlans();
    if (!plans[plannerGoalId]) plans[plannerGoalId] = [];
    plans[plannerGoalId].push(step);
    savePlans(plans);
    plannerInput.value = "";
    if (isNumeric) plannerStepValueInput.value = "";
    renderPlannerSteps();
};

plannerInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        e.preventDefault();
        plannerAddBtn.click();
    }
});

plannerStepValueInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        e.preventDefault();
        plannerAddBtn.click();
    }
});

// Modal ESC/Click out
window.addEventListener('keydown', e => {
    if (e.key === "Escape") {
        if (modal.style.display === "flex") closeGoalModal();
        if (plannerSection.style.display !== "none") closePlanner();
    }
});

modal.addEventListener('click', (e) => {
    if (e.target === modal) closeGoalModal();
});

plannerSection.addEventListener('click', (e) => {
    if (e.target === plannerSection) closePlanner();
});

// ====== INITIALIZATION ======
(async () => {
    await requireAuth();

    await loadGoals();
    plansCache = await cloudGet(LS_PLANS, {});
    renderGoalTemplates();
    renderGoals();
    updateDashboardSummary();
})();