/* ============================================================
   ETHO — Goal deadline reminders (browser-only, lightweight)
   ------------------------------------------------------------
   Scope, on purpose: mirrors reminders.js's approach for the
   checklist (no polling loop, no service worker, no OS push).
   Goal deadlines are DATES, not exact times, so this doesn't need
   per-second precision — one self-rescheduling timer that fires
   once a day (at 09:00 local) is enough, plus an immediate
   evaluation whenever the goals data actually changes.

   How it hooks into goals.js: goals.js is not wrapped in an IIFE,
   so `allGoals`, `saveGoals`, and `renderGoals` are already global.
   Wrapping those two functions is enough to know whenever a
   deadline might have changed, including the very first load
   (renderGoals() is goals.js's last init step).

   What triggers a popup, per incomplete goal with a deadline:
     - "coming up"  → 7, 3, or 1 day(s) before the deadline
     - "reached"    → the deadline day itself, and every day it
                      stays incomplete after that (overdue)
   Each goal shows at most one popup per calendar day, tracked in
   cloud storage so it survives refreshes and doesn't nag on every
   page load.

   Requires (loaded before this file): goals.js, cloud-sync.js.
   ============================================================ */

(function () {
  "use strict";

  const PREF_KEY = "goalRemindersEnabled";
  const STATE_KEY = "goalReminderState"; // { [goalId]: { soon: "YYYY-MM-DD", reached: "YYYY-MM-DD" } }
  const SOON_THRESHOLDS = [7, 3, 1]; // days-before checkpoints that trigger a "coming up" popup
  const DAY_MS = 86400000;
  const CHECK_HOUR = 9; // local time the daily evaluation runs at

  let enabled = true;
  let reminderState = {};
  let dailyTimer = null;
  let toggleBtn = null;
  let toggleLabel = null;
  let evaluateQueued = false;

  // ---------- date helpers ----------
  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function dateStr(d) {
    return d.toISOString().slice(0, 10);
  }

  function daysUntil(goal) {
    if (!goal.deadline) return null;
    const due = new Date(goal.deadline + "T00:00:00");
    if (isNaN(due.getTime())) return null;
    return Math.round((due.getTime() - startOfToday().getTime()) / DAY_MS);
  }

  function nextCheckTime() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), CHECK_HOUR, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  // ---------- evaluation (event-driven, never polls) ----------
  function evaluateDeadlines() {
    if (!enabled || typeof allGoals === "undefined" || !Array.isArray(allGoals)) return;

    const today = dateStr(startOfToday());
    const matches = []; // { goal, kind: 'soon' | 'reached', days }
    let stateChanged = false;

    allGoals.forEach(goal => {
      if (goal.completed) return;
      const d = daysUntil(goal);
      if (d === null) return;

      const goalState = reminderState[goal.id] || {};

      if (d <= 0) {
        if (goalState.reached !== today) {
          matches.push({ goal, kind: "reached", days: d });
          goalState.reached = today;
          reminderState[goal.id] = goalState;
          stateChanged = true;
        }
      } else if (SOON_THRESHOLDS.includes(d)) {
        if (goalState.soon !== today) {
          matches.push({ goal, kind: "soon", days: d });
          goalState.soon = today;
          reminderState[goal.id] = goalState;
          stateChanged = true;
        }
      }
    });

    if (stateChanged) cloudSet(STATE_KEY, reminderState);
    matches.forEach(m => enqueuePopup(m));
  }

  // Debounce so saveGoals()+renderGoals() firing back-to-back in the same
  // synchronous chain (common in goals.js) only evaluates once.
  function scheduleEvaluate() {
    if (evaluateQueued) return;
    evaluateQueued = true;
    setTimeout(() => { evaluateQueued = false; evaluateDeadlines(); }, 50);
  }

  function scheduleDailyCheck() {
    if (dailyTimer) clearTimeout(dailyTimer);
    const next = nextCheckTime();
    dailyTimer = setTimeout(() => { evaluateDeadlines(); scheduleDailyCheck(); }, next - new Date());
  }

  // ---------- popup queue (one at a time, so multiple due goals don't stack) ----------
  const popupQueue = [];
  let popupShowing = false;

  function enqueuePopup(match) {
    popupQueue.push(match);
    if (!popupShowing) showNextPopup();
  }

  function showNextPopup() {
    const match = popupQueue.shift();
    if (!match) { popupShowing = false; return; }
    popupShowing = true;

    const { goal, kind, days } = match;
    const isReached = kind === "reached";
    const icon = goal.icon || "🎯";

    let title, text;
    if (isReached) {
      title = days === 0 ? "Deadline is today" : `Deadline passed`;
      text = days === 0
        ? `${icon} "${goal.title}" is due today.`
        : `${icon} "${goal.title}" was due ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago and isn't marked complete yet.`;
    } else {
      title = "Deadline coming up";
      text = `${icon} "${goal.title}" is due in ${days} day${days === 1 ? "" : "s"}.`;
    }

    const el = document.createElement("div");
    el.className = `goal-reminder-popup ${isReached ? "reached" : "soon"}`;
    el.innerHTML = `
      <div class="goal-reminder-popup-icon"><i class="fa-solid ${isReached ? "fa-triangle-exclamation" : "fa-clock"}"></i></div>
      <div style="flex:1; min-width:0;">
        <div class="goal-reminder-popup-title">${escapeHTML(title)}</div>
        <div class="goal-reminder-popup-text">${escapeHTML(text)}</div>
      </div>
      <button type="button" class="goal-reminder-popup-close" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));

    let dismissTimer = setTimeout(dismiss, 9000);
    function dismiss() {
      clearTimeout(dismissTimer);
      el.classList.remove("show");
      setTimeout(() => { el.remove(); showNextPopup(); }, 350);
    }
    el.querySelector(".goal-reminder-popup-close").addEventListener("click", dismiss);
    el.addEventListener("click", (e) => {
      if (e.target.closest(".goal-reminder-popup-close")) return;
      // Clicking the popup body jumps to the goal card.
      dismiss();
      const card = document.querySelector(`[data-goal-id="${goal.id}"]`);
      if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str == null ? "" : String(str);
    return div.innerHTML;
  }

  // ---------- toggle UI ----------
  function renderToggle() {
    if (!toggleBtn) return;
    toggleBtn.classList.toggle("active", enabled);
    if (toggleLabel) toggleLabel.textContent = enabled ? "Reminders on" : "Reminders off";
    const icon = toggleBtn.querySelector("i");
    if (icon) icon.className = enabled ? "fa-solid fa-bell" : "fa-solid fa-bell-slash";
  }

  function toggleReminders() {
    enabled = !enabled;
    cloudSet(PREF_KEY, enabled);
    renderToggle();
    if (enabled) evaluateDeadlines();
  }

  // ---------- wrap goals.js's global mutation entry points ----------
  const originalSaveGoals = window.saveGoals;
  window.saveGoals = function (...args) {
    const result = originalSaveGoals.apply(this, args);
    scheduleEvaluate();
    return result;
  };
  const originalRenderGoals = window.renderGoals;
  window.renderGoals = function (...args) {
    const result = originalRenderGoals.apply(this, args);
    scheduleEvaluate();
    return result;
  };

  // Re-check if the tab was backgrounded/slept for a while — setTimeout can
  // drift or get throttled, so correct for it on return instead of polling.
  document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleEvaluate(); });

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", async () => {
    toggleBtn = document.getElementById("goal-reminders-toggle-btn");
    toggleLabel = document.getElementById("goal-reminders-toggle-label");

    enabled = await cloudGet(PREF_KEY, true);
    reminderState = await cloudGet(STATE_KEY, {});
    renderToggle();
    scheduleDailyCheck();
    // goals.js's own async init (requireAuth + loadGoals) races this same
    // cloudGet() call, so its first renderGoals() can fire before `enabled`
    // is known — the wrapped call above still queues an evaluate either way,
    // and this explicit call covers the case where goals.js finished first.
    scheduleEvaluate();

    if (toggleBtn) toggleBtn.addEventListener("click", toggleReminders);
  });
})();