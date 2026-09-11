/* ============================================================
   ETHO — Fitness page
   ------------------------------------------------------------
   Structured fitness planning, execution, and tracking system:
   Goal -> Plan (your own weekly routine) -> Today's Workout ->
   Execute -> Record -> History -> Adjust.

   Plans are built day by day: for each weekday the user either
   marks it a rest day or builds a workout by adding exercises
   (from the library or typed freely) with sets/reps-or-time/rest.
   Starter templates exist only as an OPTIONAL quick-insert inside
   that editor — nothing requires picking one.

   Storage (via cloudGet/cloudSet from cloud-sync.js, so data
   follows the account, not the device):
     fitnessGoals            FitnessGoal[]
     fitnessPlans            FitnessPlan[]           schedule[day] = 'rest' | Workout
     fitnessCustomExercises  Exercise[]              (built by the user, merged with the built-in library)
     fitnessCustomTemplates  Template[]              (whole workouts saved by the user, merged into the template picker)
     fitnessSessions         WorkoutSession[]        (completed history, full snapshot)
     fitnessDayLog           { [date]: { status:'completed', sessionId, workout } | { status:'skipped', workout } }
     fitnessOverrides        { [date]: 'rest' | Workout }   one-off day overrides on top of the
                                                              active plan's recurring schedule

   Workout shape: { id, name, exercises: [{ exerciseId, sets, reps, durationSec, restSec, notes }] }
   (reps is set OR durationSec is set, never both)

   Requires (loaded before this file): auth.js, account-base.js,
   cloud-sync.js, dialogs.js.
   ============================================================ */

(function () {
  "use strict";

  // ============================================================
  // 1. BUILT-IN EXERCISE LIBRARY
  // ============================================================
  const BUILTIN_EXERCISES = [
    { id: "push-up", name: "Push-up", muscle: "Chest & Triceps", type: "Strength", difficulty: "Beginner", equipment: "None", instructions: "Hands under shoulders, body in a straight line. Lower your chest to the floor, then push back up.", progressions: ["Knee Push-up", "Push-up", "Decline Push-up", "Archer Push-up"] },
    { id: "knee-push-up", name: "Knee Push-up", muscle: "Chest & Triceps", type: "Strength", difficulty: "Beginner", equipment: "None", instructions: "Same as a push-up, performed from the knees to reduce load.", progressions: [] },
    { id: "decline-push-up", name: "Decline Push-up", muscle: "Chest & Shoulders", type: "Strength", difficulty: "Intermediate", equipment: "Bench or box", instructions: "Feet elevated on a bench, hands on the floor. Lower and push back up.", progressions: [] },
    { id: "archer-push-up", name: "Archer Push-up", muscle: "Chest & Triceps", type: "Strength", difficulty: "Advanced", equipment: "None", instructions: "Wide hand placement, shift your weight side to side keeping one arm extended.", progressions: [] },
    { id: "squat", name: "Bodyweight Squat", muscle: "Quads & Glutes", type: "Strength", difficulty: "Beginner", equipment: "None", instructions: "Feet shoulder-width apart. Lower your hips back and down, chest up, then stand back up.", progressions: [] },
    { id: "lunge", name: "Forward Lunge", muscle: "Quads & Glutes", type: "Strength", difficulty: "Beginner", equipment: "None", instructions: "Step forward and lower your back knee toward the floor, then push back to standing.", progressions: [] },
    { id: "glute-bridge", name: "Glute Bridge", muscle: "Glutes & Hamstrings", type: "Strength", difficulty: "Beginner", equipment: "None", instructions: "Lie on your back, feet flat. Lift your hips and squeeze your glutes at the top.", progressions: [] },
    { id: "wall-sit", name: "Wall Sit", muscle: "Quads", type: "Strength", difficulty: "Beginner", equipment: "Wall", instructions: "Back against a wall, knees bent to about 90°. Hold the position.", progressions: [] },
    { id: "plank", name: "Plank", muscle: "Core", type: "Strength", difficulty: "Beginner", equipment: "None", instructions: "Hold a straight-body position, resting on forearms and toes.", progressions: [] },
    { id: "side-plank", name: "Side Plank", muscle: "Core & Obliques", type: "Strength", difficulty: "Intermediate", equipment: "None", instructions: "Hold your body sideways, balanced on one forearm and the side of one foot.", progressions: [] },
    { id: "russian-twist", name: "Russian Twist", muscle: "Obliques", type: "Strength", difficulty: "Beginner", equipment: "None", instructions: "Seated, lean back slightly with feet lifted, rotate your torso side to side.", progressions: [] },
    { id: "bicycle-crunch", name: "Bicycle Crunch", muscle: "Core", type: "Strength", difficulty: "Beginner", equipment: "None", instructions: "Lying down, alternate bringing elbow to opposite knee in a pedaling motion.", progressions: [] },
    { id: "superman", name: "Superman", muscle: "Lower Back", type: "Strength", difficulty: "Beginner", equipment: "None", instructions: "Lie face down, lift arms and legs off the floor at the same time.", progressions: [] },
    { id: "bird-dog", name: "Bird Dog", muscle: "Core & Back", type: "Mobility", difficulty: "Beginner", equipment: "None", instructions: "From all-fours, extend opposite arm and leg while keeping your hips level.", progressions: [] },
    { id: "pull-up", name: "Pull-up", muscle: "Back & Biceps", type: "Strength", difficulty: "Advanced", equipment: "Pull-up bar", instructions: "Hang from the bar, pull your chin over the bar, then lower with control.", progressions: ["Dead Hang", "Negative Pull-up", "Pull-up", "Weighted Pull-up"] },
    { id: "dead-hang", name: "Dead Hang", muscle: "Back & Forearms", type: "Strength", difficulty: "Beginner", equipment: "Pull-up bar", instructions: "Hang from the bar with arms fully extended, shoulders active.", progressions: [] },
    { id: "negative-pull-up", name: "Negative Pull-up", muscle: "Back & Biceps", type: "Strength", difficulty: "Intermediate", equipment: "Pull-up bar", instructions: "Jump or step to the top position, then lower yourself as slowly as possible.", progressions: [] },
    { id: "dip", name: "Dip", muscle: "Triceps & Chest", type: "Strength", difficulty: "Intermediate", equipment: "Parallel bars or chair", instructions: "Lower your body by bending the elbows, then press back up.", progressions: [] },
    { id: "mountain-climber", name: "Mountain Climber", muscle: "Core & Cardio", type: "Conditioning", difficulty: "Beginner", equipment: "None", instructions: "From a plank, drive your knees toward your chest quickly, alternating sides.", progressions: [] },
    { id: "burpee", name: "Burpee", muscle: "Full Body", type: "Conditioning", difficulty: "Intermediate", equipment: "None", instructions: "Squat, kick back to a plank, do a push-up, jump your feet in, then jump up.", progressions: [] },
    { id: "jumping-jack", name: "Jumping Jack", muscle: "Full Body", type: "Cardio", difficulty: "Beginner", equipment: "None", instructions: "Jump your feet out while raising your arms overhead, then return.", progressions: [] },
    { id: "high-knees", name: "High Knees", muscle: "Cardio & Core", type: "Cardio", difficulty: "Beginner", equipment: "None", instructions: "Run in place, driving your knees up high with quick steps.", progressions: [] },
    { id: "jump-rope", name: "Jump Rope", muscle: "Cardio", type: "Cardio", difficulty: "Beginner", equipment: "Jump rope", instructions: "Skip rope at a steady, controlled rhythm.", progressions: [] },
    { id: "running", name: "Running", muscle: "Cardio & Legs", type: "Endurance", difficulty: "Beginner", equipment: "None", instructions: "Steady-pace run outdoors or on a treadmill.", progressions: [] },
    { id: "calf-raise", name: "Calf Raise", muscle: "Calves", type: "Strength", difficulty: "Beginner", equipment: "None", instructions: "Rise onto your toes, hold briefly, then lower slowly.", progressions: [] },
    { id: "pike-push-up", name: "Pike Push-up", muscle: "Shoulders", type: "Strength", difficulty: "Intermediate", equipment: "None", instructions: "Hips high in a pike position, lower your head toward the floor and press back up.", progressions: [] },
    { id: "wall-handstand-hold", name: "Wall Handstand Hold", muscle: "Shoulders & Core", type: "Strength", difficulty: "Intermediate", equipment: "Wall", instructions: "Kick up into a handstand against a wall and hold the position.", progressions: [] },
    { id: "handstand-push-up", name: "Handstand Push-up", muscle: "Shoulders & Triceps", type: "Strength", difficulty: "Advanced", equipment: "Wall", instructions: "From a wall handstand, lower your head toward the floor, then press back up.", progressions: ["Pike Push-up", "Wall Handstand Hold", "Handstand Push-up"] },
    { id: "cat-cow", name: "Cat-Cow Stretch", muscle: "Spine", type: "Mobility", difficulty: "Beginner", equipment: "None", instructions: "On all fours, alternate arching and rounding your back slowly.", progressions: [] },
    { id: "childs-pose", name: "Child's Pose", muscle: "Back & Hips", type: "Mobility", difficulty: "Beginner", equipment: "None", instructions: "Kneel and sit your hips back toward your heels, arms extended forward.", progressions: [] },
    { id: "hamstring-stretch", name: "Hamstring Stretch", muscle: "Hamstrings", type: "Flexibility", difficulty: "Beginner", equipment: "None", instructions: "Hinge forward at the hips and reach toward your toes, holding the stretch.", progressions: [] },
    { id: "shoulder-rolls", name: "Shoulder Rolls", muscle: "Shoulders", type: "Mobility", difficulty: "Beginner", equipment: "None", instructions: "Roll your shoulders in slow, full circles, forward then backward.", progressions: [] },
    { id: "hip-circles", name: "Hip Circles", muscle: "Hips", type: "Mobility", difficulty: "Beginner", equipment: "None", instructions: "Rotate your hips in large circles in both directions.", progressions: [] },
    // Was referenced in pull-up's own progressions list above but never actually
    // existed as an exercise — added so that reference (and the library) is real.
    { id: "weighted-pull-up", name: "Weighted Pull-up", muscle: "Back & Biceps", type: "Strength", difficulty: "Advanced", equipment: "Pull-up bar + weight belt or vest", instructions: "Same as a pull-up, with added weight clipped to a belt or worn as a vest for extra resistance.", progressions: [] },
    { id: "reverse-lunge", name: "Reverse Lunge", muscle: "Quads & Glutes", type: "Strength", difficulty: "Beginner", equipment: "None", instructions: "Step backward and lower your back knee toward the floor, then push through the front foot to stand.", progressions: [] },
    { id: "step-up", name: "Step-up", muscle: "Quads & Glutes", type: "Strength", difficulty: "Beginner", equipment: "Bench or box", instructions: "Step fully onto a raised platform with one foot, drive up to standing, then step back down with control.", progressions: [] },
    { id: "plank-shoulder-tap", name: "Plank Shoulder Tap", muscle: "Core & Shoulders", type: "Strength", difficulty: "Beginner", equipment: "None", instructions: "From a plank, tap one hand to the opposite shoulder at a time while keeping your hips as still as possible.", progressions: [] },
    { id: "bear-crawl", name: "Bear Crawl", muscle: "Full Body", type: "Conditioning", difficulty: "Intermediate", equipment: "None", instructions: "Hands and feet on the floor, knees hovering just above it, crawl forward moving opposite hand and foot together.", progressions: [] },
    { id: "skater-hop", name: "Skater Hop", muscle: "Legs & Cardio", type: "Cardio", difficulty: "Intermediate", equipment: "None", instructions: "Hop laterally from one foot to the other in a skating motion, letting the trailing leg swing behind you for balance.", progressions: [] },
    { id: "tricep-dip-bench", name: "Bench Tricep Dip", muscle: "Triceps", type: "Strength", difficulty: "Beginner", equipment: "Bench or chair", instructions: "Hands on the edge of a bench behind you, legs extended. Lower your hips toward the floor by bending the elbows, then press back up.", progressions: [] },
    { id: "dumbbell-bicep-curl", name: "Dumbbell Bicep Curl", muscle: "Biceps", type: "Strength", difficulty: "Beginner", equipment: "Dumbbells", instructions: "Elbows tucked at your sides, curl the dumbbells up toward your shoulders, then lower with control.", progressions: [] },
    { id: "dumbbell-shoulder-press", name: "Dumbbell Shoulder Press", muscle: "Shoulders", type: "Strength", difficulty: "Intermediate", equipment: "Dumbbells", instructions: "Press the dumbbells overhead from shoulder height until your arms are fully extended, then lower back down.", progressions: [] },
    { id: "dumbbell-row", name: "Dumbbell Row", muscle: "Back & Biceps", type: "Strength", difficulty: "Beginner", equipment: "Dumbbells", instructions: "Hinge forward with a flat back, pull the dumbbell up toward your hip, then lower it with control.", progressions: [] },
    { id: "goblet-squat", name: "Goblet Squat", muscle: "Quads & Glutes", type: "Strength", difficulty: "Beginner", equipment: "Dumbbell or kettlebell", instructions: "Hold a dumbbell or kettlebell close to your chest and squat down between your knees, then stand back up.", progressions: [] },
    { id: "dumbbell-romanian-deadlift", name: "Dumbbell Romanian Deadlift", muscle: "Hamstrings & Glutes", type: "Strength", difficulty: "Intermediate", equipment: "Dumbbells", instructions: "With a slight knee bend, hinge at the hips and lower the dumbbells along your legs, then drive your hips forward to stand.", progressions: [] },
    { id: "band-pull-apart", name: "Resistance Band Pull-Apart", muscle: "Shoulders & Back", type: "Strength", difficulty: "Beginner", equipment: "Resistance band", instructions: "Hold the band with arms extended in front of you and pull it apart until your arms are out to the sides, then return slowly.", progressions: [] },
    { id: "kettlebell-swing", name: "Kettlebell Swing", muscle: "Full Body", type: "Conditioning", difficulty: "Intermediate", equipment: "Kettlebell", instructions: "Hinge at the hips to swing the kettlebell back between your legs, then snap your hips forward to drive it up to chest height.", progressions: [] },
    { id: "farmers-carry", name: "Farmer's Carry", muscle: "Full Body & Grip", type: "Strength", difficulty: "Beginner", equipment: "Dumbbells or kettlebells", instructions: "Hold a weight in each hand at your sides and walk a set distance with an upright posture and tight core.", progressions: [] },
  ];

  // ============================================================
  // 2. STARTER TEMPLATES — optional quick-insert only, never
  //    required. Used from inside the exercise editor as a
  //    shortcut to pre-fill a day, fully editable afterwards.
  // ============================================================
  const CATEGORY_META = {
    "Strength": { icon: "fa-dumbbell" }, "Calisthenics": { icon: "fa-hand-fist" },
    "Endurance": { icon: "fa-person-running" }, "Mobility": { icon: "fa-spa" }, "General Fitness": { icon: "fa-layer-group" },
  };
const STARTER_TEMPLATES = [
  // =========================================================
  // STRENGTH — FULL BODY / UPPER / LOWER
  // =========================================================

  {
    id: "push",
    name: "Push Strength",
    category: "Strength",
    difficulty: "Intermediate",
    duration: 40,
    exercises: [
      { exerciseId: "dumbbell-press", sets: 3, reps: 8, restSec: 90 },
      { exerciseId: "dips", sets: 3, reps: 8, restSec: 90 },
      { exerciseId: "pike-push-up", sets: 3, reps: 8, restSec: 75 },
      { exerciseId: "push-up", sets: 2, reps: 12, restSec: 60 }
    ]
  },

  {
    id: "pull",
    name: "Pull Strength",
    category: "Strength",
    difficulty: "Intermediate",
    duration: 40,
    exercises: [
      { exerciseId: "pull-up", sets: 3, reps: 6, restSec: 120 },
      { exerciseId: "inverted-row", sets: 3, reps: 10, restSec: 75 },
      { exerciseId: "face-pull", sets: 3, reps: 12, restSec: 60 },
      { exerciseId: "bicep-curl", sets: 3, reps: 10, restSec: 60 }
    ]
  },

  {
    id: "legs",
    name: "Lower Body Strength",
    category: "Strength",
    difficulty: "Intermediate",
    duration: 40,
    exercises: [
      { exerciseId: "squat", sets: 4, reps: 8, restSec: 120 },
      { exerciseId: "bulgarian-split-squat", sets: 3, reps: 8, restSec: 90, notes: "per leg" },
      { exerciseId: "glute-bridge", sets: 3, reps: 12, restSec: 60 },
      { exerciseId: "calf-raise", sets: 3, reps: 15, restSec: 45 }
    ]
  },

  {
    id: "t-beg-strength",
    name: "Beginner Strength",
    category: "Strength",
    difficulty: "Beginner",
    duration: 30,
    exercises: [
      { exerciseId: "squat", sets: 3, reps: 10, restSec: 60 },
      { exerciseId: "knee-push-up", sets: 3, reps: 8, restSec: 60 },
      { exerciseId: "glute-bridge", sets: 3, reps: 12, restSec: 45 },
      { exerciseId: "inverted-row", sets: 3, reps: 8, restSec: 60 },
      { exerciseId: "plank", sets: 2, durationSec: 30, restSec: 45 }
    ]
  },

  {
    id: "t-fullbody-strength",
    name: "Full-Body Strength",
    category: "Strength",
    difficulty: "Intermediate",
    duration: 40,
    exercises: [
      { exerciseId: "squat", sets: 4, reps: 8, restSec: 90 },
      { exerciseId: "push-up", sets: 3, reps: 10, restSec: 60 },
      { exerciseId: "inverted-row", sets: 3, reps: 10, restSec: 75 },
      { exerciseId: "bulgarian-split-squat", sets: 3, reps: 8, restSec: 75, notes: "per leg" },
      { exerciseId: "plank", sets: 3, durationSec: 30, restSec: 45 }
    ]
  },

  {
    id: "t-fullbody-beginner",
    name: "Full-Body Foundation",
    category: "Strength",
    difficulty: "Beginner",
    duration: 30,
    exercises: [
      { exerciseId: "squat", sets: 3, reps: 10, restSec: 60 },
      { exerciseId: "knee-push-up", sets: 3, reps: 8, restSec: 60 },
      { exerciseId: "inverted-row", sets: 3, reps: 8, restSec: 60 },
      { exerciseId: "glute-bridge", sets: 3, reps: 12, restSec: 45 },
      { exerciseId: "bird-dog", sets: 2, reps: 8, restSec: 30, notes: "per side" }
    ]
  },

  {
    id: "t-upper-body",
    name: "Upper Body Builder",
    category: "Strength",
    difficulty: "Intermediate",
    duration: 35,
    exercises: [
      { exerciseId: "dumbbell-press", sets: 3, reps: 8, restSec: 90 },
      { exerciseId: "inverted-row", sets: 3, reps: 10, restSec: 75 },
      { exerciseId: "pike-push-up", sets: 3, reps: 8, restSec: 75 },
      { exerciseId: "face-pull", sets: 3, reps: 12, restSec: 60 },
      { exerciseId: "bicep-curl", sets: 2, reps: 12, restSec: 45 }
    ]
  },

  {
    id: "t-lower-body",
    name: "Lower Body Builder",
    category: "Strength",
    difficulty: "Intermediate",
    duration: 35,
    exercises: [
      { exerciseId: "squat", sets: 4, reps: 8, restSec: 90 },
      { exerciseId: "bulgarian-split-squat", sets: 3, reps: 10, restSec: 75, notes: "per leg" },
      { exerciseId: "single-leg-glute-bridge", sets: 3, reps: 10, restSec: 60, notes: "per leg" },
      { exerciseId: "calf-raise", sets: 3, reps: 15, restSec: 45 }
    ]
  },

  {
    id: "t-body-strength",
    name: "Bodyweight Strength",
    category: "Strength",
    difficulty: "Intermediate",
    duration: 35,
    exercises: [
      { exerciseId: "push-up", sets: 4, reps: 8, restSec: 75 },
      { exerciseId: "squat", sets: 4, reps: 12, restSec: 60 },
      { exerciseId: "inverted-row", sets: 4, reps: 8, restSec: 75 },
      { exerciseId: "bulgarian-split-squat", sets: 3, reps: 10, restSec: 60, notes: "per leg" },
      { exerciseId: "hollow-body-hold", sets: 3, durationSec: 25, restSec: 45 }
    ]
  },

  {
    id: "t-strength-circuit",
    name: "Strength Circuit",
    category: "Strength",
    difficulty: "Beginner",
    duration: 25,
    exercises: [
      { exerciseId: "squat", sets: 3, reps: 10, restSec: 30 },
      { exerciseId: "knee-push-up", sets: 3, reps: 8, restSec: 30 },
      { exerciseId: "glute-bridge", sets: 3, reps: 12, restSec: 30 },
      { exerciseId: "inverted-row", sets: 3, reps: 8, restSec: 30 },
      { exerciseId: "plank", sets: 3, durationSec: 25, restSec: 30 }
    ]
  },

  // =========================================================
  // CALISTHENICS
  // =========================================================

  {
    id: "t-beg-cali",
    name: "Beginner Calisthenics",
    category: "Calisthenics",
    difficulty: "Beginner",
    duration: 30,
    exercises: [
      { exerciseId: "knee-push-up", sets: 3, reps: 10, restSec: 60 },
      { exerciseId: "squat", sets: 3, reps: 12, restSec: 60 },
      { exerciseId: "inverted-row", sets: 3, reps: 8, restSec: 60 },
      { exerciseId: "glute-bridge", sets: 3, reps: 12, restSec: 45 },
      { exerciseId: "plank", sets: 3, durationSec: 25, restSec: 45 }
    ]
  },

  {
    id: "t-cali-foundation",
    name: "Calisthenics Foundation",
    category: "Calisthenics",
    difficulty: "Intermediate",
    duration: 35,
    exercises: [
      { exerciseId: "push-up", sets: 4, reps: 8, restSec: 60 },
      { exerciseId: "inverted-row", sets: 4, reps: 8, restSec: 75 },
      { exerciseId: "bulgarian-split-squat", sets: 3, reps: 8, restSec: 60, notes: "per leg" },
      { exerciseId: "pike-push-up", sets: 3, reps: 8, restSec: 60 },
      { exerciseId: "hollow-body-hold", sets: 3, durationSec: 25, restSec: 45 }
    ]
  },

  {
    id: "t-pullup-prog",
    name: "Pull-Up Progression",
    category: "Calisthenics",
    difficulty: "Intermediate",
    duration: 25,
    exercises: [
      { exerciseId: "dead-hang", sets: 3, durationSec: 20, restSec: 45 },
      { exerciseId: "scapular-pull-up", sets: 3, reps: 8, restSec: 45 },
      { exerciseId: "negative-pull-up", sets: 3, reps: 3, restSec: 75 },
      { exerciseId: "assisted-pull-up", sets: 3, reps: 5, restSec: 75 }
    ]
  },

  {
    id: "t-pushup-prog",
    name: "Push-Up Progression",
    category: "Calisthenics",
    difficulty: "Beginner",
    duration: 25,
    exercises: [
      { exerciseId: "scapular-push-up", sets: 2, reps: 10, restSec: 30 },
      { exerciseId: "knee-push-up", sets: 3, reps: 10, restSec: 60 },
      { exerciseId: "push-up", sets: 3, reps: 6, restSec: 75 },
      { exerciseId: "plank", sets: 3, durationSec: 30, restSec: 45 }
    ]
  },

  {
    id: "t-handstand-prog",
    name: "Handstand Progression",
    category: "Calisthenics",
    difficulty: "Advanced",
    duration: 30,
    exercises: [
      { exerciseId: "pike-push-up", sets: 3, reps: 8, restSec: 60 },
      { exerciseId: "elevated-pike-push-up", sets: 3, reps: 6, restSec: 75 },
      { exerciseId: "wall-handstand-hold", sets: 4, durationSec: 20, restSec: 60 },
      { exerciseId: "handstand-push-up", sets: 3, reps: 3, restSec: 90 }
    ]
  },

  {
    id: "t-cali-fullbody",
    name: "Full-Body Calisthenics",
    category: "Calisthenics",
    difficulty: "Intermediate",
    duration: 35,
    exercises: [
      { exerciseId: "push-up", sets: 4, reps: 10, restSec: 60 },
      { exerciseId: "pull-up", sets: 3, reps: 5, restSec: 90 },
      { exerciseId: "bulgarian-split-squat", sets: 3, reps: 10, restSec: 60, notes: "per leg" },
      { exerciseId: "pike-push-up", sets: 3, reps: 8, restSec: 60 },
      { exerciseId: "hollow-body-hold", sets: 3, durationSec: 30, restSec: 45 }
    ]
  },

  {
    id: "t-cali-core",
    name: "Calisthenics Core",
    category: "Calisthenics",
    difficulty: "Intermediate",
    duration: 20,
    exercises: [
      { exerciseId: "hollow-body-hold", sets: 3, durationSec: 30, restSec: 45 },
      { exerciseId: "plank", sets: 3, durationSec: 40, restSec: 45 },
      { exerciseId: "side-plank", sets: 3, durationSec: 30, restSec: 30, notes: "per side" },
      { exerciseId: "bird-dog", sets: 3, reps: 8, restSec: 30, notes: "per side" }
    ]
  },

  {
    id: "t-cali-push",
    name: "Calisthenics Push",
    category: "Calisthenics",
    difficulty: "Intermediate",
    duration: 25,
    exercises: [
      { exerciseId: "push-up", sets: 4, reps: 15, restSec: 60 },
      { exerciseId: "pike-push-up", sets: 3, reps: 10, restSec: 60 },
      { exerciseId: "dips", sets: 3, reps: 12, restSec: 75 },
      { exerciseId: "plank", sets: 3, durationSec: 90, restSec: 45 }
    ]
  },

  {
    id: "t-cali-pull",
    name: "Calisthenics Pull",
    category: "Calisthenics",
    difficulty: "Intermediate",
    duration: 25,
    exercises: [
      { exerciseId: "pull-up", sets: 4, reps: 10, restSec: 90 },
      { exerciseId: "inverted-row", sets: 3, reps: 10, restSec: 75 },
      { exerciseId: "australian pull-up", sets: 3, reps: 15, restSec: 60 },
      { exerciseId: "dead-hang", sets: 3, durationSec: 60, restSec: 45 }
    ]
  },

  {
    id: "t-cali-legs",
    name: "Calisthenics Legs",
    category: "Calisthenics",
    difficulty: "Intermediate",
    duration: 25,
    exercises: [
      { exerciseId: "jumping-squat", sets: 4, reps: 15, restSec: 60 },
      { exerciseId: "lunge", sets: 3, reps: 12, restSec: 60, notes: "per leg" },
      { exerciseId: "glute-bridge", sets: 3, reps: 15, restSec: 45 },
      { exerciseId: "calf-raise", sets: 3, reps: 20, restSec: 30 }
    ]
  },

  // =========================================================
  // ENDURANCE / CONDITIONING
  // =========================================================

  {
    id: "t-running",
    name: "Easy Run",
    category: "Endurance",
    difficulty: "Beginner",
    duration: 30,
    exercises: [
      { exerciseId: "jumping-jack", sets: 2, durationSec: 30, restSec: 15, notes: "warm-up" },
      { exerciseId: "running", sets: 1, durationSec: 1500, restSec: 0, notes: "easy conversational pace" }
    ]
  },

  {
    id: "t-running-intermediate",
    name: "Running Intervals",
    category: "Endurance",
    difficulty: "Intermediate",
    duration: 30,
    exercises: [
      { exerciseId: "high-knees", sets: 2, durationSec: 30, restSec: 30, notes: "warm-up" },
      { exerciseId: "running", sets: 5, durationSec: 120, restSec: 60, notes: "strong controlled pace" }
    ]
  },

  {
    id: "t-conditioning",
    name: "Full-Body Conditioning",
    category: "Endurance",
    difficulty: "Intermediate",
    duration: 25,
    exercises: [
      { exerciseId: "jumping-jack", sets: 2, durationSec: 30, restSec: 20, notes: "warm-up" },
      { exerciseId: "burpee", sets: 3, reps: 8, restSec: 45 },
      { exerciseId: "mountain-climber", sets: 3, durationSec: 30, restSec: 30 },
      { exerciseId: "high-knees", sets: 3, durationSec: 30, restSec: 30 },
      { exerciseId: "jump-rope", sets: 3, durationSec: 60, restSec: 30 }
    ]
  },

  {
    id: "t-cardio-basic",
    name: "Cardio Starter",
    category: "Endurance",
    difficulty: "Beginner",
    duration: 20,
    exercises: [
      { exerciseId: "jumping-jack", sets: 2, durationSec: 30, restSec: 20 },
      { exerciseId: "high-knees", sets: 3, durationSec: 30, restSec: 30 },
      { exerciseId: "jump-rope", sets: 5, durationSec: 60, restSec: 30 },
      { exerciseId: "mountain-climber", sets: 2, durationSec: 30, restSec: 30 }
    ]
  },

  {
    id: "t-low-impact-cardio",
    name: "Cardio Builder",
    category: "Endurance",
    difficulty: "Beginner",
    duration: 25,
    exercises: [
      { exerciseId: "jumping-jack", sets: 2, durationSec: 30, restSec: 30 },
      { exerciseId: "high-knees", sets: 3, durationSec: 30, restSec: 30 },
      { exerciseId: "mountain-climber", sets: 3, durationSec: 30, restSec: 30 },
      { exerciseId: "jump-rope", sets: 4, durationSec: 60, restSec: 45 }
    ]
  },

  {
    id: "t-hiit",
    name: "HIIT Challenge",
    category: "Endurance",
    difficulty: "Advanced",
    duration: 25,
    exercises: [
      { exerciseId: "jumping-jack", sets: 2, durationSec: 30, restSec: 15, notes: "warm-up" },
      { exerciseId: "burpee", sets: 4, reps: 8, restSec: 30 },
      { exerciseId: "mountain-climber", sets: 4, durationSec: 30, restSec: 30 },
      { exerciseId: "high-knees", sets: 4, durationSec: 30, restSec: 30 },
      { exerciseId: "jump-rope", sets: 4, durationSec: 60, restSec: 30 }
    ]
  },

  // =========================================================
  // MOBILITY / RECOVERY
  // =========================================================

  {
    id: "t-daily-mobility",
    name: "Daily Mobility",
    category: "Mobility",
    difficulty: "Beginner",
    duration: 15,
    exercises: [
      { exerciseId: "cat-cow", sets: 2, reps: 10, restSec: 15 },
      { exerciseId: "hip-circles", sets: 2, reps: 10, restSec: 15, notes: "per direction" },
      { exerciseId: "shoulder-rolls", sets: 2, reps: 10, restSec: 15, notes: "per direction" },
      { exerciseId: "bird-dog", sets: 2, reps: 8, restSec: 15, notes: "per side" },
      { exerciseId: "childs-pose", sets: 2, durationSec: 30, restSec: 15 }
    ]
  },

  {
    id: "t-flexibility",
    name: "Full-Body Flexibility",
    category: "Mobility",
    difficulty: "Beginner",
    duration: 15,
    exercises: [
      { exerciseId: "cat-cow", sets: 2, reps: 10, restSec: 15 },
      { exerciseId: "hamstring-stretch", sets: 2, durationSec: 30, restSec: 15, notes: "per leg" },
      { exerciseId: "childs-pose", sets: 2, durationSec: 30, restSec: 15 },
      { exerciseId: "hip-circles", sets: 2, reps: 10, restSec: 15, notes: "per direction" }
    ]
  },

  {
    id: "t-mobility-shoulders",
    name: "Shoulder Mobility",
    category: "Mobility",
    difficulty: "Beginner",
    duration: 12,
    exercises: [
      { exerciseId: "shoulder-rolls", sets: 3, reps: 10, restSec: 15, notes: "per direction" },
      { exerciseId: "cat-cow", sets: 2, reps: 10, restSec: 15 },
      { exerciseId: "scapular-push-up", sets: 2, reps: 10, restSec: 20 },
      { exerciseId: "childs-pose", sets: 2, durationSec: 30, restSec: 15 }
    ]
  },

  {
    id: "t-mobility-hips",
    name: "Hip Mobility",
    category: "Mobility",
    difficulty: "Beginner",
    duration: 12,
    exercises: [
      { exerciseId: "hip-circles", sets: 3, reps: 10, restSec: 15, notes: "per direction" },
      { exerciseId: "cat-cow", sets: 2, reps: 10, restSec: 15 },
      { exerciseId: "bird-dog", sets: 2, reps: 8, restSec: 15, notes: "per side" },
      { exerciseId: "hamstring-stretch", sets: 2, durationSec: 30, restSec: 15, notes: "per leg" }
    ]
  },

  {
    id: "t-recovery",
    name: "Recovery Session",
    category: "Mobility",
    difficulty: "Beginner",
    duration: 15,
    exercises: [
      { exerciseId: "cat-cow", sets: 2, reps: 10, restSec: 15 },
      { exerciseId: "hip-circles", sets: 2, reps: 10, restSec: 15, notes: "per direction" },
      { exerciseId: "shoulder-rolls", sets: 2, reps: 10, restSec: 15, notes: "per direction" },
      { exerciseId: "hamstring-stretch", sets: 2, durationSec: 30, restSec: 15, notes: "per leg" },
      { exerciseId: "childs-pose", sets: 2, durationSec: 45, restSec: 15 }
    ]
  },

  // =========================================================
  // GENERAL FITNESS
  // =========================================================

  {
    id: "t-fullbody-beg",
    name: "Full-Body Beginner",
    category: "General Fitness",
    difficulty: "Beginner",
    duration: 30,
    exercises: [
      { exerciseId: "squat", sets: 3, reps: 10, restSec: 60 },
      { exerciseId: "knee-push-up", sets: 3, reps: 8, restSec: 60 },
      { exerciseId: "glute-bridge", sets: 3, reps: 12, restSec: 45 },
      { exerciseId: "bird-dog", sets: 2, reps: 8, restSec: 30, notes: "per side" },
      { exerciseId: "jumping-jack", sets: 3, durationSec: 30, restSec: 30 }
    ]
  },

  {
    id: "t-home-workout",
    name: "Home Full-Body",
    category: "General Fitness",
    difficulty: "Intermediate",
    duration: 30,
    exercises: [
      { exerciseId: "bulgarian-split-squat", sets: 3, reps: 8, restSec: 60, notes: "per leg" },
      { exerciseId: "push-up", sets: 3, reps: 10, restSec: 60 },
      { exerciseId: "inverted-row", sets: 3, reps: 8, restSec: 60 },
      { exerciseId: "mountain-climber", sets: 3, durationSec: 30, restSec: 30 },
      { exerciseId: "hollow-body-hold", sets: 3, durationSec: 25, restSec: 45 }
    ]
  },

  {
    id: "t-quick-workout",
    name: "20-Minute Quick Workout",
    category: "General Fitness",
    difficulty: "Beginner",
    duration: 20,
    exercises: [
      { exerciseId: "squat", sets: 3, reps: 12, restSec: 30 },
      { exerciseId: "knee-push-up", sets: 3, reps: 8, restSec: 30 },
      { exerciseId: "glute-bridge", sets: 3, reps: 12, restSec: 30 },
      { exerciseId: "mountain-climber", sets: 3, durationSec: 30, restSec: 30 },
      { exerciseId: "plank", sets: 2, durationSec: 30, restSec: 30 }
    ]
  },

  {
    id: "t-quick-fullbody",
    name: "15-Minute Full Body",
    category: "General Fitness",
    difficulty: "Beginner",
    duration: 15,
    exercises: [
      { exerciseId: "squat", sets: 2, reps: 12, restSec: 30 },
      { exerciseId: "knee-push-up", sets: 2, reps: 8, restSec: 30 },
      { exerciseId: "glute-bridge", sets: 2, reps: 12, restSec: 30 },
      { exerciseId: "plank", sets: 2, durationSec: 25, restSec: 30 },
      { exerciseId: "jumping-jack", sets: 2, durationSec: 30, restSec: 20 }
    ]
  },

  {
    id: "t-fitness-foundation",
    name: "Fitness Foundation",
    category: "General Fitness",
    difficulty: "Beginner",
    duration: 35,
    exercises: [
      { exerciseId: "squat", sets: 3, reps: 10, restSec: 60 },
      { exerciseId: "knee-push-up", sets: 3, reps: 10, restSec: 60 },
      { exerciseId: "inverted-row", sets: 3, reps: 8, restSec: 60 },
      { exerciseId: "glute-bridge", sets: 3, reps: 12, restSec: 45 },
      { exerciseId: "bird-dog", sets: 2, reps: 10, restSec: 30, notes: "per side" },
      { exerciseId: "jumping-jack", sets: 2, durationSec: 30, restSec: 20 }
    ]
  },

  // =========================================================
  // SHORT / TIME-CONSTRAINED OPTIONS
  // =========================================================

  {
    id: "t-10-minute",
    name: "10-Minute Express",
    category: "General Fitness",
    difficulty: "Beginner",
    duration: 10,
    exercises: [
      { exerciseId: "squat", sets: 2, reps: 10, restSec: 20 },
      { exerciseId: "knee-push-up", sets: 2, reps: 8, restSec: 20 },
      { exerciseId: "glute-bridge", sets: 2, reps: 12, restSec: 20 },
      { exerciseId: "plank", sets: 2, durationSec: 20, restSec: 20 }
    ]
  },

  {
    id: "t-20-minute-strength",
    name: "20-Minute Strength",
    category: "Strength",
    difficulty: "Beginner",
    duration: 20,
    exercises: [
      { exerciseId: "squat", sets: 3, reps: 10, restSec: 30 },
      { exerciseId: "push-up", sets: 3, reps: 8, restSec: 30 },
      { exerciseId: "inverted-row", sets: 3, reps: 8, restSec: 30 },
      { exerciseId: "glute-bridge", sets: 2, reps: 12, restSec: 30 },
      { exerciseId: "plank", sets: 2, durationSec: 30, restSec: 20 }
    ]
  },

  // =========================================================
  // BALANCED FULL-BODY OPTIONS
  // =========================================================

  {
    id: "t-balanced-fullbody",
    name: "Balanced Full Body",
    category: "General Fitness",
    difficulty: "Intermediate",
    duration: 35,
    exercises: [
      { exerciseId: "squat", sets: 3, reps: 10, restSec: 60 },
      { exerciseId: "push-up", sets: 3, reps: 10, restSec: 60 },
      { exerciseId: "inverted-row", sets: 3, reps: 10, restSec: 60 },
      { exerciseId: "single-leg-glute-bridge", sets: 3, reps: 10, restSec: 45, notes: "per leg" },
      { exerciseId: "side-plank", sets: 3, durationSec: 30, restSec: 30, notes: "per side" }
    ]
  },

  {
    id: "t-fullbody-intermediate",
    name: "Full-Body Challenge",
    category: "General Fitness",
    difficulty: "Intermediate",
    duration: 40,
    exercises: [
      { exerciseId: "squat", sets: 4, reps: 10, restSec: 75 },
      { exerciseId: "push-up", sets: 4, reps: 10, restSec: 60 },
      { exerciseId: "inverted-row", sets: 4, reps: 8, restSec: 75 },
      { exerciseId: "bulgarian-split-squat", sets: 3, reps: 10, restSec: 60, notes: "per leg" },
      { exerciseId: "hollow-body-hold", sets: 3, durationSec: 30, restSec: 45 }
    ]
  }
];
  const GOAL_CATEGORIES = ["Strength", "Endurance", "Calisthenics Skill", "Mobility", "Distance", "Workout Count", "Consistency"];
  const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const WEEKDAY_LABELS = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };
  const WEEKDAY_SHORT = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

  // ============================================================
  // 3. STATE
  // ============================================================
  const FIT = {
    goals: [], plans: [], customExercises: [], customTemplates: [], sessions: [], dayLog: {}, overrides: {},
    calendarMonth: null, // {y, m} m = 0-11
    exec: null,
  };

  // ============================================================
  // 4. UTILITIES
  // ============================================================
  function uid() { return "id_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function deepClone(o) { return JSON.parse(JSON.stringify(o)); }
  function toISODate(d) { const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }
  function todayISO() { return toISODate(new Date()); }
  function jsDayToKey(jsDay) { return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][jsDay]; }
  function weekdayKeyForDate(iso) { return jsDayToKey(new Date(iso + "T00:00:00").getDay()); }
  function addDays(iso, n) { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return toISODate(d); }
  function formatDateLong(iso) { return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }); }
  function formatDateShort(iso) { return new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function esc(s) { return escapeHTML(s); }
  function fmtSec(sec) { if (sec == null) return ""; if (sec < 60) return `${sec}s`; const m = Math.floor(sec / 60), s = sec % 60; return s ? `${m}m ${s}s` : `${m} min`; }
  function fmtClock(sec) { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec / 60), s = sec % 60; return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`; }
  function isWorkout(v) { return v && typeof v === "object" && Array.isArray(v.exercises); }

  function exerciseById(id) {
    return getAllExercises().find(e => e.id === id) || { id, name: "Exercise", muscle: "", type: "", difficulty: "", equipment: "", instructions: "", progressions: [] };
  }
  function getAllExercises() { return BUILTIN_EXERCISES.concat(FIT.customExercises); }
  function getActivePlan() { return FIT.plans.find(p => p.active) || null; }

  function specLine(entry) {
    const timeBased = entry.durationSec != null;
    const main = timeBased ? `${entry.sets} × ${fmtSec(entry.durationSec)}` : `${entry.sets} × ${entry.reps ?? "—"} reps`;
    const rest = entry.restSec ? ` · rest ${fmtSec(entry.restSec)}` : "";
    const notes = entry.notes ? ` · ${entry.notes}` : "";
    return main + rest + notes;
  }
  function workoutSummary(w) {
    if (!isWorkout(w)) return { exCount: 0, setCount: 0, estMin: 0 };
    let setCount = 0, totalSec = 0;
    w.exercises.forEach(e => {
      setCount += e.sets;
      const per = (e.durationSec != null ? e.durationSec : (e.reps ? e.reps * 3 : 20)) + (e.restSec || 0);
      totalSec += per * e.sets;
    });
    return { exCount: w.exercises.length, setCount, estMin: Math.max(1, Math.round(totalSec / 60)) };
  }

  // Resolve what's scheduled on a date: null (nothing) | 'rest' | Workout
  function getScheduledFor(iso) {
    if (Object.prototype.hasOwnProperty.call(FIT.overrides, iso)) return FIT.overrides[iso];
    const plan = getActivePlan();
    if (!plan) return null;
    return plan.schedule[weekdayKeyForDate(iso)] || "rest";
  }
  function getDayStatus(iso) {
    const log = FIT.dayLog[iso];
    if (log && log.status === "completed") return { status: "completed", sessionId: log.sessionId, workout: log.workout };
    if (log && log.status === "skipped") return { status: "skipped", workout: log.workout };
    const scheduled = getScheduledFor(iso);
    if (scheduled == null || scheduled === "rest") return { status: "rest" };
    if (iso < todayISO()) return { status: "missed", workout: scheduled };
    return { status: "scheduled", workout: scheduled };
  }

  // ============================================================
  // 5. PERSISTENCE
  // ============================================================
  async function loadAll() {
    const [goals, plans, customExercises, customTemplates, sessions, dayLog, overrides] = await Promise.all([
      cloudGet("fitnessGoals", []), cloudGet("fitnessPlans", []), cloudGet("fitnessCustomExercises", []),
      cloudGet("fitnessCustomTemplates", []),
      cloudGet("fitnessSessions", []), cloudGet("fitnessDayLog", {}), cloudGet("fitnessOverrides", {}),
    ]);
    FIT.goals = goals || []; FIT.plans = plans || []; FIT.customExercises = customExercises || [];
    FIT.customTemplates = customTemplates || [];
    FIT.sessions = sessions || []; FIT.dayLog = dayLog || {}; FIT.overrides = overrides || {};
  }
  function saveGoals() { return cloudSet("fitnessGoals", FIT.goals); }
  function savePlans() { return cloudSet("fitnessPlans", FIT.plans); }
  function saveCustomExercises() { return cloudSet("fitnessCustomExercises", FIT.customExercises); }
  function saveCustomTemplates() { return cloudSet("fitnessCustomTemplates", FIT.customTemplates); }
  function saveSessions() { return cloudSet("fitnessSessions", FIT.sessions); }
  function saveDayLog() { return cloudSet("fitnessDayLog", FIT.dayLog); }
  function saveOverrides() { return cloudSet("fitnessOverrides", FIT.overrides); }

  // ============================================================
  // 6. STATS
  // ============================================================
  function computeStreak() {
    let streak = 0, iso = todayISO(), guard = 0;
    while (guard++ < 400) {
      const st = getDayStatus(iso);
      if (st.status === "rest") { iso = addDays(iso, -1); continue; }
      if (st.status === "completed") { streak++; iso = addDays(iso, -1); continue; }
      if (iso === todayISO() && st.status === "scheduled") { iso = addDays(iso, -1); continue; }
      break;
    }
    return streak;
  }
  function startOfWeek(iso) { const idx = WEEKDAY_KEYS.indexOf(weekdayKeyForDate(iso)); return addDays(iso, -idx); }
  function weekRange(iso) { const start = startOfWeek(iso); return [start, addDays(start, 6)]; }
  function countCompletedInRange(a, b) { return Object.keys(FIT.dayLog).filter(d => FIT.dayLog[d].status === "completed" && d >= a && d <= b).length; }
  function countScheduledInRange(a, b) { let n = 0, d = a; while (d <= b) { if (getDayStatus(d).status !== "rest") n++; d = addDays(d, 1); } return n; }
  function monthlyWorkoutCount() { const now = new Date(), ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; return FIT.sessions.filter(s => s.date.startsWith(ym)).length; }

  // ============================================================
  // 7. GENERIC OVERLAYS
  // ============================================================
  function wireOverlay(overlayId, closeId, onCloseAttempt) {
    const overlay = document.getElementById(overlayId);
    const closeBtn = document.getElementById(closeId);
    closeBtn.addEventListener("click", () => { if (onCloseAttempt) onCloseAttempt(() => hideOverlay(overlay)); else hideOverlay(overlay); });
    overlay.addEventListener("click", e => { if (e.target === overlay) { if (onCloseAttempt) onCloseAttempt(() => hideOverlay(overlay)); else hideOverlay(overlay); } });
    return overlay;
  }
  let topZ = 1000;
  function showOverlay(overlay) {
    overlay.hidden = false;
    overlay.style.zIndex = String(++topZ); // whichever overlay opens most recently always renders in front, regardless of DOM order
    requestAnimationFrame(() => overlay.classList.add("open"));
  }
  function hideOverlay(overlay) { overlay.classList.remove("open"); setTimeout(() => { overlay.hidden = true; }, 150); }

  const chooserOverlay = wireOverlay("fit-chooser-overlay", "fit-chooser-close");
  const chooserTitle = document.getElementById("fit-chooser-title");
  const chooserSub = document.getElementById("fit-chooser-sub");
  const chooserBody = document.getElementById("fit-chooser-body");
  function openChooser(titleHTML, subtitle, bodyEl) {
    chooserTitle.innerHTML = titleHTML; chooserSub.textContent = subtitle || "";
    chooserBody.innerHTML = ""; chooserBody.appendChild(bodyEl);
    showOverlay(chooserOverlay);
  }
  function closeChooser() { hideOverlay(chooserOverlay); }

  const detailOverlay = wireOverlay("fit-detail-overlay", "fit-detail-close");
  const detailBox = document.getElementById("fit-detail-box");
  const detailTitle = document.getElementById("fit-detail-title");
  const detailSub = document.getElementById("fit-detail-sub");
  const detailBody = document.getElementById("fit-detail-body");
  const detailFooter = document.getElementById("fit-detail-footer");
  function openDetail(titleHTML, subtitle, bodyEl, wide, footerEl) {
    detailBox.classList.toggle("wide", !!wide);
    detailTitle.innerHTML = titleHTML; detailSub.textContent = subtitle || "";
    detailBody.innerHTML = ""; detailBody.appendChild(bodyEl);
    detailFooter.innerHTML = "";
    if (footerEl) { detailFooter.appendChild(footerEl); detailFooter.hidden = false; }
    else { detailFooter.hidden = true; }
    showOverlay(detailOverlay);
  }
  function closeDetail() { hideOverlay(detailOverlay); }

  const builderOverlay = wireOverlay("fit-builder-overlay", "fit-builder-close", attemptCloseBuilder);
  const builderTitle = document.getElementById("fit-builder-title");
  const builderSub = document.getElementById("fit-builder-sub");
  const builderBody = document.getElementById("fit-builder-body");
  function attemptCloseBuilder(doClose) { doClose(); } // simple: builder autosaves per-day already
  function closeBuilder() { hideOverlay(builderOverlay); }

  // Clickable options list, reused everywhere
  function buildChoiceList(items) {
    const wrap = document.createElement("div");
    items.forEach(it => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "fit-choice-item" + (it.danger ? " danger" : "");
      btn.innerHTML = `<span>${it.icon ? `<i class="fa-solid ${it.icon}" style="margin-right:8px;color:var(--primary);"></i>` : ""}${esc(it.label)}${it.sub ? `<small>${esc(it.sub)}</small>` : ""}</span>${it.trailing ? `<span>${it.trailing}</span>` : ""}`;
      btn.addEventListener("click", () => it.onClick());
      wrap.appendChild(btn);
    });
    if (!items.length) { const empty = document.createElement("div"); empty.className = "fit-empty"; empty.innerHTML = `<i class="fa-solid fa-inbox"></i>Nothing here yet.`; wrap.appendChild(empty); }
    return wrap;
  }

  // ============================================================
  // 8. ADD/EDIT EXERCISE — single combined popup
  //    (the building block of the day/workout editor). One form:
  //    type or pick a name (native datalist autocomplete), set
  //    sets/reps-or-time/rest, click Save — done in one step.
  // ============================================================
  function populateExerciseDatalist() {
    const dl = document.getElementById("fit-exercise-datalist");
    if (!dl) return;
    dl.innerHTML = getAllExercises().map(e => `<option value="${esc(e.name)}">`).join("");
  }

  // Pick the most natural unit + value to display a duration in (e.g. 90 -> 1.5 min shown as 90s, 120 -> 2 min)
  function secToDisplay(sec) {
    if (sec != null && sec >= 3600 && sec % 3600 === 0) return { unit: "hour", value: sec / 3600 };
    if (sec != null && sec >= 60 && sec % 60 === 0) return { unit: "min", value: sec / 60 };
    return { unit: "sec", value: sec ?? 10 };
  }
  const DURATION_UNIT_SECONDS = { sec: 1, min: 60, hour: 3600 };

  function openExerciseEntryForm(onSave, existingEntry, onCancel) {
    onCancel = onCancel || closeDetail;
    const existingEx = existingEntry ? exerciseById(existingEntry.exerciseId) : null;
    const timeBased0 = existingEntry ? existingEntry.durationSec != null : false;
    const disp0 = timeBased0 ? secToDisplay(existingEntry.durationSec) : { unit: "sec", value: existingEntry ? existingEntry.reps : 10 };
    populateExerciseDatalist();

    const form = document.createElement("form");
    form.innerHTML = `
      <div class="fit-field">
        <label>Exercise</label>
        <input type="text" name="exname" list="fit-exercise-datalist" required autocomplete="off"
               value="${existingEx ? esc(existingEx.name) : ""}" placeholder="Type or pick an exercise…" />
      </div>
      <div class="fit-field"><label>Track by</label>
        <div class="fit-set-type-toggle">
          <button type="button" data-t="reps" class="${!timeBased0 ? "active" : ""}"><i class="fa-solid fa-hashtag"></i> Reps</button>
          <button type="button" data-t="time" class="${timeBased0 ? "active" : ""}"><i class="fa-solid fa-clock"></i> Time</button>
        </div>
      </div>
      <div class="fit-field-row">
        <div class="fit-field"><label>Sets</label><input type="number" name="sets" min="1" step="1" value="${existingEntry ? existingEntry.sets : 3}" required /></div>
        <div class="fit-field">
          <label id="fit-set-target-label">Reps</label>
          <div style="display:flex;gap:8px;">
            <input type="number" name="target" min="0" step="1" style="flex:1;" value="${disp0.value}" required />
            <select name="unit" id="fit-set-unit" style="max-width:92px;display:none;">
              <option value="sec" ${disp0.unit === "sec" ? "selected" : ""}>sec</option>
              <option value="min" ${disp0.unit === "min" ? "selected" : ""}>min</option>
              <option value="hour" ${disp0.unit === "hour" ? "selected" : ""}>hour</option>
            </select>
          </div>
        </div>
      </div>
      <div class="fit-field"><label>Rest between sets (seconds)</label><input type="number" name="rest" min="0" step="5" value="${existingEntry ? existingEntry.restSec || 0 : 60}" /></div>
      <div class="fit-field"><label>Notes (optional)</label><input type="text" name="notes" value="${existingEntry ? esc(existingEntry.notes || "") : ""}" placeholder="e.g. per leg, AMRAP, slow tempo" /></div>
      <div class="fit-form-actions">
        <button type="button" class="fit-btn-secondary" id="fit-exf-cancel">Cancel</button>
        <button type="submit" class="btn-primary"><i class="fa-solid fa-check"></i> ${existingEntry ? "Save exercise" : "Add exercise"}</button>
      </div>`;

    let timeBased = timeBased0;
    const toggleBtns = form.querySelectorAll(".fit-set-type-toggle button");
    const targetLabel = form.querySelector("#fit-set-target-label");
    const targetInput = form.querySelector('input[name="target"]');
    const unitSelect = form.querySelector("#fit-set-unit");
    function syncToggle() {
      toggleBtns.forEach(b => b.classList.toggle("active", b.dataset.t === (timeBased ? "time" : "reps")));
      targetLabel.textContent = timeBased ? "Duration" : "Reps";
      targetInput.placeholder = timeBased ? "e.g. 30" : "e.g. 12";
      unitSelect.style.display = timeBased ? "" : "none";
    }
    toggleBtns.forEach(b => b.addEventListener("click", () => { timeBased = b.dataset.t === "time"; syncToggle(); }));
    syncToggle();

    form.querySelector("#fit-exf-cancel").addEventListener("click", onCancel);
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = fd.get("exname").trim();
      if (!name) return;

      // resolve (or create) the exercise from the typed/selected name
      let ex = getAllExercises().find(x => x.name.toLowerCase() === name.toLowerCase());
      if (!ex) {
        ex = { id: uid(), name, muscle: "Custom", type: "Strength", difficulty: "Beginner", equipment: "None", instructions: "", progressions: [] };
        FIT.customExercises.push(ex);
        await saveCustomExercises();
        populateMuscleFilter();
        populateExerciseDatalist();
      }

      const target = parseInt(fd.get("target"), 10) || 0;
      const unitSec = DURATION_UNIT_SECONDS[fd.get("unit")] || 1;
      const entry = {
        exerciseId: ex.id, sets: Math.max(1, parseInt(fd.get("sets"), 10) || 1),
        reps: timeBased ? null : target, durationSec: timeBased ? target * unitSec : null,
        restSec: Math.max(0, parseInt(fd.get("rest"), 10) || 0), notes: fd.get("notes").trim() || null,
      };
      // Deliberately no closeDetail() here — this popup is often opened
      // "on top of" the day editor (see renderDayEditorInto), which reuses
      // this same shared overlay. Closing here would discard the day
      // editor's unsaved draft with no way back. Instead, onSave decides
      // what happens next: it either restores the caller's own popup
      // (day editor) or closes, depending on where this form was opened
      // from.
      onSave(entry);
    });

    openDetail(`<i class="fa-solid fa-dumbbell"></i> ${existingEntry ? "Edit exercise" : "Add an exercise"}`, "Type a name or pick one, then set sets/reps or time and rest.", form);
  }

  // Shortcut: insert a template's exercises into a draft list. Pools built-in
  // starter templates together with the user's own saved templates (grouped
  // separately as "My Templates", first, with a delete affordance).
  const MY_TEMPLATES_GROUP = "My Templates";
  function pickStarterTemplate(onPick) {
    const container = document.createElement("div");
    const search = document.createElement("div");
    search.className = "template-library-search";
    search.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i><input type="text" placeholder="Search templates…" />`;
    container.appendChild(search);

    // Difficulty filter — segmented toggle buttons instead of relying on
    // spotting the plain-text difficulty label buried in each card. "My
    // Templates" are always shown regardless of the filter since custom
    // templates don't carry a real difficulty (they're tagged "Custom").
    const DIFF_LEVELS = ["All", "Beginner", "Intermediate", "Advanced"];
    let activeDifficulty = "All";
    const diffFilter = document.createElement("div");
    diffFilter.className = "fit-difficulty-filter";
    diffFilter.innerHTML = DIFF_LEVELS.map(level =>
      `<button type="button" class="fit-diff-btn${level === "All" ? " active" : ""}" data-level="${esc(level)}">${esc(level)}</button>`
    ).join("");
    container.appendChild(diffFilter);

    const grid = document.createElement("div");
    grid.className = "template-library-grid";
    grid.style.cssText = "grid-template-columns:1fr;overflow:visible;";
    container.appendChild(grid);
    function render(q) {
      grid.innerHTML = "";
      const groups = {};
      FIT.customTemplates.filter(t => !q || t.name.toLowerCase().includes(q)).forEach(t => (groups[MY_TEMPLATES_GROUP] = groups[MY_TEMPLATES_GROUP] || []).push(t));
      STARTER_TEMPLATES
        .filter(t => !q || t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q))
        .filter(t => activeDifficulty === "All" || t.difficulty === activeDifficulty)
        .forEach(t => (groups[t.category] = groups[t.category] || []).push(t));
      const cats = Object.keys(groups);
      if (!cats.length) { grid.innerHTML = `<div class="template-library-empty">No templates match.</div>`; return; }
      cats.forEach(cat => {
        const isMine = cat === MY_TEMPLATES_GROUP;
        const h = document.createElement("div"); h.className = "fit-tpl-group-title"; h.style.cssText = "font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-dim);margin:0.9rem 0 0.4rem;";
        h.textContent = cat; grid.appendChild(h);
        groups[cat].forEach(t => {
          const card = document.createElement("button");
          card.type = "button"; card.className = "card template-lib-card"; card.style.cssText = "display:flex;width:100%;text-align:left;align-items:center;";
          card.innerHTML = `<span class="template-lib-icon"><i class="fa-solid ${isMine ? "fa-star" : ((CATEGORY_META[cat] || {}).icon || "fa-dumbbell")}"></i></span><span class="template-lib-text"><span class="template-lib-name">${esc(t.name)}</span><span class="template-lib-person"><span class="template-lib-diff-tag">${isMine ? "Custom" : t.difficulty}</span> · ${t.exercises.length} exercises</span></span>`;
          if (isMine) {
            const del = document.createElement("span");
            del.className = "checklist-action-btn"; del.style.flexShrink = "0"; del.title = "Delete template";
            del.innerHTML = `<i class="fa-solid fa-trash"></i>`;
            del.addEventListener("click", async e => {
              e.stopPropagation();
              const ok = await customConfirm(`Delete your template "${t.name}"?`, { danger: true, confirmText: "Delete" });
              if (!ok) return;
              FIT.customTemplates = FIT.customTemplates.filter(x => x.id !== t.id);
              await saveCustomTemplates();
              render(q);
            });
            card.appendChild(del);
          }
          card.addEventListener("click", () => { closeChooser(); onPick(t); });
          grid.appendChild(card);
        });
      });
    }
    render("");
    search.querySelector("input").addEventListener("input", e => render(e.target.value.trim().toLowerCase()));
    diffFilter.querySelectorAll(".fit-diff-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        activeDifficulty = btn.dataset.level;
        diffFilter.querySelectorAll(".fit-diff-btn").forEach(b => b.classList.toggle("active", b === btn));
        render(search.querySelector("input").value.trim().toLowerCase());
      });
    });
    openChooser(`<i class="fa-solid fa-book-open"></i> Insert from a template`, "Your own saved templates appear first — fully editable after inserting.", container);
  }

  // Save the current draft exercise list as a reusable template of the user's own
  function openSaveTemplateForm(exercises, defaultName) {
    if (!exercises.length) return;
    const form = document.createElement("form");
    const catOptions = Object.keys(CATEGORY_META).map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    form.innerHTML = `
      <div class="fit-field"><label>Template name</label><input type="text" name="tname" required value="${esc(defaultName || "")}" placeholder="e.g. My Push Day" /></div>
      <div class="fit-field"><label>Category</label><select name="tcategory">${catOptions}</select></div>
      <p style="font-size:0.8rem;color:var(--text-muted);margin-top:-4px;">Saves these ${exercises.length} exercise${exercises.length === 1 ? "" : "s"} as a template you can reuse on any day.</p>
      <div class="fit-form-actions">
        <button type="button" class="fit-btn-secondary" id="fit-tpl-cancel">Cancel</button>
        <button type="submit" class="btn-primary"><i class="fa-solid fa-floppy-disk"></i> Save template</button>
      </div>`;
    form.querySelector("#fit-tpl-cancel").addEventListener("click", closeDetail);
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const name = fd.get("tname").trim();
      if (!name) return;
      FIT.customTemplates.push({
        id: uid(), name, category: fd.get("tcategory"), difficulty: "Custom",
        exercises: exercises.map(ex => ({ ...ex })),
      });
      await saveCustomTemplates();
      closeDetail();
    });
    openDetail(`<i class="fa-solid fa-floppy-disk"></i> Save as template`, "Reuse this workout later from any day editor.", form);
  }

  // ============================================================
  // 9. DAY / WORKOUT EDITOR
  //    Generic: renders into any container, used both inside the
  //    Plan Builder (returns to the day selector on save) and as
  //    a standalone popup from the calendar.
  // ============================================================
  function renderDayEditorInto(container, opts) {
    // opts: { label, initial ('rest'|Workout|null), onSave(workoutOrRest), onCancel, saveLabel, cancelLabel }
    const draft = {
      name: isWorkout(opts.initial) ? opts.initial.name : `${opts.label} Workout`,
      exercises: isWorkout(opts.initial) ? deepClone(opts.initial.exercises) : [],
    };
    let isRest = !isWorkout(opts.initial);

    // The "Add/Edit exercise" form always opens in the shared detail
    // popup (fit-detail-overlay). When THIS day editor is also living in
    // that same popup (opened via openDetail from the dashboard/calendar
    // "train anyway" flows), the exercise form's own openDetail() call
    // would blow away this editor's content with no way back — so in
    // that case we snapshot this popup's title/subtitle and hand back a
    // "restore" callback used for both the sub-form's save and its
    // cancel. When this editor instead lives inside the separate Plan
    // Builder popup (fit-builder-overlay), the two popups don't collide —
    // container was never removed from its own parent, so no snapshot/
    // restore is needed and we fall back to the sub-form's own default
    // (closeDetail, which only ever affects the detail popup layered on
    // top).
    function openExerciseSubForm(onSaveEntry, existingEntry) {
      const inSharedDetailPopup = container.parentElement === detailBody;
      if (!inSharedDetailPopup) {
        openExerciseEntryForm(entry => { onSaveEntry(entry); render(); }, existingEntry);
        return;
      }
      const snapTitle = detailTitle.innerHTML, snapSub = detailSub.textContent, snapWide = detailBox.classList.contains("wide");
      const restore = () => openDetail(snapTitle, snapSub, container, snapWide);
      openExerciseEntryForm(entry => { onSaveEntry(entry); render(); restore(); }, existingEntry, restore);
    }

    function render() {
      container.innerHTML = "";
      const wrap = document.createElement("div");

      const toggle = document.createElement("div");
      toggle.className = "fit-editor-toggle";
      toggle.innerHTML = `
        <button type="button" data-r="1" class="${isRest ? "active" : ""}"><i class="fa-solid fa-mug-hot"></i> Rest day</button>
        <button type="button" data-r="0" class="${!isRest ? "active" : ""}"><i class="fa-solid fa-dumbbell"></i> Workout</button>`;
      wrap.appendChild(toggle);

      if (!isRest) {
        const nameField = document.createElement("div");
        nameField.className = "fit-field";
        nameField.innerHTML = `<label>Workout name</label><input type="text" id="fit-day-wname" value="${esc(draft.name)}" />`;
        wrap.appendChild(nameField);

        const listWrap = document.createElement("div");
        if (draft.exercises.length) {
          draft.exercises.forEach((entry, idx) => {
            const ex = exerciseById(entry.exerciseId);
            const row = document.createElement("div");
            row.className = "fit-ex-row";
            row.innerHTML = `
              <div class="info"><div class="name">${esc(ex.name)}</div><div class="spec">${esc(specLine(entry))}</div></div>
              <div class="ctrls">
                <button type="button" class="checklist-action-btn" data-act="edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="checklist-action-btn" data-act="remove" title="Remove"><i class="fa-solid fa-trash"></i></button>
              </div>`;
            row.querySelector('[data-act="edit"]').addEventListener("click", () => {
              openExerciseSubForm(updated => { draft.exercises[idx] = updated; }, entry);
            });
            row.querySelector('[data-act="remove"]').addEventListener("click", () => { draft.exercises.splice(idx, 1); render(); });
            listWrap.appendChild(row);
          });
        } else {
          const empty = document.createElement("div");
          empty.className = "fit-empty";
          empty.innerHTML = `<i class="fa-solid fa-list"></i>No exercises yet — add your first one below.`;
          listWrap.appendChild(empty);
        }
        wrap.appendChild(listWrap);

        const addBtn = document.createElement("button");
        addBtn.type = "button"; addBtn.className = "fit-add-ex-btn";
        addBtn.innerHTML = `<i class="fa-solid fa-plus"></i> Add exercise`;
        addBtn.addEventListener("click", () => {
          openExerciseSubForm(entry => { draft.exercises.push(entry); });
        });
        wrap.appendChild(addBtn);

        const starterBtn = document.createElement("button");
        starterBtn.type = "button"; starterBtn.className = "fit-btn-secondary"; starterBtn.style.width = "100%"; starterBtn.style.justifyContent = "center";
        starterBtn.innerHTML = `<i class="fa-solid fa-book-open"></i> Insert from a starter template (optional)`;
        starterBtn.addEventListener("click", () => {
          pickStarterTemplate(t => { draft.exercises = draft.exercises.concat(t.exercises.map(e => ({ ...e }))); if (!draft.exercises.length === false && draft.name.endsWith("Workout")) draft.name = t.name; render(); });
        });
        wrap.appendChild(starterBtn);

        if (draft.exercises.length) {
          const saveTplBtn = document.createElement("button");
          saveTplBtn.type = "button"; saveTplBtn.className = "fit-btn-secondary"; saveTplBtn.style.width = "100%"; saveTplBtn.style.justifyContent = "center"; saveTplBtn.style.marginTop = "10px";
          saveTplBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save as my own template`;
          saveTplBtn.addEventListener("click", () => openSaveTemplateForm(draft.exercises, draft.name));
          wrap.appendChild(saveTplBtn);
        }
      } else {
        const empty = document.createElement("div");
        empty.className = "fit-empty";
        empty.innerHTML = `<i class="fa-solid fa-mug-hot"></i>Rest day — no workout scheduled.`;
        wrap.appendChild(empty);
      }

      const footer = document.createElement("div");
      footer.className = "fit-editor-footer";
      footer.innerHTML = `
        <button type="button" class="fit-btn-secondary" id="fit-day-cancel"><i class="fa-solid fa-arrow-left"></i> ${esc(opts.cancelLabel || "Back")}</button>
        <button type="button" class="btn-primary" id="fit-day-save"><i class="fa-solid fa-check"></i> ${esc(opts.saveLabel || "Save")}</button>`;
      wrap.appendChild(footer);

      container.appendChild(wrap);

      toggle.querySelectorAll("button").forEach(b => b.addEventListener("click", () => { isRest = b.dataset.r === "1"; render(); }));
      const nameInput = container.querySelector("#fit-day-wname");
      if (nameInput) nameInput.addEventListener("input", () => { draft.name = nameInput.value; });
      container.querySelector("#fit-day-cancel").addEventListener("click", () => opts.onCancel());
      container.querySelector("#fit-day-save").addEventListener("click", () => {
        if (isRest) { opts.onSave("rest"); return; }
        const name = (draft.name || "").trim() || `${opts.label} Workout`;
        const workout = { id: (isWorkout(opts.initial) ? opts.initial.id : uid()), name, exercises: draft.exercises };
        opts.onSave(workout);
      });
    }
    render();
  }

  // ============================================================
  // 10. WORKOUT DETAIL (read-only view, from dashboard / calendar / history)
  // ============================================================
  function openWorkoutDetail(workout, opts) {
    opts = opts || {};
    const sum = workoutSummary(workout);
    const body = document.createElement("div");
    // Total time + exercise/set counts up front, above the exercise list,
    // so the shape of the workout is clear before scrolling.
    const grid = document.createElement("div");
    grid.className = "fit-summary-grid";
    grid.innerHTML = `
      <div class="fit-summary-tile"><div class="val">${sum.exCount}</div><div class="lbl">Exercises</div></div>
      <div class="fit-summary-tile"><div class="val">${sum.setCount}</div><div class="lbl">Total sets</div></div>
      <div class="fit-summary-tile"><div class="val">~${sum.estMin}</div><div class="lbl">Est. minutes</div></div>`;
    body.appendChild(grid);
    // Each exercise is a tap-to-expand row: collapsed shows name + sets/reps
    // (so the whole workout fits on screen at a glance), tapping reveals
    // muscle/equipment/difficulty + instructions for that exercise.
    workout.exercises.forEach(entry => {
      const ex = exerciseById(entry.exerciseId);
      const row = document.createElement("div");
      row.className = "fit-wd-row";
      const detailHTML = ex ? `
          <div class="fit-wd-tags">
            ${ex.muscle ? `<span class="fit-ex-tag">${esc(ex.muscle)}</span>` : ""}
            ${ex.difficulty ? `<span class="fit-ex-tag">${esc(ex.difficulty)}</span>` : ""}
            ${ex.equipment ? `<span class="fit-ex-tag">${esc(ex.equipment)}</span>` : ""}
          </div>
          <div class="fit-wd-instructions">${ex.instructions ? esc(ex.instructions) : "No instructions added for this exercise yet."}</div>`
        : `<div class="fit-wd-instructions">Exercise details unavailable.</div>`;
      row.innerHTML = `
        <button type="button" class="fit-wd-row-top">
          <span class="n">${esc(ex ? ex.name : "Unknown exercise")}</span>
          <span class="right"><span class="s">${esc(specLine(entry))}</span><i class="fa-solid fa-chevron-down fit-wd-chevron"></i></span>
        </button>
        <div class="fit-wd-row-detail">${detailHTML}</div>`;
      row.querySelector(".fit-wd-row-top").addEventListener("click", () => row.classList.toggle("open"));
      body.appendChild(row);
    });
    let footer = null;
    if (opts.onStart) {
      // Kept in the sticky footer (outside the scrollable body) so "Start
      // this workout" stays visible and dominant no matter how long the
      // exercise list is or how many rows are expanded.
      footer = document.createElement("div");
      footer.innerHTML = `<button class="btn-primary" id="fit-wd-start" style="width:100%;justify-content:center;"><i class="fa-solid fa-play"></i> Start this workout</button>`;
      footer.querySelector("#fit-wd-start").addEventListener("click", () => { closeDetail(); opts.onStart(); });
    }
    openDetail(`<i class="fa-solid fa-dumbbell"></i> ${esc(workout.name)}`, opts.subtitle || "", body, false, footer);
  }

  // ============================================================
  // 11. PLAN BUILDER (big popup: day selector <-> day editor)
  // ============================================================
  let PB = null; // { id, name, objective, schedule, active }

  function openPlanBuilder(existing) {
    PB = existing
      ? { id: existing.id, name: existing.name, objective: existing.objective || "", schedule: deepClone(existing.schedule), active: existing.active, source: existing.source }
      : { id: null, name: "", objective: "", schedule: Object.fromEntries(WEEKDAY_KEYS.map(k => [k, "rest"])), active: FIT.plans.length === 0, source: "custom" };
    renderBuilderDaySelector();
    showOverlay(builderOverlay);
  }

  function renderBuilderDaySelector() {
    builderTitle.innerHTML = `<i class="fa-solid fa-clipboard-list"></i> ${PB.id ? "Edit plan" : "Build your plan"}`;
    builderSub.textContent = "Tap a day to build its workout — or leave it as rest.";
    builderBody.innerHTML = "";

    const nameRow = document.createElement("div");
    nameRow.className = "fit-field-row";
    nameRow.innerHTML = `
      <div class="fit-field"><label>Plan name</label><input type="text" id="fit-pb-name" value="${esc(PB.name)}" placeholder="e.g. My Weekly Routine" /></div>
      <div class="fit-field"><label>Objective (optional)</label><input type="text" id="fit-pb-objective" value="${esc(PB.objective)}" placeholder="e.g. Build strength" /></div>`;
    builderBody.appendChild(nameRow);
    nameRow.querySelector("#fit-pb-name").addEventListener("input", e => { PB.name = e.target.value; });
    nameRow.querySelector("#fit-pb-objective").addEventListener("input", e => { PB.objective = e.target.value; });

    const daysGrid = document.createElement("div");
    daysGrid.className = "fit-builder-days";
    WEEKDAY_KEYS.forEach(k => {
      const val = PB.schedule[k];
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "fit-builder-day-tile" + (isWorkout(val) ? " has-workout" : "");
      const sum = isWorkout(val) ? workoutSummary(val) : null;
      tile.innerHTML = `
        <div class="dlabel">${WEEKDAY_LABELS[k]}</div>
        <div class="dcontent">${isWorkout(val) ? esc(val.name) : "Rest day"}</div>
        ${sum ? `<div class="dmeta">${sum.exCount} exercises · ~${sum.estMin} min</div>` : `<div class="dmeta">Tap to add a workout</div>`}`;
      tile.addEventListener("click", () => openBuilderDayEditor(k));
      daysGrid.appendChild(tile);
    });
    builderBody.appendChild(daysGrid);

    const footer = document.createElement("div");
    footer.className = "fit-editor-footer";
    const freq = WEEKDAY_KEYS.filter(k => isWorkout(PB.schedule[k])).length;
    footer.innerHTML = `
      <span style="font-size:0.8rem;color:var(--text-muted);align-self:center;">${freq}x / week</span>
      <span style="display:flex;gap:14px;">
        <button type="button" class="fit-btn-secondary" id="fit-pb-cancel">Cancel</button>
        <button type="button" class="btn-primary" id="fit-pb-save"><i class="fa-solid fa-check"></i> ${PB.id ? "Save plan" : "Create plan"}</button>
      </span>`;
    builderBody.appendChild(footer);
    footer.querySelector("#fit-pb-cancel").addEventListener("click", closeBuilder);
    footer.querySelector("#fit-pb-save").addEventListener("click", savePlanFromBuilder);
  }

  function openBuilderDayEditor(dayKey) {
    builderTitle.innerHTML = `<i class="fa-solid fa-calendar-day"></i> ${WEEKDAY_LABELS[dayKey]}`;
    builderSub.textContent = "Build the workout for this day, then save to go back.";
    builderBody.innerHTML = "";
    const host = document.createElement("div");
    builderBody.appendChild(host);
    renderDayEditorInto(host, {
      label: WEEKDAY_LABELS[dayKey],
      initial: PB.schedule[dayKey],
      saveLabel: "Save day", cancelLabel: "Back to week",
      onCancel: renderBuilderDaySelector,
      onSave: (value) => { PB.schedule[dayKey] = value; renderBuilderDaySelector(); },
    });
  }

  async function savePlanFromBuilder() {
    const nameInput = document.getElementById("fit-pb-name");
    const name = (nameInput ? nameInput.value : PB.name).trim();
    if (!name) {
      if (nameInput) { nameInput.style.borderColor = "var(--primary)"; nameInput.focus(); }
      return;
    }
    const plan = { id: PB.id || uid(), name, objective: PB.objective.trim(), schedule: PB.schedule, active: PB.active, source: PB.source };
    if (PB.id) {
      const idx = FIT.plans.findIndex(p => p.id === PB.id);
      FIT.plans[idx] = plan;
    } else {
      FIT.plans.push(plan);
      if (plan.active) FIT.plans.forEach(p => { if (p.id !== plan.id) p.active = false; });
    }
    await savePlans();
    closeBuilder();
    renderPlans(); renderDashboard(); renderCalendar();
  }

  // ============================================================
  // 12. RENDER: DASHBOARD
  // ============================================================
  function renderDashboard() {
    const iso = todayISO();
    const st = getDayStatus(iso);
    const card = document.getElementById("fit-today-card");

    if (st.status === "completed") {
      const session = FIT.sessions.find(s => s.id === st.sessionId);
      card.innerHTML = `
        <div class="fit-today-eyebrow"><i class="fa-solid fa-circle-check"></i> Today's Workout — Complete</div>
        <div class="fit-today-name">${esc(session ? session.workoutName : "Workout complete")}</div>
        <div class="fit-today-meta">
          <span><i class="fa-solid fa-clock"></i> ${session ? session.durationMin : 0} min</span>
          <span><i class="fa-solid fa-list-check"></i> ${session ? session.setsCompleted : 0}/${session ? session.totalSets : 0} sets</span>
          <span><i class="fa-solid fa-percent"></i> ${session ? session.completionPct : 0}% completion</span>
        </div>
        <button class="fit-btn-secondary" id="fit-view-today-session"><i class="fa-solid fa-eye"></i> View details</button>`;
      const btn = card.querySelector("#fit-view-today-session");
      if (btn && session) btn.addEventListener("click", () => openSessionDetail(session));
    } else if (st.status === "rest") {
      card.innerHTML = `
        <div class="fit-today-eyebrow"><i class="fa-solid fa-mug-hot"></i> Today's Workout</div>
        <div class="fit-today-name">Rest day</div>
        <div class="fit-today-meta"><span>Nothing scheduled — recovery is part of the plan.</span></div>
        <button class="fit-btn-secondary" id="fit-choose-anyway"><i class="fa-solid fa-plus"></i> Train anyway</button>`;
      card.querySelector("#fit-choose-anyway").addEventListener("click", () => openAdhocWorkoutChoice(iso));
    } else if (st.status === "scheduled" || st.status === "missed") {
      const w = st.workout;
      const sum = workoutSummary(w);
      card.innerHTML = `
        <div class="fit-today-top">
          <div><div class="fit-today-eyebrow"><i class="fa-solid fa-bolt"></i> Today's Workout</div><div class="fit-today-name">${esc(w.name)}</div></div>
        </div>
        <div class="fit-today-meta">
          <span><i class="fa-solid fa-clock"></i> ~${sum.estMin} min</span>
          <span><i class="fa-solid fa-list-check"></i> ${sum.exCount} exercises</span>
          <span><i class="fa-solid fa-layer-group"></i> ${sum.setCount} sets</span>
        </div>
        <div class="fit-today-actions">
          <button class="btn-primary" id="fit-start-btn"><i class="fa-solid fa-play"></i> Start Workout</button>
          <button class="fit-btn-secondary" id="fit-view-btn"><i class="fa-solid fa-eye"></i> View full workout</button>
        </div>
        <div class="fit-checkin-banner" id="fit-checkin-banner">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <div>
            <div id="fit-checkin-text">How are you feeling today?</div>
            <div class="fit-checkin-actions" id="fit-checkin-choices">
              <button data-feel="normal">Feeling good</button>
              <button data-feel="sore">High soreness</button>
              <button data-feel="low">Low energy</button>
            </div>
          </div>
        </div>`;
      card.querySelector("#fit-start-btn").addEventListener("click", () => beginExecution(w, iso));
      card.querySelector("#fit-view-btn").addEventListener("click", () => openWorkoutDetail(w, { onStart: () => beginExecution(w, iso) }));
      const banner = card.querySelector("#fit-checkin-banner");
      banner.classList.add("show");
      card.querySelectorAll("#fit-checkin-choices button").forEach(b => b.addEventListener("click", () => handleFeelingCheck(b.dataset.feel, w, iso, banner)));
    }

    const [wStart, wEnd] = weekRange(iso);
    document.getElementById("fit-stat-strip").innerHTML = `
      <div class="fit-stat-tile"><i class="fa-solid fa-check-double"></i><div class="val">${countCompletedInRange(wStart, wEnd)}/${countScheduledInRange(wStart, wEnd)}</div><div class="lbl">This week</div></div>
      <div class="fit-stat-tile"><i class="fa-solid fa-fire"></i><div class="val">${computeStreak()}</div><div class="lbl">Day streak</div></div>
      <div class="fit-stat-tile"><i class="fa-solid fa-calendar"></i><div class="val">${monthlyWorkoutCount()}</div><div class="lbl">This month</div></div>
      <div class="fit-stat-tile"><i class="fa-solid fa-clipboard-list"></i><div class="val">${FIT.sessions.length}</div><div class="lbl">Total sessions</div></div>`;
    document.getElementById("fit-header-streak").textContent = computeStreak();

    // "Your routine" — the active plan's week as clickable day cards
    const dashPlan = document.getElementById("fit-dash-plan");
    const plan = getActivePlan();
    if (!plan) {
      dashPlan.innerHTML = `<div class="fit-empty" style="grid-column:1/-1;"><i class="fa-solid fa-clipboard-list"></i>No active plan yet. Head to the Plans tab to build your week.</div>`;
    } else {
      dashPlan.innerHTML = "";
      WEEKDAY_KEYS.forEach(k => {
        const val = plan.schedule[k];
        const card2 = document.createElement("div");
        card2.className = "fit-plan-card";
        card2.style.cursor = isWorkout(val) ? "pointer" : "default";
        const sum2 = isWorkout(val) ? workoutSummary(val) : null;
        card2.innerHTML = `
          <div class="fit-card-cat">${WEEKDAY_LABELS[k]}</div>
          <h3 style="margin-top:2px;">${isWorkout(val) ? esc(val.name) : "Rest day"}</h3>
          ${sum2 ? `<div class="fit-card-foot"><span><i class="fa-solid fa-list-check"></i> ${sum2.exCount} exercises</span><span><i class="fa-solid fa-clock"></i> ~${sum2.estMin} min</span></div>` : ""}`;
        if (isWorkout(val)) card2.addEventListener("click", () => openWorkoutDetail(val, { subtitle: WEEKDAY_LABELS[k] }));
        dashPlan.appendChild(card2);
      });
    }

    const dashGoals = document.getElementById("fit-dash-goals");
    const topGoals = FIT.goals.slice(0, 4);
    if (!topGoals.length) {
      dashGoals.innerHTML = `<div class="fit-empty" style="grid-column:1/-1;"><i class="fa-solid fa-bullseye"></i>No fitness goals yet. Head to the Goals tab to set one.</div>`;
    } else {
      dashGoals.innerHTML = "";
      topGoals.forEach(g => dashGoals.appendChild(buildGoalCard(g)));
    }
  }

  function openAdhocWorkoutChoice(iso) {
    const items = [
      { label: "Build a quick workout", sub: "Add your own exercises for today", icon: "fa-pen", onClick: () => {
        closeChooser();
        const body = document.createElement("div");
        openDetail(`<i class="fa-solid fa-dumbbell"></i> Today's workout`, formatDateLong(iso), body, true);
        renderDayEditorInto(body, {
          label: "Today", initial: null, saveLabel: "Save & start", cancelLabel: "Cancel",
          onCancel: closeDetail,
          onSave: async (w) => {
            closeDetail();
            if (w === "rest") return;
            FIT.overrides[iso] = w; await saveOverrides();
            renderDashboard(); renderCalendar();
            beginExecution(w, iso);
          },
        });
      }},
      { label: "Use a starter template", sub: "Quick pre-filled workout, fully editable", icon: "fa-book-open", onClick: () => {
        closeChooser();
        pickStarterTemplate(async t => {
          const w = { id: uid(), name: t.name, exercises: t.exercises.map(e => ({ ...e })) };
          FIT.overrides[iso] = w; await saveOverrides();
          renderDashboard(); renderCalendar();
          beginExecution(w, iso);
        });
      }},
    ];
    openChooser(`<i class="fa-solid fa-dumbbell"></i> Train today`, "No workout was scheduled — how do you want to build it?", buildChoiceList(items));
  }

  function handleFeelingCheck(feel, w, iso, banner) {
    if (feel === "normal") { banner.classList.remove("show"); return; }
    banner.querySelector("#fit-checkin-text").textContent = "Your planned workout may not be the best fit today.";
    banner.querySelector("#fit-checkin-choices").innerHTML = `
      <button data-act="continue">Continue planned</button>
      <button data-act="lighter">Switch to lighter session</button>
      <button data-act="move">Move workout</button>`;
    banner.querySelector('[data-act="continue"]').addEventListener("click", () => beginExecution(w, iso));
    banner.querySelector('[data-act="lighter"]').addEventListener("click", () => {
      pickStarterTemplate(t => {
        const lw = { id: uid(), name: t.name, exercises: t.exercises.map(e => ({ ...e })) };
        beginExecution(lw, iso);
      });
    });
    banner.querySelector('[data-act="move"]').addEventListener("click", () => {
      const items = [];
      for (let i = 1; i <= 6; i++) {
        const d = addDays(iso, i);
        items.push({ label: formatDateLong(d), sub: formatDateShort(d), icon: "fa-calendar-day", onClick: async () => {
          FIT.overrides[iso] = "rest"; FIT.overrides[d] = w;
          await saveOverrides(); closeChooser(); renderDashboard(); renderCalendar();
        }});
      }
      openChooser(`<i class="fa-solid fa-calendar-days"></i> Move to which day?`, `${w.name} will move off today.`, buildChoiceList(items));
    });
  }

  // ============================================================
  // 13. RENDER: GOALS
  // ============================================================
  function buildGoalCard(g) {
    const pct = g.target > 0 ? clamp(Math.round((g.current / g.target) * 100), 0, 100) : 0;
    const plan = g.planId ? FIT.plans.find(p => p.id === g.planId) : null;
    const div = document.createElement("div");
    div.className = "fit-goal-card";
    div.innerHTML = `
      <div class="fit-card-top">
        <div><h3>${esc(g.title)}</h3><div class="fit-card-cat">${esc(g.category)}</div></div>
        <div class="fit-card-controls">
          <button class="checklist-action-btn" data-act="edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="checklist-action-btn" data-act="delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="fit-progress-row"><span>Progress</span><b>${g.current} / ${g.target} ${esc(g.unit || "")}</b></div>
      <div class="checklist-progress-bar-bg"><div class="checklist-progress-bar-fill" style="width:${pct}%"></div></div>
      <div class="fit-card-foot">
        <span>${pct}% complete</span>
        ${g.deadline ? `<span><i class="fa-solid fa-calendar"></i> ${formatDateShort(g.deadline)}</span>` : ""}
        ${plan ? `<span><i class="fa-solid fa-clipboard-list"></i> ${esc(plan.name)}</span>` : ""}
      </div>`;
    div.querySelector('[data-act="edit"]').addEventListener("click", () => openGoalForm(g));
    div.querySelector('[data-act="delete"]').addEventListener("click", async () => {
      const ok = await customConfirm(`Delete the goal "${g.title}"?`, { danger: true, confirmText: "Delete" });
      if (!ok) return;
      FIT.goals = FIT.goals.filter(x => x.id !== g.id);
      await saveGoals();
      renderGoals(); renderDashboard();
    });
    return div;
  }

  function renderGoals() {
    const list = document.getElementById("fit-goals-list");
    if (!FIT.goals.length) { list.innerHTML = `<div class="fit-empty" style="grid-column:1/-1;"><i class="fa-solid fa-bullseye"></i>No goals yet — set one to start tracking progress.</div>`; return; }
    list.innerHTML = "";
    FIT.goals.forEach(g => list.appendChild(buildGoalCard(g)));
  }

  function openGoalForm(existing) {
    const form = document.createElement("form");
    const planOptions = FIT.plans.map(p => `<option value="${p.id}" ${existing && existing.planId === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("");
    form.innerHTML = `
      <div class="fit-field"><label>Goal name</label><input type="text" name="title" required value="${existing ? esc(existing.title) : ""}" placeholder="e.g. 10 pull-ups" /></div>
      <div class="fit-field-row">
        <div class="fit-field"><label>Category</label><select name="category">${GOAL_CATEGORIES.map(c => `<option ${existing && existing.category === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
        <div class="fit-field"><label>Unit</label><input type="text" name="unit" value="${existing ? esc(existing.unit || "") : "reps"}" placeholder="reps, kg, km…" /></div>
      </div>
      <div class="fit-field-row">
        <div class="fit-field"><label>Current progress</label><input type="number" name="current" min="0" step="any" value="${existing ? existing.current : 0}" /></div>
        <div class="fit-field"><label>Target</label><input type="number" name="target" min="0" step="any" required value="${existing ? existing.target : ""}" /></div>
      </div>
      <div class="fit-field-row">
        <div class="fit-field"><label>Deadline (optional)</label><input type="date" name="deadline" value="${existing && existing.deadline ? existing.deadline : ""}" /></div>
        <div class="fit-field"><label>Related plan (optional)</label><select name="planId"><option value="">None</option>${planOptions}</select></div>
      </div>
      <div class="fit-form-actions">
        <button type="button" class="fit-btn-secondary" id="fit-goal-cancel">Cancel</button>
        <button type="submit" class="btn-primary"><i class="fa-solid fa-check"></i> ${existing ? "Save" : "Create goal"}</button>
      </div>`;
    form.querySelector("#fit-goal-cancel").addEventListener("click", closeDetail);
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const goal = {
        id: existing ? existing.id : uid(), title: fd.get("title").trim(), category: fd.get("category"),
        unit: fd.get("unit").trim(), current: parseFloat(fd.get("current")) || 0, target: parseFloat(fd.get("target")) || 0,
        deadline: fd.get("deadline") || null, planId: fd.get("planId") || null,
      };
      if (!goal.title) return;
      if (existing) { FIT.goals[FIT.goals.findIndex(g => g.id === existing.id)] = goal; } else { FIT.goals.push(goal); }
      await saveGoals();
      closeDetail();
      renderGoals(); renderDashboard();
    });
    openDetail(`<i class="fa-solid fa-bullseye"></i> ${existing ? "Edit goal" : "New goal"}`, "Fitness goals connect to your broader progress.", form);
  }
  document.getElementById("fit-new-goal-btn").addEventListener("click", () => openGoalForm(null));

  // ============================================================
  // 14. RENDER: PLANS
  // ============================================================
  function buildPlanCard(p) {
    const div = document.createElement("div");
    div.className = "fit-plan-card";
    const freq = WEEKDAY_KEYS.filter(k => isWorkout(p.schedule[k])).length;
    div.innerHTML = `
      <div class="fit-card-top">
        <div><h3>${esc(p.name)}</h3><div class="fit-card-cat">${esc(p.objective || "Custom plan")}</div></div>
        <div class="fit-card-controls">
          ${p.active ? `<span class="fit-active-tag"><i class="fa-solid fa-check"></i> Active</span>` : `<button class="checklist-action-btn" data-act="activate" title="Set active"><i class="fa-solid fa-play"></i></button>`}
          <button class="checklist-action-btn" data-act="edit" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="checklist-action-btn" data-act="delete" title="Delete"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="fit-card-foot"><span><i class="fa-solid fa-repeat"></i> ${freq}x / week</span></div>
      <div class="fit-week-strip">${WEEKDAY_KEYS.map(k => `<div class="d ${isWorkout(p.schedule[k]) ? "workout" : ""}">${WEEKDAY_SHORT[k][0]}</div>`).join("")}</div>`;
    const activateBtn = div.querySelector('[data-act="activate"]');
    if (activateBtn) activateBtn.addEventListener("click", async () => { FIT.plans.forEach(x => x.active = x.id === p.id); await savePlans(); renderPlans(); renderDashboard(); renderCalendar(); });
    div.querySelector('[data-act="edit"]').addEventListener("click", () => openPlanBuilder(p));
    div.querySelector('[data-act="delete"]').addEventListener("click", async () => {
      const ok = await customConfirm(`Delete the plan "${p.name}"?`, { danger: true, confirmText: "Delete" });
      if (!ok) return;
      FIT.plans = FIT.plans.filter(x => x.id !== p.id);
      await savePlans();
      renderPlans(); renderDashboard(); renderCalendar();
    });
    return div;
  }
  function renderPlans() {
    const list = document.getElementById("fit-plans-list");
    if (!FIT.plans.length) { list.innerHTML = `<div class="fit-empty" style="grid-column:1/-1;"><i class="fa-solid fa-clipboard-list"></i>No plans yet. Create one and build your week day by day.</div>`; return; }
    list.innerHTML = "";
    FIT.plans.forEach(p => list.appendChild(buildPlanCard(p)));
  }
  document.getElementById("fit-new-plan-btn").addEventListener("click", () => openPlanBuilder(null));

  // ============================================================
  // 15. RENDER: EXERCISE LIBRARY
  // ============================================================
  function populateMuscleFilter() {
    const sel = document.getElementById("fit-ex-filter");
    const current = sel.value;
    const muscles = [...new Set(getAllExercises().map(e => e.muscle))].filter(Boolean).sort();
    sel.innerHTML = `<option value="">All muscle groups</option>` + muscles.map(m => `<option>${esc(m)}</option>`).join("");
    if (muscles.includes(current)) sel.value = current;
  }
  function renderExercises() {
    const grid = document.getElementById("fit-ex-grid");
    const q = document.getElementById("fit-ex-search").value.trim().toLowerCase();
    const muscle = document.getElementById("fit-ex-filter").value;
    const list = getAllExercises().filter(e => (!q || e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q)) && (!muscle || e.muscle === muscle));
    if (!list.length) { grid.innerHTML = `<div class="template-library-empty">No exercises match.</div>`; updateExerciseGridToggle(); return; }
    grid.innerHTML = "";
    list.forEach(ex => {
      const card = document.createElement("div");
      card.className = "card template-lib-card fit-ex-card";
      card.innerHTML = `<span class="template-lib-icon"><i class="fa-solid fa-person-running"></i></span><span class="template-lib-text"><span class="template-lib-name">${esc(ex.name)}</span><span class="template-lib-person"><span class="fit-ex-tag">${esc(ex.muscle)}</span><span class="fit-ex-tag">${esc(ex.difficulty)}</span></span></span>`;
      card.addEventListener("click", () => openExerciseDetail(ex));
      grid.appendChild(card);
    });
    updateExerciseGridToggle();
  }

  // Exercise library "Show more" — collapses the grid to a capped height
  // on BOTH mobile and desktop whenever the full list overflows it, and
  // re-measures on every render since search/filter changes the count.
  function updateExerciseGridToggle() {
    const wrap = document.getElementById("fit-ex-grid-wrap");
    const btn = document.getElementById("fit-ex-show-more-btn");
    if (!wrap || !btn) return;

    wrap.classList.add("collapsed");
    btn.classList.remove("expanded");
    btn.setAttribute("aria-expanded", "false");
    btn.querySelector("span").textContent = "Show more";

    requestAnimationFrame(() => {
      if (wrap.scrollHeight > wrap.clientHeight + 4) {
        btn.classList.add("show");
      } else {
        btn.classList.remove("show");
        wrap.classList.remove("collapsed");
      }
    });
  }

  document.getElementById("fit-ex-show-more-btn")?.addEventListener("click", () => {
    const wrap = document.getElementById("fit-ex-grid-wrap");
    const btn = document.getElementById("fit-ex-show-more-btn");
    const collapsed = wrap.classList.toggle("collapsed");
    btn.classList.toggle("expanded", !collapsed);
    btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    btn.querySelector("span").textContent = collapsed ? "Show more" : "Show less";
    if (collapsed) wrap.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  function openExerciseDetail(ex) {
    const body = document.createElement("div");
    body.innerHTML = `
      <div class="fit-today-meta" style="margin-bottom:1rem;">
        <span><i class="fa-solid fa-dumbbell"></i> ${esc(ex.type)}</span>
        <span><i class="fa-solid fa-gauge"></i> ${esc(ex.difficulty)}</span>
        <span><i class="fa-solid fa-toolbox"></i> ${esc(ex.equipment || "None")}</span>
      </div>
      ${ex.instructions ? `<div class="fit-exec-instructions">${esc(ex.instructions)}</div>` : ""}
      ${ex.progressions && ex.progressions.length ? `<div class="fit-field"><label>Progressions</label><div class="fit-week-strip" style="flex-wrap:wrap;">${ex.progressions.map(p => `<span class="fit-ex-tag" style="padding:6px 10px;">${esc(p)}</span>`).join("")}</div></div>` : ""}`;
    openDetail(`<i class="fa-solid fa-person-running"></i> ${esc(ex.name)}`, ex.muscle, body);
  }
  function openExerciseForm() {
    const form = document.createElement("form");
    form.innerHTML = `
      <div class="fit-field"><label>Name</label><input type="text" name="name" required placeholder="e.g. Cossack Squat" /></div>
      <div class="fit-field-row">
        <div class="fit-field"><label>Muscle group / pattern</label><input type="text" name="muscle" required placeholder="e.g. Quads & Glutes" /></div>
        <div class="fit-field"><label>Type</label><input type="text" name="type" value="Strength" /></div>
      </div>
      <div class="fit-field-row">
        <div class="fit-field"><label>Difficulty</label><select name="difficulty"><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></div>
        <div class="fit-field"><label>Equipment</label><input type="text" name="equipment" value="None" /></div>
      </div>
      <div class="fit-field"><label>Instructions</label><textarea name="instructions" placeholder="How to perform it"></textarea></div>
      <div class="fit-form-actions">
        <button type="button" class="fit-btn-secondary" id="fit-ex-cancel">Cancel</button>
        <button type="submit" class="btn-primary"><i class="fa-solid fa-check"></i> Add exercise</button>
      </div>`;
    form.querySelector("#fit-ex-cancel").addEventListener("click", closeDetail);
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const fd = new FormData(form);
      const ex = { id: uid(), name: fd.get("name").trim(), muscle: fd.get("muscle").trim(), type: fd.get("type").trim() || "Strength", difficulty: fd.get("difficulty"), equipment: fd.get("equipment").trim() || "None", instructions: fd.get("instructions").trim(), progressions: [] };
      if (!ex.name) return;
      FIT.customExercises.push(ex);
      await saveCustomExercises();
      closeDetail();
      populateMuscleFilter(); populateExerciseDatalist(); renderExercises();
    });
    openDetail(`<i class="fa-solid fa-plus"></i> Add exercise`, "Custom exercises can be reused in any workout.", form);
  }
  document.getElementById("fit-new-exercise-btn").addEventListener("click", openExerciseForm);
  document.getElementById("fit-ex-search").addEventListener("input", renderExercises);
  document.getElementById("fit-ex-filter").addEventListener("change", renderExercises);

  // ============================================================
  // 16. RENDER: SCHEDULE (real month calendar)
  // ============================================================
  function renderCalendar() {
    if (!FIT.calendarMonth) { const n = new Date(); FIT.calendarMonth = { y: n.getFullYear(), m: n.getMonth() }; }
    const { y, m } = FIT.calendarMonth;
    document.getElementById("fit-cal-label").textContent = new Date(y, m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });

    const grid = document.getElementById("fit-calendar-grid");
    grid.innerHTML = "";
    WEEKDAY_KEYS.forEach(k => { const h = document.createElement("div"); h.className = "fit-cal-weekday"; h.textContent = WEEKDAY_SHORT[k]; grid.appendChild(h); });

    const firstOfMonth = new Date(y, m, 1);
    const leadOffset = WEEKDAY_KEYS.indexOf(jsDayToKey(firstOfMonth.getDay())); // Monday-start offset
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    for (let i = 0; i < leadOffset; i++) { const pad = document.createElement("div"); pad.className = "fit-cal-cell pad"; grid.appendChild(pad); }

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = toISODate(new Date(y, m, d));
      const st = getDayStatus(iso);
      const cell = document.createElement("div");
      cell.className = `fit-cal-cell ${st.status}` + (iso === todayISO() ? " is-today" : "");
      cell.innerHTML = `
        <div class="fit-cal-daynum">${d}</div>
        <div class="fit-cal-wname">${isWorkout(st.workout) ? esc(st.workout.name) : (st.status === "rest" ? "Rest" : "")}</div>
        ${st.status !== "rest" ? `<div class="fit-cal-dot"></div>` : ""}`;
      cell.addEventListener("click", () => openDayOptions(iso));
      grid.appendChild(cell);
    }
  }
  document.getElementById("fit-cal-prev").addEventListener("click", () => { let { y, m } = FIT.calendarMonth; m--; if (m < 0) { m = 11; y--; } FIT.calendarMonth = { y, m }; renderCalendar(); });
  document.getElementById("fit-cal-next").addEventListener("click", () => { let { y, m } = FIT.calendarMonth; m++; if (m > 11) { m = 0; y++; } FIT.calendarMonth = { y, m }; renderCalendar(); });
  document.getElementById("fit-cal-today").addEventListener("click", () => { const n = new Date(); FIT.calendarMonth = { y: n.getFullYear(), m: n.getMonth() }; renderCalendar(); });

  function openDayOptions(iso) {
    const st = getDayStatus(iso);
    const items = [];
    if (st.status === "completed") {
      const session = FIT.sessions.find(s => s.id === st.sessionId);
      if (session) items.push({ label: "View session", sub: session.workoutName, icon: "fa-eye", onClick: () => { closeChooser(); openSessionDetail(session); } });
    }
    if (isWorkout(st.workout)) {
      items.push({ label: "View workout", sub: st.workout.name, icon: "fa-dumbbell", onClick: () => { closeChooser(); openWorkoutDetail(st.workout, { subtitle: formatDateLong(iso), onStart: iso === todayISO() && st.status !== "completed" ? () => beginExecution(st.workout, iso) : null }); } });
    }
    if (iso === todayISO() && isWorkout(st.workout) && st.status !== "completed") {
      items.push({ label: "Start this workout", icon: "fa-play", onClick: () => { closeChooser(); beginExecution(st.workout, iso); } });
    }
    items.push({ label: "Build a custom workout for this day", icon: "fa-pen", onClick: () => {
      closeChooser();
      const body = document.createElement("div");
      openDetail(`<i class="fa-solid fa-calendar-day"></i> ${formatDateLong(iso)}`, "Set what happens on this day.", body, true);
      renderDayEditorInto(body, {
        label: formatDateShort(iso), initial: getScheduledFor(iso), saveLabel: "Save", cancelLabel: "Cancel",
        onCancel: closeDetail,
        onSave: async (w) => { FIT.overrides[iso] = w; await saveOverrides(); closeDetail(); renderCalendar(); renderDashboard(); },
      });
    }});
    items.push({ label: "Set as rest day", icon: "fa-mug-hot", onClick: async () => { FIT.overrides[iso] = "rest"; await saveOverrides(); closeChooser(); renderCalendar(); renderDashboard(); } });
    if (isWorkout(st.workout) && st.status !== "completed" && st.status !== "skipped") {
      items.push({ label: "Mark as skipped", icon: "fa-forward", onClick: async () => { FIT.dayLog[iso] = { status: "skipped", workout: st.workout }; await saveDayLog(); closeChooser(); renderCalendar(); renderDashboard(); } });
    }
    if (Object.prototype.hasOwnProperty.call(FIT.overrides, iso)) {
      items.push({ label: "Reset to plan default", icon: "fa-rotate-left", danger: true, onClick: async () => { delete FIT.overrides[iso]; await saveOverrides(); closeChooser(); renderCalendar(); renderDashboard(); } });
    }
    openChooser(`<i class="fa-solid fa-calendar-day"></i> ${formatDateLong(iso)}`, isWorkout(st.workout) ? st.workout.name : "Rest day", buildChoiceList(items));
  }

  // ============================================================
  // 17. RENDER: HISTORY
  // ============================================================
  function renderHistory() {
    const wrap = document.getElementById("fit-history-list");
    if (!FIT.sessions.length) { wrap.innerHTML = `<div class="fit-empty"><i class="fa-solid fa-clock-rotate-left"></i>No sessions logged yet — complete a workout to build your history.</div>`; return; }
    const sorted = [...FIT.sessions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    let lastMonth = "";
    wrap.innerHTML = "";
    sorted.forEach(s => {
      const monthLabel = new Date(s.date + "T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" });
      if (monthLabel !== lastMonth) { const h = document.createElement("div"); h.className = "fit-history-group-title"; h.textContent = monthLabel; wrap.appendChild(h); lastMonth = monthLabel; }
      const row = document.createElement("div");
      row.className = "fit-history-row";
      row.innerHTML = `
        <div class="fit-history-icon"><i class="fa-solid fa-dumbbell"></i></div>
        <div class="fit-history-main"><div class="name">${esc(s.workoutName)}</div><div class="meta">${formatDateLong(s.date)} · ${s.durationMin} min · ${s.setsCompleted}/${s.totalSets} sets</div></div>
        <div class="fit-history-pct">${s.completionPct}%</div>`;
      row.addEventListener("click", () => openSessionDetail(s));
      wrap.appendChild(row);
    });
  }
  function openSessionDetail(s) {
    const body = document.createElement("div");
    const summary = document.createElement("div");
    summary.className = "fit-summary-grid";
    summary.innerHTML = `
      <div class="fit-summary-tile"><div class="val">${s.durationMin}</div><div class="lbl">Minutes</div></div>
      <div class="fit-summary-tile"><div class="val">${s.results.length}</div><div class="lbl">Exercises</div></div>
      <div class="fit-summary-tile"><div class="val">${s.setsCompleted}/${s.totalSets}</div><div class="lbl">Sets completed</div></div>
      <div class="fit-summary-tile"><div class="val">${s.completionPct}%</div><div class="lbl">Completion</div></div>`;
    body.appendChild(summary);
    s.results.forEach(r => {
      // Same "was this set actually done" rule finishExecution() uses for the
      // aggregate count — recomputed per set here so each row (not just the
      // session-wide total) can show whether it was hit or missed.
      const setsDone = r.sets.map(set => set.plannedDurationSec != null
        ? (set.actualDurationSec !== "" && Number(set.actualDurationSec) > 0)
        : (set.actualReps !== "" && Number(set.actualReps) > 0));
      const doneCount = setsDone.filter(Boolean).length;

      const block = document.createElement("div");
      block.style.marginBottom = "1rem";
      block.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div style="font-weight:700;color:var(--text-main);">${esc(r.name)}</div>
        <div style="font-size:0.75rem;font-weight:700;padding:2px 8px;border-radius:99px;background:${doneCount === r.sets.length ? "var(--primary-soft)" : "var(--glass-highlight)"};color:${doneCount === r.sets.length ? "var(--primary)" : "var(--text-muted)"};">${doneCount}/${r.sets.length} sets</div>
      </div>`;
      r.sets.forEach((set, i) => {
        const planned = set.plannedDurationSec != null ? fmtSec(set.plannedDurationSec) : `${set.plannedReps ?? "—"} reps`;
        const actual = set.actualDurationSec !== "" && set.actualDurationSec != null ? fmtSec(Number(set.actualDurationSec)) : (set.actualReps !== "" ? `${set.actualReps} reps` : "—");
        const done = setsDone[i];
        const line = document.createElement("div");
        line.style.cssText = "display:flex;align-items:center;gap:10px;font-size:0.82rem;color:var(--text-muted);padding:5px 0;border-bottom:1px solid var(--glass-border);";
        line.innerHTML = `<i class="fa-solid ${done ? "fa-circle-check" : "fa-circle-minus"}" style="color:${done ? "var(--primary)" : "var(--text-dim)"};flex-shrink:0;"></i>
          <span style="flex:1;">Set ${set.setNumber} · planned ${esc(planned)}</span>
          <span style="color:${done ? "var(--text-main)" : "var(--text-dim)"};font-weight:600;">${done ? "actual " + esc(actual) : "skipped"}${done && set.actualWeight ? ` @ ${esc(String(set.actualWeight))}` : ""}</span>`;
        block.appendChild(line);
      });
      body.appendChild(block);
    });
    openDetail(`<i class="fa-solid fa-dumbbell"></i> ${esc(s.workoutName)}`, formatDateLong(s.date), body, true);
  }

  // ============================================================
  // 18. WORKOUT EXECUTION
  // ============================================================
  const execOverlay = wireOverlay("fit-exec-overlay", "fit-exec-close", async doClose => {
    if (FIT.exec && !FIT.exec.finished) {
      const ok = await customConfirm("End this workout now? Progress on this session will be lost.", { danger: true, confirmText: "End workout" });
      if (!ok) return;
    }
    doClose();
  });
  const execTitle = document.getElementById("fit-exec-title");
  const execSub = document.getElementById("fit-exec-sub");
  const execBody = document.getElementById("fit-exec-body");
  function closeExec() { clearExecTimer(); hideOverlay(execOverlay); FIT.exec = null; }

  // ----- Exec timers -----
  // Only one timer (a set's exercise timer, or the shared rest timer) runs
  // at a time app-wide during a workout. Starting a new one auto-pauses
  // whichever was already running — its progress is kept, just frozen,
  // exactly like pressing pause on it manually.
  let execTimer = null; // { key, intervalId, seconds, direction, display, startBtn, pauseBtn }

  function stopExecTimerInterval() {
    if (execTimer && execTimer.intervalId) {
      clearInterval(execTimer.intervalId);
      execTimer.intervalId = null;
      if (execTimer.startBtn && execTimer.pauseBtn) {
        execTimer.startBtn.disabled = false;
        execTimer.pauseBtn.disabled = true;
        execTimer.startBtn.classList.remove("running");
      }
    }
  }

  // Full teardown — called whenever the exec step's DOM is about to be
  // torn down (navigating exercises, finishing, or closing the workout)
  // so no interval keeps ticking against detached elements.
  function clearExecTimer() {
    stopExecTimerInterval();
    execTimer = null;
  }

  function startExecTimer({ key, direction, seconds, display, startBtn, pauseBtn, onTick, onDone }) {
    if (execTimer && execTimer.key !== key) stopExecTimerInterval(); // pause the previous timer, keep its value
    execTimer = { key, direction, seconds, display, startBtn, pauseBtn };
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    startBtn.classList.add("running");
    display.classList.remove("done");
    execTimer.intervalId = setInterval(() => {
      execTimer.seconds += direction === "down" ? -1 : 1;
      if (direction === "down" && execTimer.seconds <= 0) {
        execTimer.seconds = 0;
        display.textContent = fmtClock(0);
        display.classList.add("done");
        stopExecTimerInterval();
        if (onDone) onDone();
        return;
      }
      display.textContent = fmtClock(execTimer.seconds);
      if (onTick) onTick(execTimer.seconds);
    }, 1000);
  }

  function pauseExecTimer(key) {
    if (execTimer && execTimer.key === key) stopExecTimerInterval();
  }

  function resetExecTimer({ key, direction, targetSec, display, startBtn, pauseBtn, onTick }) {
    if (execTimer && execTimer.key === key) { stopExecTimerInterval(); execTimer = null; }
    const seconds = direction === "down" ? targetSec : 0;
    display.textContent = fmtClock(seconds);
    display.classList.remove("done");
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    startBtn.classList.remove("running");
    if (onTick) onTick(seconds);
  }

  // Wires start/pause/reset for a time-based set's own timer (counts up —
  // you might hold a plank longer or shorter than planned, so this tracks
  // actual time rather than cutting off at the target). Live-fills the
  // set's actual-duration input as it runs.
  function wireSetTimer(row, set, key) {
    const display = row.querySelector(".fit-set-timer-display");
    const startBtn = row.querySelector('[data-action="start"]');
    const pauseBtn = row.querySelector('[data-action="pause"]');
    const resetBtn = row.querySelector('[data-action="reset"]');
    const durInput = row.querySelector(".fit-actual-duration");
    if (!display || !startBtn) return;

    startBtn.addEventListener("click", () => {
      startExecTimer({
        key, direction: "up", seconds: execTimer && execTimer.key === key ? execTimer.seconds : (Number(durInput.value) || 0),
        display, startBtn, pauseBtn,
        onTick: (seconds) => { set.actualDurationSec = seconds; durInput.value = seconds; },
      });
    });
    pauseBtn.addEventListener("click", () => pauseExecTimer(key));
    resetBtn.addEventListener("click", () => {
      resetExecTimer({
        key, direction: "up", display, startBtn, pauseBtn,
        onTick: (seconds) => { set.actualDurationSec = seconds; durInput.value = seconds; },
      });
    });
  }

  // Wires the shared rest timer for the current exercise step — counts
  // down from entry.restSec, glows gold and stops cleanly at 0:00.
  function wireRestTimer(container, entry, key) {
    const display = container.querySelector(".fit-rest-timer-display");
    const startBtn = container.querySelector("#fit-rest-start");
    const pauseBtn = container.querySelector("#fit-rest-pause");
    const resetBtn = container.querySelector("#fit-rest-reset");
    if (!display || !startBtn) return;

    startBtn.addEventListener("click", () => {
      startExecTimer({
        key, direction: "down", seconds: execTimer && execTimer.key === key ? execTimer.seconds : entry.restSec,
        display, startBtn, pauseBtn,
      });
    });
    pauseBtn.addEventListener("click", () => pauseExecTimer(key));
    resetBtn.addEventListener("click", () => {
      resetExecTimer({ key, direction: "down", targetSec: entry.restSec, display, startBtn, pauseBtn });
    });
  }


  function beginExecution(workout, dateIso) {
    FIT.exec = {
      workout, date: dateIso, index: 0, startedAt: Date.now(), finished: false,
      results: workout.exercises.map(entry => ({
        exerciseId: entry.exerciseId, name: exerciseById(entry.exerciseId).name, entry,
        sets: Array.from({ length: entry.sets }, (_, i) => ({
          setNumber: i + 1, plannedReps: entry.reps != null ? entry.reps : null, plannedDurationSec: entry.durationSec != null ? entry.durationSec : null,
          actualReps: entry.reps != null ? entry.reps : "", actualDurationSec: entry.durationSec != null ? entry.durationSec : "", actualWeight: "",
        })),
      })),
    };
    showOverlay(execOverlay);
    renderExecStep();
  }

  function renderExecStep() {
    clearExecTimer(); // fresh step, fresh DOM — stop whatever was ticking from the last one
    const ex = FIT.exec;
    execTitle.innerHTML = `<i class="fa-solid fa-stopwatch"></i> ${esc(ex.workout.name)}`;
    execSub.textContent = `Exercise ${ex.index + 1} of ${ex.results.length}`;
    const cur = ex.results[ex.index];
    const exInfo = exerciseById(cur.exerciseId);
    const dots = ex.results.map((_, i) => `<div class="seg ${i < ex.index ? "done" : i === ex.index ? "current" : ""}"></div>`).join("");
    const setsHTML = cur.sets.map(set => {
      const isTime = set.plannedDurationSec != null;
      const targetText = isTime ? fmtSec(set.plannedDurationSec) : `${set.plannedReps ?? "—"} reps`;
      const timerHTML = isTime ? `
          <div class="fit-set-timer">
            <span class="fit-set-timer-display">${fmtClock(Number(set.actualDurationSec) || 0)}</span>
            <div class="fit-timer-controls">
              <button type="button" class="fit-timer-btn" data-action="start" title="Start"><i class="fa-solid fa-play"></i></button>
              <button type="button" class="fit-timer-btn" data-action="pause" title="Pause" disabled><i class="fa-solid fa-pause"></i></button>
              <button type="button" class="fit-timer-btn" data-action="reset" title="Reset"><i class="fa-solid fa-rotate-left"></i></button>
            </div>
          </div>` : "";
      return `<div class="fit-exec-set-row" data-set="${set.setNumber}">
          <div class="fit-exec-set-head"><span class="setlbl">Set ${set.setNumber}</span><span class="target">${esc(targetText)}</span></div>
          ${timerHTML}
          <div class="fit-exec-set-inputs">
            ${isTime ? `<input type="number" min="0" class="fit-actual-duration" value="${set.actualDurationSec}" placeholder="seconds" />` : `<input type="number" min="0" class="fit-actual-reps" value="${set.actualReps}" placeholder="reps" />`}
            <input type="number" min="0" step="any" class="fit-actual-weight" value="${set.actualWeight}" placeholder="weight (optional)" />
          </div>
        </div>`;
    }).join("");
    const restHTML = cur.entry.restSec ? `
      <div class="fit-rest-timer">
        <div class="fit-rest-timer-label"><i class="fa-solid fa-mug-hot"></i> Rest timer</div>
        <span class="fit-rest-timer-display">${fmtClock(cur.entry.restSec)}</span>
        <div class="fit-timer-controls">
          <button type="button" class="fit-timer-btn" id="fit-rest-start" title="Start"><i class="fa-solid fa-play"></i></button>
          <button type="button" class="fit-timer-btn" id="fit-rest-pause" title="Pause" disabled><i class="fa-solid fa-pause"></i></button>
          <button type="button" class="fit-timer-btn" id="fit-rest-reset" title="Reset"><i class="fa-solid fa-rotate-left"></i></button>
        </div>
      </div>` : "";
    execBody.innerHTML = `
      <div class="fit-exec-progress">${dots}</div>
      <div class="fit-exec-exname">${esc(exInfo.name)}${cur.entry.notes ? ` <span style="font-size:0.7rem;color:var(--text-muted);font-weight:600;">(${esc(cur.entry.notes)})</span>` : ""}</div>
      <div class="fit-exec-target">${cur.sets.length} sets · rest ${fmtSec(cur.entry.restSec || 0)} between sets</div>
      ${exInfo.instructions ? `<div class="fit-exec-instructions">${esc(exInfo.instructions)}</div>` : ""}
      <div class="fit-exec-sets">${setsHTML}</div>
      ${restHTML}
      <div class="fit-exec-nav">
        <button type="button" class="fit-btn-secondary" id="fit-exec-prev" ${ex.index === 0 ? "disabled" : ""}><i class="fa-solid fa-arrow-left"></i> Previous</button>
        <button type="button" class="btn-primary" id="fit-exec-next">${ex.index === ex.results.length - 1 ? "Finish workout" : "Next exercise"} <i class="fa-solid fa-arrow-right"></i></button>
      </div>`;
    execBody.querySelectorAll(".fit-exec-set-row").forEach(row => {
      const num = Number(row.dataset.set);
      const set = cur.sets.find(s => s.setNumber === num);
      const repsInput = row.querySelector(".fit-actual-reps");
      const durInput = row.querySelector(".fit-actual-duration");
      const wInput = row.querySelector(".fit-actual-weight");
      if (repsInput) repsInput.addEventListener("input", () => { set.actualReps = repsInput.value; });
      if (durInput) durInput.addEventListener("input", () => { set.actualDurationSec = durInput.value; });
      wInput.addEventListener("input", () => { set.actualWeight = wInput.value; });
      if (set.plannedDurationSec != null) wireSetTimer(row, set, `set-${ex.index}-${set.setNumber}`);
    });
    if (cur.entry.restSec) wireRestTimer(execBody, cur.entry, `rest-${ex.index}`);
    const prevBtn = execBody.querySelector("#fit-exec-prev");
    if (ex.index > 0) prevBtn.addEventListener("click", () => { ex.index--; renderExecStep(); });
    execBody.querySelector("#fit-exec-next").addEventListener("click", () => { if (ex.index < ex.results.length - 1) { ex.index++; renderExecStep(); } else finishExecution(); });
  }

  async function finishExecution() {
    clearExecTimer();
    const ex = FIT.exec;
    ex.finished = true;
    const durationMin = Math.max(1, Math.round((Date.now() - ex.startedAt) / 60000));
    let totalSets = 0, setsCompleted = 0;
    ex.results.forEach(r => r.sets.forEach(s => {
      totalSets++;
      const done = s.plannedDurationSec != null ? (s.actualDurationSec !== "" && Number(s.actualDurationSec) > 0) : (s.actualReps !== "" && Number(s.actualReps) > 0);
      if (done) setsCompleted++;
    }));
    const completionPct = totalSets ? Math.round((setsCompleted / totalSets) * 100) : 0;
    const session = {
      id: uid(), date: ex.date, workoutId: ex.workout.id, workoutName: ex.workout.name,
      results: ex.results.map(r => ({ exerciseId: r.exerciseId, name: r.name, sets: r.sets })),
      durationMin, setsCompleted, totalSets, completionPct, createdAt: Date.now(),
    };
    execTitle.innerHTML = `<i class="fa-solid fa-circle-check"></i> Workout Complete`;
    execSub.textContent = ex.workout.name;
    execBody.innerHTML = `
      <div class="fit-summary-grid">
        <div class="fit-summary-tile"><div class="val">${durationMin}</div><div class="lbl">Duration (min)</div></div>
        <div class="fit-summary-tile"><div class="val">${ex.results.length}</div><div class="lbl">Exercises</div></div>
        <div class="fit-summary-tile"><div class="val">${setsCompleted}/${totalSets}</div><div class="lbl">Sets completed</div></div>
        <div class="fit-summary-tile"><div class="val">${completionPct}%</div><div class="lbl">Completion</div></div>
      </div>
      <div class="fit-form-actions"><button type="button" class="btn-primary" id="fit-exec-save" style="width:100%;justify-content:center;"><i class="fa-solid fa-check"></i> Save to history</button></div>`;
    execBody.querySelector("#fit-exec-save").addEventListener("click", async () => {
      FIT.sessions.push(session);
      FIT.dayLog[ex.date] = { status: "completed", sessionId: session.id, workout: { id: ex.workout.id, name: ex.workout.name } };
      await Promise.all([saveSessions(), saveDayLog(), markConsistencyCheck(ex.date)]);
      closeExec();
      renderDashboard(); renderHistory(); renderCalendar();
      await maybeUpdateLinkedGoals();
    });
  }

  // Workout → Consistency (spec §11): a completed workout also counts as
  // a "check" on the general Consistency page for that date, so the app's
  // one streak/heatmap reflects fitness execution too — same
  // "consistency_tracker_data" key consistency.js reads/writes, no
  // separate fitness-only streak system.
  async function markConsistencyCheck(iso) {
    const year = iso.slice(0, 4);
    const data = await cloudGet("consistency_tracker_data", {});
    if (!data[year]) data[year] = {};
    if (data[year][iso] !== "check") {
      data[year][iso] = "check";
      await cloudSet("consistency_tracker_data", data);
    }
  }

  async function maybeUpdateLinkedGoals() {
    const plan = getActivePlan();
    if (!plan) return;
    const linked = FIT.goals.filter(g => g.planId === plan.id);
    for (const g of linked) {
      const wants = await customConfirm(`Update progress for the goal "${g.title}"?`, { confirmText: "Update" });
      if (!wants) continue;
      const val = await customPrompt(`New current value for "${g.title}" (${g.unit || ""}):`, { defaultValue: String(g.current) });
      if (val == null) continue;
      const num = parseFloat(val);
      if (isNaN(num)) continue;
      g.current = Math.max(0, num);
    }
    if (linked.length) { await saveGoals(); renderGoals(); renderDashboard(); }
  }

  // ============================================================
  // 19. TABS + CHROME
  // ============================================================
  function initTabs() {
    document.querySelectorAll(".fit-tab").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.panel)));
    document.querySelectorAll("[data-goto]").forEach(btn => btn.addEventListener("click", () => switchTab(btn.dataset.goto)));
  }
  function switchTab(name) {
    document.querySelectorAll(".fit-tab").forEach(b => b.classList.toggle("active", b.dataset.panel === name));
    document.querySelectorAll(".fit-panel").forEach(p => { p.hidden = p.id !== `panel-${name}`; });
  }
  function initChrome() {
    const burger = document.getElementById("burger"), sidebar = document.getElementById("sidebar"), overlay = document.getElementById("overlay");
    if (burger && sidebar && overlay) {
      const toggle = () => { sidebar.classList.toggle("open"); overlay.classList.toggle("active"); };
      burger.addEventListener("click", toggle);
      burger.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
      overlay.addEventListener("click", () => { sidebar.classList.remove("open"); overlay.classList.remove("active"); });
    }
    const dateEl = document.getElementById("dash-date");
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }

  // "Your routine" mobile collapse — same pattern as Tracker's Habit
  // Insights toggle: hidden on desktop (section is small enough there),
  // starts collapsed on phones since 7 day cards is a lot of scroll.
  function initRoutineToggle() {
    const wrap = document.getElementById("fit-dash-plan-wrap");
    const toggle = document.getElementById("fit-routine-toggle");
    if (!wrap || !toggle) return;
    if (window.innerWidth <= 599) { wrap.classList.add("collapsed"); toggle.classList.add("collapsed"); toggle.setAttribute("aria-expanded", "false"); }
    toggle.addEventListener("click", () => {
      const collapsed = wrap.classList.toggle("collapsed");
      toggle.classList.toggle("collapsed", collapsed);
      toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
    });
  }

  // ============================================================
  // 20. INIT
  // ============================================================
  document.addEventListener("DOMContentLoaded", async () => {
    initChrome();
    initTabs();
    initRoutineToggle();

    await requireAuth();

    const signedIn = await isSignedIn();
    if (!signedIn) {
      document.getElementById("fit-gate").classList.add("show");
      document.getElementById("fit-app").style.display = "none";
      document.getElementById("fit-gate-upgrade").addEventListener("click", () => { window.location.href = "upgrade.html"; });
      return;
    }

    document.getElementById("fit-app").style.display = "";
    await loadAll();
    populateMuscleFilter();
    populateExerciseDatalist();
    renderDashboard();
    renderGoals();
    renderPlans();
    renderExercises();
    renderCalendar();
    renderHistory();
  });
})();