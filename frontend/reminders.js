/* ============================================================
   ETHO — Checklist reminders (browser-only, lightweight)
   ------------------------------------------------------------
   Scope, on purpose: Checklist tasks only. No native/OS push, no
   service worker, no repeating poll loop — that combination is
   what caused the old reminder system to slow the app down, so
   it was removed. This version only ever runs ONE timer per
   upcoming task's exact time (via setTimeout), plus a single
   self-rescheduling timer for the midnight rollover. Nothing
   checks the clock on an interval.

   How it hooks into checklist.js: checklist.js is not wrapped in
   an IIFE, so `tasks`, `saveData`, and `renderTasks` are already
   global. Every place checklist.js mutates a task's completion
   state or its time calls saveData() (and usually renderTasks()
   too) — so wrapping those two functions is enough to know
   whenever the schedule needs recomputing, including the very
   first load (renderTasks() is checklist.js's last init step,
   called right after tasks are pulled from the cloud).

   Requires (loaded before this file): checklist.js, cloud-sync.js,
   dialogs.js is not required here.
   ============================================================ */

(function () {
  "use strict";

  const PREF_KEY = "checklistRemindersEnabled";
  const VOLUME_KEY = "checklistRemindersVolume";
  let enabled = false;
  let volume = 0.7; // 0..1, persisted; default is louder than the old fixed 0.2 gain peak
  let timers = new Map(); // taskId -> timeout id
  let midnightTimer = null;
  let toggleBtn = null;
  let volumeSlider = null;
  let activeAlarm = null; // { ctx, oscillators, stopTimeoutId, onInteract } while a 15s alarm is ringing

  // ---------- scheduling (event-driven, never polls) ----------
  function clearAllTimers() {
    timers.forEach(id => clearTimeout(id));
    timers.clear();
  }

  function todayAt(hourStr) {
    const m = /^(\d{2}):(\d{2})$/.exec(hourStr || "");
    if (!m) return null;
    const d = new Date();
    d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return d;
  }

  function scheduleAll() {
    clearAllTimers();
    // NOTE: use the bare `tasks` identifier, not window.tasks — checklist.js
    // declares it with let/const at top scope, so it's a global lexical
    // binding, not a property of window. window.tasks is always undefined.
    if (!enabled || typeof tasks === "undefined" || !Array.isArray(tasks)) return;
    const now = Date.now();
    tasks.forEach(task => {
      if (task.completed || !task.hour) return;
      const when = todayAt(task.hour);
      if (!when) return;
      const delay = when.getTime() - now;
      if (delay <= 0) return; // don't retroactively alarm on past times
      const id = setTimeout(() => fireReminder(task), delay);
      timers.set(task.id, id);
    });
  }

  function scheduleMidnightRollover() {
    if (midnightTimer) clearTimeout(midnightTimer);
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
    midnightTimer = setTimeout(() => { scheduleAll(); scheduleMidnightRollover(); }, next - now);
  }

  // ---------- firing ----------
  // Contextual framing (spec §13): connect the reminder to the day's
  // system instead of a bare "Reminder: <task>" — reliability still comes
  // first (this fires exactly at the scheduled time, no fake "in 15 min"
  // countdown we can't actually back up).
  function fireReminder(task) {
    timers.delete(task.id);
    const title = `⏰ ${task.text}`;
    const body = task.category
        ? `Time for it — part of today's ${task.category} plan.`
        : `It's time. Today's plan is waiting.`;
    let notified = false;
    if (window.Notification && Notification.permission === "granted") {
      try {
        const n = new Notification(title, { body, icon: "./images/favicon.ico", tag: "etho-task-" + task.id });
        n.onclick = () => { window.focus(); n.close(); stopAlarm(); };
        n.onclose = () => stopAlarm(); // best-effort — not all browsers fire this on manual dismiss
        notified = true;
      } catch (err) {
        // fall through to the in-page toast below
      }
    }
    if (!notified) showToast(title, body);
    startAlarm();
  }

  // Schedules a full ~15s alarm pattern up front using the Web Audio clock
  // (sample-accurate, doesn't drift like chained setTimeouts would) and
  // tears the whole thing down the moment the user does *anything* —
  // click, key press, touch, dismissing the toast, or clicking the
  // notification. If they touch nothing, it rings for the full 15s.
  function startAlarm() {
    stopAlarm(); // only one alarm at a time
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const master = ctx.createGain();
      // volume is 0..1 from the slider; ceiling raised from the old 0.5x
      // cap so "max" actually sounds noticeably bigger, not just "loud-ish".
      master.gain.value = Math.max(0, Math.min(1, volume)) * 0.9;
      master.connect(ctx.destination);

      const TOTAL_SECONDS = 15;
      const pattern = [880, 1046, 660]; // brighter/more urgent than before
      const beepDur = 0.18;
      const gap = 0.08;
      const cycleGap = 0.25;

      let t = ctx.currentTime;
      const endTime = t + TOTAL_SECONDS;
      const oscillators = [];

      while (t < endTime) {
        pattern.forEach(freq => {
          if (t >= endTime) return;
          // Fundamental tone — square wave instead of sine: harmonically
          // richer and reads as "alarm" rather than "notification chime",
          // which is the point given the anti-procrastination goal.
          const osc1 = ctx.createOscillator();
          const g1 = ctx.createGain();
          osc1.type = "square";
          osc1.frequency.setValueAtTime(freq, t);
          g1.gain.setValueAtTime(0.0001, t);
          g1.gain.exponentialRampToValueAtTime(1, t + 0.015);
          g1.gain.exponentialRampToValueAtTime(0.0001, t + beepDur);
          osc1.connect(g1).connect(master);
          osc1.start(t);
          osc1.stop(t + beepDur + 0.02);
          oscillators.push(osc1);

          // Octave-up sine layer on top for brightness/perceived loudness
          // without just cranking gain (which would distort the square).
          const osc2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          osc2.type = "sine";
          osc2.frequency.setValueAtTime(freq * 2, t);
          g2.gain.setValueAtTime(0.0001, t);
          g2.gain.exponentialRampToValueAtTime(0.5, t + 0.015);
          g2.gain.exponentialRampToValueAtTime(0.0001, t + beepDur);
          osc2.connect(g2).connect(master);
          osc2.start(t);
          osc2.stop(t + beepDur + 0.02);
          oscillators.push(osc2);

          t += beepDur + gap;
        });
        t += cycleGap;
      }

      const stopTimeoutId = setTimeout(stopAlarm, TOTAL_SECONDS * 1000 + 200);
      const onInteract = () => stopAlarm();
      ["click", "keydown", "touchstart"].forEach(evt =>
        document.addEventListener(evt, onInteract, { capture: true, passive: true })
      );

      activeAlarm = { ctx, oscillators, stopTimeoutId, onInteract };
    } catch (err) {
      // audio isn't essential — the toast/notification still shown, just no sound
    }
  }

  function stopAlarm() {
    if (!activeAlarm) return;
    const { ctx, oscillators, stopTimeoutId, onInteract } = activeAlarm;
    clearTimeout(stopTimeoutId);
    ["click", "keydown", "touchstart"].forEach(evt =>
      document.removeEventListener(evt, onInteract, { capture: true })
    );
    oscillators.forEach(osc => { try { osc.stop(); } catch (err) { /* already stopped */ } });
    try { ctx.close(); } catch (err) { /* already closed */ }
    activeAlarm = null;
  }

  // Preview a short 2-cycle burst for the volume slider — not the full 15s.
  function previewChime() {
    stopAlarm();
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const master = ctx.createGain();
      master.gain.value = Math.max(0, Math.min(1, volume)) * 0.9;
      master.connect(ctx.destination);
      const pattern = [880, 1046, 660];
      let t = ctx.currentTime;
      pattern.forEach(freq => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(1, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        osc.connect(g).connect(master);
        osc.start(t);
        osc.stop(t + 0.2);
        t += 0.26;
      });
      setTimeout(() => ctx.close(), (t - ctx.currentTime) * 1000 + 100);
    } catch (err) { /* ignore */ }
  }

  function showToast(title, body) {
    const toast = document.createElement("div");
    toast.className = "etho-reminder-toast";
    toast.innerHTML = `
      <div class="etho-reminder-toast-icon"><i class="fa-solid fa-bell"></i></div>
      <div class="etho-reminder-toast-body">
        <div class="etho-reminder-toast-title">${escapeHTML(title)}</div>
        <div class="etho-reminder-toast-text">${escapeHTML(body)}</div>
      </div>
      <button type="button" class="etho-reminder-toast-close" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    const remove = () => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 250); };
    toast.querySelector(".etho-reminder-toast-close").addEventListener("click", () => { stopAlarm(); remove(); });
    // Matches the 15s alarm window so the toast doesn't vanish while the
    // sound is still ringing (the global click/keydown listener in
    // startAlarm() will already have stopped the alarm well before this
    // if the user interacted with anything, toast included).
    setTimeout(remove, 15000);
  }

  // ---------- toggle UI ----------
  function renderToggle() {
    if (!toggleBtn) return;
    toggleBtn.classList.toggle("active", enabled);
    toggleBtn.innerHTML = enabled
      ? '<i class="fa-solid fa-bell"></i> Reminders on'
      : '<i class="fa-solid fa-bell-slash"></i> Reminders off';
  }

  async function enableReminders() {
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission(); // must run from a user gesture — called directly from the click handler
    }
    enabled = true;
    cloudSet(PREF_KEY, true);
    renderToggle();
    scheduleAll();
  }

  function disableReminders() {
    enabled = false;
    cloudSet(PREF_KEY, false);
    clearAllTimers();
    stopAlarm();
    renderToggle();
  }

  // ---------- wrap checklist.js's global mutation entry points ----------
  const originalSaveData = window.saveData;
  window.saveData = function (...args) {
    const result = originalSaveData.apply(this, args);
    scheduleAll();
    return result;
  };
  const originalRenderTasks = window.renderTasks;
  window.renderTasks = function (...args) {
    const result = originalRenderTasks.apply(this, args);
    scheduleAll();
    return result;
  };

  // Re-sync if the tab was backgrounded/slept for a while — setTimeout can
  // drift or get throttled, so correct for it on return instead of polling.
  document.addEventListener("visibilitychange", () => { if (!document.hidden) scheduleAll(); });

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", async () => {
    toggleBtn = document.getElementById("reminders-toggle-btn");
    if (!toggleBtn) return;

    enabled = await cloudGet(PREF_KEY, false);
    volume = await cloudGet(VOLUME_KEY, 0.7);
    renderToggle();
    scheduleMidnightRollover();
    // Explicitly (re)schedule here instead of trusting the wrapped
    // renderTasks() to do it: checklist.js's own cloud fetch and this
    // cloudGet() call race each other, so renderTasks() can fire *before*
    // `enabled` is known — in which case scheduleAll() bails out on
    // !enabled and nothing ever reschedules. This call makes scheduling
    // correct regardless of which async call wins.
    scheduleAll();

    toggleBtn.addEventListener("click", () => {
      // Free users never reach this: applyAccountLocks() intercepts clicks on
      // [data-account-feature] elements before this listener runs.
      if (enabled) disableReminders(); else enableReminders();
    });

    // Optional volume slider — wire it up only if the markup exists on this
    // page. Add e.g. <input type="range" id="reminders-volume-slider"
    // min="0" max="1" step="0.05"> near the toggle button to expose it.
    volumeSlider = document.getElementById("reminders-volume-slider");
    if (volumeSlider) {
      volumeSlider.value = volume;
      volumeSlider.addEventListener("input", () => {
        volume = Number(volumeSlider.value);
      });
      volumeSlider.addEventListener("change", () => {
        cloudSet(VOLUME_KEY, volume);
      });
      // let the user hear the level they're picking (short preview, not the full 15s alarm)
      volumeSlider.addEventListener("change", () => previewChime());
    }
  });
})();