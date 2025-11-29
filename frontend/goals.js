// ----- GOALS.JS: Logic for SMART Goals Dashboard -----

// ====== STATE & STORAGE ======
const LS_KEY = "productivity_goals_v2";
const LS_PLANS = "productivity_goal_plans_v2";
const dailyQuotes = [
  "Don't limit your challenges. Challenge your limits.",
  "Small progress is still progress.",
  "The secret of getting ahead is getting started.",
  "Success is the sum of small efforts, repeated day in and day out.",
  "The best time to plant a tree was 20 years ago. The second best time is now.",
  "Discipline is choosing between what you want now and what you want most.",
  "Dream big. Start small. Act now.",
  "Your goals are as good as your actions.",
  "You don't have to be extreme, just consistent.",
  "Today's accomplishments were yesterday's impossibilities."
];

const goalTemplates = [
  { icon: "📚", title: "Read 12 Books this year", type: "numeric", targetNumber: 12, desc: "Finish one book a month." },
  { icon: "🏃‍♂️", title: "Run 100 km", type: "numeric", targetNumber: 100, desc: "Accumulate 100 km in a season." },
  { icon: "🧘", title: "Practice daily meditation", type: "descriptive", desc: "Build a 30-day meditation streak." },
  { icon: "💡", title: "Launch a side project", type: "descriptive", desc: "Ship a simple public app." },
  { icon: "🍎", title: "Healthy eating for 30 days", type: "descriptive", desc: "Improve eating habits consistently." }
];

let allGoals = [];
let plannerGoalId = null;

// ====== DOM ELEMENTS ======
const burgerMenu = document.getElementById('burger-menu');
const sidebar = document.getElementById('sidebar');
const summaryTotal = document.getElementById('goals-total');
const summaryCompleted = document.getElementById('goals-completed');
const summaryRemaining = document.getElementById('goals-remaining');
const overallProgressBar = document.getElementById('overall-progress-bar');
const overallProgressPercent = document.getElementById('overall-progress-percent');
const goalsList = document.getElementById('goals-list');
const emptyState = document.getElementById('empty-state');
const addGoalBtn = document.getElementById('add-goal-btn');
const modal = document.getElementById('goals-modal');
const modalTitle = document.getElementById('modal-title');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const goalForm = document.getElementById('goal-form');
const goalTitleField = document.getElementById('goal-title');
const goalTypeField = document.getElementById('goal-type');
const targetNumberGroup = document.getElementById('target-number-group');
const goalTargetNumberField = document.getElementById('goal-target-number');
const goalDescField = document.getElementById('goal-desc');
const goalDeadlineField = document.getElementById('goal-deadline');
const templatesList = document.getElementById('goal-templates-list');
const plannerSection = document.getElementById('goals-planner-section');
const plannerGoalTitle = document.getElementById('planner-goal-title');
const plannerStepsList = document.getElementById('planner-steps-list');
const plannerInput = document.getElementById('planner-step-input');
const plannerAddBtn = document.getElementById('planner-add-step-btn');
const closePlannerBtn = document.getElementById('close-planner-btn');
const quoteBox = document.getElementById('motivational-quote');

// ====== SIDEBAR TOGGLE ======
burgerMenu.addEventListener('click', () => {
    burgerMenu.classList.toggle('active');
    sidebar.classList.toggle('open');
});

// ====== QUOTE OF THE DAY ======
(function showDailyQuote() {
  const dt = new Date();
  const idx = (dt.getFullYear() + dt.getMonth() + dt.getDate()) % dailyQuotes.length;
  quoteBox.textContent = `"${dailyQuotes[idx]}"`;
})();

// ====== GOALS CRUD ======
function loadGoals() {
    allGoals = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
}

function saveGoals() {
    localStorage.setItem(LS_KEY, JSON.stringify(allGoals));
}

function updateDashboardSummary() {
    const total = allGoals.length;
    const completed = allGoals.filter(g => g.completed).length;
    const remaining = total - completed;
    
    summaryTotal.textContent = total;
    summaryCompleted.textContent = completed;
    summaryRemaining.textContent = remaining;
    
    // Overall progress
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    overallProgressBar.style.width = `${progress}%`;
    overallProgressPercent.textContent = `${progress}%`;
}

// ====== MODAL (Add / Edit) ======
let modalMode = "add";
let editingGoalId = null;

function openGoalModal(mode, goal = null) {
    modalMode = mode;
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
    goalForm.reset();
    targetNumberGroup.style.display = "none";
    
    if (mode === "add") {
        modalTitle.innerHTML = '<i class="fa-solid fa-bullseye"></i> Add New Goal';
        editingGoalId = null;
    } else {
        modalTitle.innerHTML = '<i class="fa-solid fa-pen"></i> Edit Goal';
        editingGoalId = goal.id;
        goalTitleField.value = goal.title || "";
        goalTypeField.value = goal.type || "numeric";
        if (goal.type === "numeric") {
            targetNumberGroup.style.display = "block";
            goalTargetNumberField.value = goal.targetNumber || "";
        }
        goalDeadlineField.value = goal.deadline || "";
        goalDescField.value = goal.desc || "";
    }
    goalTitleField.focus();
}

function closeGoalModal() {
    modal.style.display = "none";
    document.body.style.overflow = "";
    editingGoalId = null;
}

// Type logic
goalTypeField.addEventListener('change', (e) => {
    targetNumberGroup.style.display = e.target.value === "numeric" ? "block" : "none";
});

// Cancel
modalCancelBtn.addEventListener('click', closeGoalModal);

// Add btn
addGoalBtn.addEventListener('click', () => openGoalModal('add'));

// Form submit
goalForm.addEventListener('submit', e => {
    e.preventDefault();
    const title = goalTitleField.value.trim();
    const type = goalTypeField.value;
    const targetNumber = type === "numeric" ? Number(goalTargetNumberField.value) : undefined;
    const desc = goalDescField.value.trim();
    const deadline = goalDeadlineField.value || "";

    if (!title || (type === "numeric" && !targetNumber)) {
      goalTitleField.focus();
      return;
    }

    if (modalMode === "add") {
      const id = Date.now().toString(36) + Math.floor(Math.random() * 90000);
      allGoals.push({
        id, title, type, targetNumber, desc, deadline,
        progress: 0,
        completed: false,
        milestones: [],
        createdAt: new Date().toISOString()
      });
    } else if (modalMode === "edit" && editingGoalId) {
      allGoals = allGoals.map(g => g.id === editingGoalId ? {
        ...g, title, type, targetNumber, desc, deadline
      } : g);
    }

    saveGoals();
    renderGoals();
    updateDashboardSummary();
    closeGoalModal();
});

// ====== TEMPLATES ======
function renderGoalTemplates() {
    templatesList.innerHTML = '';
    goalTemplates.forEach((tpl) => {
        const btn = document.createElement('button');
        btn.className = 'template-btn';
        btn.type = 'button';
        btn.innerHTML = `<span style="font-size:1.4em">${tpl.icon}</span> <span>${tpl.title}</span>`;
        btn.onclick = () => {
          openGoalModal('add');
          goalTitleField.value = tpl.title;
          goalTypeField.value = tpl.type;
          targetNumberGroup.style.display = tpl.type === "numeric" ? "block" : "none";
          goalTargetNumberField.value = tpl.type === "numeric" ? tpl.targetNumber : "";
          goalDescField.value = tpl.desc || "";
        };
        templatesList.append(btn);
    });
}

// ====== RENDER GOALS ======
function renderGoals() {
  goalsList.innerHTML = '';
  
  if (allGoals.length === 0) {
    emptyState.style.display = 'block';
    goalsList.style.display = 'none';
    updateDashboardSummary();
    return;
  }
  
  emptyState.style.display = 'none';
  goalsList.style.display = 'grid';
  
  allGoals.forEach(goal => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.cssText = 'position: relative; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; transition: var(--transition);';
    
    // Completed badge
    if (goal.completed) {
      card.style.opacity = '0.8';
      const badge = document.createElement('div');
      badge.innerHTML = '<i class="fa-solid fa-check-circle"></i> Completed';
      badge.style.cssText = 'position: absolute; top: 1rem; right: 1rem; background: linear-gradient(135deg, var(--accent), var(--primary)); color: white; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 600; display: flex; align-items: center; gap: 0.25rem;';
      card.appendChild(badge);
    }
    
    // Title & Description
    const header = document.createElement('div');
    header.innerHTML = `
      <div style="font-size: 1.1rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.5rem; padding-right: ${goal.completed ? '6rem' : '0'};">
        ${goal.title}
      </div>
      ${goal.desc ? `<div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">${goal.desc}</div>` : ''}
      ${goal.deadline ? `<div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 0.5rem;"><i class="fa-solid fa-calendar"></i> Due: ${new Date(goal.deadline).toLocaleDateString()}</div>` : ''}
    `;
    card.appendChild(header);
    
    // Progress Section
    const progressSection = document.createElement('div');
    progressSection.style.cssText = 'display: flex; flex-direction: column; gap: 0.75rem; margin-top: auto;';
    
    if (goal.type === "numeric") {
      const percent = goal.targetNumber > 0 ? Math.round(100 * Math.min(1, (goal.progress || 0) / goal.targetNumber)) : 0;
      
      progressSection.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
          <span style="color: var(--text-muted);"><i class="fa-solid fa-chart-line"></i> Progress</span>
          <span style="color: var(--primary); font-weight: 600;">${goal.progress || 0} / ${goal.targetNumber}</span>
        </div>
        <div class="checklist-progress-bar-bg">
          <div class="checklist-progress-bar-fill" style="width: ${percent}%"></div>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <input type="number" class="progress-input" value="${goal.progress || 0}" 
                 min="0" max="${goal.targetNumber}" 
                 style="flex: 1; background: rgba(0, 0, 0, 0.4); border: 1px solid var(--glass-border); 
                        color: var(--text-main); padding: 0.5rem; border-radius: var(--radius-sm); 
                        font-size: 0.9rem; text-align: center;" 
                 ${goal.completed ? 'disabled' : ''}>
          <button class="update-progress-btn" style="background: var(--primary); color: white; 
                  padding: 0.5rem 1rem; border-radius: var(--radius-sm); cursor: pointer; 
                  transition: var(--transition); font-size: 0.85rem; font-weight: 500;"
                  ${goal.completed ? 'disabled' : ''}>
            <i class="fa-solid fa-arrow-up"></i> Update
          </button>
        </div>
      `;
      
      card.appendChild(progressSection);
      
      // Update progress handler
      const updateBtn = card.querySelector('.update-progress-btn');
      const progressInput = card.querySelector('.progress-input');
      updateBtn.onclick = () => {
        goal.progress = Number(progressInput.value);
        if (goal.progress >= goal.targetNumber) {
          goal.completed = true;
        }
        saveGoals();
        renderGoals();
        updateDashboardSummary();
      };
    } else {
      // Milestone-based
      const plans = getPlans();
      const steps = plans[goal.id] || [];
      const doneSteps = steps.filter(s => s.done).length;
      const totalSteps = steps.length;
      const percent = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;
      
      progressSection.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
          <span style="color: var(--text-muted);"><i class="fa-solid fa-tasks"></i> Milestones</span>
          <span style="color: var(--primary); font-weight: 600;">${doneSteps} / ${totalSteps} completed</span>
        </div>
        <div class="checklist-progress-bar-bg">
          <div class="checklist-progress-bar-fill" style="width: ${percent}%"></div>
        </div>
      `;
      card.appendChild(progressSection);
    }
    
    // Actions
    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 0.5rem; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--glass-border);';
    actions.innerHTML = `
      <button class="template-btn plan-btn" style="flex: 1; justify-content: center; margin: 0;" title="Manage action plan">
        <i class="fa-solid fa-clipboard-list"></i> Action Plan
      </button>
      <button class="checklist-action-btn edit-btn" style="padding: 0.5rem 0.75rem; font-size: 1rem;" title="Edit goal">
        <i class="fa-solid fa-pen"></i>
      </button>
      ${!goal.completed ? `
        <button class="checklist-action-btn complete-btn" style="padding: 0.5rem 0.75rem; font-size: 1rem; color: var(--accent);" title="Mark as complete">
          <i class="fa-solid fa-check"></i>
        </button>
      ` : ''}
      <button class="checklist-action-btn delete-btn" style="padding: 0.5rem 0.75rem; font-size: 1rem; color: var(--secondary);" title="Delete goal">
        <i class="fa-solid fa-trash"></i>
      </button>
    `;
    card.appendChild(actions);
    
    // Event handlers
    card.querySelector('.plan-btn').onclick = () => openPlanner(goal.id);
    card.querySelector('.edit-btn').onclick = () => openGoalModal('edit', goal);
    card.querySelector('.delete-btn').onclick = () => {
      if (confirm(`Delete "${goal.title}"?`)) {
        allGoals = allGoals.filter(g => g.id !== goal.id);
        saveGoals();
        renderGoals();
        updateDashboardSummary();
      }
    };
    
    if (!goal.completed) {
      card.querySelector('.complete-btn').onclick = () => {
        goal.completed = true;
        if (goal.type === "numeric") goal.progress = goal.targetNumber;
        saveGoals();
        renderGoals();
        updateDashboardSummary();
      };
    }
    
    goalsList.appendChild(card);
  });
  
  updateDashboardSummary();
}

// ====== PLANNER: STEPS/MILESTONES ======
function getPlans() {
  return JSON.parse(localStorage.getItem(LS_PLANS) || "{}");
}

function savePlans(plans) {
  localStorage.setItem(LS_PLANS, JSON.stringify(plans));
}

function openPlanner(goalId) {
  plannerGoalId = goalId;
  const goal = allGoals.find(g => g.id === goalId);
  plannerGoalTitle.textContent = goal.title;
  plannerSection.style.display = "block";
  plannerSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  renderPlannerSteps();
}

function closePlanner() {
  plannerGoalId = null;
  plannerSection.style.display = "none";
  plannerStepsList.innerHTML = "";
  plannerInput.value = "";
}

closePlannerBtn.onclick = closePlanner;

function renderPlannerSteps() {
  if (!plannerGoalId) return;
  plannerStepsList.innerHTML = '';
  
  let plans = getPlans();
  let steps = plans[plannerGoalId] || [];
  
  if (steps.length === 0) {
    plannerStepsList.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
        <i class="fa-solid fa-clipboard" style="font-size: 2.5rem; opacity: 0.3; margin-bottom: 0.75rem;"></i>
        <p style="font-size: 0.95rem;">No action steps yet. Add your first milestone below!</p>
      </div>
    `;
    return;
  }
  
  steps.forEach((step, idx) => {
    const div = document.createElement('div');
    div.style.cssText = `display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; 
                         background: rgba(255, 255, 255, 0.03); border-radius: var(--radius-md); 
                         border: 1px solid var(--glass-border); transition: var(--transition);`;
    
    div.innerHTML = `
      <input type="checkbox" ${step.done ? "checked" : ""} 
             style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--primary);" 
             title="Mark as done">
      <span style="flex: 1; ${step.done ? 'text-decoration: line-through; opacity: 0.5;' : ''}">${idx + 1}. ${step.text}</span>
      <button class="checklist-action-btn delete-step-btn" style="font-size: 0.9rem; color: var(--text-muted);" title="Remove step">
        <i class="fa-solid fa-times"></i>
      </button>
    `;
    
    div.querySelector('input[type="checkbox"]').onchange = e => {
      steps[idx].done = e.target.checked;
      savePlans(plans);
      renderPlannerSteps();
      updateGoalProgress();
    };
    
    div.querySelector('.delete-step-btn').onclick = () => {
      steps.splice(idx, 1);
      savePlans(plans);
      renderPlannerSteps();
      updateGoalProgress();
    };
    
    plannerStepsList.appendChild(div);
  });
  
  updateGoalProgress();
}

function updateGoalProgress() {
  let goal = allGoals.find(g => g.id === plannerGoalId);
  if (!goal) return;
  
  let plans = getPlans();
  let steps = plans[plannerGoalId] || [];
  
  goal.milestones = steps.map(s => s.text);
  goal.progress = steps.filter(s => s.done).length;
  goal.completed = steps.length > 0 && steps.filter(s => s.done).length === steps.length;
  
  saveGoals();
  renderGoals();
  updateDashboardSummary();
}

// Add step
plannerAddBtn.onclick = () => {
  const txt = plannerInput.value.trim();
  if (!txt) return;
  
  let plans = getPlans();
  if (!plans[plannerGoalId]) plans[plannerGoalId] = [];
  plans[plannerGoalId].push({text: txt, done: false});
  savePlans(plans);
  plannerInput.value = "";
  renderPlannerSteps();
};

plannerInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    plannerAddBtn.click();
  }
});

// Modal ESC/Click out
window.addEventListener('keydown', e => {
  if (e.key === "Escape") {
    if (modal.style.display === "flex") closeGoalModal();
    if (plannerSection.style.display !== "none") closePlanner();
  }
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) closeGoalModal();
});

// ====== INITIALIZATION ======
loadGoals();
renderGoalTemplates();
renderGoals();
updateDashboardSummary();