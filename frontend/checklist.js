// ========== CHECKLIST JS LOGIC (FIXED) ==========

// ----- DOM Elements -----
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarOverlay = document.getElementById("overlay");
const historyBtn = document.getElementById("history-btn");
const historyDropdown = document.getElementById("history-dropdown");
const tasksList = document.getElementById("tasks-list");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const addTaskBtn = document.getElementById("add-task-btn");
const categoriesSection = document.getElementById("categories-section");
const mobileCategoryToggleBtn = document.getElementById("mobile-category-toggle-btn");
const mobileCategoryActiveLabel = document.getElementById("mobile-category-active-label");
const historyList = document.getElementById("history-list");

// ----- Config -----
// "Routine" keeps the original storage keys (pre-existing user data lives
// here) and resets its completion state every day. "Checklist" is the new,
// plain list that never auto-resets and never shows/edits task times.
const LOCALSTORAGE_KEY = "dashboard_checklist_current";
const HISTORY_KEY = "dashboard_checklist_history";
const CHECKLIST_LOCALSTORAGE_KEY = "dashboard_checklist_basic_current";
const CHECKLIST_HISTORY_KEY = "dashboard_checklist_basic_history";
const ROUTINE_LAST_RESET_KEY = "dashboard_checklist_routine_last_reset";
const CATEGORIES_KEY = "dashboard_checklist_categories";
const USER_TEMPLATES_KEY = "dashboard_checklist_user_templates";

// Routines below are compiled from publicly reported interviews and
// profiles (not verbatim quotes, not photos/likenesses of anyone —
// icons stand in for people to avoid any image-rights issue). "featured"
// templates show inline; everyone else lives in the searchable library
// modal (account only — see renderTemplateLibrary()).
const TEMPLATES = {

"cr7": {
  "name": "CR7 Routine",
  "person": "Cristiano Ronaldo",
  "icon": "fa-futbol",
  "featured": true,
  "tasks": [
    {
      "text": "Wake up & hydrate",
      "category": "Health",
      "hour": "06:00"
    },
    {
      "text": "Morning activation, stretching & light exercise",
      "category": "Health",
      "hour": "06:15"
    },
    {
      "text": "High-protein breakfast (eggs, fruit, avocado, dairy)",
      "category": "Health",
      "hour": "07:30"
    },
    {
      "text": "Football training: technical, tactical & high-intensity drills",
      "category": "Training",
      "hour": "09:00"
    },
    {
      "text": "Strength & conditioning session",
      "category": "Training",
      "hour": "11:00"
    },
    {
      "text": "Post-training recovery: hydration, stretching & recovery treatment",
      "category": "Recovery",
      "hour": "12:30"
    },
    {
      "text": "High-protein meal (fish or chicken, vegetables & quality carbohydrates)",
      "category": "Health",
      "hour": "13:00"
    },
    {
      "text": "Afternoon recovery nap",
      "category": "Recovery",
      "hour": "14:00"
    },
    {
      "text": "Second training / conditioning / mobility session",
      "category": "Training",
      "hour": "16:00"
    },
    {
      "text": "Cold exposure & recovery",
      "category": "Recovery",
      "hour": "17:30"
    },
    {
      "text": "Family time & relaxation",
      "category": "Social",
      "hour": "19:00"
    },
    {
      "text": "Balanced dinner (lean protein, vegetables & whole-food carbohydrates)",
      "category": "Health",
      "hour": "20:00"
    },
    {
      "text": "Wind down, relax & prepare for sleep",
      "category": "Recovery",
      "hour": "21:30"
    },
    {
      "text": "Night sleep",
      "category": "Recovery",
      "hour": "22:00"
    }
  ]
},
"bezos": {
  "name": "Bezos Routine",
  "person": "Jeff Bezos",
  "icon": "fa-rocket",
  "featured": true,
  "tasks": [
    {
      "text": "Wake up naturally & start the morning slowly",
      "category": "Health",
      "hour": "07:00"
    },
    {
      "text": "Morning puttering: coffee & newspaper",
      "category": "Mindset",
      "hour": "07:30"
    },
    {
      "text": "Breakfast with family",
      "category": "Social",
      "hour": "08:00"
    },
    {
      "text": "Workout: cardio & resistance training",
      "category": "Health",
      "hour": "08:45"
    },
    {
      "text": "High-IQ meetings & highest-priority decisions",
      "category": "Work",
      "hour": "10:00"
    },
    {
      "text": "Complete the most mentally demanding work before lunch",
      "category": "Work",
      "hour": "11:30"
    },
    {
      "text": "Lunch & lower-intensity work",
      "category": "Work",
      "hour": "13:00"
    },
    {
      "text": "Afternoon work & operational decisions",
      "category": "Work",
      "hour": "14:00"
    },
    {
      "text": "Stop pushing difficult decisions when mental energy drops",
      "category": "Mindset",
      "hour": "17:00"
    },
    {
      "text": "Family dinner",
      "category": "Social",
      "hour": "19:00"
    },
    {
      "text": "Wash the dishes & spend time with family",
      "category": "Social",
      "hour": "19:30"
    },
    {
      "text": "Wind down & protect tomorrow's energy",
      "category": "Recovery",
      "hour": "21:30"
    },
    {
      "text": "Get 8 hours of sleep",
      "category": "Recovery",
      "hour": "22:00"
    }
  ]
},
"gmindset": {
  "name": "Gmindset02 Creator Day",
  "person": "Gmindset02",
  "icon": "fa-youtube",
  "iconStyle": "brands",
  "featured": true,
  "tasks": [
    {
      "text": "Wake up & pray",
      "category": "Mindset",
      "hour": "06:00"
    },
    {
      "text": "Morning sunlight + brush teeth + cold shower",
      "category": "Health",
      "hour": "06:15"
    },
    {
      "text": "Meditation / mental reset (10 – 15 min)",
      "category": "Mindset",
      "hour": "06:40"
    },
    {
      "text": "Content creation",
      "category": "Work",
      "hour": "07:00"
    },
    {
      "text": "Work on the main business",
      "category": "Deep Work",
      "hour": "09:00"
    },
    {
      "text": "Lunch + nap",
      "category": "Health",
      "hour": "12:00"
    },
    {
      "text": "Work on 2ndary tasks / content creation",
      "category": "Work",
      "hour": "14:00"
    },
    {
      "text": "Walk my dog + exercise",
      "category": "Health",
      "hour": "17:00"
    },
    {
      "text": "Shower + dinner",
      "category": "Personal",
      "hour": "19:00"
    },
    {
      "text": "Learn",
      "category": "Learning",
      "hour": "19:45"
    },
    {
      "text": "Nighttime wind down: reading, journaling & reflection",
      "category": "Recovery",
      "hour": "20:30"
    },
    {
      "text": "Sleep 8 – 9 hours",
      "category": "Recovery",
      "hour": "21:00"
    },
  ]
},

  "zuckerberg": {
    "name": "Zuck Routine",
    "person": "Mark Zuckerberg",
    "icon": "fa-meta",
    "iconStyle": "brands",
    "featured": false,
    "tasks": [
      {
        "text": "Wake up & start the day",
        "category": "Health",
        "hour": "08:00"
      },
      {
        "text": "Check messages & important updates",
        "category": "Work",
        "hour": "08:15"
      },
      {
        "text": "MMA / Brazilian Jiu-Jitsu training",
        "category": "Health",
        "hour": "08:30"
      },
      {
        "text": "Recovery: stretching, shower & cold exposure",
        "category": "Recovery",
        "hour": "10:00"
      },
      {
        "text": "Breakfast & refuel",
        "category": "Health",
        "hour": "10:30"
      },
      {
        "text": "Deep executive work: product, strategy & engineering",
        "category": "Work",
        "hour": "11:00"
      },
      {
        "text": "Meetings, collaboration & operational work",
        "category": "Work",
        "hour": "14:00"
      },
      {
        "text": "Focused work / learning / problem solving",
        "category": "Learning",
        "hour": "16:30"
      },
      {
        "text": "Family time & dinner",
        "category": "Social",
        "hour": "19:00"
      },
      {
        "text": "Wind down & prepare for sleep",
        "category": "Recovery",
        "hour": "21:30"
      },
      {
        "text": "Prioritize a full night's sleep",
        "category": "Recovery",
        "hour": "22:30"
      }
    ]
  },

  "cook": {
    "name": "Cook's 4AM Start",
    "person": "Tim Cook",
    "icon": "fa-envelope-open-text",
    "featured": false,
    "tasks": [
      {
        "text": "Wake up early",
        "category": "Health",
        "hour": "03:45"
      },
      {
        "text": "Read and respond to emails",
        "category": "Work",
        "hour": "04:00"
      },
      {
        "text": "Review priorities & prepare for the day",
        "category": "Work",
        "hour": "05:00"
      },
      {
        "text": "Morning workout",
        "category": "Health",
        "hour": "05:30"
      },
      {
        "text": "Breakfast & prepare for work",
        "category": "Health",
        "hour": "06:30"
      },
      {
        "text": "Review business priorities & global operations",
        "category": "Work",
        "hour": "07:00"
      },
      {
        "text": "Executive meetings & leadership work",
        "category": "Work",
        "hour": "08:00"
      },
      {
        "text": "Lunch & reset",
        "category": "Health",
        "hour": "12:00"
      },
      {
        "text": "Afternoon strategy, product & executive work",
        "category": "Work",
        "hour": "13:00"
      },
      {
        "text": "Review the day's priorities & outstanding communication",
        "category": "Work",
        "hour": "18:00"
      },
      {
        "text": "Wind down & prepare for an early night",
        "category": "Recovery",
        "hour": "20:30"
      },
      {
        "text": "Sleep",
        "category": "Recovery",
        "hour": "21:30"
      }
    ]
  
},
  "schwarzenegger": {
    "name": "Arnold's Two-a-Days",
    "person": "Arnold Schwarzenegger",
    "icon": "fa-dumbbell",
    "featured": false,
    "tasks": [
      {
        "text": "Wake up early & start the day with purpose",
        "category": "Mindset",
        "hour": "05:30"
      },
      {
        "text": "Read the news & stay informed",
        "category": "Learning",
        "hour": "06:00"
      },
      {
        "text": "Bodybuilding workout: weights & focused training",
        "category": "Health",
        "hour": "06:30"
      },
      {
        "text": "High-protein breakfast & recovery meal",
        "category": "Health",
        "hour": "08:00"
      },
      {
        "text": "Business, creative projects & public work",
        "category": "Work",
        "hour": "09:00"
      },
      {
        "text": "Walk, spend time with animals & get outdoors",
        "category": "Social",
        "hour": "12:00"
      },
      {
        "text": "Second training session: cardio or outdoor activity",
        "category": "Health",
        "hour": "16:00"
      },
      {
        "text": "Read, write & work on personal projects",
        "category": "Learning",
        "hour": "17:30"
      },
      {
        "text": "Dinner & time with family and friends",
        "category": "Social",
        "hour": "19:00"
      },
      {
        "text": "Reflect, relax & prepare for tomorrow",
        "category": "Mindset",
        "hour": "21:30"
      },
      {
        "text": "Sleep & recover",
        "category": "Recovery",
        "hour": "22:30"
      }
    ]
  
},
  "obama-michelle": {
    "name": "Michelle's Morning",
    "person": "Michelle Obama",
    "icon": "fa-person-running",
    "featured": false,
    "tasks": [
      {
        "text": "Wake up early & start the day",
        "category": "Health",
        "hour": "04:30"
      },
      {
        "text": "Morning workout: strength & cardio",
        "category": "Health",
        "hour": "04:45"
      },
      {
        "text": "Shower, get ready & prepare for the day",
        "category": "Health",
        "hour": "06:00"
      },
      {
        "text": "Breakfast & family time",
        "category": "Social",
        "hour": "06:30"
      },
      {
        "text": "Writing, creative work & professional priorities",
        "category": "Work",
        "hour": "08:00"
      },
      {
        "text": "Public engagements & advocacy work",
        "category": "Work",
        "hour": "11:00"
      },
      {
        "text": "Lunch & midday reset",
        "category": "Health",
        "hour": "13:00"
      },
      {
        "text": "Afternoon work, meetings & projects",
        "category": "Work",
        "hour": "14:00"
      },
      {
        "text": "Family time & dinner",
        "category": "Social",
        "hour": "18:30"
      },
      {
        "text": "Evening wind-down & personal time",
        "category": "Recovery",
        "hour": "20:30"
      },
      {
        "text": "Get a full night's sleep",
        "category": "Recovery",
        "hour": "22:00"
      }
    ]
},
  "winfrey": {
    "name": "Oprah's Ritual",
    "person": "Oprah Winfrey",
    "icon": "fa-mug-hot",
    "featured": false,
    "tasks": [
      {
        "text": "Wake naturally & begin the morning calmly",
        "category": "Mindset",
        "hour": "06:00"
      },
      {
        "text": "Morning meditation",
        "category": "Mindset",
        "hour": "06:20"
      },
      {
        "text": "Practice gratitude & reflect on what matters",
        "category": "Mindset",
        "hour": "06:50"
      },
      {
        "text": "Morning workout",
        "category": "Health",
        "hour": "07:15"
      },
      {
        "text": "Healthy breakfast & hydration",
        "category": "Health",
        "hour": "08:30"
      },
      {
        "text": "Creative work, business & media responsibilities",
        "category": "Work",
        "hour": "09:30"
      },
      {
        "text": "Focused work, meetings & projects",
        "category": "Work",
        "hour": "13:00"
      },
      {
        "text": "Evening meal & meaningful connection",
        "category": "Social",
        "hour": "18:00"
      },
      {
        "text": "Reading & evening reflection",
        "category": "Mindset",
        "hour": "20:30"
      },
      {
        "text": "Wind down & prepare for sleep",
        "category": "Recovery",
        "hour": "21:30"
      }
    ]
},
  "johnson": {
    "name": "The Rock's Grind",
    "person": "Dwayne Johnson",
    "icon": "fa-dumbbell",
    "featured": false,
    "tasks": [
      {
        "text": "Wake up early & hydrate",
        "category": "Health",
        "hour": "04:00"
      },
      {
        "text": "Morning cardio",
        "category": "Health",
        "hour": "04:30"
      },
      {
        "text": "High-protein breakfast",
        "category": "Health",
        "hour": "05:30"
      },
      {
        "text": "Production, business & filming work",
        "category": "Work",
        "hour": "07:00"
      },
      {
        "text": "Focused business & creative work",
        "category": "Work",
        "hour": "10:00"
      },
      {
        "text": "Iron Paradise weight-training session",
        "category": "Health",
        "hour": "14:00"
      },
      {
        "text": "Post-workout meal & recovery",
        "category": "Recovery",
        "hour": "15:30"
      },
      {
        "text": "Business operations & creative projects",
        "category": "Work",
        "hour": "16:00"
      },
      {
        "text": "Family time & dinner",
        "category": "Social",
        "hour": "19:00"
      },
      {
        "text": "Wind down & disconnect from work",
        "category": "Recovery",
        "hour": "20:30"
      },
      {
        "text": "Sleep & recover",
        "category": "Recovery",
        "hour": "21:00"
      }
    ]
  },

  "ravikant": {
    "name": "Naval's Deep Work",
    "person": "Naval Ravikant",
    "icon": "fa-book",
    "featured": false,
    "tasks": [
      {
        "text": "Wake naturally & start the day without rushing",
        "category": "Mindset",
        "hour": "07:00"
      },
      {
        "text": "Read, learn & think without distractions",
        "category": "Learning",
        "hour": "07:30"
      },
      {
        "text": "Walk outdoors & get regular movement",
        "category": "Health",
        "hour": "08:30"
      },
      {
        "text": "Deep work on high-leverage priorities",
        "category": "Work",
        "hour": "09:30"
      },
      {
        "text": "Lunch & unstructured thinking time",
        "category": "Mindset",
        "hour": "13:00"
      },
      {
        "text": "Focused work, writing & creative thinking",
        "category": "Work",
        "hour": "14:00"
      },
      {
        "text": "Read, learn & develop specific knowledge",
        "category": "Learning",
        "hour": "16:00"
      },
      {
        "text": "Meditation & mental reset",
        "category": "Mindset",
        "hour": "18:00"
      },
      {
        "text": "Disconnect from work & enjoy unstructured time",
        "category": "Recovery",
        "hour": "20:00"
      },
      {
        "text": "Prepare for restful sleep",
        "category": "Recovery",
        "hour": "22:00"
      }
    ]
  },
  "franklin": {
    "name": "Franklin's Schedule",
    "person": "Benjamin Franklin",
    "icon": "fa-feather",
    "featured": false,
    "tasks": [
      {
        "text": "Rise, wash, address Powerful Goodness & plan the day's business",
        "category": "Mindset",
        "hour": "05:00"
      },
      {
        "text": "Breakfast & prepare for the day's work",
        "category": "Health",
        "hour": "06:00"
      },
      {
        "text": "Work: study & conduct current business",
        "category": "Work",
        "hour": "08:00"
      },
      {
        "text": "Review accounts, read & dine",
        "category": "Learning",
        "hour": "12:00"
      },
      {
        "text": "Work: continue current business",
        "category": "Work",
        "hour": "14:00"
      },
      {
        "text": "Put things in their places",
        "category": "Mindset",
        "hour": "18:00"
      },
      {
        "text": "Supper, music, diversion & conversation",
        "category": "Social",
        "hour": "19:00"
      },
      {
        "text": "Examine the day: \"What good have I done today?\"",
        "category": "Mindset",
        "hour": "21:30"
      },
      {
        "text": "Sleep",
        "category": "Recovery",
        "hour": "22:00"
      }
    ]
},
  "obama-barack": {
    "name": "Barack's Balance",
    "person": "Barack Obama",
    "icon": "fa-landmark",
    "featured": false,
    "tasks": [
      {
        "text": "Wake up & start the day",
        "category": "Health",
        "hour": "07:00"
      },
      {
        "text": "Morning workout: cardio or weights",
        "category": "Health",
        "hour": "07:15"
      },
      {
        "text": "Breakfast & family time",
        "category": "Social",
        "hour": "08:30"
      },
      {
        "text": "Review security briefing & prepare for the day",
        "category": "Learning",
        "hour": "08:45"
      },
      {
        "text": "Core work, meetings & strategic decisions",
        "category": "Work",
        "hour": "09:00"
      },
      {
        "text": "Focused work, meetings & policy reviews",
        "category": "Work",
        "hour": "13:00"
      },
      {
        "text": "Return home & have dinner with family",
        "category": "Social",
        "hour": "18:30"
      },
      {
        "text": "Read briefing papers, write & handle remaining work",
        "category": "Work",
        "hour": "20:00"
      },
      {
        "text": "Reading, reflection & personal downtime",
        "category": "Mindset",
        "hour": "22:30"
      },
      {
        "text": "Sleep",
        "category": "Recovery",
        "hour": "01:00"
      }
    ]
}}
const FEATURED_TEMPLATE_KEYS = Object.keys(TEMPLATES).filter(k => TEMPLATES[k].featured);
const LIBRARY_TEMPLATE_KEYS = Object.keys(TEMPLATES).filter(k => !TEMPLATES[k].featured);

// ----- State (populated from the cloud once DOMContentLoaded fires) -----
// `tasks` / `historyCache` always hold whichever tab is currently active —
// every existing function (addTask, saveData, applyTemplateByKey, etc.)
// keeps reading/writing those two globals unchanged. Switching tabs saves
// nothing implicitly; it just reloads the other tab's data fresh from
// storage (every mutation already persists immediately via saveData()),
// so there's no risk of a stale in-memory copy drifting from what's saved.
let activeTab = "routine"; // "routine" | "checklist"
let tasks = [];
let historyCache = [];
let categories = ["Health", "Work", "Learning", "Recovery", "Social", "Fun", "Mindset"];
let userTemplatesCache = [];
let currentFilterCategory = null;

const tabsBar = document.getElementById("checklist-tabs");
const tasksColTitle = document.getElementById("tasks-col-title");
const checklistSubtitle = document.getElementById("checklist-subtitle");

function activeTasksKey() { return activeTab === "routine" ? LOCALSTORAGE_KEY : CHECKLIST_LOCALSTORAGE_KEY; }
function activeHistoryKey() { return activeTab === "routine" ? HISTORY_KEY : CHECKLIST_HISTORY_KEY; }

// ----- Daily reset (Routine tab only) -----
// Once per calendar day, uncheck every routine task so the list "just
// reset" — the tasks themselves (and their times) are untouched, only
// completion state. Works whether or not the Routine tab is the one
// currently on screen: if it's active, reset the live `tasks` array
// directly; if not, reset its stored copy so it's fresh whenever the
// user switches back or reloads. Returns true if the live, on-screen
// list changed (so the caller knows to re-render).
async function resetRoutineCompletionIfNeeded() {
    const todayStr = new Date().toDateString();
    const lastReset = await cloudGet(ROUTINE_LAST_RESET_KEY, "");
    if (lastReset === todayStr) return false;
    await cloudSet(ROUTINE_LAST_RESET_KEY, todayStr);

    if (activeTab === "routine") {
        if (!tasks.some(t => t.completed)) return false;
        tasks = tasks.map(t => t.completed ? { ...t, completed: false } : t);
        saveData();
        return true;
    }

    const stored = await cloudGet(LOCALSTORAGE_KEY, { tasks: [] });
    const storedTasks = stored.tasks || [];
    if (storedTasks.some(t => t.completed)) {
        const resetTasks = storedTasks.map(t => t.completed ? { ...t, completed: false } : t);
        await cloudSet(LOCALSTORAGE_KEY, { tasks: resetTasks });
    }
    return false;
}

// Catches day rollover for a tab left open across midnight, without
// requiring a page reload.
function watchForDailyReset() {
    const check = async () => {
        const changed = await resetRoutineCompletionIfNeeded();
        if (changed) renderTasks();
    };
    setInterval(check, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) check(); });
}

function updateTabUI() {
    if (tabsBar) {
        tabsBar.querySelectorAll(".checklist-tab-btn").forEach(btn => {
            const isActive = btn.dataset.tab === activeTab;
            btn.classList.toggle("active", isActive);
            btn.setAttribute("aria-selected", isActive ? "true" : "false");
        });
    }
    document.body.classList.toggle("checklist-mode", activeTab === "checklist");
    if (tasksColTitle) tasksColTitle.textContent = activeTab === "routine" ? "Today's Routine" : "Your Checklist";
    if (checklistSubtitle) {
        checklistSubtitle.textContent = activeTab === "routine"
            ? "Design your day, track your wins."
            : "Your list, however long you need it — nothing resets.";
    }
}

async function switchTab(tab) {
    if (tab === activeTab || (tab !== "routine" && tab !== "checklist")) return;

    activeTab = tab;
    currentFilterCategory = null;

    const stored = await cloudGet(activeTasksKey(), { tasks: [] });
    tasks = stored.tasks || [];
    historyCache = await cloudGet(activeHistoryKey(), []);

    // Catch a reset that happened earlier today while this tab was dormant.
    if (activeTab === "routine") await resetRoutineCompletionIfNeeded();

    updateTabUI();
    renderTasks();
    renderCategoriesUI();
    updateProgress();
    initTaskSortable();
    if (!historyDropdown.hidden) historyDropdown.hidden = true;
}

if (tabsBar) {
    tabsBar.addEventListener("click", (e) => {
        const btn = e.target.closest(".checklist-tab-btn");
        if (btn) switchTab(btn.dataset.tab);
    });
}

// ----- Initialization -----
document.addEventListener("DOMContentLoaded", async () => {
    await requireAuth();

    const currentData = await cloudGet(activeTasksKey(), { tasks: [] });
    tasks = currentData.tasks || [];
    historyCache = await cloudGet(activeHistoryKey(), []);
    categories = await cloudGet(CATEGORIES_KEY, categories);
    userTemplatesCache = await cloudGet(USER_TEMPLATES_KEY, []);

    await resetRoutineCompletionIfNeeded(); // activeTab is "routine" at this point

    updateTabUI();
    renderTasks();
    renderCategoriesUI();
    renderUserTemplatesUI();
    updateProgress();
    initTaskSortable();
    watchForDailyReset();
});

// ----- Sidebar Logic -----
if (sidebarToggle) {
    sidebarToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        sidebar.classList.toggle("open");
        sidebarOverlay?.classList.toggle("active", sidebar.classList.contains("open"));
    });
}
sidebarOverlay?.addEventListener("click", () => {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("active");
});
document.addEventListener("click", (e) => {
    if (window.innerWidth < 1024 && sidebar.classList.contains("open") && !sidebar.contains(e.target) && e.target !== sidebarToggle && !e.target.closest(".mobile-bottom-nav")) {
        sidebar.classList.remove("open");
        sidebarOverlay?.classList.remove("active");
    }
    if (!historyDropdown.hidden && !historyDropdown.contains(e.target) && e.target !== historyBtn) {
        historyDropdown.hidden = true;
    }
    if (activeTimePicker && !activeTimePicker.contains(e.target) && !e.target.closest(".checklist-task-hour")) {
        closeTimePicker();
    }
    if (categoriesSection.classList.contains("mobile-open") && !categoriesSection.contains(e.target) && e.target !== mobileCategoryToggleBtn && !mobileCategoryToggleBtn?.contains(e.target)) {
        closeMobileCategoryPanel();
    }
});

// ----- Rendering Tasks -----
function renderTasks() {
    tasksList.innerHTML = "";

    if (!tasks.length) {
        tasksList.innerHTML = `
            <div style="text-align:center; padding:3rem; color:var(--text-muted);">
                <i class="fa-solid fa-clipboard-check" style="font-size:2rem; margin-bottom:1rem; opacity:0.5;"></i><br>
                Your list is empty. Add something worth doing today.
                <div style="margin-top:1rem;">
                    <button type="button" class="checklist-add-btn" id="empty-state-add-btn"><i class="fa-solid fa-plus"></i> Add your first task</button>
                </div>
            </div>`;
        updateProgress();
        document.getElementById("empty-state-add-btn")?.addEventListener("click", addTask);
        return;
    }

    let visibleIndex = 0;
    let hasVisible = false;
    tasks.forEach((task) => {
        if (currentFilterCategory && task.category !== currentFilterCategory) return;
        hasVisible = true;

        const li = document.createElement("li");
        li.className = "checklist-task-item" + (task.completed ? " completed" : "");
        li.dataset.id = task.id;
        li.style.animationDelay = `${Math.min(visibleIndex, 12) * 30}ms`;
        visibleIndex++;

        // 0. Drag Handle (for touch/mouse reordering — keeps the rest of the
        // row's taps, like the checkbox or editable label, from triggering a drag)
        const dragHandle = document.createElement("div");
        dragHandle.className = "task-drag-handle";
        dragHandle.innerHTML = '<i class="fa-solid fa-grip-vertical"></i>';
        dragHandle.title = "Drag to reorder";

        // 1. Custom Checkbox
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "checklist-task-checkbox";
        checkbox.checked = task.completed;
        checkbox.addEventListener("change", () => {
            task.completed = checkbox.checked;
            saveData();
            li.classList.toggle("completed", task.completed);
            updateProgress();
        });

        // 2. Hour Badge — click opens a cronometer-style hour/minute picker.
        // Sits right before the label, in the same row/space. Only the
        // Routine tab deals in times; the plain Checklist tab skips it.
        let hourBadge = null;
        if (activeTab === "routine") {
            hourBadge = document.createElement("button");
            hourBadge.type = "button";
            hourBadge.className = "checklist-task-hour" + (task.hour ? "" : " empty");
            hourBadge.innerHTML = `<i class="fa-regular fa-clock"></i><span>${task.hour ? formatHour12(task.hour) : "--:--"}</span>`;
            hourBadge.title = "Set task time";
            hourBadge.addEventListener("click", (e) => {
                e.stopPropagation();
                if (activeTimePickerTaskId === task.id) { closeTimePicker(); return; }
                openTimePicker(task, hourBadge);
            });
        }

        // 3. Editable Label (a real <input> instead of contentEditable — far more
        // reliable on mobile: proper soft keyboard, predictable cursor/selection,
        // and it visually reads as an editable field instead of plain text)
        const label = document.createElement("input");
        label.type = "text";
        label.className = "checklist-task-label";
        label.value = task.text;
        label.addEventListener("blur", () => {
            const trimmed = label.value.trim();
            if (trimmed && trimmed !== task.text) {
                task.text = trimmed;
                // Hand-edited text means this is no longer "whatever the
                // personalization engine generated" — untag it so a future
                // regenerate/shuffle treats it as a manual task and leaves
                // it alone instead of overwriting the user's own wording.
                delete task.personaSlot;
            }
            label.value = task.text;
            saveData();
        });
        label.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); label.blur(); } });

        // 4. Category Select (Styled)
        const catSelect = document.createElement("select");
        catSelect.style.width = "auto";
        catSelect.style.fontSize = "0.8rem";
        catSelect.style.padding = "0.3rem";
        catSelect.innerHTML = `<option value="">Category...</option>`;
        categories.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c;
            opt.textContent = c;
            if (task.category === c) opt.selected = true;
            catSelect.appendChild(opt);
        });
        catSelect.addEventListener("change", () => {
            task.category = catSelect.value;
            delete task.personaSlot; // manually recategorized — see label blur handler above
            saveData();
        });

        // 5. Controls (FontAwesome Icons)
        const controls = document.createElement("div");
        controls.className = "checklist-task-controls";

        const btnUp = createIconBtn("fa-arrow-up", () => moveTask(task.id, -1));
        const btnDown = createIconBtn("fa-arrow-down", () => moveTask(task.id, 1));
        const btnDel = createIconBtn("fa-trash", () => deleteTask(task.id), "text-align:right; color:#ef4444;");

        controls.append(btnUp, btnDown, btnDel);

        li.append(dragHandle, checkbox);
        if (hourBadge) li.append(hourBadge);
        li.append(label, catSelect, controls);
        tasksList.appendChild(li);
    });

    if (!hasVisible) {
        tasksList.innerHTML = `
            <div style="text-align:center; padding:3rem; color:var(--text-muted);">
                <i class="fa-solid fa-filter" style="font-size:2rem; margin-bottom:1rem; opacity:0.5;"></i><br>
                No tasks in "${escapeHTML(currentFilterCategory)}" yet.
                <div style="margin-top:1rem;">
                    <button type="button" class="checklist-add-btn" id="empty-filter-clear-btn"><i class="fa-solid fa-xmark"></i> Show all tasks</button>
                </div>
            </div>`;
        document.getElementById("empty-filter-clear-btn")?.addEventListener("click", () => {
            currentFilterCategory = null;
            renderCategoriesUI();
            renderTasks();
        });
    }

    updateProgress();
}

// ----- Drag-to-Reorder (touch + mouse, via SortableJS) -----
// Reads the new visual order of task <li> elements from the DOM and merges
// it back into the full `tasks` array — preserving the position of any
// tasks currently hidden by a category filter, so reordering while filtered
// doesn't scramble tasks outside the current view.
function reorderTasksFromDOM() {
    const idsInNewOrder = Array.from(tasksList.children)
        .map(li => li.dataset.id)
        .filter(Boolean);
    if (!idsInNewOrder.length) return;

    const visibleIdSet = new Set(idsInNewOrder);
    const reorderedVisible = idsInNewOrder.map(id => tasks.find(t => t.id === id)).filter(Boolean);

    let visibleIndex = 0;
    tasks = tasks.map(t => visibleIdSet.has(t.id) ? reorderedVisible[visibleIndex++] : t);

    saveData();
}

let taskSortable = null;
function initTaskSortable() {
    if (typeof Sortable === "undefined" || !tasksList) return;
    if (taskSortable) taskSortable.destroy();
    taskSortable = Sortable.create(tasksList, {
        handle: ".task-drag-handle",
        animation: 150,
        delay: 120,           // short delay before a touch-drag starts, so a normal tap/scroll isn't mistaken for a drag
        delayOnTouchOnly: true,
        touchStartThreshold: 5,
        ghostClass: "task-drag-ghost",
        onEnd: reorderTasksFromDOM
    });
}

// ----- Task Hour / Cronometer-style Time Picker -----
// Note: the hour is stored as a plain property on each task object, just
// like text/category. That's why reordering (drag or up/down arrows) just
// works automatically: whichever function moves a task around the `tasks`
// array moves the whole object — hour included — so two swapped tasks
// naturally swap hours along with everything else. No extra sync needed.
let activeTimePicker = null;
let activeTimePickerTaskId = null;

// Tasks store the hour internally as 24h "HH:MM" (keeps chronological
// sort/compare trivial); the UI always displays/edits it as 12h AM/PM
// since this app is for an English-speaking audience.
function formatHour12(hour24) {
    if (!/^\d{2}:\d{2}$/.test(hour24 || "")) return "";
    const [h, m] = hour24.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function closeTimePicker() {
    if (activeTimePicker) activeTimePicker.remove();
    activeTimePicker = null;
    activeTimePickerTaskId = null;
}

function openTimePicker(task, anchorEl) {
    closeTimePicker();
    activeTimePickerTaskId = task.id;

    const isValid = /^\d{2}:\d{2}$/.test(task.hour || "");
    let hour24, minuteVal;
    if (isValid) {
        [hour24, minuteVal] = task.hour.split(":").map(Number);
    } else {
        // No hour set yet: start from the current time (rounded to the
        // nearest 5 min) instead of an arbitrary 12:00
        const now = new Date();
        hour24 = now.getHours();
        minuteVal = Math.round(now.getMinutes() / 5) * 5 % 60;
    }
    let period = hour24 >= 12 ? "PM" : "AM";
    let hourVal = hour24 % 12;
    if (hourVal === 0) hourVal = 12;

    const popup = document.createElement("div");
    popup.className = "time-picker-popup";
    popup.addEventListener("click", (e) => e.stopPropagation());
    popup.innerHTML = `
        <div class="time-picker-header">
            <span class="time-picker-title"><i class="fa-regular fa-clock"></i> Task Time</span>
            <button type="button" class="time-picker-delete" title="Clear time"><i class="fa-solid fa-trash"></i></button>
        </div>
        <div class="time-picker-display">
            <div class="time-picker-unit active" data-type="hour">
                <button type="button" class="time-picker-arrow up"><i class="fa-solid fa-chevron-up"></i></button>
                <div class="time-picker-value">${String(hourVal).padStart(2, "0")}</div>
                <button type="button" class="time-picker-arrow down"><i class="fa-solid fa-chevron-down"></i></button>
            </div>
            <div class="time-picker-colon">:</div>
            <div class="time-picker-unit" data-type="minute">
                <button type="button" class="time-picker-arrow up"><i class="fa-solid fa-chevron-up"></i></button>
                <div class="time-picker-value">${String(minuteVal).padStart(2, "0")}</div>
                <button type="button" class="time-picker-arrow down"><i class="fa-solid fa-chevron-down"></i></button>
            </div>
            <div class="time-picker-unit time-picker-period" data-type="period">
                <button type="button" class="time-picker-arrow up"><i class="fa-solid fa-chevron-up"></i></button>
                <div class="time-picker-value">${period}</div>
                <button type="button" class="time-picker-arrow down"><i class="fa-solid fa-chevron-down"></i></button>
            </div>
        </div>
        <div class="time-picker-actions">
            <button type="button" class="time-picker-cancel">Cancel</button>
            <button type="button" class="time-picker-save"><i class="fa-solid fa-check"></i> Save</button>
        </div>
    `;

    const hourUnit = popup.querySelector('.time-picker-unit[data-type="hour"]');
    const minuteUnit = popup.querySelector('.time-picker-unit[data-type="minute"]');
    const periodUnit = popup.querySelector('.time-picker-unit[data-type="period"]');
    const hourValueEl = hourUnit.querySelector(".time-picker-value");
    const minuteValueEl = minuteUnit.querySelector(".time-picker-value");
    const periodValueEl = periodUnit.querySelector(".time-picker-value");

    function setActive(unit) {
        popup.querySelectorAll(".time-picker-unit").forEach(u => u.classList.remove("active"));
        unit.classList.add("active");
    }

    hourUnit.querySelector(".up").addEventListener("click", () => {
        hourVal = hourVal === 12 ? 1 : hourVal + 1;
        hourValueEl.textContent = String(hourVal).padStart(2, "0");
        setActive(hourUnit);
    });
    hourUnit.querySelector(".down").addEventListener("click", () => {
        hourVal = hourVal === 1 ? 12 : hourVal - 1;
        hourValueEl.textContent = String(hourVal).padStart(2, "0");
        setActive(hourUnit);
    });
    minuteUnit.querySelector(".up").addEventListener("click", () => {
        minuteVal = (minuteVal + 5) % 60;
        minuteValueEl.textContent = String(minuteVal).padStart(2, "0");
        setActive(minuteUnit);
    });
    minuteUnit.querySelector(".down").addEventListener("click", () => {
        minuteVal = (minuteVal + 55) % 60;
        minuteValueEl.textContent = String(minuteVal).padStart(2, "0");
        setActive(minuteUnit);
    });
    periodUnit.querySelectorAll(".time-picker-arrow").forEach(btn => {
        btn.addEventListener("click", () => {
            period = period === "AM" ? "PM" : "AM";
            periodValueEl.textContent = period;
            setActive(periodUnit);
        });
    });

    popup.querySelector(".time-picker-delete").addEventListener("click", () => {
        task.hour = "";
        saveData();
        closeTimePicker();
        renderTasks();
    });

    popup.querySelector(".time-picker-cancel").addEventListener("click", () => {
        closeTimePicker();
    });

    popup.querySelector(".time-picker-save").addEventListener("click", () => {
        let h24 = hourVal % 12;
        if (period === "PM") h24 += 12;
        task.hour = `${String(h24).padStart(2, "0")}:${String(minuteVal).padStart(2, "0")}`;
        saveData();
        closeTimePicker();
        renderTasks();
    });

    document.body.appendChild(popup);

    // Position the popup right under the badge, keeping it on-screen
    const rect = anchorEl.getBoundingClientRect();
    const popupWidth = popup.offsetWidth;
    let left = rect.left;
    if (left + popupWidth > window.innerWidth - 10) left = window.innerWidth - popupWidth - 10;
    if (left < 10) left = 10;
    let top = rect.bottom + 8;
    if (top + popup.offsetHeight > window.innerHeight - 10) top = rect.top - popup.offsetHeight - 8;
    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;

    activeTimePicker = popup;
}

function createIconBtn(iconClass, onClick, style = "") {
    const btn = document.createElement("button");
    btn.className = "checklist-action-btn";
    btn.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
    if (style) btn.style.cssText = style;
    btn.addEventListener("click", onClick);
    return btn;
}

// ----- Core Logic -----
function addTask() {
    tasks.push({
        id: Date.now().toString(36),
        text: "New Task",
        completed: false,
        category: currentFilterCategory || "",
        hour: ""
    });
    saveData();
    renderTasks();
    // Focus last added
    setTimeout(() => {
        const last = tasksList.lastElementChild;
        if (last) {
            const lbl = last.querySelector(".checklist-task-label");
            if (lbl) { lbl.focus(); lbl.select(); }
        }
    }, 50);
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveData();
    renderTasks();
}

function moveTask(id, direction) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx >= 0 && newIdx < tasks.length) {
        [tasks[idx], tasks[newIdx]] = [tasks[newIdx], tasks[idx]];
        saveData();
        renderTasks();
    }
}

function updateProgress() {
    const total = tasks.length;
    const done = tasks.filter(t => t.completed).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    const wasComplete = progressBar.dataset.complete === "1";
    progressBar.style.width = pct + "%";
    progressText.textContent = pct + "%";

    // Signed-in touch: a small confetti burst the moment a full list is completed.
    if (pct === 100 && total > 0 && !wasComplete) {
        progressBar.dataset.complete = "1";
        if (document.documentElement.getAttribute("data-plan") === "account" && typeof confetti === "function") {
            confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: ["#E8001C", "#FF4444", "#d4af37"] });
        }
        // Only the Routine tab counts toward "today's routine" for the
        // Consistency prompt — the free-form Checklist tab is a separate,
        // non-daily to-do list.
        if (activeTab === "routine" && typeof checkDailyCompletionAndPrompt === "function") {
            checkDailyCompletionAndPrompt();
        }
    } else if (pct < 100) {
        progressBar.dataset.complete = "0";
    }
}

// ----- Categories (With Delete) -----
function renderCategoriesUI() {
    const list = categoriesSection.querySelector(".categories-list");
    list.innerHTML = "";

    // 1. Add Button
    const addBtn = document.createElement("button");
    addBtn.className = "checklist-add-btn";
    addBtn.style.padding = "0.5rem 1rem";
    addBtn.style.fontSize = "0.8rem";
    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
    addBtn.onclick = async () => {
        const name = await customPrompt("Name your new category:", { placeholder: "e.g. Health" });
        if (name && !categories.includes(name)) {
            categories.push(name);
            cloudSet(CATEGORIES_KEY, categories);
            renderCategoriesUI();
            renderTasks(); 
        }
    };
    list.appendChild(addBtn);

    // 2. "All" Filter Button (No delete)
    const allBtn = document.createElement("button");
    allBtn.className = "category-btn";
    if (!currentFilterCategory) {
        allBtn.style.background = "var(--accent)";
        allBtn.style.color = "#000";
    }
    allBtn.textContent = "All";
    allBtn.onclick = () => { currentFilterCategory = null; renderCategoriesUI(); renderTasks(); };
    list.appendChild(allBtn);

    // 3. Category Buttons (With Delete)
    categories.forEach((cat, index) => {
        const btn = document.createElement("button");
        btn.className = "category-btn";

        // Highlight if active
        if (currentFilterCategory === cat) {
            btn.style.background = "var(--accent)";
            btn.style.color = "#000";
        }

        // Label text
        const span = document.createElement("span");
        span.textContent = cat;
        btn.appendChild(span);

        // Delete Icon
        const delIcon = document.createElement("span");
        delIcon.className = "category-delete";
        delIcon.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        delIcon.onclick = async (e) => {
            e.stopPropagation(); 
            const ok = await customConfirm(`Delete category "${cat}"?`, { danger: true, confirmText: "Delete" });
            if (ok) {
                categories.splice(index, 1); 
                if (currentFilterCategory === cat) currentFilterCategory = null;
                tasks.forEach(t => { if (t.category === cat) t.category = ""; });
                saveData(); 
                cloudSet(CATEGORIES_KEY, categories); 
                renderCategoriesUI();
                renderTasks();
            }
        };

        btn.onclick = () => { currentFilterCategory = cat; renderCategoriesUI(); renderTasks(); };
        btn.appendChild(delIcon);
        list.appendChild(btn);
    });

    // Keep the mobile toggle button's label in sync with the active filter
    // so the current category is visible even while the panel is closed.
    if (mobileCategoryActiveLabel) {
        mobileCategoryActiveLabel.textContent = currentFilterCategory || "All";
    }
}

// ----- Mobile category filter toggle -----
// On phones the category sidebar collapses into a panel opened from this
// button (see the .checklist-category-toggle-btn / #categories-section
// mobile-open rules in styles.css). Desktop never shows the toggle, so
// this only affects the mobile layout.
function closeMobileCategoryPanel() {
    categoriesSection.classList.remove("mobile-open");
    mobileCategoryToggleBtn?.classList.remove("active");
    mobileCategoryToggleBtn?.setAttribute("aria-expanded", "false");
}

if (mobileCategoryToggleBtn) {
    mobileCategoryToggleBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = categoriesSection.classList.toggle("mobile-open");
        mobileCategoryToggleBtn.classList.toggle("active", open);
        mobileCategoryToggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });

    // Picking a category (or hitting "All") is a natural close moment —
    // no need to make the user dismiss the panel separately afterward.
    categoriesSection.querySelector(".categories-list")?.addEventListener("click", (e) => {
        if (e.target.closest("button") && !e.target.closest(".category-delete") && window.innerWidth <= 767) {
            closeMobileCategoryPanel();
        }
    });
}

// ----- Templates & History -----
document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".template-btn");
    // If we clicked a delete icon inside a template btn, ignore this listener
    if (!btn || e.target.closest(".template-delete")) return;
    
    const type = btn.dataset.template;
    // If it's a user template (no dataset type usually), ignore, it's handled in renderUserTemplatesUI
    if(!type && !btn.classList.contains("user-tpl")) return; 
    // However, your HTML hardcodes types, but dynamically added user templates don't have data-template="...".
    // The logic below handles standard types. User templates are handled in their specific onclick.
    
    if (type === "custom") {
        const name = await customPrompt("Name this template:", { placeholder: "e.g. My Morning Routine" });
        if (name) {
            userTemplatesCache.push({
                name,
                tasks: tasks.map(t => ({ text: t.text, category: t.category || "", hour: t.hour || "" }))
            });
            cloudSet(USER_TEMPLATES_KEY, userTemplatesCache);
            renderUserTemplatesUI();
        }
        return;
    }

    if (type === "empty" || TEMPLATES[type]) {
        applyTemplateByKey(type);
    }
});

// Shared by the inline featured buttons and the template library modal
// cards — loads a template by its TEMPLATES key (or "empty" for a blank
// list), saving the current list to history first.
function applyTemplateByKey(type) {
    if (tasks.length > 0 && (type === "empty" || TEMPLATES[type])) {
        historyCache.unshift({ date: new Date(), tasks: [...tasks] });
        historyCache = historyCache.slice(0, 10);
        cloudSet(activeHistoryKey(), historyCache);
    }

    if (type === "empty") {
        tasks = [];
    } else if (TEMPLATES[type]) {
        tasks = TEMPLATES[type].tasks.map(task => ({
            id: Math.random().toString(36),
            text: task.text,
            completed: false,
            category: task.category,
            // Templates carry routine-style times; the plain Checklist tab
            // never shows or stores times, so strip them on apply.
            hour: activeTab === "routine" ? (task.hour || "") : ""
        }));
    }

    saveData();
    renderTasks();
    closeTemplateLibrary();
}

// ----- Template Library Modal (account) -----
const libraryModal = document.getElementById("template-library-modal");
const libraryGrid = document.getElementById("template-library-grid");
const librarySearchInput = document.getElementById("template-library-search-input");
const browseTemplatesBtn = document.getElementById("browse-templates-btn");

function iconTag(t) {
    return `<i class="fa-${t.iconStyle === "brands" ? "brands" : "solid"} ${t.icon}"></i>`;
}

function renderTemplateLibrary(filter = "") {
    if (!libraryGrid) return;
    const q = filter.trim().toLowerCase();
    const keys = LIBRARY_TEMPLATE_KEYS.filter(key => {
        const t = TEMPLATES[key];
        return !q || t.name.toLowerCase().includes(q) || t.person.toLowerCase().includes(q);
    });

    libraryGrid.innerHTML = "";

    if (!keys.length) {
        libraryGrid.innerHTML = `<div class="template-library-empty">No templates match "${filter}".</div>`;
        return;
    }

    keys.forEach((key, index) => {
        const t = TEMPLATES[key];
        const card = document.createElement("button");
        card.type = "button";
        card.className = "template-btn template-lib-card";
        card.dataset.template = key;
        card.style.animationDelay = `${Math.min(index, 10) * 35}ms`;
        card.innerHTML = `
            <span class="template-lib-icon">${iconTag(t)}</span>
            <span class="template-lib-text">
                <span class="template-lib-name">${t.name}</span>
                <span class="template-lib-person">${t.person} · ${t.tasks.length} tasks</span>
            </span>
        `;
        libraryGrid.appendChild(card);
    });
}

function openTemplateLibrary() {
    if (!libraryModal) return;
    libraryModal.hidden = false;
    requestAnimationFrame(() => libraryModal.classList.add("open"));
    renderTemplateLibrary(librarySearchInput ? librarySearchInput.value : "");
    if (librarySearchInput) setTimeout(() => librarySearchInput.focus(), 150);
}

function closeTemplateLibrary() {
    if (!libraryModal || libraryModal.hidden) return;
    libraryModal.classList.remove("open");
    setTimeout(() => { libraryModal.hidden = true; }, 200);
}

if (browseTemplatesBtn) {
    browseTemplatesBtn.addEventListener("click", () => {
        // Free users never reach this: applyAccountLocks() intercepts the click
        // on [data-account-feature] elements before this listener runs.
        openTemplateLibrary();
    });
}

document.getElementById("template-library-close")?.addEventListener("click", closeTemplateLibrary);

libraryModal?.addEventListener("click", (e) => {
    if (e.target === libraryModal) closeTemplateLibrary();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && libraryModal && !libraryModal.hidden) closeTemplateLibrary();
});

librarySearchInput?.addEventListener("input", () => renderTemplateLibrary(librarySearchInput.value));

// ----- User Templates UI (With Delete) -----
function renderUserTemplatesUI() {
    const container = document.querySelector(".templates-options");

    // 1. Clean up existing user templates to avoid duplicates
    container.querySelectorAll(".user-tpl").forEach(el => el.remove());

    userTemplatesCache.forEach((ut, index) => {
        const btn = document.createElement("button");
        btn.className = "template-btn user-tpl";

        // Left side: Name
        const nameSpan = document.createElement("span");
        nameSpan.innerHTML = `<i class="fa-solid fa-star" style="color:gold; margin-right:8px;"></i> ${ut.name}`;
        btn.appendChild(nameSpan);

        // Right side: Delete Icon
        const delBtn = document.createElement("span");
        delBtn.className = "template-delete";
        delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        delBtn.title = "Delete Template";

        // Delete Logic
        delBtn.onclick = async (e) => {
            e.stopPropagation(); 
            const ok = await customConfirm(`Delete template "${ut.name}"?`, { danger: true, confirmText: "Delete" });
            if (ok) {
                userTemplatesCache.splice(index, 1);
                cloudSet(USER_TEMPLATES_KEY, userTemplatesCache);
                renderUserTemplatesUI();
            }
        };
        btn.appendChild(delBtn);

        // Load Logic 
        btn.onclick = async (e) => {
             // Prevent loading if we clicked delete
             if(e.target.closest('.template-delete')) return;

             const ok = await customConfirm(`Load "${ut.name}"? Current tasks will be saved to history.`, { confirmText: "Load" });
             if (ok) {
                if (tasks.length > 0) {
                    historyCache.unshift({ date: new Date(), tasks: [...tasks] });
                    historyCache = historyCache.slice(0, 10);
                    cloudSet(activeHistoryKey(), historyCache);
                }
                // Backward compatibility: templates saved before this update
                // stored tasks as plain text strings instead of objects.
                tasks = ut.tasks.map(t => {
                    const isLegacy = typeof t === "string";
                    return {
                        id: Math.random().toString(36),
                        text: isLegacy ? t : t.text,
                        completed: false,
                        category: isLegacy ? "" : (t.category || ""),
                        hour: (isLegacy || activeTab !== "routine") ? "" : (t.hour || "")
                    };
                });
                saveData();
                renderTasks();
            }
        };

        // Insert before the "Create Custom" button
        const customBtn = container.querySelector('[data-template="custom"]');
        if (customBtn) {
            container.insertBefore(btn, customBtn);
        } else {
            container.appendChild(btn);
        }
    });
}

// ----- History Logic -----
if (historyBtn) {
    historyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        historyDropdown.hidden = !historyDropdown.hidden;
        if (!historyDropdown.hidden) {
            historyList.innerHTML = "";
            const history = historyCache;
            if (!history.length) historyList.innerHTML = "<li>No history yet</li>";
            history.forEach(h => {
                const li = document.createElement("li");
                li.innerHTML = `<small>${new Date(h.date).toLocaleDateString()}</small><span>${h.tasks.length} task${h.tasks.length !== 1 ? 's' : ''}</span>`;
                li.onclick = async () => {
                    const ok = await customConfirm("Restore this list? It will replace your current tasks.", { confirmText: "Restore" });
                    if (ok) {
                        tasks = h.tasks;
                        saveData();
                        renderTasks();
                    }
                };
                historyList.appendChild(li);
            });
        }
    });
}

// ----- Utility Functions -----
function saveData() { cloudSet(activeTasksKey(), { tasks }); }

if (addTaskBtn) addTaskBtn.addEventListener("click", addTask);