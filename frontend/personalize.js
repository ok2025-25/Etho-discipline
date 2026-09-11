/* ============================================================
   ETHO — Checklist Personalization (account) — UI layer
   ------------------------------------------------------------
   Owns the quiz, the "Your Focus" card, and the load/confirm/
   history flow. It never builds task content itself — every
   checklist comes from window.PersonalizationEngine.generate()
   (see personalize-engine.js), so this file doesn't change when
   the engine behind it does.

   Gated behind the existing data-account-feature pattern: free
   users never reach the quiz because applyAccountLocks() (auth.js)
   intercepts clicks on #focus-card before any listener here
   runs, the same way it already does for #browse-templates-btn.
   ============================================================ */

const FOCUS_PROFILE_KEY = "checklist_focus_profile";

const QUIZ_QUESTIONS = [
  {
    id: "focusTime",
    question: "When do you feel most focused?",
    options: [
      { value: "early", label: "Early morning", icon: "fa-sun" },
      { value: "midday", label: "Midday", icon: "fa-cloud-sun" },
      { value: "evening", label: "Evening", icon: "fa-moon" },
      { value: "varies", label: "It varies", icon: "fa-shuffle" }
    ]
  },
  {
    id: "motivator",
    question: "What matters most when you finish your list?",
    options: [
      { value: "speed", label: "Speed — check things off fast", icon: "fa-bolt" },
      { value: "streak", label: "Streak — don't break the chain", icon: "fa-fire" },
      { value: "balance", label: "Balance — work and rest, mixed", icon: "fa-scale-balanced" },
      { value: "depth", label: "Depth — fewer things, done well", icon: "fa-gem" }
    ]
  },
  {
    id: "style",
    question: "How do you like your list to feel?",
    options: [
      { value: "minimal", label: "Minimal — as little as possible", icon: "fa-minus" },
      { value: "structured", label: "Structured — clear categories", icon: "fa-table-cells" },
      { value: "bold", label: "Bold — big, hard to miss", icon: "fa-expand" },
      { value: "flexible", label: "Flexible — no fixed times", icon: "fa-arrows-spin" }
    ]
  },
  {
    id: "vibe",
    question: "Pick a vibe for your checklist",
    options: [
      { value: "calm", label: "Calm", icon: "fa-leaf" },
      { value: "energetic", label: "Energetic", icon: "fa-bolt" },
      { value: "professional", label: "Professional", icon: "fa-briefcase" },
      { value: "playful", label: "Playful", icon: "fa-face-grin-stars" }
    ]
  }
];

const VIBE_META = {
  calm: { accent: "#2E8B87", icon: "fa-leaf" },
  energetic: { accent: "#E07A2C", icon: "fa-bolt" },
  professional: { accent: "#2C4870", icon: "fa-briefcase" },
  playful: { accent: "#8B5CF6", icon: "fa-face-grin-stars" }
};

const FOCUS_TIME_LABEL = { early: "early-morning", midday: "midday", evening: "evening", varies: "flexible" };
const MOTIVATOR_LABEL = { speed: "built for speed", streak: "built to protect your streak", balance: "built to balance work and rest", depth: "built around one deep focus" };
const STYLE_LABEL = { minimal: "kept minimal", structured: "clearly categorized", bold: "big and hard to miss", flexible: "loose, with no fixed times" };

let focusProfile = null; // null until a checklist has been generated
let onboardingIntent = null; // goal text captured during onboarding, if any and not yet used
let quizAnswers = {};
let quizStep = 0;

const focusCard = document.getElementById("focus-card");
const quizRoot = document.getElementById("focus-quiz-modal-root");
const checklistMainEl = document.querySelector(".checklist-main");

function applyPersonaAccent() {
  if (!checklistMainEl) return;
  if (focusProfile) {
    const meta = VIBE_META[focusProfile.vibe] || VIBE_META.calm;
    checklistMainEl.style.setProperty("--persona-accent", meta.accent);
  } else {
    checklistMainEl.style.removeProperty("--persona-accent");
  }
}

// ----- "Your Focus" card -----
function renderFocusCardLoading() {
  if (!focusCard) return;
  focusCard.innerHTML = `
    <div class="focus-card-icon"><i class="fa-solid fa-spinner fa-spin"></i></div>
    <div class="focus-card-body">
      <h3>Building your checklist…</h3>
      <p>Putting together tasks that fit how you work.</p>
    </div>
  `;
}

function renderFocusCard() {
  if (!focusCard) return;
  applyPersonaAccent();

  if (!focusProfile) {
    // If onboarding captured a stated goal and this is the user's first
    // time seeing this card, use it to make the pitch concrete instead of
    // generic — otherwise the goal they typed during onboarding is never
    // referenced again anywhere in the app.
    const title = onboardingIntent?.text
      ? "Turn that goal into a checklist"
      : "Get a checklist built for you";
    const body = onboardingIntent?.text
      ? `You told us: "${escapeHTML(onboardingIntent.text)}". Answer 4 quick questions and I'll build a checklist — tasks, timing and tone — around how you actually work toward it.`
      : "Answer 4 quick questions and I'll generate a whole new checklist — tasks, timing and tone — around how you actually work.";

    focusCard.innerHTML = `
      <div class="focus-card-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
      <div class="focus-card-body">
        <h3>${title}</h3>
        <p>${body}</p>
      </div>
      <button class="focus-card-cta" id="focus-quiz-start-btn" type="button">
        Build my checklist <i class="fa-solid fa-arrow-right"></i>
      </button>
    `;
    document.getElementById("focus-quiz-start-btn")?.addEventListener("click", openQuiz);
    return;
  }

  const meta = VIBE_META[focusProfile.vibe] || VIBE_META.calm;
  const timeLabel = FOCUS_TIME_LABEL[focusProfile.focusTime] || "your";
  const motivatorLine = MOTIVATOR_LABEL[focusProfile.motivator] || "built around how you work";
  const styleLine = STYLE_LABEL[focusProfile.style] || "shaped to fit your day";

  focusCard.innerHTML = `
    <div class="focus-card-icon"><i class="fa-solid ${meta.icon}"></i></div>
    <div class="focus-card-body">
      <h3>Built around your ${timeLabel} focus</h3>
      <p>This checklist is ${motivatorLine} and ${styleLine}.</p>
    </div>
    <div class="focus-card-actions">
      <button class="focus-card-icon-btn focus-card-configure" id="focus-quiz-configure-btn" type="button" title="Choose which categories are included">
        <i class="fa-solid fa-list-check"></i>
      </button>
      <button class="focus-card-icon-btn focus-card-shuffle" id="focus-quiz-shuffle-btn" type="button" title="Get a fresh version, same answers">
        <i class="fa-solid fa-shuffle"></i>
      </button>
      <button class="focus-card-icon-btn focus-card-retake" id="focus-quiz-retake-btn" type="button" title="Change your answers">
        <i class="fa-solid fa-sliders"></i>
      </button>
    </div>
  `;
  document.getElementById("focus-quiz-configure-btn")?.addEventListener("click", openConfigurePanel);
  document.getElementById("focus-quiz-shuffle-btn")?.addEventListener("click", shuffleChecklist);
  document.getElementById("focus-quiz-retake-btn")?.addEventListener("click", openQuiz);
}

// ----- Quiz modal -----
function buildQuizShell() {
  quizRoot.innerHTML = `
    <div class="focus-quiz-overlay" id="focus-quiz-overlay">
      <div class="focus-quiz-box">
        <div class="focus-quiz-header">
          <h3><i class="fa-solid fa-wand-magic-sparkles"></i> Build your checklist</h3>
          <button class="focus-quiz-close" id="focus-quiz-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="focus-quiz-dots" id="focus-quiz-dots"></div>
        <div class="focus-quiz-question" id="focus-quiz-question"></div>
        <div class="focus-quiz-options" id="focus-quiz-options"></div>
        <button class="focus-quiz-back" id="focus-quiz-back" type="button" hidden>
          <i class="fa-solid fa-arrow-left"></i> Back
        </button>
      </div>
    </div>
  `;
  document.getElementById("focus-quiz-close").addEventListener("click", closeQuiz);
  document.getElementById("focus-quiz-back").addEventListener("click", quizBack);
  quizRoot.querySelector("#focus-quiz-overlay").addEventListener("click", (e) => {
    if (e.target.id === "focus-quiz-overlay") closeQuiz();
  });
}

function openQuiz() {
  quizAnswers = {};
  quizStep = 0;
  if (!quizRoot.querySelector(".focus-quiz-overlay")) buildQuizShell();
  quizRoot.hidden = false;
  requestAnimationFrame(() => quizRoot.querySelector(".focus-quiz-overlay").classList.add("open"));
  renderQuizStep();
}

function closeQuiz() {
  const overlay = quizRoot.querySelector(".focus-quiz-overlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  setTimeout(() => { quizRoot.hidden = true; }, 200);
}

function renderQuizStep() {
  const q = QUIZ_QUESTIONS[quizStep];
  const dots = document.getElementById("focus-quiz-dots");
  const qEl = document.getElementById("focus-quiz-question");
  const optsEl = document.getElementById("focus-quiz-options");
  const backBtn = document.getElementById("focus-quiz-back");

  dots.innerHTML = QUIZ_QUESTIONS.map((_, i) =>
    `<span class="focus-quiz-dot${i === quizStep ? " active" : ""}${i < quizStep ? " done" : ""}"></span>`
  ).join("");

  qEl.textContent = q.question;

  optsEl.innerHTML = "";
  q.options.forEach(opt => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "focus-quiz-option";
    btn.innerHTML = `<i class="fa-solid ${opt.icon}"></i><span>${opt.label}</span>`;
    btn.addEventListener("click", () => selectAnswer(q.id, opt.value));
    optsEl.appendChild(btn);
  });

  backBtn.hidden = quizStep === 0;
}

function quizBack() {
  if (quizStep === 0) return;
  quizStep--;
  renderQuizStep();
}

async function selectAnswer(questionId, value) {
  quizAnswers[questionId] = value;
  if (quizStep < QUIZ_QUESTIONS.length - 1) {
    quizStep++;
    renderQuizStep();
  } else {
    const answers = { ...quizAnswers };
    closeQuiz();
    await loadGeneratedChecklist(
      answers,
      "Build a checklist from your answers? Completed and manually edited tasks stay put — everything else gets refreshed."
    );
  }
}

// Same profile, fresh phrasing — the engine's anti-repeat memory
// (profile.lastVariants) makes sure this doesn't just reload the
// same list.
async function shuffleChecklist() {
  if (!focusProfile) return;
  await loadGeneratedChecklist(
    focusProfile,
    "Get a fresh version of this checklist? Completed and manually edited tasks stay put — everything else gets refreshed."
  );
}

// ----- Generate + load, mirroring the existing "load a template" flow -----
// Regenerating (shuffle or retake) never wipes work the user has actually
// done: any task that's completed, or that the user hand-edited (which
// clears its personaSlot — see checklist.js), is left exactly as-is.
// Only untouched, incomplete persona-generated tasks get replaced with
// fresh ones from the engine.
async function loadGeneratedChecklist(profile, confirmMessage) {
  const proceed = window.customConfirm
    ? await customConfirm(confirmMessage, { confirmText: "Build it" })
    : true;
  if (!proceed) return;

  const currentTasks = (typeof tasks !== "undefined") ? tasks : [];

  if (currentTasks.length > 0 && typeof historyCache !== "undefined") {
    historyCache.unshift({ date: new Date(), tasks: [...currentTasks] });
    historyCache = historyCache.slice(0, 10);
    await cloudSet(activeHistoryKey(), historyCache);
  }

  // Keep as-is: completed tasks (regardless of source) and manual/edited
  // tasks (no personaSlot). Everything else — untouched, incomplete
  // persona tasks — is up for regeneration.
  const preserved = currentTasks.filter(t => t.completed || !t.personaSlot);
  const coveredSlots = new Set(preserved.filter(t => t.personaSlot).map(t => t.personaSlot));

  renderFocusCardLoading();

  const useHours = (typeof activeTab === "undefined" || activeTab === "routine") && profile.style !== "flexible";
  const { tasks: generated, lastVariants } = await window.PersonalizationEngine.generate(profile, { useHours, includedSlots: profile.includedSlots });

  // Drop any freshly generated slot that's already covered by a preserved
  // (completed) persona task, so we don't end up with two "wake up" tasks.
  const freshTasks = generated.filter(t => !coveredSlots.has(t.personaSlot));

  tasks = [...preserved, ...freshTasks];
  saveData();
  renderTasks();

  focusProfile = {
    focusTime: profile.focusTime,
    motivator: profile.motivator,
    style: profile.style,
    vibe: profile.vibe,
    includedSlots: profile.includedSlots || null,
    lastVariants,
    completedAt: new Date().toISOString()
  };
  await cloudSet(FOCUS_PROFILE_KEY, focusProfile);
  renderFocusCard();

  if (window.confetti) confetti({ particleCount: 90, spread: 70, origin: { y: 0.7 } });
}

// ----- Configure panel: pick which categories are in the checklist -----
// Separate from the full quiz — this only changes which slots (wake,
// focus, learning, etc.) are included, without touching focusTime/
// motivator/style/vibe. Uses the same reuse-quizRoot element so we don't
// need a second DOM anchor on every page that includes this script.
function openConfigurePanel() {
  if (!focusProfile || !window.PersonalizationSlots) return;
  const slots = window.PersonalizationSlots;
  const currentSlots = focusProfile.includedSlots || slots.defaultsForStyle(focusProfile.style);

  quizRoot.innerHTML = `
    <div class="focus-quiz-overlay" id="focus-quiz-overlay">
      <div class="focus-quiz-box">
        <div class="focus-quiz-header">
          <h3><i class="fa-solid fa-list-check"></i> What's in your checklist</h3>
          <button class="focus-quiz-close" id="focus-quiz-close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <p style="color:var(--text-muted); font-size:0.85rem; margin:-0.5rem 0 1rem;">Choose which categories get generated. Anything you've already completed or edited stays no matter what you turn off here.</p>
        <div class="focus-config-options" id="focus-config-options"></div>
        <button class="focus-quiz-save" id="focus-config-save" type="button">Save changes</button>
      </div>
    </div>
  `;
  const optsEl = document.getElementById("focus-config-options");
  slots.order.forEach(id => {
    const row = document.createElement("label");
    row.className = "focus-config-option";
    row.innerHTML = `
      <input type="checkbox" value="${id}" ${currentSlots.includes(id) ? "checked" : ""}>
      <i class="fa-solid ${slots.icons[id]}"></i>
      <span>${slots.labels[id]}</span>
    `;
    optsEl.appendChild(row);
  });

  document.getElementById("focus-quiz-close").addEventListener("click", closeQuiz);
  quizRoot.querySelector("#focus-quiz-overlay").addEventListener("click", (e) => {
    if (e.target.id === "focus-quiz-overlay") closeQuiz();
  });
  document.getElementById("focus-config-save").addEventListener("click", async () => {
    const checked = Array.from(optsEl.querySelectorAll("input:checked")).map(i => i.value);
    if (!checked.length) {
      if (window.customAlert) customAlert("Pick at least one category.");
      else window.alert("Pick at least one category.");
      return;
    }
    closeQuiz();
    await applyIncludedSlots(checked);
  });

  quizRoot.hidden = false;
  requestAnimationFrame(() => quizRoot.querySelector(".focus-quiz-overlay").classList.add("open"));
}

// Applies a new category selection without disturbing completed or
// hand-edited tasks: drops untouched persona tasks whose category was
// turned off, then generates fresh tasks only for newly-added categories
// that aren't already covered by something preserved.
async function applyIncludedSlots(newSlots) {
  if (!focusProfile) return;
  const currentTasks = (typeof tasks !== "undefined") ? tasks : [];

  const kept = currentTasks.filter(t => !(t.personaSlot && !t.completed && !newSlots.includes(t.personaSlot)));
  const coveredSlots = new Set(kept.filter(t => t.personaSlot).map(t => t.personaSlot));
  const missingSlots = newSlots.filter(s => !coveredSlots.has(s));

  let addedTasks = [];
  let lastVariants = focusProfile.lastVariants;
  if (missingSlots.length) {
    const useHours = (typeof activeTab === "undefined" || activeTab === "routine") && focusProfile.style !== "flexible";
    const result = await window.PersonalizationEngine.generate(focusProfile, { useHours, includedSlots: missingSlots });
    addedTasks = result.tasks;
    lastVariants = { ...focusProfile.lastVariants, ...result.lastVariants };
  }

  tasks = [...kept, ...addedTasks];
  saveData();
  renderTasks();

  focusProfile = { ...focusProfile, includedSlots: newSlots, lastVariants };
  await cloudSet(FOCUS_PROFILE_KEY, focusProfile);
  renderFocusCard();
}

// ----- Init -----
document.addEventListener("DOMContentLoaded", async () => {
  if (!focusCard || !quizRoot) return;
  focusProfile = await cloudGet(FOCUS_PROFILE_KEY, null);
  if (!focusProfile) onboardingIntent = await cloudGet("onboarding_intent", null);
  renderFocusCard();
});