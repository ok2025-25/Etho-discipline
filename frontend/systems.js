/* ============================================================
   ETHO — Systems (spec §15) — UI layer
   ------------------------------------------------------------
   Renders the "Activate a System" modal and, on confirm, writes
   the chosen system's bundle into the app's REAL storage — the
   same cloud keys goals.js / checklist.js / agenda.js already
   read from. No new storage model, no new gating mechanism:
   Locked systems reuse the existing [data-account-feature] lock
   (applyAccountLocks, from auth.js) the same way agenda.html and the
   template library already do.

   Entry point: any element with id="open-systems-btn" opens the
   picker. Requires (loaded before this file): cloud-sync.js,
   dialogs.js, systems-data.js, and auth.js/account-base.js for
   getUserPlan()/applyAccountLocks(). canvas-confetti is optional.

   Storage keys touched on activation (all pre-existing):
     "productivity_goals_v2"          — goals.js
     "productivity_goal_plans_v2"     — goals.js (per-goal steps)
     "dashboard_checklist_current"    — checklist.js (routine tab)
     "dashboard_checklist_categories" — checklist.js
     "agendaEvents"                   — agenda.js
     "activatedSystems"               — new, just tracks which
                                         systems show as "Activated"
                                         in the picker; nothing else
                                         reads it.
   ============================================================ */

const SYSTEMS_ROOT_ID = "systems-modal-root";
let systemsSelected = null;
let activatedSystemIds = [];

function ensureSystemsRoot() {
  let root = document.getElementById(SYSTEMS_ROOT_ID);
  if (!root) {
    root = document.createElement("div");
    root.id = SYSTEMS_ROOT_ID;
    root.hidden = true;
    document.body.appendChild(root);
  }
  return root;
}

function systemsOverlay() {
  return document.getElementById("systems-overlay");
}

function buildSystemsShell() {
  const root = ensureSystemsRoot();
  root.innerHTML = `
    <div class="template-library-overlay" id="systems-overlay">
      <div class="template-library-box" id="systems-box">
        <!-- content swapped between picker / preview via renderSystemsPicker() / renderSystemsPreview() -->
      </div>
    </div>
  `;
  document.getElementById("systems-overlay").addEventListener("click", (e) => {
    if (e.target.id === "systems-overlay") closeSystemsModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && systemsOverlay()?.classList.contains("open")) closeSystemsModal();
  });
}

async function openSystemsModal() {
  if (!document.getElementById(SYSTEMS_ROOT_ID) || !document.getElementById("systems-overlay")) {
    buildSystemsShell();
  }
  activatedSystemIds = await cloudGet("activatedSystems", []);
  systemsSelected = null;
  renderSystemsPicker();

  const root = document.getElementById(SYSTEMS_ROOT_ID);
  root.hidden = false;
  requestAnimationFrame(() => systemsOverlay().classList.add("open"));

  // Reuse the existing lock mechanism for locked system cards —
  // this modal is injected after page load, so it needs its own pass.
  if (typeof applyAccountLocks === "function" && typeof getUserPlan === "function") {
    applyAccountLocks(await getUserPlan());
  }
}

function closeSystemsModal() {
  const overlay = systemsOverlay();
  if (!overlay) return;
  overlay.classList.remove("open");
  setTimeout(() => { document.getElementById(SYSTEMS_ROOT_ID).hidden = true; }, 200);
}

// ----- Step 1: picker grid -----
function renderSystemsPicker() {
  const box = document.getElementById("systems-box");
  box.innerHTML = `
    <div class="template-library-header">
      <div>
        <h3><i class="fa-solid fa-layer-group"></i> Etho Systems</h3>
        <p class="template-library-sub">Activate a complete starter system — goals, checklist, categories and (where relevant) a weekly schedule — in one click.</p>
      </div>
      <button class="template-library-close" id="systems-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="template-library-grid" id="systems-grid"></div>
  `;
  document.getElementById("systems-close").addEventListener("click", closeSystemsModal);

  const grid = document.getElementById("systems-grid");
  ETHO_SYSTEMS.forEach((sys, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "template-btn template-lib-card";
    if (sys.locked) card.setAttribute("data-account-feature", "");
    card.style.animationDelay = `${Math.min(index, 10) * 35}ms`;
    const activated = activatedSystemIds.includes(sys.id);
    card.innerHTML = `
      <span class="template-lib-icon"><i class="${sys.icon}"></i></span>
      <span class="template-lib-text">
        <span class="template-lib-name">${sys.name}${activated ? ' <i class="fa-solid fa-circle-check" style="color:#22C55E;font-size:0.75em;" title="Already activated"></i>' : ""}</span>
        <span class="template-lib-person">${sys.tagline}</span>
      </span>
    `;
    // data-account-feature elements get their click intercepted by auth.js's
    // capturing-phase listener when the user is free — this handler simply
    // never runs for them, same as the template library cards.
    card.addEventListener("click", () => {
      systemsSelected = sys;
      renderSystemsPreview();
    });
    grid.appendChild(card);
  });
}

// ----- Step 2: preview + activate -----
function renderSystemsPreview() {
  const sys = systemsSelected;
  if (!sys) return renderSystemsPicker();
  const box = document.getElementById("systems-box");

  const goalsHTML = sys.goals.map(g => `<li><i class="fa-solid fa-bullseye"></i> ${g.title}</li>`).join("");
  const tasksHTML = sys.checklistTasks.map(t =>
    `<li><i class="fa-solid fa-check"></i> ${t.text}${t.hour ? ` <span class="systems-preview-hour">${t.hour}</span>` : ""}</li>`
  ).join("");
  const catsHTML = sys.categories.map(c => `<span class="category-btn" style="pointer-events:none;">${c}</span>`).join("");
  const agendaHTML = (sys.agendaBlocks || []).map(b =>
    `<li><i class="fa-solid fa-calendar-day"></i> ${b.title} — ${b.time}, ${b.weekdays.length === 7 ? "every day" : b.weekdays.map(w => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][w]).join("/")}</li>`
  ).join("");

  box.innerHTML = `
    <div class="template-library-header">
      <div>
        <h3><i class="${sys.icon}"></i> ${sys.name}</h3>
        <p class="template-library-sub">${sys.tagline}</p>
      </div>
      <button class="template-library-close" id="systems-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="systems-preview-body">
      <div class="systems-preview-col">
        <h4>Goal${sys.goals.length > 1 ? "s" : ""}</h4>
        <ul class="systems-preview-list">${goalsHTML}</ul>
      </div>
      <div class="systems-preview-col">
        <h4>Checklist <span style="font-weight:400;text-transform:none;letter-spacing:0;">(replaces your Routine list)</span></h4>
        <ul class="systems-preview-list">${tasksHTML}</ul>
      </div>
      ${agendaHTML ? `<div class="systems-preview-col"><h4>Weekly schedule</h4><ul class="systems-preview-list">${agendaHTML}</ul></div>` : ""}
      <div class="systems-preview-col">
        <h4>Categories</h4>
        <div class="systems-preview-cats">${catsHTML}</div>
      </div>
    </div>
    <div class="systems-preview-actions">
      <button class="systems-back-btn" id="systems-back-btn" type="button"><i class="fa-solid fa-arrow-left"></i> Back</button>
      <button class="systems-activate-btn" id="systems-activate-btn" type="button">
        <i class="fa-solid fa-bolt"></i> Activate System
      </button>
    </div>
  `;
  document.getElementById("systems-close").addEventListener("click", closeSystemsModal);
  document.getElementById("systems-back-btn").addEventListener("click", () => { systemsSelected = null; renderSystemsPicker(); });
  document.getElementById("systems-activate-btn").addEventListener("click", activateSelectedSystem);
}

// ----- Activation: writes the bundle into real app storage -----
// Extracted so onboarding.html can activate a system without going
// through the picker/preview modal UI at all.
async function writeSystemToStorage(sys) {
  // 1. Goals + their step plans
  const goals = await cloudGet("productivity_goals_v2", []);
  const plans = await cloudGet("productivity_goal_plans_v2", {});
  sys.goals.forEach(g => {
    const id = Date.now().toString(36) + Math.floor(Math.random() * 90000);
    goals.push({
      id, title: g.title, type: g.type, targetNumber: g.targetNumber,
      desc: g.desc, deadline: "", icon: g.icon,
      progress: 0, completed: false, milestones: [],
      createdAt: new Date().toISOString()
    });
    if (g.steps?.length) plans[id] = g.steps.map(text => ({ text, done: false }));
  });
  await cloudSet("productivity_goals_v2", goals);
  await cloudSet("productivity_goal_plans_v2", plans);

  // 2. Categories (merge, no duplicates)
  const categories = await cloudGet("dashboard_checklist_categories", []);
  sys.categories.forEach(c => { if (!categories.includes(c)) categories.push(c); });
  await cloudSet("dashboard_checklist_categories", categories);

  // 3. Checklist tasks — REPLACES the Routine tab's current list, same as
  // applying a template in checklist.js: the old list is saved to history
  // first (so it's one click away, not lost) rather than merged in.
  const routineData = await cloudGet("dashboard_checklist_current", { tasks: [] });
  const existingTasks = Array.isArray(routineData) ? routineData : (routineData.tasks || []);
  if (existingTasks.length > 0) {
    const history = await cloudGet("dashboard_checklist_history", []);
    history.unshift({ date: new Date(), tasks: existingTasks });
    await cloudSet("dashboard_checklist_history", history.slice(0, 10));
  }
  const newTasks = sys.checklistTasks.map(t => ({
    id: Math.random().toString(36), text: t.text, completed: false,
    category: t.category, hour: t.hour || ""
  }));
  await cloudSet("dashboard_checklist_current", { tasks: newTasks });

  // 4. Agenda — recurring blocks placed on their matching weekdays for the next 7 days
  if (sys.agendaBlocks?.length) {
    const agendaEvents = await cloudGet("agendaEvents", {});
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const weekday = d.getDay();
      sys.agendaBlocks.forEach(b => {
        if (!b.weekdays.includes(weekday)) return;
        if (!agendaEvents[iso]) agendaEvents[iso] = [];
        agendaEvents[iso].push({
          id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          title: b.title, time: b.time, color: b.color
        });
      });
    }
    await cloudSet("agendaEvents", agendaEvents);
  }

  // 5. Remember this system was activated (picker badge only)
  const activated = await cloudGet("activatedSystems", []);
  if (!activated.includes(sys.id)) {
    activated.push(sys.id);
    await cloudSet("activatedSystems", activated);
  }
}
window.writeSystemToStorage = writeSystemToStorage;

async function activateSelectedSystem() {
  const sys = systemsSelected;
  if (!sys) return;

  const proceed = window.customConfirm
    ? await customConfirm(
        `Activate the ${sys.name}? This adds a goal and categories${sys.agendaBlocks?.length ? ", schedules agenda events," : ""} and REPLACES your current Routine checklist (your old list is saved to history first).`,
        { confirmText: "Activate" }
      )
    : true;
  if (!proceed) return;

  const btn = document.getElementById("systems-activate-btn");
  if (btn) { btn.disabled = true; btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Activating…`; }

  await writeSystemToStorage(sys);

  if (window.confetti) confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
  closeSystemsModal();

  // Dashboard cards (goals/checklist/agenda stats) read these same keys
  // on load — reload so the whole dashboard reflects the new system
  // immediately instead of only updating in the background.
  setTimeout(() => window.location.reload(), 600);
}

// ----- Init -----
document.addEventListener("DOMContentLoaded", () => {
  const trigger = document.getElementById("open-systems-btn");
  if (!trigger) return;
  trigger.addEventListener("click", openSystemsModal);
  trigger.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openSystemsModal(); }
  });
});