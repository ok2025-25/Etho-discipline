/* ============================================================
   ETHO — shared Etho Score calculator (spec §5)
   ------------------------------------------------------------
   Pure data function, no DOM reads/writes — script.js (home
   dashboard) and consistency.js both call this so the number
   shown on both pages can never drift out of sync with each
   other. Weighted inputs are excluded (not zeroed) when there's
   no data for them yet, and the remaining weights are
   re-normalized — see spec §5 ("don't display fake precision").

   Weights: today's Routine completion 40%, goals-completed
   ratio 20%, plain Checklist-tab completion 15%, today's
   fitness execution 15%, today's habit completion 10%.

   Returns { score: number|null, hasData: boolean, breakdown }.
   score is null (and hasData false) when nothing has any data
   yet — the caller should show "Build your score today" in
   that case. breakdown is always a 5-entry array (one per
   category, in weight order) so a UI can show every category —
   including ones with no data yet — not just the ones counted;
   each entry is { key, label, pct, weight, included }, where
   `weight` is the category's re-normalized share of the score
   actually shown (0 for excluded categories), and `pct` is null
   for excluded categories.
   ============================================================ */

async function computeEthoScore() {
    const [routine, basicChecklist, goals, trackerState, fitnessExecutionPct] = await Promise.all([
        cloudGet("dashboard_checklist_current", { tasks: [] }),
        cloudGet("dashboard_checklist_basic_current", { tasks: [] }),
        cloudGet("productivity_goals_v2", []),
        cloudGet("prod_momentum_data", { habits: [] }),
        computeFitnessTodayExecutionPct()
    ]);

    const routineTasks = routine.tasks || [];
    const routinePct = routineTasks.length > 0
        ? Math.round((routineTasks.filter(t => t.completed).length / routineTasks.length) * 100)
        : null;

    const basicTasks = basicChecklist.tasks || [];
    const basicPct = basicTasks.length > 0
        ? Math.round((basicTasks.filter(t => t.completed).length / basicTasks.length) * 100)
        : null;

    const goalsPct = goals.length > 0
        ? Math.round((goals.filter(g => g.completed).length / goals.length) * 100)
        : null;

    const habits = trackerState.habits || [];
    const today = typeof getTodayKey === "function" ? getTodayKey() : ethoScoreTodayKey();
    const habitPct = habits.length > 0
        ? Math.round((habits.filter(h => h.history && h.history[today]).length / habits.length) * 100)
        : null;

    const categories = [
        { key: "routine", label: "Today's Routine", pct: routinePct, weight: 40 },
        { key: "goals", label: "Goals Completed", pct: goalsPct, weight: 20 },
        { key: "checklist", label: "Checklist", pct: basicPct, weight: 15 },
        { key: "fitness", label: "Fitness Execution", pct: fitnessExecutionPct, weight: 15 },
        { key: "habits", label: "Habits Today", pct: habitPct, weight: 10 }
    ];

    const weighted = categories.filter(i => i.pct !== null);

    if (weighted.length === 0) {
        return {
            score: null,
            hasData: false,
            breakdown: categories.map(c => ({ ...c, included: false, weight: 0 }))
        };
    }

    const totalWeight = weighted.reduce((sum, i) => sum + i.weight, 0);
    const score = Math.round(weighted.reduce((sum, i) => sum + i.pct * i.weight, 0) / totalWeight);

    const breakdown = categories.map(c => ({
        key: c.key,
        label: c.label,
        pct: c.pct,
        included: c.pct !== null,
        // Re-normalized share of the final score, so a UI can show e.g.
        // "Routine — 47% of your score" instead of the raw fixed weight,
        // which would misleadingly still say 40% even when other
        // categories were excluded and it's actually carrying more.
        weight: c.pct !== null ? Math.round((c.weight / totalWeight) * 100) : 0
    }));

    return { score, hasData: true, breakdown };
}

// ----- Etho Score history (account trend view) -----
// Stores one score per calendar day, keyed by ISO date, capped to the
// most recent 60 entries so the payload can't grow unbounded. Callers
// (script.js) record today's score once per render after a successful
// computeEthoScore() — recording is idempotent (same-day calls just
// overwrite today's entry) so it's safe to call on every dashboard load.
const ETHO_SCORE_HISTORY_KEY = "etho_score_history";
const ETHO_SCORE_HISTORY_MAX_DAYS = 60;

async function recordEthoScoreHistory(score) {
    if (typeof score !== "number") return;
    const today = typeof getTodayKey === "function" ? getTodayKey() : ethoScoreTodayKey();
    const history = await cloudGet(ETHO_SCORE_HISTORY_KEY, {});
    history[today] = score;

    const dates = Object.keys(history).sort();
    while (dates.length > ETHO_SCORE_HISTORY_MAX_DAYS) {
        delete history[dates.shift()];
    }

    await cloudSet(ETHO_SCORE_HISTORY_KEY, history);
}

// Returns the last `days` calendar days (oldest first) as
// [{ date, score }], score is null for days with no recorded entry
// (not yet reached, or the user had no data that day) so a chart can
// render gaps instead of fake zeros.
async function getEthoScoreHistory(days = 7) {
    const history = await cloudGet(ETHO_SCORE_HISTORY_KEY, {});
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        out.push({ date: iso, score: Object.prototype.hasOwnProperty.call(history, iso) ? history[iso] : null });
    }
    return out;
}

// Same today-execution logic as script.js's renderFitnessCard, minus the
// DOM writes — kept in sync manually since it's a small, stable function.
async function computeFitnessTodayExecutionPct() {
    const [plans, dayLog, overrides] = await Promise.all([
        cloudGet("fitnessPlans", []),
        cloudGet("fitnessDayLog", {}),
        cloudGet("fitnessOverrides", {})
    ]);
    const plan = plans.find(p => p.active);
    if (!plan) return null;

    const jsDayToKey = d => ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][d];
    const isWorkout = v => v && typeof v === "object" && Array.isArray(v.exercises);
    const toISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

    const todayStatus = statusFor(todayISOStr);
    if (todayStatus === "rest") return null; // nothing to execute either way
    return todayStatus === "completed" ? 100 : 0;
}

// getTodayKey() already exists as a top-level const in script.js when this
// file loads on home.html. consistency.html doesn't define it, so this
// gives computeEthoScore() a fallback — using a distinct name (not
// "getTodayKey") so it can never collide with script.js's const, no
// matter which file loads first.
function ethoScoreTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}