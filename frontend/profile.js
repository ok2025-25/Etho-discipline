// ========== PROFILE PAGE LOGIC ==========

document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) { window.location.href = LOGIN_PAGE; return; } // nothing to show a guest here

  renderAccountInfo(user);
  renderTrackerStats();
  renderChecklistStats();
  renderGoalsStats();
  renderLearningStats();
  renderConsistencyStats();
  setupHandlers(user);
});

// ---------- Account header + form ----------
function renderAccountInfo(user) {
  const name = user.user_metadata?.full_name || user.email.split("@")[0];
  const avatarUrl = user.user_metadata?.avatar_url;
  const avatarEl = document.getElementById("profile-avatar");

  document.getElementById("profile-display-name").textContent = name;
  document.getElementById("profile-email").textContent = user.email;
  document.getElementById("profile-email-static").textContent = user.email;
  document.getElementById("profile-name-input").value = user.user_metadata?.full_name || "";

  if (avatarUrl) {
    avatarEl.textContent = "";
    avatarEl.style.backgroundImage = `url("${avatarUrl}")`;
    avatarEl.style.backgroundSize = "cover";
    avatarEl.style.backgroundPosition = "center";
  } else {
    avatarEl.style.backgroundImage = "";
    avatarEl.textContent = name.charAt(0).toUpperCase();
  }

  const planLabel = document.getElementById("profile-plan-label");
  if (planLabel && typeof isSignedIn === "function") {
    try {
      Promise.resolve(isSignedIn(user)).then(signedIn => {
        planLabel.textContent = signedIn ? "Signed in" : "Guest";
      });
    } catch (e) {
      // isSignedIn() unavailable/failed — leave default "Guest" label
    }
  }
}

function setupHandlers(user) {
  const saveBtn = document.getElementById("save-name-btn");
  const nameInput = document.getElementById("profile-name-input");
  const saveMsg = document.getElementById("save-msg");
  const logoutBtn = document.getElementById("logout-btn");

  saveBtn.addEventListener("click", async () => {
    const newName = nameInput.value.trim();
    if (!newName) {
      showSaveMsg("Please enter a name.", true);
      return;
    }

    saveBtn.disabled = true;
    try {
      const { user: updatedUser } = await updateUserFullName(newName);
      document.getElementById("profile-display-name").textContent = newName;
      if (!updatedUser.user_metadata?.avatar_url) {
        document.getElementById("profile-avatar").textContent = newName.charAt(0).toUpperCase();
      }
      updateNavbarUser(updatedUser); // keep the navbar in sync without a reload
      showSaveMsg("Saved!", false);
    } catch (err) {
      showSaveMsg(err.message || "Could not save.", true);
    } finally {
      saveBtn.disabled = false;
    }
  });

  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveBtn.click();
  });

  logoutBtn.addEventListener("click", () => {
    signOutUser();
  });

  const avatarInput = document.getElementById("avatar-input");
  const avatarEl = document.getElementById("profile-avatar");
  if (avatarInput) {
    avatarInput.addEventListener("change", async () => {
      const file = avatarInput.files[0];
      if (!file) return;

      avatarEl.style.opacity = "0.5";
      try {
        const { user: updatedUser } = await uploadUserAvatar(file);
        renderAccountInfo(updatedUser);
        updateNavbarUser(updatedUser);
        showSaveMsg("Profile picture updated!", false);
      } catch (err) {
        showSaveMsg(err.message || "Could not upload picture.", true);
      } finally {
        avatarEl.style.opacity = "1";
        avatarInput.value = "";
      }
    });
  }
}

function showSaveMsg(text, isError) {
  const el = document.getElementById("save-msg");
  el.textContent = text;
  el.className = "profile-save-msg show" + (isError ? " error" : "");
  setTimeout(() => el.classList.remove("show"), 2500);
}

// Writes a stat value to both the free-plan (legacy) element and the
// Account tile element, since both versions render in the DOM at once
// and are toggled purely via CSS ([data-plan]).
function setStat(baseId, value) {
  const legacyEl = document.getElementById(baseId);
  if (legacyEl) legacyEl.textContent = value;
  const accountEl = document.getElementById("account-" + baseId);
  if (accountEl) accountEl.textContent = value;
}

// ---------- Momentum Tracker stats ----------
async function renderTrackerStats() {
  const state = await cloudGet("prod_momentum_data", { habits: [] });
  const habits = state.habits || [];

  const today = new Date().toISOString().split("T")[0];

  // Today's completion
  const doneToday = habits.filter(h => h.history && h.history[today]).length;
  const todayPct = habits.length > 0 ? Math.round((doneToday / habits.length) * 100) : 0;

  // Total check-ins
  let totalChecks = 0;
  habits.forEach(h => { totalChecks += Object.keys(h.history || {}).length; });

  // Streak (same logic as tracker.js)
  let streak = 0;
  let d = new Date();
  while (true) {
    const dateStr = d.toISOString().split("T")[0];
    const anyDone = habits.some(h => h.history && h.history[dateStr]);
    if (dateStr === today) {
      if (anyDone) streak++;
    } else {
      if (anyDone) streak++;
      else break;
    }
    d.setDate(d.getDate() - 1);
    // safety cap to avoid infinite loop on corrupted data
    if (streak > 3650) break;
  }

  setStat("stat-streak", streak);
  setStat("stat-today-pct", todayPct + "%");
  setStat("stat-total-checkins", totalChecks);

  const ring = document.getElementById("ring-today-pct");
  if (ring) ring.style.setProperty("--pct", todayPct);
}

// ---------- Checklist stats ----------
async function renderChecklistStats() {
  const current = await cloudGet("dashboard_checklist_current", { tasks: [] });
  const tasks = current.tasks || [];
  const history = await cloudGet("dashboard_checklist_history", []);

  const doneToday = tasks.filter(t => t.completed).length;
  const todayPct = tasks.length > 0 ? Math.round((doneToday / tasks.length) * 100) : 0;

  // Total tasks ever completed = today's completed + completed tasks saved in history
  let historyCompleted = 0;
  let listsCompleted = 0;
  history.forEach(entry => {
    const entryTasks = entry.tasks || [];
    const completedInEntry = entryTasks.filter(t => t.completed).length;
    historyCompleted += completedInEntry;
    if (entryTasks.length > 0 && completedInEntry === entryTasks.length) listsCompleted++;
  });

  setStat("stat-checklist-today", todayPct + "%");
  setStat("stat-checklist-done", doneToday + historyCompleted);
  setStat("stat-checklist-lists", listsCompleted);

  const ring = document.getElementById("ring-checklist-today");
  if (ring) ring.style.setProperty("--pct", todayPct);
}

// ---------- Goals stats ----------
async function renderGoalsStats() {
  const goals = await cloudGet("productivity_goals_v2", []);
  const total = goals.length;
  const done = goals.filter(g => g.completed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  setStat("stat-goals-total", total);
  setStat("stat-goals-done", done);
  setStat("stat-goals-pct", pct + "%");

  const ring = document.getElementById("ring-goals-pct");
  if (ring) ring.style.setProperty("--pct", pct);
}

// ---------- Learning stats ----------
async function renderLearningStats() {
  const notes = await cloudGet("learningNotes", []);
  setStat("stat-notes-count", notes.length);
}

// ---------- Consistency Tracker stats ----------
async function renderConsistencyStats() {
  const data = await cloudGet("consistency_tracker_data", {});

  // Success rate for the current calendar year
  const currentYear = new Date().getFullYear();
  const yearData = data[currentYear] || {};
  const values = Object.values(yearData);
  const checks = values.filter(v => v === "check").length;
  const crosses = values.filter(v => v === "cross").length;
  const logged = checks + crosses;
  const rate = logged > 0 ? Math.round((checks / logged) * 100) : 0;

  // Current streak: walk backward day-by-day from today across all years
  const pad = n => String(n).padStart(2, "0");
  const dateKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  let streak = 0;
  const d = new Date();
  while (true) {
    const year = d.getFullYear();
    const status = data[year] ? data[year][dateKey(d)] : undefined;
    if (status === "check") {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
    if (streak > 3650) break; // safety cap
  }

  setStat("stat-consistency-streak", streak);
  setStat("stat-consistency-rate", rate + "%");

  const ring = document.getElementById("ring-consistency-rate");
  if (ring) ring.style.setProperty("--pct", rate);
}

// ---------- Sidebar (mobile) ----------
const burger = document.getElementById("sidebar-toggle");
const sidebar = document.getElementById("sidebar");
const sidebarOverlayEl = document.getElementById("overlay");

if (burger && sidebar) {
  burger.addEventListener("click", () => {
    burger.classList.toggle("active");
    sidebar.classList.toggle("open");
    sidebarOverlayEl?.classList.toggle("active", sidebar.classList.contains("open"));
  });

  sidebarOverlayEl?.addEventListener("click", () => {
    sidebar.classList.remove("open");
    burger.classList.remove("active");
    sidebarOverlayEl.classList.remove("active");
  });

  document.addEventListener("click", (e) => {
    if (!sidebar.contains(e.target) && !burger.contains(e.target) && !e.target.closest(".mobile-bottom-nav")) {
      sidebar.classList.remove("open");
      burger.classList.remove("active");
      sidebarOverlayEl?.classList.remove("active");
    }
  });
}