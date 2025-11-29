// ========== CHECKLIST JS LOGIC (FIXED) ==========

// ----- DOM Elements -----
const sidebar = document.getElementById("sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const historyBtn = document.getElementById("history-btn");
const historyDropdown = document.getElementById("history-dropdown");
const tasksList = document.getElementById("tasks-list");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const addTaskBtn = document.getElementById("add-task-btn");
const categoriesSection = document.getElementById("categories-section");
const historyList = document.getElementById("history-list");

// ----- Config -----
const LOCALSTORAGE_KEY = "dashboard_checklist_current";
const HISTORY_KEY = "dashboard_checklist_history";
const CATEGORIES_KEY = "dashboard_checklist_categories";
const USER_TEMPLATES_KEY = "dashboard_checklist_user_templates";

const TEMPLATES = {
"Cr7 routine": { 
  name: "CR7 Routine", 
  tasks: [
    "Wake up 6:00-7:00 AM", 
    "High protein breakfast", 
    "3-4h training (weights + cardio)", 
    "90-min recovery nap", 
    "Protein-rich lunch", 
    "Afternoon training/drills", 
    "90-min nap", 
    "Family time (evening)", 
    "8h sleep (polyphasic cycles)"
  ] 
},
"Jeff Bezos routine": { 
  name: "Jeff Bezos Routine", 
  tasks: [
    "Wake up 6:30-7:00 AM naturally", 
    "No phone - 'puttering time'", 
    "Coffee & newspaper", 
    "Breakfast with family", 
    "High-IQ meetings (10am-12pm)", 
    "Stop work decisions by 5pm", 
    "Family dinner", 
    "Bed by 10:30pm (8h sleep)"
  ] 
},
"Mark Zuckerberg routine": { 
  name: "Zuck Routine", 
  tasks: [
    "Wake up 8:00 AM", 
    "Check Facebook/Messenger/WhatsApp", 
    "MMA/Jiu-jitsu (3-4x/week)", 
    "Simple breakfast (no preference)", 
    "Gray t-shirt uniform", 
    "50-60h work/week", 
    "Family dinner & bedtime routine", 
    "8h sleep with tracking"
  ] 
}
};

// ----- State -----
let tasks = loadFromLocal(LOCALSTORAGE_KEY, { tasks: [] }).tasks || [];
let categories = loadFromLocal(CATEGORIES_KEY, ["Health", "Work", "Learning", "Deep Work"]);
let currentFilterCategory = null;

// ----- Initialization -----
document.addEventListener("DOMContentLoaded", () => {
    renderTasks();
    renderCategoriesUI();
    renderUserTemplatesUI();
    updateProgress();
});

// ----- Sidebar Logic -----
if (sidebarToggle) {
    sidebarToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        sidebar.classList.toggle("open");
    });
}
document.addEventListener("click", (e) => {
    if (window.innerWidth < 1024 && sidebar.classList.contains("open") && !sidebar.contains(e.target) && e.target !== sidebarToggle) {
        sidebar.classList.remove("open");
    }
    if (!historyDropdown.hidden && !historyDropdown.contains(e.target) && e.target !== historyBtn) {
        historyDropdown.hidden = true;
    }
});

// ----- Rendering Tasks -----
function renderTasks() {
    tasksList.innerHTML = "";

    if (!tasks.length) {
        tasksList.innerHTML = `
            <div style="text-align:center; padding:3rem; color:var(--text-muted);">
                <i class="fa-solid fa-clipboard-check" style="font-size:2rem; margin-bottom:1rem; opacity:0.5;"></i><br>
                Your list is empty.<br>Start by adding a task!
            </div>`;
        updateProgress();
        return;
    }

    tasks.forEach((task) => {
        if (currentFilterCategory && task.category !== currentFilterCategory) return;

        const li = document.createElement("li");
        li.className = "checklist-task-item" + (task.completed ? " completed" : "");
        li.dataset.id = task.id;

        // 1. Custom Checkbox
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "checklist-task-checkbox";
        checkbox.checked = task.completed;
        checkbox.addEventListener("change", () => {
            task.completed = checkbox.checked;
            saveData();
            li.classList.toggle("completed", task.completed);
            updateProgress();
        });

        // 2. Editable Label
        const label = document.createElement("div");
        label.className = "checklist-task-label";
        label.contentEditable = "true";
        label.textContent = task.text;
        label.addEventListener("blur", () => {
            task.text = label.textContent.trim() || task.text;
            saveData();
        });
        label.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); label.blur(); } });

        // 3. Category Select (Styled)
        const catSelect = document.createElement("select");
        catSelect.style.width = "auto";
        catSelect.style.fontSize = "0.8rem";
        catSelect.style.padding = "0.3rem";
        catSelect.innerHTML = `<option value="">Category...</option>`;
        categories.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c;
            opt.textContent = c;
            if (task.category === c) opt.selected = true;
            catSelect.appendChild(opt);
        });
        catSelect.addEventListener("change", () => {
            task.category = catSelect.value;
            saveData();
        });

        // 4. Controls (FontAwesome Icons)
        const controls = document.createElement("div");
        controls.className = "checklist-task-controls";

        const btnUp = createIconBtn("fa-arrow-up", () => moveTask(task.id, -1));
        const btnDown = createIconBtn("fa-arrow-down", () => moveTask(task.id, 1));
        const btnDel = createIconBtn("fa-trash", () => deleteTask(task.id), "text-align:right; color:#ef4444;");

        controls.append(btnUp, btnDown, btnDel);

        li.append(checkbox, label, catSelect, controls);
        tasksList.appendChild(li);
    });

    updateProgress();
}

function createIconBtn(iconClass, onClick, style = "") {
    const btn = document.createElement("button");
    btn.className = "checklist-action-btn";
    btn.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
    if (style) btn.style.cssText = style;
    btn.addEventListener("click", onClick);
    return btn;
}

// ----- Core Logic -----
function addTask() {
    tasks.push({
        id: Date.now().toString(36),
        text: "New Task",
        completed: false,
        category: currentFilterCategory || ""
    });
    saveData();
    renderTasks();
    // Focus last added
    setTimeout(() => {
        const last = tasksList.lastElementChild;
        if (last) {
            const lbl = last.querySelector(".checklist-task-label");
            if (lbl) lbl.focus();
        }
    }, 50);
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveData();
    renderTasks();
}

function moveTask(id, direction) {
    const idx = tasks.findIndex(t => t.id === id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx >= 0 && newIdx < tasks.length) {
        [tasks[idx], tasks[newIdx]] = [tasks[newIdx], tasks[idx]];
        saveData();
        renderTasks();
    }
}

function updateProgress() {
    const total = tasks.length;
    const done = tasks.filter(t => t.completed).length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    progressBar.style.width = pct + "%";
    progressText.textContent = pct + "%";
}

// ----- Categories (With Delete) -----
function renderCategoriesUI() {
    const list = categoriesSection.querySelector(".categories-list");
    list.innerHTML = "";

    // 1. Add Button
    const addBtn = document.createElement("button");
    addBtn.className = "checklist-add-btn";
    addBtn.style.padding = "0.5rem 1rem";
    addBtn.style.fontSize = "0.8rem";
    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
    addBtn.onclick = () => {
        const name = prompt("New Category Name:");
        if (name && name.trim() !== "" && !categories.includes(name)) {
            categories.push(name.trim());
            saveToLocal(CATEGORIES_KEY, categories);
            renderCategoriesUI();
            renderTasks(); 
        }
    };
    list.appendChild(addBtn);

    // 2. "All" Filter Button (No delete)
    const allBtn = document.createElement("button");
    allBtn.className = "category-btn";
    if (!currentFilterCategory) {
        allBtn.style.background = "var(--accent)";
        allBtn.style.color = "#000";
    }
    allBtn.textContent = "All";
    allBtn.onclick = () => { currentFilterCategory = null; renderCategoriesUI(); renderTasks(); };
    list.appendChild(allBtn);

    // 3. Category Buttons (With Delete)
    categories.forEach((cat, index) => {
        const btn = document.createElement("button");
        btn.className = "category-btn";

        // Highlight if active
        if (currentFilterCategory === cat) {
            btn.style.background = "var(--accent)";
            btn.style.color = "#000";
        }

        // Label text
        const span = document.createElement("span");
        span.textContent = cat;
        btn.appendChild(span);

        // Delete Icon
        const delIcon = document.createElement("span");
        delIcon.className = "category-delete";
        delIcon.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        delIcon.onclick = (e) => {
            e.stopPropagation(); 
            if (confirm(`Delete category "${cat}"?`)) {
                categories.splice(index, 1); 
                if (currentFilterCategory === cat) currentFilterCategory = null;
                tasks.forEach(t => { if (t.category === cat) t.category = ""; });
                saveData(); 
                saveToLocal(CATEGORIES_KEY, categories); 
                renderCategoriesUI();
                renderTasks();
            }
        };

        btn.onclick = () => { currentFilterCategory = cat; renderCategoriesUI(); renderTasks(); };
        btn.appendChild(delIcon);
        list.appendChild(btn);
    });
}

// ----- Templates & History -----
document.addEventListener("click", (e) => {
    const btn = e.target.closest(".template-btn");
    // If we clicked a delete icon inside a template btn, ignore this listener
    if (!btn || e.target.closest(".template-delete")) return;
    
    const type = btn.dataset.template;
    // If it's a user template (no dataset type usually), ignore, it's handled in renderUserTemplatesUI
    if(!type && !btn.classList.contains("user-tpl")) return; 
    // However, your HTML hardcodes types, but dynamically added user templates don't have data-template="...".
    // The logic below handles standard types. User templates are handled in their specific onclick.
    
    if (type === "custom") {
        const name = prompt("Template Name:");
        if (name) {
            const userTemplates = loadFromLocal(USER_TEMPLATES_KEY, []);
            userTemplates.push({ name, tasks: tasks.map(t => t.text) });
            saveToLocal(USER_TEMPLATES_KEY, userTemplates);
            renderUserTemplatesUI();
        }
        return;
    }

    // Save current to history before wiping
    if (tasks.length > 0 && (type === "empty" || TEMPLATES[type])) {
        let history = loadFromLocal(HISTORY_KEY, []);
        history.unshift({ date: new Date(), tasks: [...tasks] });
        saveToLocal(HISTORY_KEY, history.slice(0, 10));
    }

    if (type === "empty") {
        tasks = [];
    } else if (TEMPLATES[type]) {
        tasks = TEMPLATES[type].tasks.map(txt => ({
            id: Math.random().toString(36), text: txt, completed: false, category: ""
        }));
    }

    saveData();
    renderTasks();
});

// ----- User Templates UI (With Delete) -----
function renderUserTemplatesUI() {
    const container = document.querySelector(".templates-options");

    // 1. Clean up existing user templates to avoid duplicates
    container.querySelectorAll(".user-tpl").forEach(el => el.remove());

    const userTemplates = loadFromLocal(USER_TEMPLATES_KEY, []);

    userTemplates.forEach((ut, index) => {
        const btn = document.createElement("button");
        btn.className = "template-btn user-tpl";

        // Left side: Name
        const nameSpan = document.createElement("span");
        nameSpan.innerHTML = `<i class="fa-solid fa-star" style="color:gold; margin-right:8px;"></i> ${ut.name}`;
        btn.appendChild(nameSpan);

        // Right side: Delete Icon
        const delBtn = document.createElement("span");
        delBtn.className = "template-delete";
        delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        delBtn.title = "Delete Template";

        // Delete Logic
        delBtn.onclick = (e) => {
            e.stopPropagation(); 
            if (confirm(`Delete template "${ut.name}"?`)) {
                userTemplates.splice(index, 1);
                saveToLocal(USER_TEMPLATES_KEY, userTemplates);
                renderUserTemplatesUI();
            }
        };
        btn.appendChild(delBtn);

        // Load Logic 
        btn.onclick = (e) => {
             // Prevent loading if we clicked delete
             if(e.target.closest('.template-delete')) return;

             if (confirm(`Load ${ut.name}? Current tasks will be saved to history.`)) {
                if (tasks.length > 0) {
                    let history = loadFromLocal(HISTORY_KEY, []);
                    history.unshift({ date: new Date(), tasks: [...tasks] });
                    saveToLocal(HISTORY_KEY, history.slice(0, 10));
                }
                tasks = ut.tasks.map(txt => ({
                    id: Math.random().toString(36),
                    text: txt,
                    completed: false,
                    category: ""
                }));
                saveData();
                renderTasks();
            }
        };

        // Insert before the "Create Custom" button
        const customBtn = container.querySelector('[data-template="custom"]');
        if (customBtn) {
            container.insertBefore(btn, customBtn);
        } else {
            container.appendChild(btn);
        }
    });
}

// ----- History Logic -----
if (historyBtn) {
    historyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        historyDropdown.hidden = !historyDropdown.hidden;
        if (!historyDropdown.hidden) {
            historyList.innerHTML = "";
            const history = loadFromLocal(HISTORY_KEY, []);
            if (!history.length) historyList.innerHTML = "<li>No history yet</li>";
            history.forEach(h => {
                const li = document.createElement("li");
                li.style.padding = "0.5rem";
                li.style.cursor = "pointer";
                li.style.borderBottom = "1px solid #333";
                li.innerHTML = `<small>${new Date(h.date).toLocaleDateString()}</small> - ${h.tasks.length} tasks`;
                li.onclick = () => {
                    if (confirm("Restore this list?")) {
                        tasks = h.tasks;
                        saveData();
                        renderTasks();
                    }
                };
                historyList.appendChild(li);
            });
        }
    });
}

// ----- Utility Functions -----
function saveData() { saveToLocal(LOCALSTORAGE_KEY, { tasks }); }
function saveToLocal(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function loadFromLocal(key, fallback) {
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : fallback;
}

if (addTaskBtn) addTaskBtn.addEventListener("click", addTask);