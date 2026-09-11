/* ============================================================
   ETHO — Personalization Engine (rules-based v1)
   ------------------------------------------------------------
   This file is the ONLY place that knows how a checklist gets
   built from a profile. personalize.js (the UI: quiz, card,
   loading state) never builds tasks itself — it always calls

       window.PersonalizationEngine.generate(profile, context)

   and awaits a result. That's the whole contract:

     profile  { focusTime, motivator, style, vibe, lastVariants? }
     context  { useHours: boolean }
     returns  { tasks: Task[], lastVariants: {...} }
              Task = the same shape checklist.js already uses:
              { id, text, category, completed, hour }

   Swapping in a real AI-backed engine later means adding one
   new file — no edits anywhere else. It would look like:

     // personalize-engine-ai.js (loaded AFTER this file)
     window.PersonalizationEngine = {
       id: "ai-v1",
       async generate(profile, context) {
         try {
           const res = await fetch("/api/generate-checklist", {
             method: "POST",
             body: JSON.stringify({ profile, context })
           });
           if (!res.ok) throw new Error("bad response");
           return await res.json(); // same { tasks, lastVariants } shape
         } catch (err) {
           console.warn("AI engine failed, falling back to rules", err);
           return window.PersonalizationEngineRules.generate(profile, context);
         }
       }
     };

   That's why this engine exports itself under BOTH names below —
   `PersonalizationEngine` (whatever's currently active) and
   `PersonalizationEngineRules` (this implementation specifically,
   so a future engine always has a safe fallback to call).
   ============================================================ */

// ----- Per-time-of-day schedule (kept strictly ascending within
// each style's fixed task order, for every focusTime value) -----
const WAKE_HOUR = { early: "05:30", midday: "07:00", evening: "08:00", varies: "07:30" };
const FOCUS_HOUR = { early: "06:30", midday: "11:00", evening: "18:00", varies: "10:00" };
const RESET_HOUR = { early: "09:00", midday: "13:30", evening: "19:00", varies: "13:00" };
const LEARNING_HOUR = { early: "09:30", midday: "14:00", evening: "19:30", varies: "13:30" };
const FUN_HOUR = { early: "12:00", midday: "16:00", evening: "20:00", varies: "15:30" };
const WIND_DOWN_HOUR = { early: "21:00", midday: "21:30", evening: "22:00", varies: "21:30" };

// ----- Phrasing pools. 3 hand-written variants per slot per vibe
// (or per motivator) so two checklists from the same answers don't
// read identically — pickVariant() below also avoids repeating
// whatever was used last time. -----
const VIBE_WAKE_VARIANTS = {
  calm: [
    "Wake up gently — a few slow minutes before the day starts",
    "Ease into the morning — no rush, no phone yet",
    "Open your eyes, breathe, then get up slowly"
  ],
  energetic: [
    "Wake up & get moving — no snoozing",
    "Up and at it — cold water on your face, straight into motion",
    "Rise fast — the day's waiting on you"
  ],
  professional: [
    "Wake up & review today's priorities",
    "Start the day — check the plan, then execute",
    "Up and oriented — know your top 3 before anything else"
  ],
  playful: [
    "Wake up — start the day like it's level one",
    "Rise and shine, main character energy",
    "Morning! Time to hit start on today"
  ]
};

const VIBE_FOCUS_VARIANTS = {
  calm: [
    "Deep focus block — go slow, stay present",
    "Settle in — one task, unhurried",
    "Quiet focus — no rush, just steady progress"
  ],
  energetic: [
    "Power block — attack your top priority",
    "Go time — full send on the big task",
    "High-intensity focus — clock's running, make it count"
  ],
  professional: [
    "Core focus block — highest-leverage task",
    "Priority block — the task that actually moves things forward",
    "Execution block — no meetings, just output"
  ],
  playful: [
    "Main quest — today's big task",
    "Boss level — the task that matters most today",
    "Today's main event — give it your best shot"
  ]
};

const VIBE_WIND_DOWN_VARIANTS = {
  calm: [
    "Wind down slowly — dim the lights, no screens",
    "Ease out of the day — quiet, unhurried",
    "Slow finish — let the day close gently"
  ],
  energetic: [
    "Cool down — light stretch, plan tomorrow",
    "Wind it down — quick stretch, set tomorrow's target",
    "Final lap — cool down and line up tomorrow"
  ],
  professional: [
    "Close out — review wins, set tomorrow's priority",
    "Day close — quick review, one priority for tomorrow",
    "Shutdown ritual — wrap loose ends, note tomorrow's focus"
  ],
  playful: [
    "Wind down — end the day on a high note",
    "Final boss defeated — time to relax",
    "Roll credits — close the day out happy"
  ]
};

const VIBE_FUN_VARIANTS = {
  calm: [
    "Quiet moment — tea, no agenda",
    "Sit with someone you like, no phones",
    "A calm, unhurried break — yours alone"
  ],
  energetic: [
    "Move your body — quick walk or dance break",
    "Get the blood moving — anything physical, 10 minutes",
    "Shake it out — quick burst of movement"
  ],
  professional: [
    "Step out — call a friend or colleague, no work talk",
    "Reconnect — a short non-work conversation",
    "Check in on someone — two minutes, no agenda"
  ],
  playful: [
    "Do one fun, non-work thing — just because",
    "Play break — anything that makes you grin",
    "Treat yourself to five minutes of pure fun"
  ]
};
const FUN_CATEGORY = { calm: "Social", energetic: "Fun", professional: "Social", playful: "Fun" };

const MOTIVATOR_VARIANTS = {
  speed: {
    category: "Work",
    texts: [
      "Quick-win sprint — clear 2-3 small tasks first",
      "Fast start — knock out the easy ones before anything else",
      "Momentum sprint — three quick wins to get moving"
    ]
  },
  streak: {
    category: "Mindset",
    texts: [
      "Streak check-in — keep the chain alive",
      "Don't break the chain — mark today off",
      "Streak protection — the one thing that keeps it going"
    ]
  },
  balance: {
    category: "Recovery",
    texts: [
      "Rest block — step away, no screens",
      "Real break — away from the desk, no phone",
      "Balance check — make sure today has both work and rest"
    ]
  },
  depth: {
    category: "Work",
    texts: [
      "Pick your one meaningful task for today",
      "One task, full attention — no multitasking",
      "The one thing — decide it now, protect it later"
    ]
  }
};

const RESET_VARIANTS = [
  "Reset — quick walk or stretch",
  "Step away — 5 minutes outside or by a window",
  "Reset button — stretch, water, deep breath"
];

const LEARNING_VARIANTS = [
  "Learn something small — 15 focused minutes",
  "One idea worth keeping — read or watch for 15 minutes",
  "Small learning block — no pressure, just curiosity"
];

// Picks a random entry from a pool, avoiding the index used last
// time (when the pool is big enough for that to matter).
function pickVariant(pool, lastIndex) {
  if (pool.length <= 1) return { text: pool[0], index: 0 };
  let idx;
  do {
    idx = Math.floor(Math.random() * pool.length);
  } while (idx === lastIndex);
  return { text: pool[idx], index: idx };
}

// Sensible fallbacks for any field a caller doesn't provide — lets the
// engine run off a partial profile (e.g. a quiz answered only part-way,
// or a profile assembled from another flow like onboarding) instead of
// throwing on an undefined lookup key.
const PROFILE_DEFAULTS = { focusTime: "midday", motivator: "balance", style: "structured", vibe: "calm" };

async function generate(profile, context) {
  const motivator = (profile?.motivator && MOTIVATOR_VARIANTS[profile.motivator]) ? profile.motivator : PROFILE_DEFAULTS.motivator;
  const style = profile?.style || PROFILE_DEFAULTS.style;
  const vibe = (profile?.vibe && VIBE_WAKE_VARIANTS[profile.vibe]) ? profile.vibe : PROFILE_DEFAULTS.vibe;
  const resolvedFocusTime = WAKE_HOUR[profile?.focusTime] ? profile.focusTime : PROFILE_DEFAULTS.focusTime;

  const useHours = !!context?.useHours;
  const last = profile?.lastVariants || {};
  const chosen = {};

  // `slot` tags the task with which quiz-answer bucket it came from, so
  // the checklist UI can tell a persona-generated task apart from a
  // manually added one and preserve completed/edited tasks when the
  // checklist is regenerated instead of wiping everything.
  const mk = (text, category, hour, slot) => ({
    id: Math.random().toString(36).slice(2),
    text,
    category,
    completed: false,
    hour: useHours ? (hour || "") : "",
    personaSlot: slot
  });

  const wakeV = pickVariant(VIBE_WAKE_VARIANTS[vibe], last.wake);
  chosen.wake = wakeV.index;
  const wake = mk(wakeV.text, "Health", WAKE_HOUR[resolvedFocusTime], "wake");

  const motivatorV = pickVariant(MOTIVATOR_VARIANTS[motivator].texts, last.motivator);
  chosen.motivator = motivatorV.index;
  const motivatorTask = mk(motivatorV.text, MOTIVATOR_VARIANTS[motivator].category, "", "motivator");

  const focusV = pickVariant(VIBE_FOCUS_VARIANTS[vibe], last.focus);
  chosen.focus = focusV.index;
  const focusBlock = mk(focusV.text, "Work", FOCUS_HOUR[resolvedFocusTime], "focus");

  const resetV = pickVariant(RESET_VARIANTS, last.reset);
  chosen.reset = resetV.index;
  const reset = mk(resetV.text, "Recovery", RESET_HOUR[resolvedFocusTime], "reset");

  const learningV = pickVariant(LEARNING_VARIANTS, last.learning);
  chosen.learning = learningV.index;
  const learning = mk(learningV.text, "Learning", LEARNING_HOUR[resolvedFocusTime], "learning");

  const funV = pickVariant(VIBE_FUN_VARIANTS[vibe], last.fun);
  chosen.fun = funV.index;
  const funBreak = mk(funV.text, FUN_CATEGORY[vibe], FUN_HOUR[resolvedFocusTime], "fun");

  const windV = pickVariant(VIBE_WIND_DOWN_VARIANTS[vibe], last.windDown);
  chosen.windDown = windV.index;
  const windDown = mk(windV.text, "Recovery", WIND_DOWN_HOUR[resolvedFocusTime], "windDown");

  let tasks;
  const pool = { wake, motivator: motivatorTask, focus: focusBlock, reset, learning, fun: funBreak, windDown };
  const CANONICAL_ORDER = ["wake", "motivator", "focus", "reset", "learning", "fun", "windDown"];

  if (Array.isArray(context?.includedSlots) && context.includedSlots.length) {
    // Explicit category selection (from the "Configure your checklist"
    // panel) overrides the style-based default subset entirely — the
    // user picked exactly what they want in the list.
    tasks = CANONICAL_ORDER.filter(s => context.includedSlots.includes(s)).map(s => pool[s]);
  } else if (style === "structured") {
    tasks = [wake, motivatorTask, focusBlock, reset, learning, funBreak, windDown];
  } else if (style === "bold") {
    tasks = [wake, focusBlock, motivatorTask, windDown];
  } else {
    // minimal and flexible share the same lean skeleton — flexible just drops the hours
    tasks = [wake, motivatorTask, focusBlock, windDown];
  }

  return { tasks, lastVariants: chosen };
}

// The default slot subset for each style, with no explicit category
// override — used by the "Configure your checklist" panel to know which
// checkboxes should start checked for a profile that's never had its
// categories customized before.
const STYLE_DEFAULT_SLOTS = {
  structured: ["wake", "motivator", "focus", "reset", "learning", "fun", "windDown"],
  bold: ["wake", "focus", "motivator", "windDown"],
  minimal: ["wake", "motivator", "focus", "windDown"],
  flexible: ["wake", "motivator", "focus", "windDown"]
};
window.PersonalizationSlots = {
  order: ["wake", "motivator", "focus", "reset", "learning", "fun", "windDown"],
  labels: { wake: "Wake up", motivator: "Motivator task", focus: "Focus block", reset: "Reset break", learning: "Learning", fun: "Fun / social", windDown: "Wind down" },
  icons: { wake: "fa-sun", motivator: "fa-bolt", focus: "fa-crosshairs", reset: "fa-arrows-rotate", learning: "fa-book", fun: "fa-face-smile", windDown: "fa-moon" },
  defaultsForStyle: (style) => STYLE_DEFAULT_SLOTS[style] || STYLE_DEFAULT_SLOTS.structured
};

window.PersonalizationEngineRules = { id: "rules-v1", generate };
window.PersonalizationEngine = window.PersonalizationEngine || window.PersonalizationEngineRules;