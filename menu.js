// Global Mobile Side Menu Logic
document.addEventListener('DOMContentLoaded', () => {
  let hamburger = document.getElementById('hamburger');
  const sideMenu = document.getElementById('sideMenu');
  const sideMenuOverlay = document.getElementById('sideMenuOverlay');
  const sideMenuClose = document.getElementById('sideMenuClose');

  if (!sideMenu || !sideMenuOverlay) return;

  function openSideMenu() {
    sideMenu.classList.add('open');
    sideMenuOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    
    // Sync profile
    try {
      if (localStorage.getItem('sc_isLoggedIn') === 'true') {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('sc_profile_'));
        if (keys.length) {
          const profile = JSON.parse(localStorage.getItem(keys[0]) || '{}');
          if (profile.avatar) {
            const smImg = document.getElementById('smAvatarImg');
            const smIcon = document.getElementById('smAvatarIcon');
            if (smImg) { smImg.src = profile.avatar; smImg.classList.remove('hidden'); }
            if (smIcon) smIcon.style.display = 'none';
          }
          if (profile.name) {
            const smName = document.getElementById('smUserName');
            const smSub = document.getElementById('smUserSub');
            if (smName) smName.textContent = 'Hi, ' + profile.name + '!';
            if (smSub) smSub.textContent = 'View your profile & orders';
          }
        }
      }
    } catch(e) {}
  }

  function closeSideMenu() {
    sideMenu.classList.remove('open');
    sideMenuOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  if (hamburger) {
    // Clone hamburger to remove any legacy event listeners (like the one that makes it an X)
    const newHamburger = hamburger.cloneNode(true);
    hamburger.parentNode.replaceChild(newHamburger, hamburger);
    hamburger = newHamburger;
    
    hamburger.addEventListener('click', openSideMenu);
  }

  if (sideMenuClose) sideMenuClose.addEventListener('click', closeSideMenu);
  if (sideMenuOverlay) sideMenuOverlay.addEventListener('click', closeSideMenu);

  // Allow links inside the menu with data-close to close the menu when clicked
  sideMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      // Small delay so navigation feels natural
      setTimeout(closeSideMenu, 150);
    });
  });
});

// Global Premium Centered Stock Alert Modal
window.showStockAlert = function(msg, redirectUrl = null) {
  // Remove existing alert if present
  const existing = document.getElementById('scStockAlertOverlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'scStockAlertOverlay';
  overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); z-index: 100000; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s ease; padding: 1.5rem;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background: #ffffff; border-radius: 24px; width: 100%; max-width: 420px; padding: 2.2rem 1.8rem; text-align: center; box-shadow: 0 25px 60px rgba(0,0,0,0.35); transform: scale(0.88) translateY(20px); transition: transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275); border: 1px solid rgba(0,0,0,0.08); position: relative;';

  modal.innerHTML = `
    <div style="width: 76px; height: 76px; background: #fff1f2; border: 2px solid #ffe4e6; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.2rem; box-shadow: 0 10px 25px rgba(225,29,72,0.18);">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e11d48" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
    </div>
    <h3 style="font-family: 'Inter', sans-serif; font-size: 1.4rem; font-weight: 800; color: #0f172a; margin-bottom: 0.6rem; letter-spacing: -0.5px;">Stock Limit Exceeded</h3>
    <p style="font-family: 'Inter', sans-serif; font-size: 0.95rem; color: #475569; line-height: 1.6; margin-bottom: 1.8rem; padding: 0 0.5rem;">${msg}</p>
    <button id="scStockAlertBtn" style="background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); color: #ffffff; border: none; border-radius: 14px; padding: 0.9rem 2rem; font-size: 0.95rem; font-weight: 700; width: 100%; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 6px 20px rgba(225,29,72,0.35); letter-spacing: 0.5px;">GOT IT, UNDERSTOOD</button>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Trigger animation
  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    modal.style.transform = 'scale(1) translateY(0)';
  });

  const closeAlert = () => {
    overlay.style.opacity = '0';
    modal.style.transform = 'scale(0.88) translateY(20px)';
    setTimeout(() => {
      overlay.remove();
      if (redirectUrl) window.location.href = redirectUrl;
    }, 280);
  };

  const btn = modal.querySelector('#scStockAlertBtn');
  if (btn) {
    btn.addEventListener('click', closeAlert);
    btn.addEventListener('mouseenter', () => btn.style.transform = 'translateY(-2px)');
    btn.addEventListener('mouseleave', () => btn.style.transform = 'translateY(0)');
  }
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeAlert();
  });
};

// Intercept showToast globally for stock warnings
function setupToastInterceptor() {
  const origShowToast = window.showToast;
  if (typeof origShowToast === 'function' && !origShowToast._isIntercepted) {
    window.showToast = function(msg) {
      if (msg && (msg.includes('available') || msg.includes('stock') || msg.includes('Cannot checkout') || msg.includes('Out of Stock') || msg.includes('Quantity capped'))) {
        if (window.showStockAlert) {
          window.showStockAlert(msg);
          return;
        }
      }
      origShowToast(msg);
    };
    window.showToast._isIntercepted = true;
  }
}
setupToastInterceptor();
document.addEventListener('DOMContentLoaded', setupToastInterceptor);
window.addEventListener('load', setupToastInterceptor);
