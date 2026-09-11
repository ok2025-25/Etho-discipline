// ========== DAILY COMPLETION -> CONSISTENCY PROMPT ==========
// Shared across checklist.html and tracker.html. When today's Routine
// checklist and every habit are both fully checked off, this offers a
// one-tap way to stamp today on the Consistency tracker instead of
// making the user remember to go do it by hand on a different page.
//
// Reuses the exact same cloud key/data shape as consistency.js
// (consistency_tracker_data -> { "<year>": { "<y-m-d>": "check"|"cross" } })
// so a stamp made here is identical to one made by hand on that page —
// consistency.js picks it up on its next load with no extra work.
//
// Include AFTER auth.js + cloud-sync.js (needs cloudGet/cloudSet) and
// AFTER dialogs.js (reuses its dialog overlay/box CSS classes).

const CONSISTENCY_DATA_KEY = "consistency_tracker_data";
const ROUTINE_TASKS_KEY = "dashboard_checklist_current";
const MOMENTUM_KEY = "prod_momentum_data";

function cpPad(n) { return String(n).padStart(2, "0"); }
function cpDateKey(date) { return `${date.getFullYear()}-${cpPad(date.getMonth() + 1)}-${cpPad(date.getDate())}`; }
function cpTodayKey() { return cpDateKey(new Date()); }
function cpDismissKey() { return `consistency_prompt_dismissed_${cpTodayKey()}`; }

let consistencyPromptShowing = false;

// Call this after any action that could complete "today" — a task
// checkbox toggle on the Routine tab, or a habit toggle on the Tracker
// page. Cheap to call often: it bails out fast (no network) once today
// has already been stamped or the prompt was dismissed today.
async function checkDailyCompletionAndPrompt() {
  if (consistencyPromptShowing) return;
  if (typeof cloudGet !== "function") return;
  if (localStorage.getItem(cpDismissKey())) return; // already handled/dismissed today

  const todayStr = cpTodayKey();
  const year = new Date().getFullYear();

  // Already stamped today — by this prompt earlier, or by hand on the
  // Consistency page itself — nothing left to ask.
  const trackerData = await cloudGet(CONSISTENCY_DATA_KEY, {});
  if (trackerData[year] && trackerData[year][todayStr]) return;

  const routineData = await cloudGet(ROUTINE_TASKS_KEY, { tasks: [] });
  const routineTasks = routineData.tasks || [];
  const routineDone = routineTasks.length > 0 && routineTasks.every(t => t.completed);

  const momentum = await cloudGet(MOMENTUM_KEY, { habits: [] });
  const habits = momentum.habits || [];
  const habitsDone = habits.length === 0 || habits.every(h => h.history && h.history[todayStr]);

  if (!routineDone || !habitsDone) return;
  // Require at least one real thing completed — an empty routine and no
  // habits shouldn't silently count as "a perfect day".
  if (routineTasks.length === 0 && habits.length === 0) return;

  showConsistencyPrompt(todayStr, year);
}

function showConsistencyPrompt(todayStr, year) {
  consistencyPromptShowing = true;

  const overlay = document.createElement("div");
  overlay.className = "custom-dialog-overlay";
  overlay.innerHTML = `
    <div class="custom-dialog-box" role="dialog" aria-modal="true">
      <div class="custom-dialog-icon" style="color:var(--gold, #D4AF37);"><i class="fa-solid fa-star"></i></div>
      <div class="custom-dialog-body">
        <p>You've completed today's routine and every habit. Mark today on your Consistency tracker?</p>
      </div>
      <div class="custom-dialog-actions">
        <button type="button" class="custom-dialog-btn custom-dialog-cancel" id="cp-not-now">Not now</button>
        <button type="button" class="custom-dialog-btn custom-dialog-confirm" id="cp-mark-success"><i class="fa-solid fa-check"></i> Mark success</button>
      </div>
    </div>
  `;

  let root = document.getElementById("custom-dialog-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "custom-dialog-root";
    document.body.appendChild(root);
  }
  root.appendChild(overlay);

  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => overlay.classList.add("open"));

  function close() {
    document.body.style.overflow = prevOverflow;
    overlay.classList.remove("open");
    setTimeout(() => overlay.remove(), 150);
    consistencyPromptShowing = false;
  }

  function dismissForToday() {
    localStorage.setItem(cpDismissKey(), "1");
    close();
  }

  overlay.querySelector("#cp-not-now").addEventListener("click", dismissForToday);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) dismissForToday(); });

  overlay.querySelector("#cp-mark-success").addEventListener("click", async () => {
    const trackerData = await cloudGet(CONSISTENCY_DATA_KEY, {});
    if (!trackerData[year]) trackerData[year] = {};
    trackerData[year][todayStr] = "check";
    cloudSet(CONSISTENCY_DATA_KEY, trackerData);
    localStorage.setItem(cpDismissKey(), "1");
    close();
  });
}
