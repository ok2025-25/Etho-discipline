document.addEventListener("DOMContentLoaded", async () => {
    const user = await requireAuth();

    // Personalized greeting (spec §4 header) — "Good morning/afternoon/evening, [Name]."
    // Guests (user is null) just get the plain time-of-day greeting.
    const greetingEl = document.getElementById("dash-greeting");
    if (greetingEl) {
        const label = user?.user_metadata?.full_name || user?.email || "";
        const firstName = label.split(/[\s@]/)[0];
        const hour = new Date().getHours();
        const timeGreeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
        greetingEl.textContent = firstName ? `${timeGreeting}, ${firstName}.` : `${timeGreeting}.`;
    }

    const burger = document.getElementById("burger");
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("overlay");

    function openSidebar() {
        sidebar.classList.add("open");
        overlay.classList.add("active");
        burger.classList.add("active");
    }

    function closeSidebar() {
        sidebar.classList.remove("open");
        overlay.classList.remove("active");
        burger.classList.remove("active");
    }

    function toggleSidebar() {
        sidebar.classList.contains("open")
            ? closeSidebar()
            : openSidebar();
    }

    // Burger click
    burger.addEventListener("click", toggleSidebar);

    // Keyboard support
    burger.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggleSidebar();
        }
    });

    // Close when clicking overlay
    overlay.addEventListener("click", closeSidebar);

    // Close when pressing Escape
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            closeSidebar();
        }
    });

    // Close sidebar when a menu link is clicked (mobile)
    document.querySelectorAll(".sidebar a").forEach(link => {
        link.addEventListener("click", closeSidebar);
    });

    // Optional username from localStorage (kept as fallback;
    // requireAuth() already overwrites .username with the Supabase user)
    const usernameEl = document.querySelector(".username");
    const savedUsername = localStorage.getItem("username");

    if (savedUsername && usernameEl && !user) {
        usernameEl.textContent = `Welcome, ${savedUsername}`;
    }

    // Clickable dashboard cards — the whole card navigates now, not just
    // the small "View →" text, giving a much larger, easier tap target
    document.querySelectorAll("[data-href]").forEach(card => {
        const go = () => { window.location.href = card.dataset.href; };
        card.addEventListener("click", go);
        card.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                go();
            }
        });
    });

    // Populate the dashboard's live stats (checklist, tracker, goals,
    // consistency, learning) if this page has them — safe no-op elsewhere.
    if (document.getElementById("dash-date")) {
        renderDashboardStats();
    }
});

// ========== COUNT-UP ANIMATION ==========
// Small, dependency-free number tween for stat values — used across the
// dashboard so numbers land with a bit of motion instead of popping in.
function animateCount(el, target, duration = 700) {
    if (!el) return;
    const start = 0;
    const startTime = performance.now();
    const isInt = Number.isInteger(target);
    const step = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const value = start + (target - start) * eased;
        el.textContent = isInt ? Math.round(value) : value.toFixed(1);
        if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

// ========== DASHBOARD STATS ==========

const getTodayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

async function renderDashboardStats() {
    const dateEl = document.getElementById("dash-date");
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString(undefined, {
            weekday: "long", year: "numeric", month: "long", day: "numeric"
        });
    }

    const [trackerInfo, goalsInfo, consistencyInfo, fitnessInfo] = await Promise.all([
        renderTrackerHero(),
        renderGoalsCard(),
        renderConsistencyCard(),
        renderFitnessCard()
    ]);
    await renderTodayProgressAndScore();
    await renderTodayChecklistWidget();
    renderLearningCard();
    renderSmartRemindersCard();
    renderAgendaCard();
    if (window.isSignedIn && (await isSignedIn())) {
        renderAccountDashboardExtras();
    }

    // Header "day streak" badge shows whichever streak (habits vs. consistency vs. fitness) is highest
    const bestStreak = Math.max(trackerInfo || 0, consistencyInfo || 0, (fitnessInfo && fitnessInfo.streak) || 0);
    const bestStreakEl = document.getElementById("header-best-streak");
    if (bestStreakEl) animateCount(bestStreakEl, bestStreak);
}

// ---------- Account dashboard extras: Etho Score Trend + Weekly Momentum ----------
// Weekly Momentum is a real 7-day activity count. The trend card used to be
// a separate "Focus Score" with its own blended-average formula — a second,
// competing "your score" number sitting right under the real Etho Score,
// which undercut the "one number for your day" pitch and linked to a
// Consistency page that had no Focus Score on it at all. Replaced with a
// proper Etho Score trend (reuses computeEthoScore()/getEthoScoreHistory()
// from etho-score.js, so it's the same number, just over time) that opens
// the same breakdown modal instead of a mismatched link.
async function renderAccountDashboardExtras() {
    const [checklistCurrent, trackerState, consistencyData, checklistHistory] = await Promise.all([
        cloudGet("dashboard_checklist_current", { tasks: [] }),
        cloudGet("prod_momentum_data", { habits: [] }),
        cloudGet("consistency_tracker_data", {}),
        cloudGet("dashboard_checklist_history", [])
    ]);

    const tasks = checklistCurrent.tasks || [];
    const habits = trackerState.habits || [];
    const today = getTodayKey();

    // ----- Etho Score Trend: today's score + delta vs yesterday, with a
    // 7-day sparkline sourced from the shared history helper -----
    const [{ score: todayScore, breakdown: todayBreakdown }, history] = await Promise.all([
        computeEthoScore(),
        getEthoScoreHistory(7)
    ]);

    const trendValueEl = document.getElementById("etho-trend-value");
    const trendBadgeEl = document.getElementById("etho-trend-badge");
    const trendChartEl = document.getElementById("etho-trend-chart");
    const trendCardEl = document.getElementById("etho-trend-card");

    if (trendValueEl) trendValueEl.textContent = todayScore === null ? "—" : todayScore;

    if (trendBadgeEl) {
        const priorEntries = history.filter(h => h.date !== today && h.score !== null);
        const yesterday = priorEntries.length > 0 ? priorEntries[priorEntries.length - 1].score : null;
        if (todayScore === null || yesterday === null) {
            trendBadgeEl.textContent = "New";
            trendBadgeEl.classList.add("muted");
        } else {
            const delta = todayScore - yesterday;
            trendBadgeEl.textContent = delta === 0 ? "Steady" : `${delta > 0 ? "+" : ""}${delta} vs yesterday`;
            trendBadgeEl.classList.toggle("muted", delta <= 0);
        }
    }

    if (trendChartEl) {
        const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
        trendChartEl.innerHTML = history.map(h => {
            const isToday = h.date === today;
            const height = h.score === null ? 12 : Math.max(10, h.score);
            const label = dayLabels[new Date(h.date + "T00:00:00").getDay()];
            return `<div class="week-bar${h.score !== null ? " active" : ""}${isToday ? " today" : ""}" style="height:${height}%"><span>${label}</span></div>`;
        }).join("");
    }

    if (trendCardEl) {
        const openBreakdown = () => showEthoScoreBreakdown(todayScore, todayBreakdown);
        trendCardEl.onclick = openBreakdown;
        trendCardEl.onkeydown = (e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openBreakdown(); }
        };
    }

    // ----- Weekly Momentum: days in the last 7 (incl. today) with at
    // least one logged action across checklist, habits, or consistency -----
    const last7 = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }

    const checklistDoneDates = new Set(
        checklistHistory
            .filter(h => (h.tasks || []).some(t => t.completed))
            .map(h => new Date(h.date).toISOString().split("T")[0])
    );
    if (tasks.some(t => t.completed)) checklistDoneDates.add(today);

    const activeDays = last7.filter(dateStr => {
        const habitDone = habits.some(h => h.history && h.history[dateStr]);
        const year = dateStr.split("-")[0];
        const consistencyDone = consistencyData[year] && consistencyData[year][dateStr] === "check";
        return habitDone || consistencyDone || checklistDoneDates.has(dateStr);
    }).length;

    const rankValueEl = document.getElementById("weekly-rank-value");
    const rankBadgeEl = document.getElementById("weekly-rank-badge");
    if (rankValueEl) animateCount(rankValueEl, activeDays);
    if (rankBadgeEl) {
        rankBadgeEl.textContent = activeDays >= 6 ? "On fire" : activeDays >= 4 ? "Consistent" : activeDays >= 1 ? "Warming up" : "Not yet";
        rankBadgeEl.classList.toggle("muted", activeDays < 4);
    }

    // ----- Mini 7-day chart: same active/inactive data as above, rendered
    // oldest-to-newest so it reads left-to-right like a normal chart -----
    const chartEl = document.getElementById("week-chart");
    if (chartEl) {
        const dayLabels = ["S", "M", "T", "W", "T", "F", "S"];
        const ordered = [...last7].reverse(); // oldest -> newest (today last)
        chartEl.innerHTML = ordered.map((dateStr, idx) => {
            const habitDone = habits.some(h => h.history && h.history[dateStr]);
            const year = dateStr.split("-")[0];
            const consistencyDone = consistencyData[year] && consistencyData[year][dateStr] === "check";
            const isActive = habitDone || consistencyDone || checklistDoneDates.has(dateStr);
            const isToday = dateStr === today;
            const label = dayLabels[new Date(dateStr + "T00:00:00").getDay()];
            return `<div class="week-bar${isActive ? " active" : ""}${isToday ? " today" : ""}" style="height:${isActive ? 100 : 12}%"><span>${label}</span></div>`;
        }).join("");
    }
}

// ---------- Today's Progress + Etho Score (spec §3-5) ----------
// Today's Progress reads the same "dashboard_checklist_current" Routine
// tasks the Checklist page's Routine tab uses — this dashboard doesn't
// keep a second copy of "today's plan". The Etho Score itself is computed
// by the shared computeEthoScore() (etho-score.js) so home.html and
// consistency.html can never show two different numbers.
async function renderTodayProgressAndScore() {
    const routine = await cloudGet("dashboard_checklist_current", { tasks: [] });
    const routineTasks = routine.tasks || [];
    const done = routineTasks.filter(t => t.completed).length;
    const total = routineTasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    const doneEl = document.getElementById("today-progress-done");
    const totalEl = document.getElementById("today-progress-total");
    const fillEl = document.getElementById("today-progress-fill");
    const pctEl = document.getElementById("today-progress-pct");

    if (doneEl) animateCount(doneEl, done);
    if (totalEl) totalEl.textContent = total;
    if (fillEl) fillEl.style.width = pct + "%";
    if (pctEl) pctEl.textContent = total > 0 ? `${pct}% completed today` : "Add today's plan to get started";

    // ----- Etho Score (shared calculator — see etho-score.js) -----
    // Account-exclusive flagship feature: guests never get the real
    // number computed OR rendered — computeEthoScore() isn't even
    // called for them, so there's nothing sitting in the DOM to leak.
    // They see a gold locked teaser instead of a dimmed real value.
    const scoreWrapEl = document.querySelector(".today-hero-score");
    const scoreValueEl = document.getElementById("etho-score-value");
    const scoreSubEl = document.getElementById("etho-score-sub");
    const scoreRingEl = document.getElementById("etho-score-ring-fill");
    const RING_CIRCUMFERENCE = 326.7;

    const signedIn = window.isSignedIn && (await isSignedIn());

    if (!signedIn) {
        if (scoreWrapEl) scoreWrapEl.classList.add("etho-score-teaser");
        if (scoreValueEl) scoreValueEl.innerHTML = '<i class="fa-solid fa-lock"></i>';
        if (scoreSubEl) scoreSubEl.textContent = "Sign in to unlock";
        if (scoreRingEl) scoreRingEl.style.strokeDashoffset = String(RING_CIRCUMFERENCE * 0.4);
        return;
    }

    if (scoreWrapEl) scoreWrapEl.classList.remove("etho-score-teaser");
    const { score, hasData, breakdown } = await computeEthoScore();

    if (!hasData) {
        if (scoreValueEl) scoreValueEl.textContent = "—";
        if (scoreSubEl) scoreSubEl.textContent = "Build your score today";
        if (scoreRingEl) scoreRingEl.style.strokeDashoffset = RING_CIRCUMFERENCE;
        bindEthoScoreClick(scoreWrapEl, () => showEthoScoreBreakdown(null, breakdown));
        return;
    }

    if (scoreValueEl) scoreValueEl.textContent = score;
    if (scoreSubEl) scoreSubEl.textContent = "Today's discipline";
    if (scoreRingEl) scoreRingEl.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - score / 100));

    // Clicking the score opens the "what's driving this" breakdown —
    // Signed-in users only (the wrap has no click handler at all when locked,
    // so free users just get the normal upgrade-prompt click already
    // wired by data-account-feature).
    bindEthoScoreClick(scoreWrapEl, () => showEthoScoreBreakdown(score, breakdown));

    // Fire-and-forget: today's score joins the trend history the
    // "Etho Score · This Week" card reads. Never blocks rendering.
    recordEthoScoreHistory(score);
}

function bindEthoScoreClick(el, handler) {
    if (!el) return;
    el.onclick = handler;
    el.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(); }
    };
}

// ---------- Etho Score breakdown modal (spec depth pass) ----------
// Shows exactly which categories fed today's number and how much each
// one is currently worth — including categories with no data yet, so
// it doubles as a nudge ("log a workout to bring Fitness into your
// score") rather than just a readout.
const ETHO_BREAKDOWN_ICONS = {
    routine: "fa-list-check",
    goals: "fa-bullseye",
    checklist: "fa-square-check",
    fitness: "fa-dumbbell",
    habits: "fa-repeat"
};

function showEthoScoreBreakdown(score, breakdown) {
    if (!breakdown) return;
    if (document.getElementById("etho-breakdown-modal")) return;

    injectEthoBreakdownStyles();

    const rowsHTML = breakdown.map(c => {
        const icon = ETHO_BREAKDOWN_ICONS[c.key] || "fa-circle";
        if (!c.included) {
            return `
              <div class="etho-breakdown-row etho-breakdown-row-empty">
                <div class="etho-breakdown-icon"><i class="fa-solid ${icon}"></i></div>
                <div class="etho-breakdown-info">
                  <div class="etho-breakdown-label">${c.label}</div>
                  <div class="etho-breakdown-note">No data yet — not counted today</div>
                </div>
              </div>`;
        }
        return `
          <div class="etho-breakdown-row">
            <div class="etho-breakdown-icon"><i class="fa-solid ${icon}"></i></div>
            <div class="etho-breakdown-info">
              <div class="etho-breakdown-label">${c.label}</div>
              <div class="etho-breakdown-bar-bg"><div class="etho-breakdown-bar-fill" style="width:${c.pct}%"></div></div>
            </div>
            <div class="etho-breakdown-stats">
              <span class="etho-breakdown-pct">${c.pct}%</span>
              <span class="etho-breakdown-weight">${c.weight}% of score</span>
            </div>
          </div>`;
    }).join("");

    const overlay = document.createElement("div");
    overlay.id = "etho-breakdown-modal";
    overlay.className = "etho-breakdown-overlay";
    overlay.innerHTML = `
      <div class="etho-breakdown-box">
        <button type="button" class="etho-breakdown-close" aria-label="Close">&times;</button>
        <div class="etho-breakdown-header">
          <div class="etho-breakdown-score">${score === null ? "—" : score}</div>
          <div class="etho-breakdown-title">${score === null ? "Build your score today" : "What's driving your score"}</div>
        </div>
        <div class="etho-breakdown-rows">${rowsHTML}</div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector(".etho-breakdown-close").onclick = () => overlay.remove();
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
}

function injectEthoBreakdownStyles() {
    if (document.getElementById("etho-breakdown-styles")) return;
    const style = document.createElement("style");
    style.id = "etho-breakdown-styles";
    style.textContent = `
      .etho-breakdown-overlay {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.65);
        backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        z-index: 5000;
        padding: var(--space-lg);
      }
      .etho-breakdown-box {
        position: relative;
        background: var(--glass-surface, #140505);
        border: 1px solid var(--gold-glow);
        box-shadow: 0 0 32px var(--gold-glow);
        border-radius: var(--radius-lg);
        padding: var(--space-xl);
        max-width: 380px;
        width: 100%;
      }
      .etho-breakdown-close {
        position: absolute; top: 12px; right: 14px;
        background: none; border: none; cursor: pointer;
        font-size: 1.4rem; line-height: 1; color: var(--text-muted);
      }
      .etho-breakdown-close:hover { color: var(--text-main); }
      .etho-breakdown-header { text-align: center; margin-bottom: var(--space-lg); }
      .etho-breakdown-score {
        font-size: 2.4rem; font-weight: 800;
        background: linear-gradient(135deg, var(--gold-text), var(--gold));
        -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
      }
      .etho-breakdown-title { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.2rem; }
      .etho-breakdown-rows { display: flex; flex-direction: column; gap: 0.85rem; }
      .etho-breakdown-row { display: flex; align-items: center; gap: 10px; }
      .etho-breakdown-icon {
        width: 32px; height: 32px; flex-shrink: 0;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        background: var(--gold-soft); color: var(--gold);
        font-size: 0.8rem;
      }
      .etho-breakdown-row-empty .etho-breakdown-icon { background: var(--glass-highlight); color: var(--text-muted); }
      .etho-breakdown-info { flex: 1; min-width: 0; }
      .etho-breakdown-label { font-size: 0.82rem; font-weight: 700; color: var(--text-main); margin-bottom: 3px; }
      .etho-breakdown-note { font-size: 0.72rem; color: var(--text-muted); }
      .etho-breakdown-bar-bg { height: 6px; border-radius: 999px; background: var(--glass-highlight); overflow: hidden; }
      .etho-breakdown-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--gold-deep), var(--gold)); }
      .etho-breakdown-stats { text-align: right; flex-shrink: 0; }
      .etho-breakdown-pct { display: block; font-size: 0.85rem; font-weight: 800; color: var(--gold-text); }
      .etho-breakdown-weight { display: block; font-size: 0.65rem; color: var(--text-muted); }
    `;
    document.head.appendChild(style);
}

// ---------- Today's Checklist — central interactive action component (spec §6) ----------
// Same Routine data as Today's Progress above; checking a box here writes
// straight to "dashboard_checklist_current" (the same key checklist.js's
// Routine tab reads/writes) and re-runs the dashboard stats so Today's
// Progress, the Etho Score and the header streak all reflect it immediately
// — no page reload needed.
async function renderTodayChecklistWidget() {
    const listEl = document.getElementById("today-checklist-list");
    if (!listEl) return;

    const routine = await cloudGet("dashboard_checklist_current", { tasks: [] });
    const tasks = routine.tasks || [];

    if (tasks.length === 0) {
        listEl.innerHTML = `<li class="today-checklist-empty">Nothing planned for today yet. <a href="checklist.html">Add a task or activate a System</a>.</li>`;
        return;
    }

    const formatTime = (hourStr) => {
        const m = /^(\d{2}):(\d{2})$/.exec(hourStr || "");
        if (!m) return "";
        const h = Number(m[1]), min = Number(m[2]);
        const period = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 === 0 ? 12 : h % 12;
        return `${h12}:${String(min).padStart(2, "0")} ${period}`;
    };

    listEl.innerHTML = "";
    tasks.forEach(task => {
        const li = document.createElement("li");
        li.className = "today-checklist-item" + (task.completed ? " completed" : "");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "today-checklist-checkbox";
        checkbox.checked = task.completed;
        checkbox.setAttribute("aria-label", `Mark "${task.text}" ${task.completed ? "incomplete" : "complete"}`);
        checkbox.addEventListener("click", (e) => e.stopPropagation());
        checkbox.addEventListener("change", async () => {
            task.completed = checkbox.checked;
            li.classList.toggle("completed", task.completed);
            await cloudSet("dashboard_checklist_current", { tasks });
            // Re-run the stats that depend on this list so Today's Progress,
            // the Etho Score and the streak badge update in place.
            const [goalsInfo, fitnessInfo] = await Promise.all([renderGoalsCard(), renderFitnessCard()]);
            await renderTodayProgressAndScore();
        });

        const text = document.createElement("span");
        text.className = "today-checklist-text";
        text.textContent = task.text;
        if (task.category) {
            const cat = document.createElement("span");
            cat.className = "today-checklist-cat";
            cat.textContent = task.category;
            text.appendChild(cat);
        }

        li.append(checkbox, text);
        if (task.hour) {
            const time = document.createElement("span");
            time.className = "today-checklist-time";
            time.textContent = formatTime(task.hour);
            li.appendChild(time);
        }
        listEl.appendChild(li);
    });
}

// ---------- Momentum Tracker hero ----------
async function renderTrackerHero() {
    const state = await cloudGet("prod_momentum_data", { habits: [] });
    const habits = state.habits || [];
    const today = getTodayKey();

    const doneToday = habits.filter(h => h.history && h.history[today]).length;
    const pct = habits.length > 0 ? Math.round((doneToday / habits.length) * 100) : 0;

    // Streak: consecutive days (from today backward) with at least one habit done
    let streak = 0;
    let d = new Date();
    while (true) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const anyDone = habits.some(h => h.history && h.history[dateStr]);
        if (dateStr === today) {
            if (anyDone) streak++;
        } else if (anyDone) {
            streak++;
        } else {
            break;
        }
        d.setDate(d.getDate() - 1);
        if (streak > 3650) break;
    }

    const valueEl = document.getElementById("tracker-streak-value");
    const fillEl = document.getElementById("tracker-progress-fill");
    const metaEl = document.getElementById("tracker-meta");
    const badgeEl = document.getElementById("tracker-badge");

    if (valueEl) animateCount(valueEl, streak);
    if (fillEl) fillEl.style.width = pct + "%";
    if (metaEl) metaEl.textContent = habits.length > 0
        ? `${doneToday} of ${habits.length} habits done today`
        : "No habits tracked yet";

    if (badgeEl) {
        if (habits.length === 0) { badgeEl.textContent = "Get started"; badgeEl.classList.add("muted"); }
        else { badgeEl.textContent = `${pct}% today`; badgeEl.classList.toggle("muted", pct === 0); }
    }

    return streak;
}

// ---------- Goals card ----------
async function renderGoalsCard() {
    const goals = await cloudGet("productivity_goals_v2", []);
    const total = goals.length;
    const completed = goals.filter(g => g.completed).length;
    const active = total - completed;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    const valueEl = document.getElementById("goals-stat-value");
    const fillEl = document.getElementById("goals-progress-fill");
    const metaEl = document.getElementById("goals-meta");
    const badgeEl = document.getElementById("goals-badge");

    if (valueEl) animateCount(valueEl, active);
    if (fillEl) fillEl.style.width = pct + "%";

    const today = new Date();
    const upcoming = goals
        .filter(g => !g.completed && g.deadline)
        .map(g => ({ ...g, daysLeft: Math.ceil((new Date(g.deadline) - today) / 86400000) }))
        .filter(g => g.daysLeft >= 0)
        .sort((a, b) => a.daysLeft - b.daysLeft)[0];

    if (badgeEl) {
        if (upcoming) {
            badgeEl.textContent = upcoming.daysLeft === 0 ? "Due today" : `${upcoming.daysLeft}d left`;
            badgeEl.classList.remove("muted");
        } else {
            badgeEl.textContent = active > 0 ? `${active} active` : "All done";
            badgeEl.classList.add("muted");
        }
    }

    // Surface which goal that badge is actually about — "3d left" alone
    // doesn't say what's due. Falls back to the plain count when there's
    // no dated goal to point to, so this never grows the card, just
    // fills in what's already there with one more useful fact.
    if (metaEl) {
        if (upcoming) {
            metaEl.textContent = `Next: ${upcoming.title}${upcoming.daysLeft === 0 ? " · due today" : ` · ${upcoming.daysLeft}d left`}`;
        } else if (total > 0) {
            metaEl.textContent = `${completed} of ${total} goals complete`;
        } else {
            metaEl.textContent = "No goals yet";
        }
    }

    return { total, completed, pct: total > 0 ? pct : null };
}

// ---------- Consistency card ----------
async function renderConsistencyCard() {
    const data = await cloudGet("consistency_tracker_data", {});
    const currentYear = new Date().getFullYear();
    const yearData = data[currentYear] || {};
    const values = Object.values(yearData);
    const checks = values.filter(v => v === "check").length;
    const crosses = values.filter(v => v === "cross").length;
    const logged = checks + crosses;
    const rate = logged > 0 ? Math.round((checks / logged) * 100) : 0;

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
        if (streak > 3650) break;
    }

    const valueEl = document.getElementById("consistency-stat-value");
    const fillEl = document.getElementById("consistency-progress-fill");
    const metaEl = document.getElementById("consistency-meta");
    const badgeEl = document.getElementById("consistency-badge");

    if (valueEl) animateCount(valueEl, streak);
    if (fillEl) fillEl.style.width = rate + "%";
    if (metaEl) metaEl.textContent = logged > 0 ? `${rate}% success rate this year` : "Not logged yet this year";

    if (badgeEl) {
        const todayStatus = data[currentYear] ? data[currentYear][getTodayKey()] : undefined;
        if (todayStatus === "check") {
            badgeEl.textContent = "Logged ✓";
            badgeEl.classList.remove("muted");
        } else if (todayStatus === "cross") {
            badgeEl.textContent = "Missed today";
            badgeEl.classList.remove("muted");
        } else {
            badgeEl.textContent = "Not logged";
            badgeEl.classList.add("muted");
        }
    }

    return streak;
}

// ---------- Fitness tracker card ----------
// Mirrors the day-status/streak logic from fitness.js so the dashboard
// card reflects the exact same plan, overrides and history the Fitness
// page itself uses — not a separate/duplicated source of truth.
async function renderFitnessCard() {
    const [plans, sessions, dayLog, overrides] = await Promise.all([
        cloudGet("fitnessPlans", []),
        cloudGet("fitnessSessions", []),
        cloudGet("fitnessDayLog", {}),
        cloudGet("fitnessOverrides", {})
    ]);

    const valueEl = document.getElementById("recovery-value");
    const unitEl = document.getElementById("recovery-unit");
    const metaEl = document.getElementById("recovery-meta");
    const badgeEl = document.getElementById("recovery-badge");

    const plan = plans.find(p => p.active);

    // No plan yet (or none active) — fall back to the original "plans created" framing
    if (!plan) {
        if (valueEl) animateCount(valueEl, plans.length);
        if (unitEl) unitEl.textContent = plans.length === 1 ? "plan created" : "plans created";
        if (metaEl) metaEl.textContent = plans.length > 0
            ? "Set a plan as active to start tracking your streak."
            : "Create your own fitness plan to stay on track with your health.";
        if (badgeEl) {
            badgeEl.textContent = plans.length > 0 ? "No active plan" : "Get started";
            badgeEl.classList.add("muted");
        }
        return { streak: 0, todayExecutionPct: null };
    }

    const jsDayToKey = d => ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d];
    const isWorkout = v => v && typeof v === "object" && Array.isArray(v.exercises);
    const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return toISO(d); };
    const todayISOStr = toISO(new Date());

    function scheduledFor(iso) {
        if (Object.prototype.hasOwnProperty.call(overrides, iso)) return overrides[iso];
        return plan.schedule[jsDayToKey(new Date(iso + "T00:00:00").getDay())] || "rest";
    }
    function statusFor(iso) {
        const log = dayLog[iso];
        if (log && log.status === "completed") return "completed";
        if (log && log.status === "skipped") return "skipped";
        const scheduled = scheduledFor(iso);
        if (!isWorkout(scheduled)) return "rest";
        return iso < todayISOStr ? "missed" : "scheduled";
    }

    let streak = 0, iso = todayISOStr, guard = 0;
    while (guard++ < 400) {
        const st = statusFor(iso);
        if (st === "rest") { iso = addDays(iso, -1); continue; }
        if (st === "completed") { streak++; iso = addDays(iso, -1); continue; }
        if (iso === todayISOStr && st === "scheduled") { iso = addDays(iso, -1); continue; }
        break;
    }
    const todayStatus = statusFor(todayISOStr);

    if (valueEl) animateCount(valueEl, streak);
    if (unitEl) unitEl.textContent = "day streak";
    if (metaEl) metaEl.textContent = sessions.length > 0
        ? `${plan.name} · ${sessions.length} workout${sessions.length === 1 ? "" : "s"} logged`
        : `${plan.name} is active — log your first workout.`;

    if (badgeEl) {
        badgeEl.classList.remove("muted");
        if (todayStatus === "completed") badgeEl.textContent = "Completed ✓";
        else if (todayStatus === "scheduled") badgeEl.textContent = "Workout today";
        else { badgeEl.textContent = "Rest day"; badgeEl.classList.add("muted"); }
    }

    // "Today's fitness execution" for the Etho Score — null (no applicable
    // input) on a rest day, since there's nothing to execute either way.
    const todayExecutionPct = todayStatus === "completed" ? 100
        : todayStatus === "scheduled" || todayStatus === "missed" ? 0
        : null;

    return { streak, todayExecutionPct };
}

// ---------- Smart reminders card ----------
// Reads the same "dashboard_checklist_current" snapshot renderChecklistHero()
// uses (so this is the exact same tasks, not a second source of truth) plus
// the "checklistRemindersEnabled" preference reminders.js persists, and
// surfaces whichever incomplete task with a .hour is coming up next today.
async function renderSmartRemindersCard() {
    const valueEl = document.getElementById("next-action-value");
    const metaEl = document.getElementById("next-action-meta");
    const badgeEl = document.getElementById("next-action-badge");
    if (!valueEl && !metaEl && !badgeEl) return;

    const [remindersOn, current] = await Promise.all([
        cloudGet("checklistRemindersEnabled", false),
        cloudGet("dashboard_checklist_current", { tasks: [] })
    ]);
    const tasks = current.tasks || [];

    const formatTime = (hourStr) => {
        const m = /^(\d{2}):(\d{2})$/.exec(hourStr || "");
        if (!m) return null;
        const h = Number(m[1]), min = Number(m[2]);
        const period = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 === 0 ? 12 : h % 12;
        return `${h12}:${String(min).padStart(2, "0")} ${period}`;
    };

    if (badgeEl) badgeEl.classList.remove("muted");

    if (!remindersOn) {
        if (valueEl) valueEl.textContent = "—";
        if (metaEl) metaEl.textContent = "Reminders are off — turn them on from Checklist.";
        if (badgeEl) { badgeEl.textContent = "Off"; badgeEl.classList.add("muted"); }
        return;
    }

    const now = new Date();
    const upcoming = tasks
        .filter(t => !t.completed && t.hour)
        .map(t => {
            const m = /^(\d{2}):(\d{2})$/.exec(t.hour);
            if (!m) return null;
            const when = new Date();
            when.setHours(Number(m[1]), Number(m[2]), 0, 0);
            return { ...t, when };
        })
        .filter(t => t && t.when > now)
        .sort((a, b) => a.when - b.when)[0];

    if (!upcoming) {
        if (valueEl) valueEl.textContent = "—";
        if (metaEl) metaEl.textContent = tasks.length > 0
            ? "No upcoming reminders left today."
            : "Add task times in Checklist to get reminded.";
        if (badgeEl) { badgeEl.textContent = "None today"; badgeEl.classList.add("muted"); }
        return;
    }

    if (valueEl) valueEl.textContent = formatTime(upcoming.hour);
    if (metaEl) metaEl.textContent = upcoming.text + (upcoming.category ? ` · ${upcoming.category}` : "");
    if (badgeEl) badgeEl.textContent = "NEXT";
}

// ---------- Learning card ----------
async function renderLearningCard() {
    const notes = await cloudGet("learningNotes", []);

    const valueEl = document.getElementById("learning-stat-value");
    const metaEl = document.getElementById("learning-meta");
    const badgeEl = document.getElementById("learning-badge");

    if (valueEl) animateCount(valueEl, notes.length);

    if (notes.length === 0) {
        if (metaEl) metaEl.textContent = "Start capturing ideas.";
        if (badgeEl) { badgeEl.textContent = "Empty"; badgeEl.classList.add("muted"); }
        return;
    }

    const latest = [...notes].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    if (metaEl) metaEl.textContent = `Last note: “${(latest.title || "Untitled")}”`;

    if (badgeEl) {
        const todayStr = new Date().toDateString();
        const editedToday = new Date(latest.date).toDateString() === todayStr;
        badgeEl.textContent = editedToday ? "Updated today" : new Date(latest.date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
        badgeEl.classList.toggle("muted", !editedToday);
    }
}

// ---------- Agenda card ----------
// Reads the same "agendaEvents" cloud key agenda.js writes to (keyed by
// ISO date), so this card is never a second source of truth.
async function renderAgendaCard() {
    const valueEl = document.getElementById("agenda-stat-value");
    const metaEl = document.getElementById("agenda-meta");
    const badgeEl = document.getElementById("agenda-badge");
    if (!valueEl && !metaEl && !badgeEl) return;

    const allEvents = await cloudGet("agendaEvents", {});
    const todayEvents = (allEvents[getTodayKey()] || []).slice().sort((a, b) => {
        const toMin = t => { const m = /^(\d{2}):(\d{2})$/.exec(t || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : 0; };
        return toMin(a.time) - toMin(b.time);
    });

    if (valueEl) animateCount(valueEl, todayEvents.length);

    if (todayEvents.length === 0) {
        if (metaEl) metaEl.textContent = "Nothing scheduled today.";
        if (badgeEl) { badgeEl.textContent = "Free day"; badgeEl.classList.add("muted"); }
        return;
    }

    const now = new Date();
    const upcoming = todayEvents.find(ev => {
        const m = /^(\d{2}):(\d{2})$/.exec(ev.time || "");
        if (!m) return false;
        const when = new Date();
        when.setHours(Number(m[1]), Number(m[2]), 0, 0);
        return when > now;
    });

    if (metaEl) metaEl.textContent = upcoming ? `Next: ${upcoming.title}` : `${todayEvents[0].title} started the day.`;
    if (badgeEl) {
        badgeEl.textContent = upcoming ? "Next up" : `${todayEvents.length} today`;
        badgeEl.classList.remove("muted");
    }
}