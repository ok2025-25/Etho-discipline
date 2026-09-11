const newNoteBtn = document.getElementById("new-note-btn");
const saveBtn = document.getElementById("save-note-btn");
const notesList = document.getElementById("notes-list");
const titleInput = document.getElementById("note-title");
const contentArea = document.getElementById("note-content");
const searchInput = document.getElementById("search-notes"); // New search ref

const NOTES_KEY = "learningNotes";
let notes = []; // in-memory cache, kept in sync with the cloud
let currentNote = null;

// Load saved notes on start
window.addEventListener("DOMContentLoaded", async () => {
  await requireAuth();

  notes = await cloudGet(NOTES_KEY, []);
  renderNotesList();

  initDailyQuote();
  await initHubTabs();
  initLessonView();
  await initLibrary();
  await initWheel();
  await initQuotesBrowser();
});

// Filters/renders the in-memory `notes` array — does not touch storage,
// so typing in the search box doesn't trigger a network round trip.
function renderNotesList() {
  const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";

  notesList.innerHTML = "";

  const filteredNotes = notes.filter(note =>
    (note.title || "").toLowerCase().includes(searchTerm) ||
    (note.content || "").toLowerCase().includes(searchTerm)
  );

  if (filteredNotes.length === 0) {
    const isSearching = searchTerm.length > 0;
    notesList.innerHTML = isSearching
      ? '<li class="empty-state" style="padding:20px; text-align:center; color:var(--text-dim);">No notes match your search.</li>'
      : `<li class="empty-state" style="padding:24px 20px; text-align:center; color:var(--text-dim);">
           You don't have a note yet.<br>Capture an idea worth keeping.
           <div style="margin-top:0.9rem;">
             <button type="button" class="checklist-add-btn" id="notes-empty-add-btn"><i class="fa-solid fa-plus"></i> New note</button>
           </div>
         </li>`;
    if (!isSearching) document.getElementById("notes-empty-add-btn")?.addEventListener("click", () => newNoteBtn?.click());
    return;
  }

  filteredNotes
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .forEach(note => {
      const li = document.createElement("li");
      li.classList.add("note-item");
      
      // We separate the text click from the delete button click
      li.innerHTML = `
        <div class="note-info">
          <strong>${note.title || "Untitled"}</strong>
          <small>${new Date(note.date).toLocaleDateString()}</small>
        </div>
        <button class="delete-note-btn" title="Delete">
          <i class="fa-solid fa-trash"></i>
        </button>
      `;

      // Click on the text loads the note
      li.querySelector(".note-info").addEventListener("click", () => loadNoteContent(note));

      // Click on the trash icon deletes the note
      const deleteBtn = li.querySelector(".delete-note-btn");
      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Prevent opening the note when deleting
        deleteNote(note.id);
      });

      notesList.appendChild(li);
    });
}

// Function to Delete a Note
async function deleteNote(id) {
  const ok = await customConfirm("Are you sure you want to delete this note?", { danger: true, confirmText: "Delete" });
  if (ok) {
    notes = notes.filter(note => note.id !== id);
    cloudSet(NOTES_KEY, notes);

    // If we deleted the note currently on screen, clear the editor
    if (currentNote && currentNote.id === id) {
      currentNote = null;
      titleInput.value = "";
      contentArea.value = "";
    }

    renderNotesList();
  }
}

// Save note
saveBtn.addEventListener("click", () => {
  const title = titleInput.value.trim();
  const content = contentArea.value.trim();
  if (!content && !title) return alert("Please write something before saving.");

  if (currentNote) {
    // Update existing
    const index = notes.findIndex(n => n.id === currentNote.id);
    if (index !== -1) {
        notes[index] = { ...notes[index], title, content, date: new Date() };
    }
  } else {
    // Create new
    const newNote = {
      id: Date.now(),
      title,
      content,
      date: new Date()
    };
    notes.push(newNote);
    currentNote = newNote;
  }

  cloudSet(NOTES_KEY, notes);
  renderNotesList();
  alert("Note saved ✅");
});

// New note button
newNoteBtn.addEventListener("click", () => {
  currentNote = null;
  titleInput.value = "";
  contentArea.value = "";
  titleInput.focus();
});

// Load content into editor
function loadNoteContent(note) {
  currentNote = note;
  titleInput.value = note.title;
  contentArea.value = note.content;
}

// Search functionality
if(searchInput) {
    searchInput.addEventListener("input", renderNotesList);
}

// Sidebar Mobile Logic
const burger = document.getElementById('burger');
const sidebar = document.getElementById('sidebar');
const sidebarOverlayEl = document.getElementById('overlay');

if(burger && sidebar) {
    burger.addEventListener('click', () => {
        burger.classList.toggle('active');
        sidebar.classList.toggle('open');
        sidebarOverlayEl?.classList.toggle('active', sidebar.classList.contains('open'));
    });

    sidebarOverlayEl?.addEventListener('click', () => {
        sidebar.classList.remove('open');
        burger.classList.remove('active');
        sidebarOverlayEl.classList.remove('active');
    });

    document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && !burger.contains(e.target) && !e.target.closest('.mobile-bottom-nav')) {
            sidebar.classList.remove('open');
            burger.classList.remove('active');
            sidebarOverlayEl?.classList.remove('active');
        }
    });
}

// ============================================================
// DAILY INSIGHT QUOTE
// ============================================================
const HUB_QUOTES = [
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "Live as if you were to die tomorrow. Learn as if you were to live forever.", author: "Mahatma Gandhi" },
  { text: "Change is the end result of all true learning.", author: "Leo Buscaglia" },
  { text: "Anyone who stops learning is old, whether at twenty or eighty.", author: "Henry Ford" },
  { text: "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.", author: "Brian Herbert" }
];

function initDailyQuote() {
  const textEl = document.getElementById("hub-quote-text");
  const authorEl = document.getElementById("hub-quote-author");
  if (!textEl || !authorEl) return;

  // Stable per day, not random on every reload
  const dayIndex = Math.floor(Date.now() / 86400000) % HUB_QUOTES.length;
  const q = HUB_QUOTES[dayIndex];
  textEl.textContent = `"${q.text}"`;
  authorEl.textContent = q.author;
}

// ============================================================
// TABS (Notes / Library) — Library requires an account
// ============================================================
async function initHubTabs() {
  const tabButtons = document.querySelectorAll(".hub-tab");

  tabButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const tab = btn.dataset.tab;

      // Explicit check here rather than relying solely on the global
      // account-lock click interceptor, so the panel never switches even
      // if both handlers happen to fire.
      if ((tab === "library" || tab === "quotes") && !(await isSignedIn())) {
        if (typeof showSignInModal === "function") showSignInModal(btn.dataset.accountLabel, btn.dataset.accountCopy);
        return;
      }

      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".hub-panel").forEach(p => p.classList.remove("active"));
      document.getElementById(`panel-${tab}`)?.classList.add("active");

      // The Show-more toggle for Library/Quotes is measured off
      // scrollHeight/clientHeight, which are both 0 while the panel is
      // display:none — so a render that happens before the tab is ever
      // opened (e.g. initial page load defaulting to Notes) never shows
      // the button even when the content actually overflows. Re-measure
      // now that the panel is actually visible.
      if (tab === "library") {
        updateLibraryGridToggle(document.getElementById("library-grid"), document.getElementById("library-show-more-btn"));
      } else if (tab === "quotes") {
        updateLibraryGridToggle(document.getElementById("quotes-grid"), document.getElementById("quotes-show-more-btn"));
      }
    });
  });
}

// ============================================================
// LIBRARY — lessons, categories, search, favorites
// ============================================================
const LESSONS = [
  { id: "l1", category: "Discipline", icon: "fa-solid fa-fire",
    title: "Discipline Loves Routine",
    summary: "The less you rely on daily decisions, the more consistent you'll become. Fixed routines remove the need to negotiate with yourself every day.",
    content: "Motivation is a feeling, and feelings are unreliable — they show up when they want to and vanish right when you need them most. Discipline built on routine doesn't ask motivation to show up at all.\n\nWhen an action happens at the same time, in the same order, every day, your brain stops treating it as a decision and starts treating it as a default. That's the entire trick: you're not becoming a more willpower-driven person, you're removing the moment where willpower is required.\n\nThis is why the people who seem \"naturally\" consistent usually aren't relying on inspiration at all — they've just engineered a schedule that makes the right action the path of least resistance.",
    takeaway: "Anchor one important habit to the same time tomorrow." },

  { id: "l2", category: "Discipline", icon: "fa-solid fa-fire",
    title: "Win the First Hour",
    summary: "How you spend the first hour of your day often sets the tone for the rest. Protect it from distractions and focus on meaningful actions.",
    content: "The first hour after waking has an outsized effect on the twelve that follow, because it's when you set the emotional and mental frame you'll carry forward.\n\nOpen with something reactive — a phone full of notifications, other people's priorities, other people's opinions — and you spend the rest of the day playing catch-up in someone else's agenda. Open with something intentional, even something small, and you carry that sense of authorship into everything after it.\n\nYou don't need a two-hour morning routine to benefit from this. Even ten distraction-free minutes spent on something that matters to you can change the tone of the entire day.",
    takeaway: "Avoid social media during your first hour tomorrow." },

  { id: "l3", category: "Productivity", icon: "fa-solid fa-list-check",
    title: "Decision Fatigue Is Real",
    summary: "Every decision consumes mental energy. Simplify repeated choices so your brain has more capacity for work that actually matters.",
    content: "Willpower and decision-making draw from the same limited pool of mental energy. Every choice you make — what to wear, what to eat, which task to start first — spends from that pool, whether the choice is important or not.\n\nBy the time you reach the decisions that actually matter, that pool is often already drained by dozens of trivial ones. This is why the same person can make sharp calls at 9am and sloppy ones by 4pm without anything else in their life changing.\n\nThe fix isn't more discipline — it's fewer decisions. Pre-deciding routine choices (what you'll eat, wear, or work on first) frees that mental budget for the choices that are actually worth deliberating over.",
    takeaway: "Automate or plan one recurring decision today." },

  { id: "l4", category: "Productivity", icon: "fa-solid fa-list-check",
    title: "Measure What Matters",
    summary: "Progress becomes visible when you track it. Whether it's hours studied, workouts completed, or sales made, numbers reveal the truth.",
    content: "Effort feels real in the moment but is notoriously hard to judge in hindsight — memory rounds up good weeks and rounds down hard ones. Numbers don't have that bias.\n\nA tracked metric turns a vague sense of \"I've been working on this\" into an honest answer: exactly how much, how often, and whether it's trending up or down. That honesty is uncomfortable at first, which is exactly why it's useful — it's the fastest way to catch a plateau before it becomes a pattern.\n\nThe metric doesn't need to be perfect or complex. A single number, tracked consistently, beats a sophisticated system you abandon after two weeks.",
    takeaway: "Track one meaningful metric for the next seven days." },

  { id: "l5", category: "Mindset", icon: "fa-solid fa-brain",
    title: "Detach From Results",
    summary: "You control your effort, not the outcome. Focusing on actions instead of immediate results reduces anxiety and improves long-term performance.",
    content: "Outcomes are downstream of a lot of things you don't control — timing, other people, luck, circumstances you can't see. Effort is the one variable that's entirely yours, every single day.\n\nWhen your sense of success is tied only to outcomes, every setback outside your control feels like a personal failure, and that anxiety tends to shrink the very effort that produces good outcomes in the first place. Tying your standard to effort instead breaks that loop — you can walk away from a bad day knowing you did the work, regardless of what the scoreboard says.\n\nThis isn't about not caring how things turn out. It's about judging yourself by the part of the process you can actually influence.",
    takeaway: "Judge today by your effort, not by the outcome." },

  { id: "l6", category: "Mindset", icon: "fa-solid fa-brain",
    title: "Comfort Is Expensive",
    summary: "Growth usually hides behind temporary discomfort. The conversations, workouts, and projects you avoid often offer the biggest rewards.",
    content: "Almost everything you'd point to as meaningful growth — a hard conversation, a difficult workout, a project you weren't sure you could finish — started as something you wanted to avoid.\n\nThat avoidance isn't a character flaw, it's just how the brain is wired: it treats short-term discomfort as a bigger threat than long-term stagnation, even though stagnation is usually the more expensive option. The bill for staying comfortable doesn't come due immediately, which makes it easy to ignore.\n\nThe people who grow fastest aren't the ones who feel less discomfort — they're the ones who've learned to read discomfort as a signal that they're near something worth doing, rather than a signal to stop.",
    takeaway: "Do one task today that you've been avoiding." },

  { id: "l7", category: "Fitness", icon: "fa-solid fa-dumbbell",
    title: "Recovery Drives Performance",
    summary: "Your body improves between workouts, not during them. Quality sleep, nutrition, and recovery are essential parts of training.",
    content: "Training is the stimulus, not the improvement. The actual adaptation — the stronger muscle fibers, the better-conditioned heart, the sharper technique — happens afterward, while you rest.\n\nSkip that recovery window by training again too soon, sleeping too little, or under-fueling, and you're stacking stimulus on top of stimulus with no room left for the adaptation to actually occur. That's how consistent effort turns into a plateau or, worse, an injury.\n\nRecovery isn't the opposite of training — it's the other half of it. Treating sleep and nutrition as part of the program, not an afterthought, is often the single biggest lever left on the table.",
    takeaway: "Aim for a full night's sleep after your next workout." },

  { id: "l8", category: "Fitness", icon: "fa-solid fa-dumbbell",
    title: "Master the Basics",
    summary: "The biggest improvements come from consistently practicing fundamental movements—not constantly searching for new exercises.",
    content: "It's tempting to chase novelty — a new exercise, a new program, a new technique — because it feels like progress. But most real strength and skill comes from getting incrementally better at a small set of fundamental movements, over a long stretch of time.\n\nSwitching exercises constantly resets the learning curve every time. You never get far enough into any one movement to refine the technique that actually unlocks the next level of progress. Depth beats breadth here.\n\nThe basics aren't basic because they're easy — they're basic because they're the foundation everything else is built on. Mastering them is rarely glamorous, but it's almost always what separates steady long-term progress from a string of false starts.",
    takeaway: "Focus on perfect technique before increasing intensity." },

  { id: "l9", category: "Entrepreneurship", icon: "fa-solid fa-rocket",
    title: "Attention Comes Before Revenue",
    summary: "People can't buy what they don't know exists. Building an audience is often as important as building the product itself.",
    content: "A great product with zero visibility and a mediocre product with real reach will usually trade places in the market — attention is that powerful a lever. This isn't a comment on quality mattering less; it's a reminder that quality is invisible until someone notices it exists.\n\nBuilding an audience — even a small, genuinely engaged one — means that when you do have something worth buying, there's already a group of people paying attention. Without that, every launch starts from zero, every single time.\n\nThink of audience-building as infrastructure, not marketing. It compounds quietly in the background while the product itself is still being built.",
    takeaway: "Share your work publicly at least once this week." },

  { id: "l10", category: "Entrepreneurship", icon: "fa-solid fa-rocket",
    title: "Cash Flow Beats Vanity",
    summary: "Revenue, profit, and customer retention matter far more than followers, downloads, or likes. Focus on metrics that keep a business alive.",
    content: "Vanity metrics feel good because they're easy to see and easy to grow — a follower count, a download number, a like. But none of them pay the bills, and a business can look impressive on those numbers while quietly running out of money.\n\nRevenue, profit margin, and retention are less exciting to post about, but they're the metrics that actually determine whether the business survives next quarter. They force an honest answer to the only question that matters: are people willing to pay, and do they keep paying?\n\nIt's worth periodically auditing which numbers you're actually optimizing for day to day, because the ones that feel most rewarding to watch climb are rarely the ones keeping the lights on.",
    takeaway: "Identify the one metric that truly drives your business." },

  { id: "l11", category: "Psychology", icon: "fa-solid fa-lightbulb",
    title: "Your Brain Seeks Rewards",
    summary: "Habits form faster when they're immediately satisfying. Adding a small reward after a productive action reinforces the behavior.",
    content: "Your brain doesn't wait for long-term payoffs to decide whether a behavior is worth repeating — it responds to what happens in the next few seconds. That's why habits with an immediate, tangible payoff stick, while ones whose benefits only arrive months later constantly need willpower just to survive.\n\nThis is a mechanism you can deliberately use. Pairing a productive action with something genuinely satisfying — even something small, like checking it off a list or a five-minute break you actually enjoy — gives the brain the immediate signal it's looking for, without waiting for the eventual, distant reward.\n\nOver time, the behavior itself starts to feel rewarding on its own, and the artificial reward becomes less necessary. But in the early stages, it's often the difference between a habit that sticks and one that quietly disappears after a week.",
    takeaway: "Pair one habit with a healthy reward today." },

  { id: "l12", category: "Personal Development", icon: "fa-solid fa-seedling",
    title: "Reflection Creates Growth",
    summary: "Experience alone doesn't make you wiser. Taking a few minutes to reflect on what worked, what didn't, and why turns experience into improvement.",
    content: "Living through an experience and learning from it are two different things — plenty of people repeat the same year twenty times over without ever extracting a lesson from it. The difference is reflection.\n\nWithout it, experience just accumulates as noise: things happened, but nothing was distilled from them. A few honest minutes spent asking what worked, what didn't, and why turns a day of raw events into an actual insight you can carry forward.\n\nThis doesn't need to be elaborate. A short, consistent habit of reviewing the day — even three sentences — compounds into real self-knowledge over months, in a way that simply living through more days never quite manages on its own.",
    takeaway: "Write down one lesson you learned before going to bed tonight." }
];

const FAVORITES_KEY = "learningFavorites";
const CUSTOM_LESSONS_KEY = "customLessons";
let favoriteIds = [];
let customLessons = []; // user-created lessons (account), kept in sync with the cloud
let activeLibraryFilter = "All";

// Built-ins + whatever the user has written themselves.
function allLessons() {
  return [...LESSONS, ...customLessons];
}

const LESSON_ICON_CHOICES = [
  "fa-solid fa-lightbulb", "fa-solid fa-fire", "fa-solid fa-list-check",
  "fa-solid fa-brain", "fa-solid fa-dumbbell", "fa-solid fa-rocket",
  "fa-solid fa-seedling", "fa-solid fa-book", "fa-solid fa-star",
  "fa-solid fa-heart", "fa-solid fa-clock", "fa-solid fa-feather-pointed"
];

async function initLibrary() {
  const filtersEl = document.getElementById("library-filters");
  const searchEl = document.getElementById("search-lessons");
  if (!filtersEl) return; // panel not present, safety check

  favoriteIds = await cloudGet(FAVORITES_KEY, []);
  customLessons = await cloudGet(CUSTOM_LESSONS_KEY, []);

  buildLibraryFilters();

  if (searchEl) searchEl.addEventListener("input", renderLibrary);

  const chooseBtn = document.getElementById("choose-for-me-btn");
  if (chooseBtn) chooseBtn.addEventListener("click", chooseForMe);

  initLessonForm();

  renderLibrary();
}

function buildLibraryFilters() {
  const filtersEl = document.getElementById("library-filters");
  if (!filtersEl) return;

  const categories = ["All", ...new Set(allLessons().map(l => l.category)), "Favorites"];
  filtersEl.innerHTML = "";
  categories.forEach(cat => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `library-chip ${cat === activeLibraryFilter ? "active" : ""}`;
    chip.textContent = cat;
    chip.onclick = () => {
      activeLibraryFilter = cat;
      filtersEl.querySelectorAll(".library-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      renderLibrary();
    };
    filtersEl.appendChild(chip);
  });
}

// Picks a random lesson, clears any active filter/search so it's
// guaranteed visible, then scrolls to it with a highlight pulse.
function chooseForMe() {
  const grid = document.getElementById("library-grid");
  const filtersEl = document.getElementById("library-filters");
  const searchEl = document.getElementById("search-lessons");
  const lessons = allLessons();
  if (!grid || lessons.length === 0) return;

  const pick = lessons[Math.floor(Math.random() * lessons.length)];

  activeLibraryFilter = "All";
  if (searchEl) searchEl.value = "";
  if (filtersEl) {
    filtersEl.querySelectorAll(".library-chip").forEach(c => c.classList.toggle("active", c.textContent === "All"));
  }
  renderLibrary();

  const card = grid.querySelector(`[data-lesson-id="${pick.id}"]`);
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.classList.remove("chosen-pulse");
    void card.offsetWidth; // restart animation
    card.classList.add("chosen-pulse");
  }
}

function renderLibrary() {
  const grid = document.getElementById("library-grid");
  const searchEl = document.getElementById("search-lessons");
  if (!grid) return;

  const term = searchEl ? searchEl.value.trim().toLowerCase() : "";

  const filtered = allLessons().filter(lesson => {
    const matchesFilter =
      activeLibraryFilter === "All" ||
      (activeLibraryFilter === "Favorites" ? favoriteIds.includes(lesson.id) : lesson.category === activeLibraryFilter);

    const matchesSearch =
      !term ||
      lesson.title.toLowerCase().includes(term) ||
      lesson.summary.toLowerCase().includes(term) ||
      lesson.category.toLowerCase().includes(term);

    return matchesFilter && matchesSearch;
  });

  grid.innerHTML = "";

  if (filtered.length === 0) {
    const emptyMsg = activeLibraryFilter === "Favorites"
      ? "No favorites yet — heart a lesson to keep it here."
      : "No lessons match here yet.";
    grid.innerHTML = `<div class="library-empty">${emptyMsg}</div>`;
    return;
  }

  filtered.forEach(lesson => {
    const isFav = favoriteIds.includes(lesson.id);
    const isCustom = !!lesson.custom;

    const card = document.createElement("div");
    card.className = "lesson-card";
    card.dataset.lessonId = lesson.id;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Read: ${lesson.title}`);
    card.innerHTML = `
      <div class="lesson-card-top">
        <div class="lesson-icon"><i class="${lesson.icon}"></i></div>
        <div class="lesson-card-actions">
          ${isCustom ? `
            <button class="lesson-edit-btn" title="Edit lesson"><i class="fa-solid fa-pen"></i></button>
            <button class="lesson-delete-btn" title="Delete lesson"><i class="fa-solid fa-trash"></i></button>
          ` : ""}
          <button class="lesson-fav-btn ${isFav ? "active" : ""}" title="${isFav ? "Remove from favorites" : "Add to favorites"}">
            <i class="fa-${isFav ? "solid" : "regular"} fa-heart"></i>
          </button>
        </div>
      </div>
      <span class="lesson-category">${lesson.category}${isCustom ? '<span class="lesson-custom-badge"><i class="fa-solid fa-user-pen"></i> Yours</span>' : ""}</span>
      <h4 class="lesson-title">${lesson.title}</h4>
      <p class="lesson-summary">${lesson.summary}</p>
      <div class="lesson-takeaway"><i class="fa-solid fa-arrow-right"></i> ${lesson.takeaway}</div>
      <div class="lesson-read-more"><i class="fa-solid fa-book-open"></i> Read full lesson</div>
    `;

    card.querySelector(".lesson-fav-btn").addEventListener("click", (e) => { e.stopPropagation(); toggleFavorite(lesson.id); });

    if (isCustom) {
      card.querySelector(".lesson-edit-btn").addEventListener("click", (e) => { e.stopPropagation(); openLessonModal(lesson); });
      card.querySelector(".lesson-delete-btn").addEventListener("click", (e) => { e.stopPropagation(); deleteCustomLesson(lesson.id); });
    }

    card.addEventListener("click", () => openLessonView(lesson));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openLessonView(lesson); }
    });

    grid.appendChild(card);
  });

  updateLibraryGridToggle(grid, document.getElementById("library-show-more-btn"));
}

// Mobile-only "Show more" for a long Library/Quotes grid — re-measures
// on every render since search/filter changes how many cards are shown.
function updateLibraryGridToggle(grid, btn) {
  if (!grid || !btn) return;

  grid.classList.remove("expanded");
  btn.classList.remove("expanded", "show");
  btn.setAttribute("aria-expanded", "false");
  btn.querySelector("span").textContent = "Show more";

  if (grid.children.length === 0) {
    grid.classList.remove("collapsible");
    return;
  }

  grid.classList.add("collapsible");
  requestAnimationFrame(() => {
    if (grid.scrollHeight > grid.clientHeight + 4) {
      btn.classList.add("show");
    }
  });
}

function initLibraryShowMoreButtons() {
  document.getElementById("library-show-more-btn")?.addEventListener("click", () => {
    const grid = document.getElementById("library-grid");
    const btn = document.getElementById("library-show-more-btn");
    const expanded = grid.classList.toggle("expanded");
    btn.classList.toggle("expanded", expanded);
    btn.setAttribute("aria-expanded", expanded ? "true" : "false");
    btn.querySelector("span").textContent = expanded ? "Show less" : "Show more";
    if (!expanded) btn.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  document.getElementById("quotes-show-more-btn")?.addEventListener("click", () => {
    const grid = document.getElementById("quotes-grid");
    const btn = document.getElementById("quotes-show-more-btn");
    const expanded = grid.classList.toggle("expanded");
    btn.classList.toggle("expanded", expanded);
    btn.setAttribute("aria-expanded", expanded ? "true" : "false");
    btn.querySelector("span").textContent = expanded ? "Show less" : "Show more";
    if (!expanded) btn.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}
initLibraryShowMoreButtons();

function toggleFavorite(id) {
  if (favoriteIds.includes(id)) {
    favoriteIds = favoriteIds.filter(f => f !== id);
  } else {
    favoriteIds.push(id);
  }
  cloudSet(FAVORITES_KEY, favoriteIds);
  renderLibrary();
}

// ============================================================
// CUSTOM LESSONS — signed-in users writing their own Library entries
// ============================================================
function initLessonForm() {
  const overlay = document.getElementById("lesson-form-overlay");
  const form = document.getElementById("lesson-form");
  const iconPicker = document.getElementById("lesson-icon-picker");
  const newLessonBtn = document.getElementById("new-lesson-btn");
  if (!overlay || !form || !iconPicker) return;

  iconPicker.innerHTML = "";
  LESSON_ICON_CHOICES.forEach(icon => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-picker-btn";
    btn.dataset.icon = icon;
    btn.innerHTML = `<i class="${icon}"></i>`;
    btn.addEventListener("click", () => {
      document.getElementById("lesson-form-icon").value = icon;
      iconPicker.querySelectorAll(".icon-picker-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
    iconPicker.appendChild(btn);
  });

  if (newLessonBtn) newLessonBtn.addEventListener("click", () => openLessonModal());
  document.getElementById("lesson-form-close")?.addEventListener("click", closeLessonModal);
  document.getElementById("lesson-form-cancel")?.addEventListener("click", closeLessonModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeLessonModal();
  });

  form.addEventListener("submit", handleLessonFormSubmit);
}

// lesson === null -> creating a new one; lesson === object -> editing that custom lesson
function openLessonModal(lesson = null) {
  const overlay = document.getElementById("lesson-form-overlay");
  const iconPicker = document.getElementById("lesson-icon-picker");
  if (!overlay) return;

  // Keep the category datalist current, including any category the
  // user has already invented via a previous custom lesson.
  const datalist = document.getElementById("lesson-category-list");
  if (datalist) {
    const categories = [...new Set(allLessons().map(l => l.category))];
    datalist.innerHTML = categories.map(c => `<option value="${c}"></option>`).join("");
  }

  document.getElementById("lesson-form-title").innerHTML = lesson
    ? '<i class="fa-solid fa-pen"></i> Edit Lesson'
    : '<i class="fa-solid fa-feather-pointed"></i> New Lesson';

  document.getElementById("lesson-form-id").value = lesson ? lesson.id : "";
  document.getElementById("lesson-form-title-input").value = lesson ? lesson.title : "";
  document.getElementById("lesson-form-category").value = lesson ? lesson.category : "";
  document.getElementById("lesson-form-summary").value = lesson ? lesson.summary : "";
  document.getElementById("lesson-form-content").value = lesson ? (lesson.content || "") : "";
  document.getElementById("lesson-form-takeaway").value = lesson ? lesson.takeaway : "";

  const icon = lesson ? lesson.icon : "fa-solid fa-lightbulb";
  document.getElementById("lesson-form-icon").value = icon;
  iconPicker.querySelectorAll(".icon-picker-btn").forEach(b => b.classList.toggle("active", b.dataset.icon === icon));

  overlay.hidden = false;
  void overlay.offsetWidth; // restart transition
  overlay.classList.add("open");
  document.getElementById("lesson-form-title-input").focus();
}

function closeLessonModal() {
  const overlay = document.getElementById("lesson-form-overlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  setTimeout(() => { overlay.hidden = true; }, 200);
}

function handleLessonFormSubmit(e) {
  e.preventDefault();

  const id = document.getElementById("lesson-form-id").value;
  const title = document.getElementById("lesson-form-title-input").value.trim();
  const category = document.getElementById("lesson-form-category").value.trim();
  const summary = document.getElementById("lesson-form-summary").value.trim();
  const content = document.getElementById("lesson-form-content").value.trim();
  const takeaway = document.getElementById("lesson-form-takeaway").value.trim();
  const icon = document.getElementById("lesson-form-icon").value || "fa-solid fa-lightbulb";

  if (!title || !category || !summary || !takeaway) return;

  if (id) {
    // Editing an existing custom lesson
    const index = customLessons.findIndex(l => l.id === id);
    if (index !== -1) {
      customLessons[index] = { ...customLessons[index], title, category, summary, content, takeaway, icon };
    }
  } else {
    customLessons.push({
      id: `custom-${Date.now()}`,
      custom: true,
      title, category, summary, content, takeaway, icon
    });
  }

  cloudSet(CUSTOM_LESSONS_KEY, customLessons);
  closeLessonModal();
  buildLibraryFilters();
  renderLibrary();
  alert("Lesson saved ✅");
}

async function deleteCustomLesson(id) {
  const ok = await customConfirm("Delete this lesson? This can't be undone.", { danger: true, confirmText: "Delete" });
  if (!ok) return;

  customLessons = customLessons.filter(l => l.id !== id);
  favoriteIds = favoriteIds.filter(f => f !== id);

  cloudSet(CUSTOM_LESSONS_KEY, customLessons);
  cloudSet(FAVORITES_KEY, favoriteIds);

  buildLibraryFilters();
  renderLibrary();
}

// ============================================================
// LESSON VIEW — full read modal (built-in and custom lessons)
// ============================================================
// Older custom lessons saved before the "content" field existed won't
// have one — fall back to the summary rather than showing a blank body.
function lessonContentParagraphs(lesson) {
  const raw = (lesson.content && lesson.content.trim()) || lesson.summary || "";
  return raw.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
}

function openLessonView(lesson) {
  const overlay = document.getElementById("lesson-view-overlay");
  if (!overlay) return;

  const isCustom = !!lesson.custom;
  const isFav = favoriteIds.includes(lesson.id);

  document.getElementById("lesson-view-icon").innerHTML = `<i class="${lesson.icon}"></i>`;
  document.getElementById("lesson-view-category").innerHTML =
    `${lesson.category}${isCustom ? '<span class="lesson-custom-badge"><i class="fa-solid fa-user-pen"></i> Yours</span>' : ""}`;
  document.getElementById("lesson-view-title").textContent = lesson.title;

  const body = document.getElementById("lesson-view-body");
  const paragraphs = lessonContentParagraphs(lesson);
  body.innerHTML = paragraphs.map(p => `<p>${p}</p>`).join("");
  body.classList.remove("expanded");

  document.getElementById("lesson-view-takeaway").innerHTML =
    `<i class="fa-solid fa-arrow-right"></i> ${lesson.takeaway}`;

  const favBtn = document.getElementById("lesson-view-fav-btn");
  favBtn.classList.toggle("active", isFav);
  favBtn.innerHTML = `<i class="fa-${isFav ? "solid" : "regular"} fa-heart"></i> ${isFav ? "Saved" : "Save"}`;
  favBtn.onclick = () => { toggleFavorite(lesson.id); openLessonView(lesson); };

  const editBtn = document.getElementById("lesson-view-edit-btn");
  const deleteBtn = document.getElementById("lesson-view-delete-btn");
  editBtn.style.display = isCustom ? "" : "none";
  deleteBtn.style.display = isCustom ? "" : "none";
  editBtn.onclick = () => { closeLessonView(); openLessonModal(lesson); };
  deleteBtn.onclick = async () => {
    await deleteCustomLesson(lesson.id);
    // deleteCustomLesson re-renders the grid behind the modal; if the
    // lesson is actually gone, close the view instead of showing stale content.
    if (!customLessons.some(l => l.id === lesson.id)) closeLessonView();
  };

  // "Show more" only ever matters on the narrow layout — measure after
  // paint so scrollHeight reflects the mobile line-clamp height.
  const moreBtn = document.getElementById("lesson-view-more-btn");
  requestAnimationFrame(() => {
    const needsToggle = window.innerWidth <= 599 && body.scrollHeight > body.clientHeight + 4;
    moreBtn.style.display = needsToggle ? "" : "none";
    moreBtn.innerHTML = '<i class="fa-solid fa-chevron-down"></i> Show more';
  });

  overlay.hidden = false;
  void overlay.offsetWidth;
  overlay.classList.add("open");
}

function closeLessonView() {
  const overlay = document.getElementById("lesson-view-overlay");
  if (!overlay) return;
  overlay.classList.remove("open");
  setTimeout(() => { overlay.hidden = true; }, 200);
}

function initLessonView() {
  const overlay = document.getElementById("lesson-view-overlay");
  if (!overlay) return;
  document.getElementById("lesson-view-close")?.addEventListener("click", closeLessonView);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeLessonView(); });
  document.getElementById("lesson-view-more-btn")?.addEventListener("click", () => {
    const body = document.getElementById("lesson-view-body");
    const btn = document.getElementById("lesson-view-more-btn");
    const expanded = body.classList.toggle("expanded");
    btn.innerHTML = expanded
      ? '<i class="fa-solid fa-chevron-up"></i> Show less'
      : '<i class="fa-solid fa-chevron-down"></i> Show more';
  });
}

// ============================================================
// WISDOM WHEEL — spin-to-draw quote experience
// ============================================================
// Starter set: 6 quotes per category. Meant to grow toward a much
// larger library over time — once it's large, that's better served
// by a Supabase table than a hardcoded array, but the wheel logic
// below doesn't care where the pool comes from.
const WHEEL_CATEGORIES = [
  { name: "Discipline", color: "#E8001C", icon: "fa-solid fa-fire" },
  { name: "Productivity", color: "#8B0000", icon: "fa-solid fa-list-check" },
  { name: "Mindset", color: "#B33A3A", icon: "fa-solid fa-brain" },
  { name: "Fitness", color: "#C2185B", icon: "fa-solid fa-dumbbell" },
  { name: "Entrepreneurship", color: "#7A1F1F", icon: "fa-solid fa-rocket" },
  { name: "Psychology", color: "#A62639", icon: "fa-solid fa-lightbulb" },
  { name: "Personal Development", color: "#D6273D", icon: "fa-solid fa-seedling" },
  { name: "Life", color: "#D4AF37", icon: "fa-solid fa-star" }
];

// Real, commonly-cited quotes with authors — attribution follows the same
// convention already used elsewhere in the app (the static quotes on
// checklist/tracker/consistency pages).
const WHEEL_QUOTES = {
  "Discipline": [
    { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
    { text: "We must all suffer one of two things: the pain of discipline or the pain of regret.", author: "Jim Rohn" },
    { text: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca" },
    { text: "The successful warrior is the average man with laser-like focus.", author: "Bruce Lee" },
    { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
    { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
    { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
    { text: "Success is actually a short race—a sprint fueled by discipline just long enough for habit to take over.", author: "Gary Keller" },
    { text: "The pain of discipline is nothing compared to the pain of regret.", author: "Anonymous" },
    { text: "Small disciplines repeated with consistency every day lead to great achievements gained slowly over time.", author: "John C. Maxwell" },
    { text: "You will never always be motivated. You have to learn to be disciplined.", author: "Anonymous" },
    { text: "Discipline is the soul of an army. It makes small numbers formidable.", author: "George Washington" },
    { text: "Rule your mind or it will rule you.", author: "Horace" },
    { text: "First we make our habits, then our habits make us.", author: "John Dryden" },
    { text: "Through discipline comes freedom.", author: "Aristotle" }
  ],
  "Productivity": [
    { text: "Until we can manage time, we can manage nothing else.", author: "Peter Drucker" },
    { text: "Efficiency is doing things right; effectiveness is doing the right things.", author: "Peter Drucker" },
    { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
    { text: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
    { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
    { text: "Lost time is never found again.", author: "Benjamin Franklin" },
    { text: "The key is not to prioritize what's on your schedule, but to schedule your priorities.", author: "Stephen Covey" },
    { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
    { text: "Do not wait; the time will never be 'just right.'", author: "Napoleon Hill" },
    { text: "Concentrate all your thoughts upon the work at hand.", author: "Alexander Graham Bell" },
    { text: "It's not about having time. It's about making time.", author: "Anonymous" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "Ordinary things done consistently produce extraordinary results.", author: "Keith Cunningham" },
    { text: "One of the secrets of life is to keep moving forward.", author: "Anonymous" },
    { text: "The shorter way to do many things is to do only one thing at a time.", author: "Mozart" },
    { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" }
  ],
  "Mindset": [
    { text: "Whether you think you can, or you think you can't — you're right.", author: "Henry Ford" },
    { text: "The mind is everything. What you think you become.", author: "Buddha" },
    { text: "It's not what happens to you, but how you react to it that matters.", author: "Epictetus" },
    { text: "The pessimist sees difficulty in every opportunity. The optimist sees opportunity in every difficulty.", author: "Winston Churchill" },
    { text: "Whatever the mind can conceive and believe, it can achieve.", author: "Napoleon Hill" },
    { text: "You have power over your mind, not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" },
    { text: "Whether you believe you can or believe you can't, you're right.", author: "Henry Ford" },
    { text: "Our life is what our thoughts make it.", author: "Marcus Aurelius" },
    { text: "You become what you think about most.", author: "Earl Nightingale" },
    { text: "The only limit to our realization of tomorrow is our doubts of today.", author: "Franklin D. Roosevelt" },
    { text: "We become what we repeatedly think about.", author: "Earl Nightingale" },
    { text: "If you can change your mind, you can change your life.", author: "William James" },
    { text: "A person's mind, stretched by new ideas, may never return to its original dimensions.", author: "Oliver Wendell Holmes Jr." },
    { text: "The greatest discovery of any generation is that a human can alter his life by altering his attitude.", author: "William James" },
    { text: "You cannot stop the waves, but you can learn to surf.", author: "Jon Kabat-Zinn" },
    { text: "He who conquers others is strong; he who conquers himself is mighty.", author: "Lao Tzu" }
  ],
  "Fitness": [
    { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
    { text: "He who has health has hope, and he who has hope has everything.", author: "Thomas Carlyle" },
    { text: "Lack of activity destroys the good condition of every human being.", author: "Plato" },
    { text: "Strength does not come from winning. Your struggles develop your strengths.", author: "Arnold Schwarzenegger" },
    { text: "Those who think they have no time for exercise will sooner or later find time for illness.", author: "Edward Stanley" },
    { text: "To keep the body in good health is a duty.", author: "Buddha" },
    { text: "The body achieves what the mind believes.", author: "Anonymous" },
    { text: "Exercise is a celebration of what your body can do, not a punishment for what you ate.", author: "Anonymous" },
    { text: "The groundwork for all happiness is good health.", author: "James Leigh Hunt" },
    { text: "A healthy outside starts from the inside.", author: "Robert Urich" },
    { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
    { text: "The resistance that you fight physically in the gym and the resistance that you fight in life can only build a strong character.", author: "Arnold Schwarzenegger" },
    { text: "If something stands between you and your success, move it. Never be denied.", author: "Dwayne Johnson" },
    { text: "The greatest wealth is health.", author: "Virgil" },
    { text: "Your body can stand almost anything. It is your mind that you have to convince.", author: "Anonymous" },
    { text: "The difference between try and triumph is a little umph.", author: "Anonymous" }
  ],
  "Entrepreneurship": [
    { text: "If you are not embarrassed by the first version of your product, you've launched too late.", author: "Reid Hoffman" },
    { text: "I have not failed. I've just found 10,000 ways that won't work.", author: "Thomas Edison" },
    { text: "The biggest risk is not taking any risk.", author: "Mark Zuckerberg" },
    { text: "Business opportunities are like buses — there's always another one coming.", author: "Richard Branson" },
    { text: "If you double the number of experiments you do per year, you're going to double your inventiveness.", author: "Jeff Bezos" },
    { text: "Your work is going to fill a large part of your life. The only way to be truly satisfied is to do great work.", author: "Steve Jobs" },
    { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
    { text: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau" },
    { text: "Don't worry about being successful but work toward being significant.", author: "Oprah Winfrey" },
    { text: "Ideas are easy. Implementation is hard.", author: "Guy Kawasaki" },
    { text: "Chase the vision, not the money; the money will end up following you.", author: "Tony Hsieh" },
    { text: "The secret of successful hiring is this: look for the people who want to change the world.", author: "Marc Benioff" },
    { text: "Every problem is a gift—without problems we would not grow.", author: "Anthony Robbins" },
    { text: "Don't build a product you think people need. Build something they actually need.", author: "Anonymous" },
    { text: "Success is walking from failure to failure with no loss of enthusiasm.", author: "Winston Churchill" },
    { text: "If you really look closely, most overnight successes took a long time.", author: "Steve Jobs" }
  ],
  "Psychology": [
    { text: "Until you make the unconscious conscious, it will direct your life and you will call it fate.", author: "Carl Jung" },
    { text: "The greatest weapon against stress is our ability to choose one thought over another.", author: "William James" },
    { text: "Nothing in life is as important as you think it is while you are thinking about it.", author: "Daniel Kahneman" },
    { text: "Being entirely honest with oneself is a good exercise.", author: "Sigmund Freud" },
    { text: "In any given moment we have two options: to step forward into growth or step back into safety.", author: "Abraham Maslow" },
    { text: "What you resist, persists.", author: "Carl Jung" },
    { text: "The curious paradox is that when I accept myself just as I am, then I can change.", author: "Carl Rogers" },
    { text: "Knowing yourself is the beginning of all wisdom.", author: "Aristotle" },
    { text: "We are not disturbed by things, but by the views which we take of them.", author: "Epictetus" },
    { text: "People do not decide their futures, they decide their habits and their habits decide their futures.", author: "F. M. Alexander" },
    { text: "The mind is its own place, and in itself can make a heaven of hell, a hell of heaven.", author: "John Milton" },
    { text: "The greatest discovery is the discovery of oneself.", author: "Carl Jung" },
    { text: "What you think, you become. What you feel, you attract. What you imagine, you create.", author: "Buddha" },
    { text: "We don't see things as they are, we see them as we are.", author: "Anaïs Nin" },
    { text: "Until you value yourself, you won't value your time.", author: "M. Scott Peck" },
    { text: "The privilege of a lifetime is to become who you truly are.", author: "Carl Jung" }
  ],
  "Personal Development": [
    { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
    { text: "Do the best you can until you know better. Then when you know better, do better.", author: "Maya Angelou" },
    { text: "It's what you learn after you know it all that counts.", author: "John Wooden" },
    { text: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
    { text: "Real knowledge is to know the extent of one's ignorance.", author: "Confucius" },
    { text: "The only true wisdom is in knowing you know nothing.", author: "Socrates" },
    { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
    { text: "The only person you are destined to become is the person you decide to be.", author: "Ralph Waldo Emerson" },
    { text: "Growth is painful. Change is painful. But nothing is as painful as staying stuck somewhere you don't belong.", author: "Mandy Hale" },
    { text: "We cannot become what we want by remaining what we are.", author: "Max De Pree" },
    { text: "The journey of a thousand miles begins with one step.", author: "Lao Tzu" },
    { text: "Knowledge speaks, but wisdom listens.", author: "Jimi Hendrix" },
    { text: "There is no growth without change, there is no change without fear.", author: "Anonymous" },
    { text: "The greatest investment you can make is in yourself.", author: "Warren Buffett" },
    { text: "Learn continually. There's always one more thing to learn.", author: "Steve Jobs" },
    { text: "Become addicted to constant and never-ending self-improvement.", author: "Anthony Robbins" }
  ],
  "Life": [
    { text: "Luck is what happens when preparation meets opportunity.", author: "Seneca" },
    { text: "The two most important days in your life are the day you are born and the day you find out why.", author: "Mark Twain" },
    { text: "Life is either a daring adventure or nothing at all.", author: "Helen Keller" },
    { text: "Do one thing every day that scares you.", author: "Eleanor Roosevelt" },
    { text: "The years teach much which the days never knew.", author: "Ralph Waldo Emerson" },
    { text: "Peace comes from within. Do not seek it without.", author: "Buddha" },
    { text: "To live a creative life, we must lose our fear of being wrong.", author: "J. Chilton Pearce" },
    { text: "Not all those who wander are lost.", author: "J. R. R. Tolkien" },
    { text: "The purpose of our lives is to be happy.", author: "Dalai Lama" },
    { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
    { text: "Life is really simple, but we insist on making it complicated.", author: "Confucius" },
    { text: "Wherever you go, go with all your heart.", author: "Confucius" },
    { text: "Happiness depends upon ourselves.", author: "Aristotle" },
    { text: "Turn your wounds into wisdom.", author: "Oprah Winfrey" },
    { text: "The good life is one inspired by love and guided by knowledge.", author: "Bertrand Russell" },
    { text: "It is never too late to be what you might have been.", author: "George Eliot" },
    { text: "Life isn't about finding yourself. Life is about creating yourself.", author: "George Bernard Shaw" }
  ]
};

const QUOTE_FAV_KEY = "wheelQuoteFavorites";
let quoteFavorites = [];
let currentRevealedQuote = null;
let wheelRotation = 0;
let isWheelSpinning = false;

async function initWheel() {
  const dial = document.getElementById("wheel-dial");
  if (!dial) return; // panel not present, safety check

  quoteFavorites = await cloudGet(QUOTE_FAV_KEY, []);
  buildWheel();

  document.getElementById("spin-wheel-btn")?.addEventListener("click", spinWheel);
  document.getElementById("spin-again-btn")?.addEventListener("click", spinWheel);
  document.getElementById("reveal-fav-btn")?.addEventListener("click", toggleRevealFavorite);
}

function buildWheel() {
  const dial = document.getElementById("wheel-dial");
  const n = WHEEL_CATEGORIES.length;
  const slice = 360 / n;

  // conic-gradient starts at the top (12 o'clock) and moves clockwise,
  // which lines up with the fixed pointer above the wheel.
  const stops = WHEEL_CATEGORIES.map((c, i) => `${c.color} ${i * slice}deg ${(i + 1) * slice}deg`).join(", ");
  dial.style.background = `conic-gradient(${stops})`;

  const radius = 60; // px from center for icon placement
  WHEEL_CATEGORIES.forEach((c, i) => {
    const angleDeg = slice * i + slice / 2;
    const angleRad = angleDeg * Math.PI / 180;
    const x = Math.sin(angleRad) * radius;
    const y = -Math.cos(angleRad) * radius;

    const icon = document.createElement("div");
    icon.className = "wheel-segment-icon";
    icon.style.left = `calc(50% + ${x}px - 13px)`;
    icon.style.top = `calc(50% + ${y}px - 13px)`;
    icon.innerHTML = `<i class="${c.icon}"></i>`;
    dial.appendChild(icon);
  });

  const center = document.createElement("div");
  center.className = "wheel-center";
  center.innerHTML = `<i class="fa-solid fa-dice"></i>`;
  dial.appendChild(center);
}

function spinWheel() {
  if (isWheelSpinning) return;

  const dial = document.getElementById("wheel-dial");
  const spinBtn = document.getElementById("spin-wheel-btn");
  if (!dial) return;

  isWheelSpinning = true;
  spinBtn?.classList.add("spinning");
  if (spinBtn) spinBtn.disabled = true;

  const n = WHEEL_CATEGORIES.length;
  const slice = 360 / n;
  const targetIndex = Math.floor(Math.random() * n);
  const targetCategory = WHEEL_CATEGORIES[targetIndex];

  const segmentCenter = targetIndex * slice + slice / 2;
  const jitter = (Math.random() - 0.5) * (slice * 0.5);
  const desiredMod = ((360 - segmentCenter - jitter) % 360 + 360) % 360;

  const currentMod = ((wheelRotation % 360) + 360) % 360;
  let delta = desiredMod - currentMod;
  if (delta <= 0) delta += 360;
  delta += 5 * 360; // extra full spins for effect

  wheelRotation += delta;
  dial.style.transform = `rotate(${wheelRotation}deg)`;

  setTimeout(() => {
    isWheelSpinning = false;
    spinBtn?.classList.remove("spinning");
    if (spinBtn) spinBtn.disabled = false;
    revealQuote(targetCategory.name);
  }, 3300);
}

function revealQuote(categoryName) {
  const pool = WHEEL_QUOTES[categoryName] || [];
  if (pool.length === 0) return;

  const quote = pool[Math.floor(Math.random() * pool.length)];
  currentRevealedQuote = { text: quote.text, author: quote.author, category: categoryName };

  const revealEl = document.getElementById("quote-reveal");
  document.getElementById("reveal-quote-text").textContent = `"${quote.text}"`;
  document.getElementById("reveal-quote-author").textContent = `${quote.author} · ${categoryName}`;

  revealEl.style.display = "block";
  revealEl.classList.remove("pop");
  void revealEl.offsetWidth; // restart animation
  revealEl.classList.add("pop");

  updateRevealFavIcon();
}

function updateRevealFavIcon() {
  const btn = document.getElementById("reveal-fav-btn");
  if (!btn || !currentRevealedQuote) return;

  const isFav = quoteFavorites.includes(currentRevealedQuote.text);
  btn.classList.toggle("active", isFav);
  btn.innerHTML = `<i class="fa-${isFav ? "solid" : "regular"} fa-heart"></i> ${isFav ? "Saved" : "Save"}`;
}

function toggleRevealFavorite() {
  if (!currentRevealedQuote) return;
  toggleQuoteFavorite(currentRevealedQuote.text);
}

// ============================================================
// QUOTE BROWSER — search, category filters, saved quotes
// ============================================================
const ALL_QUOTES = Object.entries(WHEEL_QUOTES).flatMap(([category, list]) =>
  list.map((q, i) => ({ id: `${category}-${i}`, text: q.text, author: q.author, category }))
);

let activeQuoteFilter = "All";

async function initQuotesBrowser() {
  const filtersEl = document.getElementById("quotes-filters");
  const searchEl = document.getElementById("search-quotes");
  if (!filtersEl) return; // panel not present, safety check

  // quoteFavorites is normally already loaded by initWheel(), which runs
  // first — this is just a safety net if that ever changes.
  if (typeof quoteFavorites === "undefined" || quoteFavorites === null) {
    quoteFavorites = await cloudGet(QUOTE_FAV_KEY, []);
  }

  const categories = ["All", ...WHEEL_CATEGORIES.map(c => c.name), "Saved"];
  filtersEl.innerHTML = "";
  categories.forEach(cat => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = `library-chip ${cat === activeQuoteFilter ? "active" : ""}`;
    chip.textContent = cat;
    chip.onclick = () => {
      activeQuoteFilter = cat;
      filtersEl.querySelectorAll(".library-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      renderQuoteBrowser();
    };
    filtersEl.appendChild(chip);
  });

  if (searchEl) searchEl.addEventListener("input", renderQuoteBrowser);

  renderQuoteBrowser();
}

function renderQuoteBrowser() {
  const grid = document.getElementById("quotes-grid");
  const searchEl = document.getElementById("search-quotes");
  if (!grid) return;

  const term = searchEl ? searchEl.value.trim().toLowerCase() : "";

  const filtered = ALL_QUOTES.filter(q => {
    const matchesFilter =
      activeQuoteFilter === "All" ||
      (activeQuoteFilter === "Saved" ? quoteFavorites.includes(q.text) : q.category === activeQuoteFilter);

    const matchesSearch =
      !term ||
      q.text.toLowerCase().includes(term) ||
      q.author.toLowerCase().includes(term) ||
      q.category.toLowerCase().includes(term);

    return matchesFilter && matchesSearch;
  });

  grid.innerHTML = "";

  if (filtered.length === 0) {
    const msg = activeQuoteFilter === "Saved" ? "No saved quotes yet — heart one to keep it here." : "No quotes match here yet.";
    grid.innerHTML = `<div class="library-empty">${msg}</div>`;
    return;
  }

  filtered.forEach(q => {
    const isFav = quoteFavorites.includes(q.text);

    const card = document.createElement("div");
    card.className = "quote-browser-card";
    card.innerHTML = `
      <span class="lesson-category">${q.category}</span>
      <p>"${q.text}"</p>
      <div class="quote-browser-footer">
        <span class="quote-browser-author">— ${q.author}</span>
        <button class="lesson-fav-btn ${isFav ? "active" : ""}" title="${isFav ? "Remove from favorites" : "Add to favorites"}">
          <i class="fa-${isFav ? "solid" : "regular"} fa-heart"></i>
        </button>
      </div>
    `;

    card.querySelector(".lesson-fav-btn").addEventListener("click", () => toggleQuoteFavorite(q.text));

    grid.appendChild(card);
  });

  updateLibraryGridToggle(grid, document.getElementById("quotes-show-more-btn"));
}

function toggleQuoteFavorite(text) {
  if (quoteFavorites.includes(text)) {
    quoteFavorites = quoteFavorites.filter(t => t !== text);
  } else {
    quoteFavorites.push(text);
  }
  cloudSet(QUOTE_FAV_KEY, quoteFavorites);
  updateRevealFavIcon();
  renderQuoteBrowser();
}