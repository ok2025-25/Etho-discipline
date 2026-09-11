/* ============================================================
   ETHO — Authentification (Supabase Auth)
   ------------------------------------------------------------
   À inclure sur TOUTES les pages, dans cet ordre exact :

     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
     <script src="auth.js"></script>

   Sur les pages PROTÉGÉES (home, checklist, goals, tracker,
   learning), ajoute juste après <head> :

     <script>document.documentElement.style.visibility = "hidden";</script>

   ...et en bas de page, dans le DOMContentLoaded du script de la
   page, appelle `await requireAuth()` avant de charger les données.
   Voir AUTH_SETUP.md pour le détail page par page.
   ============================================================ */

// 1) CONFIGURATION — à remplacer par tes vraies valeurs
//    (Supabase Dashboard > Project Settings > API)
const SUPABASE_URL = "https://ofotfuviywweutqawxpq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mb3RmdXZpeXd3ZXV0cWF3eHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1ODQwMjcsImV4cCI6MjEwMTE2MDAyN30.1pxrEooDQPJMfaOlVHGViOSmX3InRHv9jprlYR1DVN8";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Page de connexion et page d'accueil post-login
const LOGIN_PAGE = "login.html";
const APP_HOME = "home.html";
const UPGRADE_PAGE = "upgrade.html";
const THEME_KEY = "ethoTheme"; // 'dark' | 'light' — available to every plan, light is the default

// Cached for the lifetime of the page load so we don't re-check on
// every isSignedIn() call. Cleared naturally on navigation/reload.
let _cachedPlan = null; // 'guest' | 'account' (signed in)

// ------------------------------------------------------------
// Inscription email + mot de passe
// ------------------------------------------------------------
async function signUpWithEmail(email, password, fullName) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName || "" }
    }
  });
  if (error) throw error;
  return data;
}

// ------------------------------------------------------------
// Connexion email + mot de passe
// ------------------------------------------------------------
async function signInWithEmail(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// ------------------------------------------------------------
// Mettre à jour le nom complet de l'utilisateur (page profil)
// ------------------------------------------------------------
async function updateUserFullName(newName) {
  const { data, error } = await supabaseClient.auth.updateUser({
    data: { full_name: newName }
  });
  if (error) throw error;
  return data;
}

// ------------------------------------------------------------
// Upload / change the user's profile picture.
// Stores the file in the "avatars" Storage bucket under the
// user's own folder (avatars/<uid>/<timestamp>-filename), then
// saves the public URL on the user's metadata so it shows up
// everywhere (navbar, profile page) on every device.
//
// Requires a public "avatars" bucket in the Supabase project
// (Storage > New bucket > Public bucket), with a policy allowing
// authenticated users to insert/update objects in their own
// "<uid>/..." folder.
// ------------------------------------------------------------
async function uploadUserAvatar(file) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in.");

  const ext = file.name.split(".").pop();
  const path = `${user.id}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabaseClient
    .storage
    .from("avatars")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabaseClient
    .storage
    .from("avatars")
    .getPublicUrl(path);

  const { data, error } = await supabaseClient.auth.updateUser({
    data: { avatar_url: publicUrl }
  });
  if (error) throw error;

  return data; // data.user.user_metadata.avatar_url is the new URL
}

// ------------------------------------------------------------
// Mot de passe oublié — envoie un lien de récupération par email
// ------------------------------------------------------------
async function sendPasswordReset(email) {
  const redirectTo = new URL("reset-password.html", window.location.href).href;
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

// ------------------------------------------------------------
// Déconnexion
// ------------------------------------------------------------
async function signOutUser() {
  // Wipe the local cache before redirecting — closes the gap where a
  // second account signing in on the same device could otherwise see
  // this account's cached data for a moment (or offline, indefinitely).
  // Cloud-synced data is untouched; it's still safe in Supabase and
  // will re-download on the next login. This also means a signed-out
  // user starts a fresh guest session with empty local data — that's
  // fine, guest data was already offered to be claimed at sign-in.
  localStorage.clear();
  await supabaseClient.auth.signOut();
  window.location.href = APP_HOME; // guest mode, not login.html — there's nothing to force
}

// ------------------------------------------------------------
// Récupérer l'utilisateur courant (ou null)
// ------------------------------------------------------------
async function getCurrentUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
}

// ------------------------------------------------------------
// PLAN / ACCOUNT STATUS
// ------------------------------------------------------------
// There's no paid tier — plan is just "account" (signed in) or
// "guest" (signed out). Every isSignedIn()/data-account-feature/
// applyAccountLocks() call site reads this value; keeping "account"/
// "guest" here (instead of "pro"/"free") means a real paid tier can
// be introduced later as its own value without renaming anything.
async function getUserPlan() {
  if (_cachedPlan) return _cachedPlan;
  const user = await getCurrentUser();
  _cachedPlan = user ? "account" : "guest";
  return _cachedPlan;
}

async function isSignedIn() {
  return (await getUserPlan()) === "account";
}

// Synchronous version for UI code that can't await (e.g. building a
// popup inline in a click handler). Relies on _cachedPlan already
// being populated by requireAuth() on page load, which is always the
// case by the time a user can interact with the page.
function isSignedInSync() {
  return _cachedPlan === "account";
}

// ------------------------------------------------------------
// THEME (every plan)
// ------------------------------------------------------------
// Light is the default, main theme — it's just styles.css's :root, so
// the "no attribute" state already renders it. Dark is the opt-in
// alternate, applied via data-theme="dark". Guests and signed-in users get the
// exact same toggle; nothing here is plan-gated.
function setThemeAttribute(theme) {
  if (theme === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

// Applies instantly from the local cache (no network wait, so no
// flash-of-wrong-theme), then quietly reconciles with the cloud copy
// in case the preference changed on another device.
function applyStoredTheme(plan) {
  let cachedTheme = "light";
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw) cachedTheme = JSON.parse(raw);
  } catch (e) { /* ignore, default to light */ }

  setThemeAttribute(cachedTheme === "dark" ? "dark" : "light");

  cloudGet(THEME_KEY, "light").then(remote => {
    setThemeAttribute(remote === "dark" ? "dark" : "light");
  }).catch(() => { /* cloudGet already falls back internally */ });
}

async function toggleTheme(btnEl) {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const next = isDark ? "light" : "dark";

  setThemeAttribute(next);
  cloudSet(THEME_KEY, next);

  if (btnEl) {
    btnEl.innerHTML = `<i class="fa-solid ${next === "light" ? "fa-sun" : "fa-moon"}"></i>`;
  }
}

// ------------------------------------------------------------
// DAILY STRIP (account only)
// ------------------------------------------------------------
// Small quote-of-the-day + "next page" bar, auto-injected at the top
// of <main> on every protected page for signed-in users only — this is
// what makes it site-wide without editing every page's HTML.
const DAILY_STRIP_QUOTES = [
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { text: "We are what we repeatedly do. Excellence is not an act, but a habit.", author: "Will Durant" },
  { text: "Whether you think you can, or you think you can't — you're right.", author: "Henry Ford" },
  { text: "Until we can manage time, we can manage nothing else.", author: "Peter Drucker" },
  { text: "The successful warrior is the average man with laser-like focus.", author: "Bruce Lee" },
  { text: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
  { text: "Do the best you can until you know better. Then when you know better, do better.", author: "Maya Angelou" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },

  { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
  { text: "Small disciplines repeated with consistency every day lead to great achievements.", author: "John C. Maxwell" },
  { text: "You will never change your life until you change something you do daily.", author: "John C. Maxwell" },
  { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { text: "Well done is better than well said.", author: "Benjamin Franklin" },
  { text: "Lost time is never found again.", author: "Benjamin Franklin" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },

  { text: "Do not wait to strike till the iron is hot, but make it hot by striking.", author: "William Butler Yeats" },
  { text: "Nothing will work unless you do.", author: "Maya Angelou" },
  { text: "What we fear doing most is usually what we most need to do.", author: "Tim Ferriss" },
  { text: "Dream big and dare to fail.", author: "Norman Vaughan" },
  { text: "The pain you feel today will be the strength you feel tomorrow.", author: "Unknown" },
  { text: "Motivation gets you going, but discipline keeps you growing.", author: "John C. Maxwell" },
  { text: "Energy and persistence conquer all things.", author: "Benjamin Franklin" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle (attributed)" },
  { text: "If you're going through hell, keep going.", author: "Winston Churchill" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },

  { text: "You become what you think about.", author: "Earl Nightingale" },
  { text: "Start where you are. Use what you have. Do what you can.", author: "Arthur Ashe" },
  { text: "Great things are done by a series of small things brought together.", author: "Vincent van Gogh" },
  { text: "Without continual growth and progress, such words as improvement, achievement, and success have no meaning.", author: "Benjamin Franklin" },
  { text: "The man who moves a mountain begins by carrying away small stones.", author: "Confucius" },
  { text: "Never confuse movement with action.", author: "Ernest Hemingway" },
  { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "Make each day your masterpiece.", author: "John Wooden" },
  { text: "If you spend too much time thinking about a thing, you'll never get it done.", author: "Bruce Lee" },

  { text: "A year from now you may wish you had started today.", author: "Karen Lamb" },
  { text: "Do one thing every day that scares you.", author: "Eleanor Roosevelt" },
  { text: "Fall seven times and stand up eight.", author: "Japanese Proverb" },
  { text: "The harder you work for something, the greater you'll feel when you achieve it.", author: "Unknown" },
  { text: "Success usually comes to those who are too busy to be looking for it.", author: "Henry David Thoreau" },
  { text: "The difference between ordinary and extraordinary is that little extra.", author: "Jimmy Johnson" },
  { text: "Discipline equals freedom.", author: "Jocko Willink" },
  { text: "Suffer the pain of discipline or suffer the pain of regret.", author: "Jim Rohn" },
  { text: "Hard choices, easy life. Easy choices, hard life.", author: "Jerzy Gregorek" },
  { text: "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.", author: "Stephen King" },

  { text: "Your future is created by what you do today, not tomorrow.", author: "Robert Kiyosaki" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "Don't count the days, make the days count.", author: "Muhammad Ali" },
  { text: "Strength does not come from physical capacity. It comes from an indomitable will.", author: "Mahatma Gandhi" },
  { text: "The journey of a thousand miles begins with one step.", author: "Lao Tzu" },
  { text: "Success is walking from failure to failure with no loss of enthusiasm.", author: "Winston Churchill" },
  { text: "If opportunity doesn't knock, build a door.", author: "Milton Berle" },
  { text: "Don't wish it were easier. Wish you were better.", author: "Jim Rohn" },
  { text: "Every accomplishment starts with the decision to try.", author: "John F. Kennedy (attributed)" },
  { text: "You are what you do, not what you say you'll do.", author: "Carl Jung (attributed)" }
];

function injectDailyStrip(plan) {
  const existing = document.getElementById("etho-daily-strip");
  if (existing) existing.remove();

  if (plan !== "account") return; // guests don't get the strip
  const main = document.querySelector("main");
  if (!main) return; // page has no <main> (e.g. login/upgrade) — skip gracefully

  const dayIndex = Math.floor(Date.now() / 86400000) % DAILY_STRIP_QUOTES.length;
  let currentQuoteIndex = dayIndex;

  const strip = document.createElement("div");
  strip.id = "etho-daily-strip";
  strip.innerHTML = `
    <div class="etho-strip-quote">
      <i class="fa-solid fa-quote-left"></i>
      <span id="etho-strip-quote-text"></span>
    </div>
    <button type="button" class="etho-strip-next">
      Next quote <i class="fa-solid fa-shuffle"></i>
    </button>
  `;

  const textEl = strip.querySelector("#etho-strip-quote-text");
  function renderStripQuote() {
    const q = DAILY_STRIP_QUOTES[currentQuoteIndex];
    textEl.innerHTML = `"${q.text}" <em>— ${q.author}</em>`;
  }
  renderStripQuote();

  strip.querySelector(".etho-strip-next").addEventListener("click", () => {
    // pick a different quote than the one currently shown
    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * DAILY_STRIP_QUOTES.length);
    } while (nextIndex === currentQuoteIndex && DAILY_STRIP_QUOTES.length > 1);
    currentQuoteIndex = nextIndex;
    renderStripQuote();
  });

  main.insertBefore(strip, main.firstChild);
}

// ------------------------------------------------------------
// GUEST → ACCOUNT DATA MIGRATION
// ------------------------------------------------------------
// A guest's checklist/goals/habits/notes/theme all live under plain,
// unscoped localStorage keys (see cloud-sync.js's guest path). Once
// they sign in, every page reads/writes a per-account key instead —
// without this, that guest data would just look like it vanished.
// Call this once, right after a successful sign-in/sign-up, before
// redirecting away from login.html. Requires cloud-sync.js to be
// loaded on the page that calls it (for cloudSet).
async function migrateGuestDataToAccount(user) {
  if (!user || typeof cloudSet !== "function") return;

  // Skip Supabase's own session keys ("sb-...") and anything already
  // scoped to an account ("u_<id>::...") — neither is guest app data.
  const keysToMigrate = Object.keys(localStorage).filter(
    k => !k.startsWith("sb-") && !k.startsWith("u_")
  );

  for (const key of keysToMigrate) {
    try {
      // Only migrate onto a key this account has never touched — if
      // they've signed into this account before (another device), a
      // real cloud row already exists and this device's guest data
      // (which could just be leftover from browsing as a guest
      // afterward) should never clobber it.
      const { data } = await supabaseClient
        .from("user_data")
        .select("key")
        .eq("user_id", user.id)
        .eq("key", key)
        .maybeSingle();
      if (data) continue;

      const raw = localStorage.getItem(key);
      let value;
      try {
        value = JSON.parse(raw);
      } catch (_) {
        continue; // not JSON — not one of ours, skip it
      }
      await cloudSet(key, value);
    } catch (err) {
      console.warn(`Couldn't migrate guest key "${key}" to account`, err);
    }
  }
}

// ------------------------------------------------------------
// PAGE GUARD
// Call at the start of every page's script. Used to redirect
// guests to login.html — it no longer does that. Every page now
// renders for guests too (local-only data); it just resolves the
// session (revalidating with Supabase rather than trusting a
// possibly-stale cached one), sets up the plan/navbar/locks for
// whichever case applies, and reveals the page. Returns the real
// user object when signed in, or null for a guest — null is NOT
// an error condition anymore, so callers should keep rendering,
// not bail out.
// ------------------------------------------------------------
async function requireAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  let user = null;
  if (session) {
    // getSession() reads the token cached on THIS device and can be
    // stale — e.g. if the name/avatar changed on another device or
    // tab, this device won't see it until its token happens to
    // refresh. getUser() revalidates with Supabase, so every device
    // reflects the latest profile on next load.
    const { data, error } = await supabaseClient.auth.getUser();
    if (!error && data.user) user = data.user;
  }

  // Set the plan cache directly from what we just resolved above,
  // instead of calling getUserPlan() (which would just re-derive the
  // same thing from another getCurrentUser() call).
  _cachedPlan = user ? "account" : "guest";
  const plan = _cachedPlan;

  applyStoredTheme(plan);
  updateNavbarUser(user, plan);
  applyAccountLocks(plan);
  injectDailyStrip(plan);

  document.documentElement.style.visibility = "visible";

  return user;
}

// ------------------------------------------------------------
// Affiche le nom (ou email) de l'utilisateur dans la navbar,
// et transforme .username en lien cliquable vers profile.html.
// Nécessite un élément .username dans la navbar (comme dans
// tes pages actuelles).
// ------------------------------------------------------------
function updateNavbarUser(user, plan) {
  const usernameEl = document.querySelector(".username");
  if (!usernameEl) return;

  usernameEl.innerHTML = "";
  usernameEl.style.cursor = "pointer";

  if (user) {
    const label = user.user_metadata?.full_name || user.email;
    const avatarUrl = user.user_metadata?.avatar_url;

    usernameEl.title = "View profile";

    if (avatarUrl) {
      const img = document.createElement("img");
      img.src = avatarUrl;
      img.alt = "";
      img.className = "navbar-avatar";
      usernameEl.appendChild(img);
    } else {
      const icon = document.createElement("i");
      icon.className = "fa-regular fa-circle-user";
      usernameEl.appendChild(icon);
    }

    usernameEl.append(document.createTextNode(" " + label));
    usernameEl.onclick = () => { window.location.href = "profile.html"; };
  } else {
    // Guest — no account page to link to, so the navbar spot just
    // points at login.html instead.
    const icon = document.createElement("i");
    icon.className = "fa-regular fa-circle-user";
    usernameEl.appendChild(icon);
    usernameEl.append(document.createTextNode(" Guest"));
    usernameEl.title = "Sign in";
    usernameEl.onclick = () => { window.location.href = LOGIN_PAGE; };
  }

  // Plan badge — the page's own gold .account-pill in the navbar already
  // signals a signed-in account, so this spot is only needed for the
  // guest "sign in for more" nudge now (avoids showing two indicators
  // at once for signed-in users).
  const existingBadge = document.querySelector(".navbar-plan-badge");
  if (existingBadge) existingBadge.remove();

  injectEthoAccountStyles();

  let anchorEl = usernameEl;
  if (plan !== "account") {
    const badge = document.createElement("button");
    badge.className = "navbar-plan-badge is-guest";
    badge.innerHTML = `<i class="fa-solid fa-crown"></i> Sign in`;
    badge.onclick = () => showSignInModal();
    usernameEl.insertAdjacentElement("afterend", badge);
    anchorEl = badge;
  }

  // Theme toggle — available to every plan.
  const existingThemeBtn = document.querySelector(".navbar-theme-toggle");
  if (existingThemeBtn) existingThemeBtn.remove();

  const isLight = document.documentElement.getAttribute("data-theme") !== "dark";
  const themeBtn = document.createElement("button");
  themeBtn.type = "button";
  themeBtn.className = "navbar-theme-toggle";
  themeBtn.title = "Switch theme";
  themeBtn.innerHTML = `<i class="fa-solid ${isLight ? "fa-sun" : "fa-moon"}"></i>`;
  themeBtn.addEventListener("click", () => toggleTheme(themeBtn));

  anchorEl.insertAdjacentElement("afterend", themeBtn);
}

// ------------------------------------------------------------
// ACCOUNT FEATURE GATING
// ------------------------------------------------------------
// Mark any element with data-account-feature (on any page) and this
// will lock it for guests and unlock it for signed-in users —
// no per-page logic needed. Example:
//   <button data-account-feature>Export to PDF</button>
// Locked elements get dimmed + a lock icon, and clicking them opens
// the sign-in prompt instead of firing their normal click handler.
function applyAccountLocks(plan) {
  injectEthoAccountStyles();

  document.querySelectorAll("[data-account-feature]").forEach(el => {
    el.removeEventListener("click", handleLockedClick, true);

    if (plan === "account") {
      el.classList.remove("account-locked");
    } else {
      el.classList.add("account-locked");
      el.addEventListener("click", handleLockedClick, true);
    }
  });
}

function handleLockedClick(e) {
  e.preventDefault();
  e.stopPropagation();
  // Walk up to the actual [data-account-feature] element (the click can land
  // on a child), so a locked element can carry its own contextual copy:
  //   <div data-account-feature data-account-label="Etho Score"
  //        data-account-copy="See one live number for your whole day.">
  // Falls back to the generic message when neither is set.
  const source = e.target.closest ? e.target.closest("[data-account-feature]") : null;
  showSignInModal(source?.dataset?.accountLabel, source?.dataset?.accountCopy);
}

function showSignInModal(label, copy) {
  if (document.getElementById("etho-signin-modal")) return;

  const title = label ? `Unlock ${label}` : "Want more of Etho?";
  const body = copy || "Sign in — it's free — to unlock this and everything else that comes with an account.";

  const overlay = document.createElement("div");
  overlay.id = "etho-signin-modal";
  overlay.className = "etho-signin-overlay";
  overlay.innerHTML = `
    <div class="etho-signin-box">
      <i class="fa-solid fa-crown"></i>
      <h3>${title}</h3>
      <p>${body}</p>
      <div class="etho-signin-actions">
        <button type="button" class="etho-signin-close">Not now</button>
        <button type="button" class="etho-signin-cta">Sign in</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector(".etho-signin-close").onclick = () => overlay.remove();
  overlay.querySelector(".etho-signin-cta").onclick = () => {
    window.location.href = LOGIN_PAGE;
  };
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

function injectEthoAccountStyles() {
  if (document.getElementById("etho-account-styles")) return;

  const style = document.createElement("style");
  style.id = "etho-account-styles";
  style.textContent = `
    /* .username has display:flex, which is block-level — without this,
       anything inserted next to it drops to a new line and spills out
       of the fixed-height navbar instead of sitting side by side. */
    .navbar-right {
      display: flex;
      align-items: center;
      gap: var(--space-sm, 12px);
    }

    .navbar-plan-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      border: 1px solid transparent;
      font-family: inherit;
    }
    .navbar-plan-badge.is-guest {
      background: var(--glass-highlight);
      border-color: var(--glass-border);
      color: var(--text-muted);
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: var(--transition-fast);
    }
    .navbar-plan-badge.is-guest i {
      color: var(--accent);
      animation: ethoBadgePulse 2.4s ease-in-out infinite;
    }
    .navbar-plan-badge.is-guest:hover {
      background: var(--primary-soft);
      border-color: var(--primary);
      color: var(--text-main);
      transform: translateY(-1px);
      box-shadow: 0 4px 16px var(--primary-glow);
    }
    @keyframes ethoBadgePulse {
      0%, 100% { text-shadow: 0 0 0 rgba(255,68,68,0); }
      50% { text-shadow: 0 0 8px var(--accent-glow); }
    }

    .navbar-theme-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--glass-highlight);
      border: 1px solid var(--glass-border);
      color: var(--text-muted);
      font-size: 0.85rem;
      cursor: pointer;
      transition: var(--transition-fast);
    }
    .navbar-theme-toggle:hover {
      color: var(--text-main);
      background: var(--primary-soft);
      border-color: var(--primary);
      transform: translateY(-1px) rotate(15deg);
    }

    /* Locked account-only elements read as a teaser, not a dead end:
       content stays legible (light grayscale, no heavy opacity drop)
       and hovering lifts a gold ribbon + glow so it feels like
       something worth unlocking rather than an error state. */
    [data-account-feature].account-locked {
      position: relative;
      cursor: pointer;
      filter: grayscale(0.35);
      transition: transform 0.25s var(--bounce, ease), box-shadow 0.25s ease, filter 0.25s ease;
      border-radius: var(--radius-md, 12px);
    }
    [data-account-feature].account-locked > * {
      opacity: 0.62;
    }
    [data-account-feature].account-locked:hover {
      filter: grayscale(0.15);
      transform: translateY(-1px);
      box-shadow: 0 8px 24px var(--gold-glow, rgba(255, 196, 82, 0.25));
    }
    [data-account-feature].account-locked:hover > * {
      opacity: 0.8;
    }
    [data-account-feature].account-locked::after {
      content: "\\f521";
      font-family: "Font Awesome 6 Free";
      font-weight: 900;
      position: absolute;
      top: -7px;
      right: -7px;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.65rem;
      color: #1a1206;
      background: linear-gradient(135deg, var(--gold-text, #ffd47a), var(--gold, #e8a52e));
      border-radius: 50%;
      box-shadow: 0 2px 10px var(--gold-glow, rgba(255, 196, 82, 0.45));
      z-index: 2;
      pointer-events: none;
    }
    [data-account-feature].account-locked:hover::after {
      animation: ethoLockPulse 0.6s ease;
    }
    @keyframes ethoLockPulse {
      0% { transform: scale(1); }
      40% { transform: scale(1.18); }
      100% { transform: scale(1); }
    }

    .etho-signin-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.65);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }
    .etho-signin-box {
      background: var(--glass-surface, #140505);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      padding: 2rem;
      max-width: 320px;
      text-align: center;
      color: var(--text-main);
      box-shadow: var(--glass-shadow);
    }
    .etho-signin-box i {
      font-size: 1.8rem;
      color: #ffd47a;
      margin-bottom: 0.75rem;
      display: inline-block;
      filter: drop-shadow(0 0 10px var(--primary-glow));
    }
    .etho-signin-box h3 { margin: 0 0 0.5rem; font-size: 1.1rem; }
    .etho-signin-box p { margin: 0 0 1.25rem; font-size: 0.85rem; color: var(--text-muted); }
    .etho-signin-actions { display: flex; gap: 10px; justify-content: center; }
    .etho-signin-actions button {
      border: none;
      border-radius: var(--radius-sm);
      padding: 0.55rem 1.1rem;
      font-size: 0.85rem;
      cursor: pointer;
      font-family: inherit;
      transition: var(--transition-fast);
    }
    .etho-signin-close {
      background: var(--glass-highlight);
      color: var(--text-muted);
      border: 1px solid var(--glass-border) !important;
    }
    .etho-signin-close:hover { color: var(--text-main); }
    .etho-signin-cta {
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: #fff;
      font-weight: 600;
      box-shadow: 0 4px 16px var(--primary-glow);
    }
    .etho-signin-cta:hover { transform: translateY(-1px); }

    #etho-daily-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-md);
      flex-wrap: wrap;
      background: var(--glass-highlight);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      padding: 0.85rem 1.3rem;
      margin-bottom: var(--space-xl);
    }
    .etho-strip-quote {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.85rem;
      color: var(--text-muted);
      min-width: 0;
    }
    .etho-strip-quote i {
      color: var(--accent);
      opacity: 0.7;
      flex-shrink: 0;
    }
    .etho-strip-quote span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .etho-strip-quote em {
      font-style: normal;
      color: var(--text-dim);
    }
    .etho-strip-next {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: transparent;
      border: 1px solid var(--glass-border);
      color: var(--text-main);
      font-family: inherit;
      font-size: 0.8rem;
      font-weight: 600;
      padding: 0.5rem 1rem;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: var(--transition-fast);
      white-space: nowrap;
      flex-shrink: 0;
    }
    .etho-strip-next:hover {
      background: var(--primary-soft);
      border-color: var(--primary);
      transform: translateX(2px);
    }
    @media (max-width: 640px) {
      .etho-strip-quote span { white-space: normal; }
    }
  `;
  document.head.appendChild(style);
}

// ------------------------------------------------------------
// Listens for session changes: if the user gets signed out (token
// expired, signed out from another tab, etc.), drop back to guest
// mode on the home page instead of forcing the login screen —
// being signed out isn't an error state anymore.
// ------------------------------------------------------------
supabaseClient.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") {
    window.location.href = APP_HOME;
  }
});