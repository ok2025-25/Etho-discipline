// ========== CONFIGURATION SUPABASE ==========
const SUPABASE_URL = 'https://lvptwkknzvrocbvktdvg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2cHR3a2tuenZyb2Nidmt0ZHZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4Nzc1NDQsImV4cCI6MjA3OTQ1MzU0NH0.TUOXAMw6USeZdYf_WSPyK_sdDSkKFvaeJqWqUu-nTFs';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ========== ÉLÉMENTS DOM ==========
const profileForm = document.getElementById('profile-form');
const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const avatarImg = document.getElementById('profile-avatar');
const avatarUpload = document.getElementById('avatar-upload');
const logoutBtn = document.getElementById('logout-btn');
const deleteAccountBtn = document.getElementById('delete-account-btn');
const messageDiv = document.getElementById('message');
const navbarUsername = document.getElementById('navbar-username');
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');

let currentUser = null;
let currentProfile = null;

// ========== VÉRIFIER AUTHENTIFICATION ==========
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = session.user;
    await loadProfile();
});

// ========== CHARGER PROFIL ==========
async function loadProfile() {
    try {
        // Charger les données du profil
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();
        
        if (error) throw error;
        
        currentProfile = profile;
        
        // Remplir le formulaire
        usernameInput.value = profile.username || '';
        emailInput.value = currentUser.email || '';
        
        // Mettre à jour l'avatar
        if (profile.avatar_url) {
            avatarImg.src = profile.avatar_url;
        } else {
            avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.username || 'User')}&size=120&background=8b5cf6&color=fff`;
        }
        
        // Mettre à jour la navbar
        updateNavbar(profile.username);
        
    } catch (error) {
        console.error('Error loading profile:', error);
        showMessage('Error loading profile', 'error');
    }
}

// ========== METTRE À JOUR LA NAVBAR ==========
function updateNavbar(username) {
    if (navbarUsername) {
        navbarUsername.innerHTML = `<i class="fa-regular fa-circle-user"></i> ${username || 'User'}`;
    }
}

// ========== SAUVEGARDER PROFIL ==========
profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const newUsername = usernameInput.value.trim();
    
    if (!newUsername) {
        showMessage('Username cannot be empty', 'error');
        return;
    }
    
    try {
        // Mettre à jour le profil
        const { error } = await supabase
            .from('profiles')
            .update({
                username: newUsername,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);
        
        if (error) throw error;
        
        // Mettre à jour les métadonnées de l'utilisateur
        const { error: metaError } = await supabase.auth.updateUser({
            data: { username: newUsername }
        });
        
        if (metaError) throw metaError;
        
        currentProfile.username = newUsername;
        updateNavbar(newUsername);
        showMessage('Profile updated successfully!', 'success');
        
        // Mettre à jour l'avatar si pas d'URL personnalisée
        if (!currentProfile.avatar_url) {
            avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(newUsername)}&size=120&background=8b5cf6&color=fff`;
        }
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showMessage('Error updating profile: ' + error.message, 'error');
    }
});

// ========== UPLOAD AVATAR ==========
avatarUpload.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
        showMessage('Please select an image file', 'error');
        return;
    }
    
    // Vérifier la taille (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
        showMessage('Image must be less than 2MB', 'error');
        return;
    }
    
    try {
        showMessage('Uploading avatar...', 'success');
        
        // Créer un nom de fichier unique
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;
        
        // Upload vers Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            });
        
        if (uploadError) throw uploadError;
        
        // Obtenir l'URL publique
        const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);
        
        const avatarUrl = urlData.publicUrl;
        
        // Mettre à jour la base de données
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: avatarUrl })
            .eq('id', currentUser.id);
        
        if (updateError) throw updateError;
        
        // Mettre à jour l'affichage
        avatarImg.src = avatarUrl;
        currentProfile.avatar_url = avatarUrl;
        
        showMessage('Avatar updated successfully!', 'success');
        
    } catch (error) {
        console.error('Error uploading avatar:', error);
        showMessage('Error uploading avatar: ' + error.message, 'error');
    }
});

// ========== DÉCONNEXION ==========
logoutBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to logout?')) return;
    
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        // Rediriger vers la page de connexion
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('Error logging out:', error);
        showMessage('Error logging out: ' + error.message, 'error');
    }
});

// ========== SUPPRIMER COMPTE ==========
deleteAccountBtn.addEventListener('click', async () => {
    const confirmation = prompt('Type "DELETE" to confirm account deletion:');
    
    if (confirmation !== 'DELETE') {
        showMessage('Account deletion cancelled', 'error');
        return;
    }
    
    try {
        // Supprimer le profil
        const { error: profileError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', currentUser.id);
        
        if (profileError) throw profileError;
        
        // Supprimer l'utilisateur (nécessite des permissions admin ou une function)
        // Note: La suppression de l'utilisateur authentifié nécessite généralement une Edge Function
        showMessage('Profile deleted. Logging out...', 'success');
        
        setTimeout(async () => {
            await supabase.auth.signOut();
            window.location.href = 'index.html';
        }, 2000);
        
    } catch (error) {
        console.error('Error deleting account:', error);
        showMessage('Error deleting account: ' + error.message, 'error');
    }
});

// ========== SIDEBAR TOGGLE ==========
if (sidebarToggle) {
    sidebarToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('open');
    });
}

document.addEventListener('click', (e) => {
    if (window.innerWidth < 1024 && sidebar.classList.contains('open') && 
        !sidebar.contains(e.target) && e.target !== sidebarToggle) {
        sidebar.classList.remove('open');
    }
});

// ========== FONCTIONS UTILITAIRES ==========
function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type} show`;
    
    setTimeout(() => {
        messageDiv.className = 'message';
    }, 5000);
}