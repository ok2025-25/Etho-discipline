
document.addEventListener('DOMContentLoaded', () => {
  const burger = document.getElementById('burger');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  
  // Only run if elements exist
  if (burger && sidebar) {
    // Ouvrir la sidebar par défaut en desktop
    if (window.innerWidth >= 1024) {
      sidebar.classList.add('open');
      burger.classList.add('active');
    }
    
    burger.addEventListener('click', (e) => {
      e.stopPropagation();
      burger.classList.toggle('active');
      sidebar.classList.toggle('open');
      
      // Toggle overlay si présent
      if (overlay) {
        overlay.classList.toggle('active');
      }
    });

    // Close sidebar when clicking anywhere else
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && 
          !sidebar.contains(e.target) && 
          !burger.contains(e.target)) {
        sidebar.classList.remove('open');
        burger.classList.remove('active');
        
        // Fermer overlay
        if (overlay) {
          overlay.classList.remove('active');
        }
      }
    });
    
    // Fermer avec overlay
    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        burger.classList.remove('active');
        overlay.classList.remove('active');
      });
    }
  }
});