/* ============================================================
   ETHO — Systems (spec §15)
   ------------------------------------------------------------
   A System is a one-click starter bundle: clicking "Activate"
   creates a predefined set of goals, checklist tasks, categories,
   and (optionally) recurring agenda blocks in one shot — the
   thing the spec calls out as "far more useful than merely
   downloading a checklist template."

   This file is DATA ONLY. systems.js is the only place that
   knows how to render the picker or write this data into the
   app's real storage (goals / checklist / categories / agenda).

   Shapes reused on purpose so activation can hand these straight
   to the same code paths the rest of the app already uses:
     goal          -> same fields as goals.js's goalTemplates entries
                      (icon, title, type, targetNumber?, desc, steps[])
     checklistTask -> same fields as checklist.js's TEMPLATES[x].tasks
                      (text, category, hour)
     agendaBlock   -> { title, weekdays: [0-6...], time: "HH:MM", color }
                      color is one of AGENDA_COLORS keys in agenda.js
                      (primary/blue/green/purple/orange)
   ============================================================ */

const ETHO_SYSTEMS = [
  {
    id: "discipline",
    icon: "fa-solid fa-shield-halved",
    name: "Discipline System",
    tagline: "A complete starter system for showing up every day.",
    locked: false,
    categories: ["Discipline", "Health", "Work"],
    goals: [
      { icon: "🎯", title: "Run this system for 30 days straight", type: "numeric", targetNumber: 30,
        desc: "Show up for your checklist and routine every day for a month.",
        steps: ["Finish week 1 without missing a day", "Finish week 2", "Reach a 21-day streak", "Complete the full 30 days"] }
    ],
    checklistTasks: [
      { text: "Wake up at a fixed time, no snoozing", category: "Discipline", hour: "06:30" },
      { text: "Make your bed", category: "Discipline", hour: "06:35" },
      { text: "Review today's top 3 priorities", category: "Work", hour: "07:00" },
      { text: "Deep work block — no phone", category: "Work", hour: "09:00" },
      { text: "Move your body for 20 minutes", category: "Health", hour: "18:00" },
      { text: "Plan tomorrow before bed", category: "Discipline", hour: "21:30" }
    ],
    agendaBlocks: [
      { title: "Deep work block", weekdays: [1, 2, 3, 4, 5], time: "09:00", color: "primary" }
    ]
  },
  {
    id: "student",
    icon: "fa-solid fa-graduation-cap",
    name: "Student System",
    tagline: "Study, routine, and planning in one system.",
    locked: false,
    categories: ["Study", "Classes", "Personal"],
    goals: [
      { icon: "🎓", title: "Finish the semester strong", type: "descriptive",
        desc: "Stay on top of coursework instead of cramming at the end.",
        steps: ["Build a weekly study schedule", "Complete first set of assignments early", "Review material weekly, not just before exams", "Finish the semester with no last-minute cramming"] }
    ],
    checklistTasks: [
      { text: "Review class notes from the day before", category: "Study", hour: "08:00" },
      { text: "Attend classes / lectures", category: "Classes", hour: "09:00" },
      { text: "Focused study block", category: "Study", hour: "16:00" },
      { text: "Review flashcards or practice questions", category: "Study", hour: "19:00" },
      { text: "Prep bag and materials for tomorrow", category: "Personal", hour: "21:00" }
    ],
    agendaBlocks: [
      { title: "Study block", weekdays: [1, 2, 3, 4, 5], time: "16:00", color: "blue" }
    ]
  },
  {
    id: "athlete",
    icon: "fa-solid fa-dumbbell",
    name: "Athlete System",
    tagline: "Fitness, recovery, and consistency together.",
    locked: false,
    categories: ["Fitness", "Recovery", "Nutrition"],
    goals: [
      { icon: "💪", title: "Train consistently for 8 weeks", type: "numeric", targetNumber: 8,
        desc: "Build a training habit that survives busy weeks.",
        steps: ["Complete week 1", "Complete week 4 without missing a planned session", "Complete week 6", "Reach week 8"] }
    ],
    checklistTasks: [
      { text: "Morning mobility / warm-up", category: "Fitness", hour: "07:00" },
      { text: "Training session", category: "Fitness", hour: "17:30" },
      { text: "Hit today's protein/hydration target", category: "Nutrition", hour: "12:00" },
      { text: "Stretch or foam roll", category: "Recovery", hour: "20:30" },
      { text: "Log sleep and how you felt today", category: "Recovery", hour: "21:30" }
    ],
    agendaBlocks: [
      { title: "Training session", weekdays: [1, 3, 5], time: "17:30", color: "green" }
    ]
  },
  {
    id: "entrepreneur",
    icon: "fa-solid fa-rocket",
    name: "Entrepreneur System",
    tagline: "Deep work, goals, and execution for building something.",
    locked: true,
    categories: ["Business", "Deep Work", "Admin"],
    goals: [
      { icon: "🚀", title: "Ship the next milestone", type: "descriptive",
        desc: "Move the business forward with a real weekly cadence instead of scattered effort.",
        steps: ["Define this month's single most important milestone", "Break it into weekly targets", "Hit week 1's target", "Hit week 2's target", "Ship the milestone"] }
    ],
    checklistTasks: [
      { text: "Review priorities — what actually moves the needle today", category: "Business", hour: "07:30" },
      { text: "Protected deep work block", category: "Deep Work", hour: "09:00" },
      { text: "Admin / email / logistics batch", category: "Admin", hour: "13:00" },
      { text: "Follow up with a customer, lead, or partner", category: "Business", hour: "15:00" },
      { text: "Log today's wins and tomorrow's #1 priority", category: "Admin", hour: "19:00" }
    ],
    agendaBlocks: [
      { title: "Protected deep work block", weekdays: [1, 2, 3, 4, 5], time: "09:00", color: "purple" },
      { title: "Admin batch", weekdays: [2, 4], time: "13:00", color: "orange" }
    ]
  },
  {
    id: "deep-work",
    icon: "fa-solid fa-brain",
    name: "Deep Work System",
    tagline: "Focus, scheduling, and daily execution.",
    locked: true,
    categories: ["Deep Work", "Admin", "Recovery"],
    goals: [
      { icon: "🧠", title: "Protect deep work every weekday", type: "numeric", targetNumber: 20,
        desc: "Get 20 real deep work sessions in — no multitasking, no notifications.",
        steps: ["Complete 5 sessions", "Complete 10 sessions", "Complete 15 sessions", "Reach 20 sessions"] }
    ],
    checklistTasks: [
      { text: "Pick tomorrow's ONE deep work task tonight", category: "Deep Work", hour: "21:00" },
      { text: "Phone away, notifications off", category: "Deep Work", hour: "08:50" },
      { text: "Deep work session (90 min)", category: "Deep Work", hour: "09:00" },
      { text: "Short break — walk, no screens", category: "Recovery", hour: "10:30" },
      { text: "Second deep work session", category: "Deep Work", hour: "11:00" },
      { text: "Shallow work / admin", category: "Admin", hour: "14:00" }
    ],
    agendaBlocks: [
      { title: "Deep work session", weekdays: [1, 2, 3, 4, 5], time: "09:00", color: "purple" }
    ]
  },
  {
    id: "morning",
    icon: "fa-solid fa-sun",
    name: "Morning System",
    tagline: "A morning routine that sets up the rest of your day.",
    locked: false,
    categories: ["Morning", "Health"],
    goals: [
      { icon: "🌅", title: "Run the morning routine daily", type: "numeric", targetNumber: 21,
        desc: "Turn a good morning into a habit, not a one-off.",
        steps: ["Complete the first 7 days", "Reach a 14-day streak", "Reach the 21-day goal"] }
    ],
    checklistTasks: [
      { text: "Wake up at your target time", category: "Morning", hour: "06:30" },
      { text: "Hydrate before anything else", category: "Health", hour: "06:35" },
      { text: "5-10 min movement or stretching", category: "Health", hour: "06:45" },
      { text: "Write down today's top 3 priorities", category: "Morning", hour: "07:00" },
      { text: "No phone for the first 30 minutes awake", category: "Morning", hour: "06:30" }
    ],
    agendaBlocks: [
      { title: "Morning routine", weekdays: [0, 1, 2, 3, 4, 5, 6], time: "06:30", color: "orange" }
    ]
  }
];

window.ETHO_SYSTEMS = ETHO_SYSTEMS;