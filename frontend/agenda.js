// ========== ETHO AGENDA ==========
// Lands on a month calendar (same component pattern as fitness.html's
// Schedule tab: .template-library-overlay for the day-detail popup).
// Clicking a day opens that day's schedule; events are added/edited
// via a small modal (custom-dialog-overlay pattern) nested on top.
// Data lives in a single cloud key, keyed by ISO date, matching the
// pattern used by checklist/goals/tracker ("dashboard_checklist_current", etc.).

const AGENDA_COLORS = [
  { key: "primary", hex: "#E8001C" },
  { key: "blue",    hex: "#3B82F6" },
  { key: "green",   hex: "#22C55E" },
  { key: "purple",  hex: "#A855F7" },
  { key: "orange",  hex: "#F59E0B" }
];
const AGENDA_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

let agendaEvents = {};        // { "YYYY-MM-DD": [{ id, time, title, color }] }
let agendaCalDate = new Date(); // tracks the MONTH currently being viewed
let agendaSelectedDay = null;   // ISO date of the day currently open in the detail overlay
let agendaEditingId = null;     // id of the event being edited in the modal, or null when adding

// The whole calendar wrap is [data-account-feature]-locked for free users
// (dimmed + click-blocked by auth.js), but that's a CSS/JS click guard
// only — the DOM text itself was still being built with real event
// titles, readable via inspect/select-text. Real event data now only
// gets rendered into the calendar when the user is actually signed in.
let agendaSignedIn = false;

document.addEventListener("DOMContentLoaded", async () => {
    await requireAuth();

    agendaSignedIn = typeof isSignedIn === "function" ? await isSignedIn() : false;

    // ---- Sidebar / burger (same behavior as every other page) ----
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
        sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
    }
    burger.addEventListener("click", toggleSidebar);
    burger.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSidebar(); }
    });
    overlay.addEventListener("click", closeSidebar);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSidebar(); });
    document.querySelectorAll(".sidebar a").forEach(link => link.addEventListener("click", closeSidebar));

    // ---- Agenda data + UI ----
    agendaEvents = await cloudGet("agendaEvents", {});
    buildColorSwatches();
    wireAgendaControls();
    renderCalendar();
    renderHeaderStat();
});

// ---------- date helpers ----------
function agendaToISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function agendaMinutes(timeStr) {
    const m = /^(\d{2}):(\d{2})$/.exec(timeStr || "");
    return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}
function agendaFormatTime(timeStr) {
    const m = /^(\d{2}):(\d{2})$/.exec(timeStr || "");
    if (!m) return timeStr;
    const h = Number(m[1]), min = Number(m[2]);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(min).padStart(2, "0")} ${period}`;
}
function agendaColorHex(key) {
    return (AGENDA_COLORS.find(c => c.key === key) || AGENDA_COLORS[0]).hex;
}
function agendaSortedDay(iso) {
    return (agendaEvents[iso] || []).slice().sort((a, b) => agendaMinutes(a.time) - agendaMinutes(b.time));
}

// ---------- controls ----------
function wireAgendaControls() {
    document.getElementById("agenda-cal-prev").addEventListener("click", () => {
        agendaCalDate.setMonth(agendaCalDate.getMonth() - 1);
        renderCalendar();
    });
    document.getElementById("agenda-cal-next").addEventListener("click", () => {
        agendaCalDate.setMonth(agendaCalDate.getMonth() + 1);
        renderCalendar();
    });
    document.getElementById("agenda-cal-today").addEventListener("click", () => {
        agendaCalDate = new Date();
        renderCalendar();
    });

    document.getElementById("agenda-day-close").addEventListener("click", closeDayOverlay);
    document.getElementById("agenda-day-overlay").addEventListener("click", (e) => {
        if (e.target.id === "agenda-day-overlay") closeDayOverlay();
    });
    document.getElementById("agenda-add-btn").addEventListener("click", () => openAgendaModal());

    document.getElementById("agenda-cancel-btn").addEventListener("click", closeAgendaModal);
    document.getElementById("agenda-save-btn").addEventListener("click", saveAgendaEvent);
    document.getElementById("agenda-delete-btn").addEventListener("click", deleteAgendaEvent);
    document.getElementById("agenda-modal").addEventListener("click", (e) => {
        if (e.target.id === "agenda-modal") closeAgendaModal();
    });
}

function buildColorSwatches() {
    const row = document.getElementById("agenda-color-row");
    row.innerHTML = "";
    AGENDA_COLORS.forEach((c, i) => {
        const el = document.createElement("div");
        el.className = "agenda-color-swatch" + (i === 0 ? " selected" : "");
        el.style.background = c.hex;
        el.dataset.color = c.key;
        el.addEventListener("click", () => {
            row.querySelectorAll(".agenda-color-swatch").forEach(s => s.classList.remove("selected"));
            el.classList.add("selected");
        });
        row.appendChild(el);
    });
}

// ---------- header stat (always reflects real "today", regardless of viewed month) ----------
function renderHeaderStat() {
    const el = document.getElementById("agenda-today-count");
    if (!agendaSignedIn) { el.textContent = "—"; return; }
    const todayISO = agendaToISO(new Date());
    const count = (agendaEvents[todayISO] || []).length;
    if (window.animateCount) animateCount(el, count); else el.textContent = count;
}

// ---------- month calendar ----------
function renderCalendar() {
    const year = agendaCalDate.getFullYear();
    const month = agendaCalDate.getMonth();

    document.getElementById("agenda-cal-label").textContent = agendaCalDate.toLocaleDateString(undefined, {
        month: "long", year: "numeric"
    });

    const grid = document.getElementById("agenda-calendar-grid");
    grid.innerHTML = "";

    AGENDA_WEEKDAYS.forEach(w => {
        const el = document.createElement("div");
        el.className = "agenda-cal-weekday";
        el.textContent = w;
        grid.appendChild(el);
    });

    const firstOfMonth = new Date(year, month, 1);
    const startPad = firstOfMonth.getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayISO = agendaToISO(new Date());

    for (let i = 0; i < startPad; i++) {
        const pad = document.createElement("div");
        pad.className = "agenda-cal-cell pad";
        grid.appendChild(pad);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(year, month, day);
        const iso = agendaToISO(cellDate);
        // Free users see the bare grid (dates only, no titles/counts) —
        // the real per-day content is what signing in actually unlocks.
        const dayEvents = agendaSignedIn ? agendaSortedDay(iso) : [];

        const cell = document.createElement("div");
        cell.className = "agenda-cal-cell" + (iso === todayISO ? " is-today" : "") + (dayEvents.length === 0 ? " empty" : "");

        const num = document.createElement("div");
        num.className = "agenda-cal-daynum";
        num.textContent = day;
        cell.appendChild(num);

        if (agendaSignedIn) {
            const preview = document.createElement("div");
            preview.className = "agenda-cal-preview";
            preview.textContent = dayEvents.length > 0 ? dayEvents.map(e => e.title).join(", ") : "No events";
            cell.appendChild(preview);

            if (dayEvents.length > 0) {
                const count = document.createElement("div");
                count.className = "agenda-cal-count";
                count.innerHTML = `<span class="dot"></span> ${dayEvents.length}`;
                cell.appendChild(count);
            }
        }

        cell.addEventListener("click", () => openDayOverlay(iso));
        grid.appendChild(cell);
    }
}

// ---------- day detail overlay ----------
function openDayOverlay(iso) {
    agendaSelectedDay = iso;
    renderDayOverlayContent();

    const overlay = document.getElementById("agenda-day-overlay");
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("open"));
}

function closeDayOverlay() {
    const overlay = document.getElementById("agenda-day-overlay");
    overlay.classList.remove("open");
    setTimeout(() => { overlay.hidden = true; }, 200);
    agendaSelectedDay = null;
}

function renderDayOverlayContent() {
    if (!agendaSelectedDay) return;
    const [y, m, d] = agendaSelectedDay.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayEvents = agendaSortedDay(agendaSelectedDay);
    const isToday = agendaSelectedDay === agendaToISO(new Date());

    document.getElementById("agenda-day-title").innerHTML =
        `<i class="fa-solid fa-calendar-day"></i> ${dateObj.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}`;
    document.getElementById("agenda-day-sub").textContent = isToday ? "Today's schedule" : "";

    const summary = document.getElementById("agenda-day-summary");
    summary.innerHTML = "";
    const countStat = document.createElement("div");
    countStat.className = "agenda-day-stat";
    countStat.innerHTML = `<div class="val">${dayEvents.length}</div><div class="lbl">${dayEvents.length === 1 ? "event" : "events"}</div>`;
    summary.appendChild(countStat);

    const rangeStat = document.createElement("div");
    rangeStat.className = "agenda-day-stat";
    rangeStat.innerHTML = dayEvents.length > 0
        ? `<div class="val" style="font-size:1rem;">${agendaFormatTime(dayEvents[0].time)} – ${agendaFormatTime(dayEvents[dayEvents.length - 1].time)}</div><div class="lbl">span</div>`
        : `<div class="val" style="font-size:1rem;">—</div><div class="lbl">span</div>`;
    summary.appendChild(rangeStat);

    const list = document.getElementById("agenda-event-list");
    list.innerHTML = "";

    if (dayEvents.length === 0) {
        const empty = document.createElement("div");
        empty.className = "agenda-day-empty";
        empty.innerHTML = `<i class="fa-regular fa-calendar"></i> Nothing planned for this day yet.<br><button type="button" class="checklist-add-btn" id="agenda-empty-add-btn" style="margin-top:0.75rem;"><i class="fa-solid fa-plus"></i> Add an event</button>`;
        list.appendChild(empty);
        document.getElementById("agenda-empty-add-btn")?.addEventListener("click", () => openAgendaModal());
    } else {
        dayEvents.forEach(ev => {
            const row = document.createElement("div");
            row.className = "agenda-event";
            row.style.setProperty("--event-color", agendaColorHex(ev.color));
            row.innerHTML = `
                <span class="dot"></span>
                <span class="title"></span>
                ${ev.goalId ? '<i class="fa-solid fa-bullseye" style="color:var(--text-dim); font-size:0.75rem;" title="Linked to a goal"></i>' : ""}
                <span class="time">${agendaFormatTime(ev.time)}</span>
            `;
            row.querySelector(".title").textContent = ev.title;
            row.addEventListener("click", () => openAgendaModal(ev));
            list.appendChild(row);
        });
    }
}

// ---------- add/edit event modal ----------
function openAgendaModal(existingEvent) {
    agendaEditingId = existingEvent ? existingEvent.id : null;

    document.getElementById("agenda-modal-title").textContent = existingEvent ? "Edit event" : "New event";
    document.getElementById("agenda-modal-icon").className = existingEvent ? "fa-solid fa-pen" : "fa-solid fa-calendar-plus";
    document.getElementById("agenda-event-title").value = existingEvent ? existingEvent.title : "";
    document.getElementById("agenda-event-title").style.borderColor = "";
    document.getElementById("agenda-event-time").value = existingEvent ? existingEvent.time : "09:00";
    document.getElementById("agenda-delete-btn").style.display = existingEvent ? "inline-flex" : "none";

    populateAgendaGoalSelect(existingEvent ? existingEvent.goalId : "");

    const colorKey = existingEvent ? existingEvent.color : "primary";
    document.querySelectorAll(".agenda-color-swatch").forEach(s => {
        s.classList.toggle("selected", s.dataset.color === colorKey);
    });

    const modal = document.getElementById("agenda-modal");
    modal.style.display = "flex";
    requestAnimationFrame(() => modal.classList.add("open"));
    setTimeout(() => document.getElementById("agenda-event-title").focus(), 50);
}

// Populates the "Link to a goal" dropdown from the real Goals list (spec
// §7's Goal → Schedule relationship) — read-only reference into
// productivity_goals_v2, no separate goals data model for Agenda.
async function populateAgendaGoalSelect(selectedGoalId) {
    const select = document.getElementById("agenda-event-goal");
    if (!select) return;
    const goals = await cloudGet("productivity_goals_v2", []);
    select.innerHTML = '<option value="">None</option>' + goals
        .filter(g => !g.completed)
        .map(g => `<option value="${g.id}">${(g.icon || "🎯")} ${escapeHTML(g.title)}</option>`)
        .join("");
    select.value = selectedGoalId || "";
}

function closeAgendaModal() {
    const modal = document.getElementById("agenda-modal");
    modal.classList.remove("open");
    agendaEditingId = null;
    setTimeout(() => { modal.style.display = "none"; }, 150);
}

async function saveAgendaEvent() {
    if (!agendaSelectedDay) return;
    const title = document.getElementById("agenda-event-title").value.trim();
    const time = document.getElementById("agenda-event-time").value || "09:00";
    const goalId = document.getElementById("agenda-event-goal")?.value || "";
    const selectedSwatch = document.querySelector(".agenda-color-swatch.selected");
    const color = selectedSwatch ? selectedSwatch.dataset.color : "primary";

    if (!title) {
        const titleInput = document.getElementById("agenda-event-title");
        titleInput.style.borderColor = "var(--primary)";
        titleInput.focus();
        return;
    }

    if (!agendaEvents[agendaSelectedDay]) agendaEvents[agendaSelectedDay] = [];

    if (agendaEditingId) {
        const ev = agendaEvents[agendaSelectedDay].find(e => e.id === agendaEditingId);
        if (ev) { ev.title = title; ev.time = time; ev.color = color; ev.goalId = goalId || undefined; }
    } else {
        agendaEvents[agendaSelectedDay].push({ id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, title, time, color, goalId: goalId || undefined });
    }

    await cloudSet("agendaEvents", agendaEvents);
    closeAgendaModal();
    renderDayOverlayContent();
    renderCalendar();
    renderHeaderStat();
}

async function deleteAgendaEvent() {
    if (!agendaEditingId || !agendaSelectedDay) return;
    if (agendaEvents[agendaSelectedDay]) {
        agendaEvents[agendaSelectedDay] = agendaEvents[agendaSelectedDay].filter(e => e.id !== agendaEditingId);
        if (agendaEvents[agendaSelectedDay].length === 0) delete agendaEvents[agendaSelectedDay];
    }
    await cloudSet("agendaEvents", agendaEvents);
    closeAgendaModal();
    renderDayOverlayContent();
    renderCalendar();
    renderHeaderStat();
}