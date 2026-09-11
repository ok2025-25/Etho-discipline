// ========== CONSISTENCY TRACKER LOGIC ==========
// 365(ish)-square yearly grid. Pick a mode (Success / Missed) with the two
// squares at the top, then click any day to stamp it. Data is stored per
// year in one cloud-synced object so it follows the account across devices.
//
// Signed-in users can also open "Customize" to pick a layout (Grid / Duolingo-style
// Path / GitHub-style Heatmap), an accent theme, square shape, and density.
// All of that lives in its own cloud key so it's independent from the
// actual check/cross data.

const DATA_KEY = "consistency_tracker_data";
const STYLE_KEY = "consistency_custom_style";
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const THEME_COLORS = {
  signature: { check: "#22c55e", cross: "#FF4444" },
  ocean:  { check: "#22D3EE", cross: "#F43F5E" }, // cyan / crimson
  sunset: { check: "#FACC15", cross: "#E11D48" }, // gold / rose
  forest: { check: "#22C55E", cross: "#F97316" }, // emerald / orange
  mono:   { check: "#E5E7EB", cross: "#52525B" }  // silver / charcoal
};

const DEFAULT_STYLE = {
  layout: "grid",       // "grid" | "path" | "heatmap"
  theme: "signature",
  shape: "rounded",      // "rounded" | "square" | "circle"
  density: "cozy"        // "compact" | "cozy" | "large"
};

let trackerData = {};      // { "2026": { "2026-03-14": "check" | "cross" }, ... }
let selectedYear = new Date().getFullYear();
let currentMode = "check"; // "check" | "cross"
let customStyle = { ...DEFAULT_STYLE };
let savedStyleSnapshot = cloneStyle(customStyle); // last persisted state, used to revert unsaved previews
let hasUnsavedChanges = false;
let userSignedIn = false;

function cloneStyle(style) {
  return { ...style };
}

// ----- DOM refs (assigned after auth clears) -----
let yearSelect, yearGrid, modeCheckBtn, modeCrossBtn;
let statStreak, statSuccessRate, statChecks, statCrosses;
let statsGrid, statRing, statCardStreak;
let customizeBtn, customizeOverlay, customizeClose, resetStyleBtn, saveStyleBtn;
let styleOptionsEl, themeOptionsEl, shapeOptionsEl, densityOptionsEl;
let backToTopBtn;

document.addEventListener("DOMContentLoaded", async () => {
  await requireAuth();

  yearSelect = document.getElementById("year-select");
  yearGrid = document.getElementById("year-grid");
  modeCheckBtn = document.getElementById("mode-check-btn");
  modeCrossBtn = document.getElementById("mode-cross-btn");
  statStreak = document.getElementById("stat-streak");
  statSuccessRate = document.getElementById("stat-success-rate");
  statChecks = document.getElementById("stat-checks");
  statCrosses = document.getElementById("stat-crosses");
  statsGrid = document.getElementById("stats-grid");
  statRing = document.getElementById("stat-ring");
  statCardStreak = document.getElementById("stat-card-streak");

  customizeBtn = document.getElementById("customize-btn");
  customizeOverlay = document.getElementById("customize-overlay");
  customizeClose = document.getElementById("customize-close");
  resetStyleBtn = document.getElementById("reset-style-btn");
  saveStyleBtn = document.getElementById("save-style-btn");
  styleOptionsEl = document.getElementById("style-options");
  themeOptionsEl = document.getElementById("theme-options");
  shapeOptionsEl = document.getElementById("shape-options");
  densityOptionsEl = document.getElementById("density-options");
  backToTopBtn = document.getElementById("back-to-top");

  populateYearSelect();
  setupModeButtons();
  setupCustomizePanel();
  setupBackToTop();

  try {
    userSignedIn = typeof isSignedIn === "function" ? await isSignedIn() : false;
  } catch {
    userSignedIn = false;
  }
  statsGrid.classList.toggle("account", userSignedIn);

  trackerData = await cloudGet(DATA_KEY, {});
  const savedStyle = await cloudGet(STYLE_KEY, null);
  if (savedStyle) customStyle = normalizeStyle(savedStyle);
  savedStyleSnapshot = cloneStyle(customStyle);

  applyCustomStyle();
  syncCustomizeUI();

  yearSelect.addEventListener("change", () => {
    selectedYear = parseInt(yearSelect.value, 10);
    renderTracker();
    renderStats();
  });

  renderTracker();
  renderStats();
  setupSidebar();
});

// Guard against malformed/partial saved data so a bad cloud value can
// never crash rendering.
function normalizeStyle(raw) {
  const merged = { ...DEFAULT_STYLE, ...raw };
  if (!THEME_COLORS[merged.theme]) merged.theme = "signature";
  if (!["grid", "path", "heatmap"].includes(merged.layout)) merged.layout = "grid";
  if (!["rounded", "square", "circle"].includes(merged.shape)) merged.shape = "rounded";
  if (!["compact", "cozy", "large"].includes(merged.density)) merged.density = "cozy";
  return merged;
}

// ----- Year selector: this year + the next 5 -----
function populateYearSelect() {
  const currentYear = new Date().getFullYear();
  yearSelect.innerHTML = "";
  for (let y = currentYear; y <= currentYear + 5; y++) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  }
  yearSelect.value = selectedYear;
}

// ----- Top mode selector (the 2 squares) -----
function setupModeButtons() {
  modeCheckBtn.addEventListener("click", () => setMode("check"));
  modeCrossBtn.addEventListener("click", () => setMode("cross"));
}

function setMode(mode) {
  currentMode = mode;
  modeCheckBtn.classList.toggle("active", mode === "check");
  modeCrossBtn.classList.toggle("active", mode === "cross");
  modeCheckBtn.setAttribute("aria-pressed", mode === "check");
  modeCrossBtn.setAttribute("aria-pressed", mode === "cross");
}

// ----- Date helpers -----
function pad(n) { return String(n).padStart(2, "0"); }
function dateKey(date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function todayKey() { return dateKey(new Date()); }
function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }

// ----- Tracker rendering (dispatches to the active layout) -----
function renderTracker() {
  yearGrid.innerHTML = "";
  if (customStyle.layout === "path") {
    renderMonthBlocks({ pathMode: true });
  } else if (customStyle.layout === "heatmap") {
    renderHeatmapLayout();
  } else {
    renderMonthBlocks({ pathMode: false });
  }
  scrollToToday();
}

// Jumps the view straight to today's square instead of leaving the user to
// scroll all the way down (e.g. landing on January when it's May). Only
// fires when the selected year actually contains today. Runs after layout
// so the element has real dimensions to scroll to.
function scrollToToday() {
  if (selectedYear !== new Date().getFullYear()) return;
  requestAnimationFrame(() => {
    const todayEl = yearGrid.querySelector(".today");
    if (todayEl) {
      todayEl.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  });
}

// Shared renderer for Grid + Path — Grid is one flowing grid per month;
// Path caps each month at 2-3 parallel horizontal rows (never a single
// long column) so longer months don't turn into a huge scroll.
function renderMonthBlocks({ pathMode }) {
  const yearData = trackerData[selectedYear] || {};
  const todayStr = todayKey();

  const monthBlocks = [];
  for (let month = 0; month < 12; month++) {
    const monthBlock = document.createElement("div");
    monthBlock.className = "month-block";

    const label = document.createElement("div");
    label.className = "month-label";
    label.textContent = `${MONTH_NAMES[month]} ${selectedYear}`;
    monthBlock.appendChild(label);

    const total = daysInMonth(selectedYear, month);
    const grid = document.createElement("div");
    grid.className = "day-grid";

    if (pathMode) {
      buildPathRows(grid, month, total, yearData, todayStr);
    } else {
      for (let day = 1; day <= total; day++) {
        const date = new Date(selectedYear, month, day);
        const key = dateKey(date);
        grid.appendChild(buildDaySquare(key, date, todayStr, yearData, false));
      }
    }

    monthBlock.appendChild(grid);
    monthBlocks.push(monthBlock);
  }

  appendMonthBlocksWithCollapse(monthBlocks);
}

// Mobile-only: when today is 3+ months into the year, the months before
// and after today collapse behind their own "Show more" toggle (one at
// the top of the list, one at the bottom) instead of dumping all 12
// months in one long scroll. Only applies to Grid/Path (both call this),
// never Heatmap, and only when viewing the year that actually contains
// today — otherwise there's no "today" to center the window on, so the
// full year renders as before.
function appendMonthBlocksWithCollapse(monthBlocks) {
  const isMobile = window.innerWidth <= 599;
  const isCurrentYear = selectedYear === new Date().getFullYear();
  const todayMonthIdx = new Date().getMonth();

  if (!isMobile || !isCurrentYear || todayMonthIdx < 3) {
    monthBlocks.forEach(mb => yearGrid.appendChild(mb));
    return;
  }

  // ---- Before-today months, collapsed behind a top toggle ----
  const beforeToggle = document.createElement("button");
  beforeToggle.type = "button";
  beforeToggle.className = "consistency-show-more-btn consistency-show-earlier";
  beforeToggle.setAttribute("aria-expanded", "false");
  const setBeforeLabel = (expanded) => {
    beforeToggle.innerHTML = expanded
      ? '<i class="fa-solid fa-chevron-up"></i> Hide earlier months'
      : '<i class="fa-solid fa-chevron-down"></i> Show earlier months';
  };
  setBeforeLabel(false);

  const beforeGroup = document.createElement("div");
  beforeGroup.className = "consistency-collapse-group collapsed";
  monthBlocks.slice(0, todayMonthIdx).forEach(mb => beforeGroup.appendChild(mb));

  beforeToggle.addEventListener("click", () => {
    const collapsed = beforeGroup.classList.toggle("collapsed");
    beforeToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    setBeforeLabel(!collapsed);
  });

  yearGrid.appendChild(beforeToggle);
  yearGrid.appendChild(beforeGroup);

  // ---- Current month, always visible ----
  yearGrid.appendChild(monthBlocks[todayMonthIdx]);

  // ---- After-today months, collapsed behind a bottom toggle ----
  if (todayMonthIdx < 11) {
    const afterGroup = document.createElement("div");
    afterGroup.className = "consistency-collapse-group collapsed";
    monthBlocks.slice(todayMonthIdx + 1).forEach(mb => afterGroup.appendChild(mb));

    const afterToggle = document.createElement("button");
    afterToggle.type = "button";
    afterToggle.className = "consistency-show-more-btn consistency-show-later";
    afterToggle.setAttribute("aria-expanded", "false");
    const setAfterLabel = (expanded) => {
      afterToggle.innerHTML = expanded
        ? '<i class="fa-solid fa-chevron-up"></i> Hide later months'
        : '<i class="fa-solid fa-chevron-down"></i> Show later months';
    };
    setAfterLabel(false);

    afterToggle.addEventListener("click", () => {
      const collapsed = afterGroup.classList.toggle("collapsed");
      afterToggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
      setAfterLabel(!collapsed);
    });

    yearGrid.appendChild(afterGroup);
    yearGrid.appendChild(afterToggle);
  }
}

// Splits a month's days across 2 or 3 rows (3 for months over 20 days, 2
// otherwise) that snake together: row 0 reads left->right, row 1 reads
// right->left, row 2 back to left->right, etc. Each row's spine is
// trimmed on whichever side has a neighboring connector, and a rounded
// elbow fills that gap, so the whole month reads as one continuous,
// smoothly-cornered path rather than disconnected straight bars.
function buildPathRows(container, month, total, yearData, todayStr) {
  const rowCount = total > 20 ? 3 : 2;
  const perRow = Math.ceil(total / rowCount);

  let day = 1;
  for (let r = 0; r < rowCount; r++) {
    const reversed = r % 2 === 1;
    const hasTop = r > 0;
    const hasBottom = r < rowCount - 1;

    // A row's own bottom-connector sits on 'right' if reading left->right,
    // 'left' if reversed; its top-connector (from the row above) is always
    // the opposite side, since rows alternate direction every step.
    const trimRight = (!reversed && hasBottom) || (reversed && hasTop);
    const trimLeft = (reversed && hasBottom) || (!reversed && hasTop);

    const row = document.createElement("div");
    let rowClass = "path-row";
    if (reversed) rowClass += " reverse";
    if (trimRight) rowClass += " trim-right";
    if (trimLeft) rowClass += " trim-left";
    row.className = rowClass;

    if (trimRight) {
      const elbow = document.createElement("div");
      elbow.className = "path-elbow right-" + (reversed ? "up" : "down");
      row.appendChild(elbow);
    }
    if (trimLeft) {
      const elbow = document.createElement("div");
      elbow.className = "path-elbow left-" + (reversed ? "down" : "up");
      row.appendChild(elbow);
    }

    const arrow = document.createElement("div");
    arrow.className = "path-arrow";
    arrow.innerHTML = `<i class="fa-solid ${reversed ? "fa-caret-left" : "fa-caret-right"}"></i>`;
    row.appendChild(arrow);

    for (let c = 0; c < perRow && day <= total; c++, day++) {
      const date = new Date(selectedYear, month, day);
      const key = dateKey(date);
      row.appendChild(buildDaySquare(key, date, todayStr, yearData, true, c));
    }
    container.appendChild(row);

    if (hasBottom) {
      const connector = document.createElement("div");
      connector.className = "path-connector " + (reversed ? "connector-left" : "connector-right");
      container.appendChild(connector);
    }
  }
}

function buildDaySquare(key, date, todayStr, yearData, pathMode, index) {
  const status = yearData[key];
  const isFuture = key > todayStr;

  const square = document.createElement("div");
  square.className = "day-square";
  if (status === "check") square.classList.add("check");
  if (status === "cross") square.classList.add("cross");
  if (key === todayStr) square.classList.add("today");
  if (isFuture) square.classList.add("future");
  square.title = date.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });

  if (!pathMode) {
    if (status === "check") square.innerHTML = '<i class="fa-solid fa-check"></i>';
    else if (status === "cross") square.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  } else {
    // Path nodes always show a day number or lock icon, Duolingo-style
    if (isFuture) square.innerHTML = '<i class="fa-solid fa-lock"></i>';
    else if (status === "check") square.innerHTML = '<i class="fa-solid fa-check"></i>';
    else if (status === "cross") square.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    else square.textContent = date.getDate();
  }

  if (!isFuture) {
    square.addEventListener("click", () => toggleDay(key, square, pathMode));
  }

  return square;
}

// GitHub-style continuous heatmap: weeks as columns, Sun-Sat as rows, whole
// year in one horizontally-scrollable strip, always chronological Jan -> Dec.
function renderHeatmapLayout() {
  const yearData = trackerData[selectedYear] || {};
  const todayStr = todayKey();

  const jan1 = new Date(selectedYear, 0, 1);
  const dec31 = new Date(selectedYear, 11, 31);
  const startPad = jan1.getDay(); // 0=Sun
  const gridStart = new Date(jan1);
  gridStart.setDate(gridStart.getDate() - startPad);

  const scroll = document.createElement("div");
  scroll.className = "heatmap-scroll";

  const monthsRow = document.createElement("div");
  monthsRow.className = "heatmap-months";

  const body = document.createElement("div");
  body.className = "heatmap-body";

  let cursor = new Date(gridStart);
  let lastLabeledMonth = -1;
  while (cursor <= dec31) {
    const week = document.createElement("div");
    week.className = "heatmap-week";

    const weekMonth = cursor.getMonth();
    const label = document.createElement("span");
    label.style.textAlign = "left";
    if (weekMonth !== lastLabeledMonth && cursor.getFullYear() === selectedYear) {
      label.textContent = MONTH_NAMES[weekMonth].slice(0, 3);
      lastLabeledMonth = weekMonth;
    }
    monthsRow.appendChild(label);

    for (let d = 0; d < 7; d++) {
      if (cursor.getFullYear() === selectedYear) {
        const key = dateKey(cursor);
        week.appendChild(buildDaySquare(key, new Date(cursor), todayStr, yearData, false));
      } else {
        const pad = document.createElement("div");
        pad.className = "day-square pad";
        week.appendChild(pad);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    body.appendChild(week);
  }

  scroll.appendChild(monthsRow);
  scroll.appendChild(body);
  yearGrid.appendChild(scroll);
}

function toggleDay(key, squareEl, pathMode) {
  if (!trackerData[selectedYear]) trackerData[selectedYear] = {};
  const yearData = trackerData[selectedYear];

  if (yearData[key] === currentMode) {
    // clicking the same mode again clears the square
    delete yearData[key];
  } else {
    yearData[key] = currentMode;
  }

  cloudSet(DATA_KEY, trackerData);
  applySquareState(squareEl, yearData[key], key, pathMode);
  renderStats();
}

function applySquareState(squareEl, status, key, pathMode) {
  squareEl.classList.remove("check", "cross");
  squareEl.innerHTML = "";
  if (status === "check") {
    squareEl.classList.add("check");
    squareEl.innerHTML = '<i class="fa-solid fa-check"></i>';
  } else if (status === "cross") {
    squareEl.classList.add("cross");
    squareEl.innerHTML = '<i class="fa-solid fa-xmark"></i>';
  } else if (pathMode && key) {
    squareEl.textContent = String(parseInt(key.slice(-2), 10));
  }
}

// ----- Stats -----
function renderStats() {
  const yearData = trackerData[selectedYear] || {};
  const values = Object.values(yearData);
  const checks = values.filter(v => v === "check").length;
  const crosses = values.filter(v => v === "cross").length;
  const logged = checks + crosses;
  const successRate = logged > 0 ? Math.round((checks / logged) * 100) : 0;
  const streak = calculateStreak();

  statChecks.textContent = checks;
  statCrosses.textContent = crosses;
  statSuccessRate.textContent = successRate + "%";
  statStreak.textContent = streak;

  if (statRing) statRing.style.setProperty("--rate", successRate);
  if (statCardStreak) {
    const tier = streak === 0 ? 0 : streak < 3 ? 1 : streak < 7 ? 2 : 3;
    statCardStreak.dataset.tier = tier;
  }

  renderEthoScoreStat();
}

// Uses the same shared computeEthoScore() home.html uses (etho-score.js)
// so this page can never show a different number than the dashboard.
// Account-exclusive: guests never trigger computeEthoScore() at all —
// they get a locked teaser, not a dimmed real number.
async function renderEthoScoreStat() {
  const el = document.getElementById("stat-etho-score");
  const card = document.getElementById("stat-card-etho-score");
  if (!el) return;

  const signedIn = window.isSignedIn && (await isSignedIn());

  if (!signedIn) {
    if (card) card.classList.add("etho-score-teaser");
    el.innerHTML = '<i class="fa-solid fa-lock"></i>';
    return;
  }

  if (card) card.classList.remove("etho-score-teaser");
  if (typeof computeEthoScore !== "function") return;
  const { score, hasData } = await computeEthoScore();
  el.textContent = hasData ? score : "—";

  // Full breakdown UI lives on the dashboard (home.html) — send signed-in
  // users there instead of leaving this card a dead end on this page.
  if (card) {
    card.style.cursor = "pointer";
    card.onclick = () => { window.location.href = "home.html"; };
  }
}

// Walks backward day-by-day counting consecutive "check" days. If today
// hasn't been logged yet, that alone shouldn't zero out an otherwise-intact
// streak (e.g. opening the app at 5am before logging today) — so counting
// starts from yesterday in that case. An explicit "cross" on today still
// breaks the streak right away, same as any other missed day.
function calculateStreak() {
  let streak = 0;
  const d = new Date();
  const todayStr = dateKey(d);
  const todayYear = d.getFullYear();
  const todayStatus = trackerData[todayYear] ? trackerData[todayYear][todayStr] : undefined;

  if (todayStatus !== "check" && todayStatus !== "cross") {
    d.setDate(d.getDate() - 1);
  }

  while (true) {
    const key = dateKey(d);
    const year = d.getFullYear();
    const status = trackerData[year] ? trackerData[year][key] : undefined;
    if (status === "check") {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
    if (streak > 3650) break; // safety cap
  }
  return streak;
}

// ========== CUSTOMIZE PANEL (account) ==========

function setupCustomizePanel() {
  customizeBtn.addEventListener("click", () => {
    // Free users: the site-wide data-account-feature lock intercepts this click
    // and shows the sign-in modal instead, so if we get here the user is signed in.
    openCustomizePanel();
  });

  customizeClose.addEventListener("click", () => closeCustomizePanel());
  customizeOverlay.addEventListener("click", (e) => {
    if (e.target === customizeOverlay) closeCustomizePanel();
  });

  // Enter saves + confirms while the panel is open; Escape backs out
  // (reverting any unsaved preview), same as the close button.
  document.addEventListener("keydown", (e) => {
    if (!customizeOverlay.classList.contains("open")) return;
    if (e.key === "Enter") {
      e.preventDefault();
      saveStyleChanges();
    } else if (e.key === "Escape") {
      closeCustomizePanel();
    }
  });

  styleOptionsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".style-option");
    if (!btn) return;
    customStyle.layout = btn.dataset.style;
    previewStyleChanges();
  });

  themeOptionsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".theme-swatch");
    if (!btn) return;
    customStyle.theme = btn.dataset.theme;
    previewStyleChanges();
  });

  shapeOptionsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".shape-option");
    if (!btn) return;
    customStyle.shape = btn.dataset.shape;
    previewStyleChanges();
  });

  densityOptionsEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".density-option");
    if (!btn) return;
    customStyle.density = btn.dataset.density;
    previewStyleChanges();
  });

  resetStyleBtn.addEventListener("click", () => {
    customStyle = { ...DEFAULT_STYLE };
    previewStyleChanges();
  });

  saveStyleBtn.addEventListener("click", saveStyleChanges);
}

function openCustomizePanel() {
  customizeOverlay.classList.add("open");
}

// Closing without saving reverts to the last persisted style, so the page
// never sits in a preview state that silently disappears on reload.
function closeCustomizePanel() {
  if (hasUnsavedChanges) {
    customStyle = cloneStyle(savedStyleSnapshot);
    applyCustomStyle();
    renderTracker();
    syncCustomizeUI();
    setUnsavedState(false);
  }
  customizeOverlay.classList.remove("open");
}

// Applies a change live (the tracker updates instantly) without persisting
// it yet — persisting only happens via Save Changes / Enter.
function previewStyleChanges() {
  applyCustomStyle();
  renderTracker();
  syncCustomizeUI();
  setUnsavedState(true);
}

function saveStyleChanges() {
  cloudSet(STYLE_KEY, customStyle);
  savedStyleSnapshot = cloneStyle(customStyle);
  setUnsavedState(false);
  closeCustomizePanel();
}

function setUnsavedState(unsaved) {
  hasUnsavedChanges = unsaved;
  saveStyleBtn.classList.toggle("unsaved", unsaved);
}

// Pushes the current style onto the DOM: CSS custom properties for the
// theme colors (everything in the <style> block reads from these), plus
// classes/data-attrs on #year-grid for shape/density/layout.
function applyCustomStyle() {
  const colors = THEME_COLORS[customStyle.theme] || THEME_COLORS.signature;
  document.documentElement.style.setProperty("--custom-check", colors.check);
  document.documentElement.style.setProperty("--custom-cross", colors.cross);

  yearGrid.dataset.layout = customStyle.layout;
  yearGrid.classList.remove("shape-rounded", "shape-square", "shape-circle");
  yearGrid.classList.add(`shape-${customStyle.shape}`);
  yearGrid.classList.remove("density-compact", "density-cozy", "density-large");
  yearGrid.classList.add(`density-${customStyle.density}`);
}

// Reflects customStyle onto the panel's active states.
function syncCustomizeUI() {
  styleOptionsEl.querySelectorAll(".style-option").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.style === customStyle.layout);
  });
  themeOptionsEl.querySelectorAll(".theme-swatch").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.theme === customStyle.theme);
  });
  shapeOptionsEl.querySelectorAll(".shape-option").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.shape === customStyle.shape);
  });
  densityOptionsEl.querySelectorAll(".density-option").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.density === customStyle.density);
  });
}

// ----- Back to top -----
function setupBackToTop() {
  if (!backToTopBtn) return;
  window.addEventListener("scroll", () => {
    backToTopBtn.classList.toggle("visible", window.scrollY > 400);
  });
  backToTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// ----- Sidebar (mobile) -----
function setupSidebar() {
  const burger = document.getElementById("sidebar-toggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("overlay");
  if (!burger || !sidebar) return;

  burger.addEventListener("click", () => {
    burger.classList.toggle("active");
    sidebar.classList.toggle("open");
    overlay?.classList.toggle("active", sidebar.classList.contains("open"));
  });

  overlay?.addEventListener("click", () => {
    sidebar.classList.remove("open");
    burger.classList.remove("active");
    overlay.classList.remove("active");
  });

  document.addEventListener("click", (e) => {
    if (!sidebar.contains(e.target) && !burger.contains(e.target) && !e.target.closest(".mobile-bottom-nav")) {
      sidebar.classList.remove("open");
      burger.classList.remove("active");
      overlay?.classList.remove("active");
    }
  });
}