// ========== CONFIGURATION SUPABASE ==========
// ⚠️ REMPLACEZ CES VALEURS PAR LES VÔTRES
const SUPABASE_URL = 'https://lvptwkknzvrocbvktdvg.supabase.co'; // Ex: https://xxxxx.supabase.co
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2cHR3a2tuenZyb2Nidmt0ZHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4Nzc1NDQsImV4cCI6MjA3OTQ1MzU0NH0.TUOXAMw6USeZdYf_WSPyK_sdDSkKFvaeJqWqUu-nTFs'; // La clé anon key

// Initialiser Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Vérifier/créer le bucket d'avatars au premier chargement
async function ensureAvatarsBucket() {
    try {
        const { data: buckets } = await supabase.storage.listBuckets();
        const avatarBucket = buckets?.find(b => b.name === 'avatars');
        
        if (!avatarBucket) {
            await supabase.storage.createBucket('avatars', {
                public: true,
                fileSizeLimit: 2097152 // 2MB
            });
        }
    } catch (error) {
        console.log('Avatar bucket check:', error.message);
    }
}

// Appeler au chargement
ensureAvatarsBucket();

// ========== ÉLÉMENTS DOM ==========
const form = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const usernameInput = document.getElementById('username');
const usernameGroup = document.getElementById('username-group');
const submitBtn = document.getElementById('submit-btn');
const toggleLink = document.getElementById('toggle-link');
const toggleText = document.getElementById('toggle-text');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const messageDiv = document.getElementById('message');

// ========== STATE ==========
let isSignUp = false;

// ========== VÉRIFIER SI DÉJÀ CONNECTÉ ==========
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        // L'utilisateur est déjà connecté, rediriger vers home
        window.location.href = 'home.html';
    }
});

// ========== TOGGLE SIGN IN / SIGN UP ==========
toggleLink.addEventListener('click', (e) => {
    e.preventDefault();
    isSignUp = !isSignUp;
    
    if (isSignUp) {
        // Mode Inscription
        authTitle.textContent = 'Create Account';
        authSubtitle.textContent = 'Join us and start your productivity journey';
        submitBtn.innerHTML = '<i class="fa-solid fa-user-plus"></i> Sign Up';
        toggleText.textContent = 'Already have an account?';
        toggleLink.textContent = 'Sign In';
        usernameGroup.classList.add('show');
        usernameInput.required = true;
    } else {
        // Mode Connexion
        authTitle.textContent = 'Welcome Back';
        authSubtitle.textContent = 'Sign in to continue your journey';
        submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
        toggleText.textContent = "Don't have an account?";
        toggleLink.textContent = 'Sign Up';
        usernameGroup.classList.remove('show');
        usernameInput.required = false;
    }
    
    hideMessage();
});

// ========== GESTION DU FORMULAIRE ==========
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const username = usernameInput.value.trim();
    
    // Validation
    if (!email || !password) {
        showMessage('Please fill in all fields', 'error');
        return;
    }
    
    if (isSignUp && !username) {
        showMessage('Please choose a username', 'error');
        return;
    }
    
    // Désactiver le bouton
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';
    
    try {
        if (isSignUp) {
            // ========== INSCRIPTION ==========
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        username: username
                    }
                }
            });
            
            if (error) throw error;
            
            // Créer le profil dans la table profiles
            const { error: profileError } = await supabase
                .from('profiles')
                .insert([{
                    id: data.user.id,
                    username: username,
                    avatar_url: null
                }]);
            
            if (profileError) throw profileError;
            
            showMessage('Account created! Check your email to verify.', 'success');
            
            // Attendre 2 secondes puis rediriger
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 2000);
            
        } else {
            // ========== CONNEXION ==========
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) throw error;
            
            showMessage('Login successful! Redirecting...', 'success');
            
            // Rediriger immédiatement
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 1000);
        }
        
    } catch (error) {
        console.error('Auth error:', error);
        showMessage(error.message, 'error');
        
        // Réactiver le bouton
        submitBtn.disabled = false;
        submitBtn.innerHTML = isSignUp 
            ? '<i class="fa-solid fa-user-plus"></i> Sign Up'
            : '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
    }
});

// ========== FONCTIONS UTILITAIRES ==========
function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type} show`;
}

function hideMessage() {
    messageDiv.className = 'message';
}

// ========== TOGGLE PASSWORD VISIBILITY ==========
const togglePasswordBtn = document.getElementById('toggle-password');

togglePasswordBtn.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    
    // Change icon
    const icon = togglePasswordBtn.querySelector('i');
    if (type === 'password') {
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    } else {
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    }
});

document.getElementById("google-login").addEventListener("click", async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  });

  if (error) {
    console.log(error);
  }
});
