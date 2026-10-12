// SuryaCotton - Core Global Menu & Navigation Logic

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
    document.body.classList.add('side-menu-open');
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
    document.body.classList.remove('side-menu-open');
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

// ============================================================
// Global Mobile App-Like Bottom Navigation & Search Modal Logic
// ============================================================
(function () {
  function syncMobileCartBadge() {
    try {
      const raw = localStorage.getItem('sc_cart');
      const cart = raw && raw.startsWith('[') ? JSON.parse(raw) : [];
      const total = Array.isArray(cart) ? cart.reduce((sum, item) => sum + (parseInt(item.qty) || 1), 0) : 0;
      const mobBadges = document.querySelectorAll('.mob-cart-badge, #mobCartCount');
      mobBadges.forEach(badge => {
        badge.textContent = total;
        badge.classList.toggle('show', total > 0);
      });
    } catch (e) {}
  }

  function initMobileBottomNav() {
    const pathname = window.location.pathname.toLowerCase();
    // Do not inject or show mobile bottom nav on checkout page
    if (pathname.includes('checkout')) return;

    // 0. Auto-inject Mobile Bottom Nav & Drawer Isolation CSS if not present
    if (!document.getElementById('mobileBottomNavCritical')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'mobileBottomNavCritical';
      styleEl.textContent = `
        html, body {
          overflow-x: hidden !important;
          max-width: 100vw !important;
        }
        .mobile-bottom-nav { display: none !important; }
        .nav-logo-img { max-height: 42px !important; width: auto !important; max-width: 140px !important; }
        .sm-logo { max-height: 38px !important; width: auto !important; max-width: 120px !important; }

        /* Side Menu Constraints */
        .side-menu {
          position: fixed !important;
          top: 0 !important; right: 0 !important; bottom: 0 !important; left: auto !important;
          width: min(340px, 90vw) !important;
          transform: translateX(105%) !important;
          visibility: hidden !important;
          pointer-events: none !important;
          z-index: 100003 !important;
          transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), visibility 0.4s ease !important;
        }
        .side-menu.open {
          transform: translateX(0) !important;
          visibility: visible !important;
          pointer-events: auto !important;
        }
        .side-menu-overlay {
          position: fixed !important; inset: 0 !important;
          z-index: 100002 !important;
          visibility: hidden !important; opacity: 0 !important;
          pointer-events: none !important;
          transition: opacity 0.4s ease, visibility 0.4s ease !important;
        }
        .side-menu-overlay.open {
          visibility: visible !important; opacity: 1 !important;
          pointer-events: auto !important;
        }

        /* Cart Drawer & Overlay Constraints */
        .cart-drawer {
          position: fixed !important;
          top: 0 !important; right: 0 !important; bottom: 0 !important; left: auto !important;
          width: min(420px, 100vw) !important;
          max-width: 100% !important;
          background: #ffffff !important;
          z-index: 100005 !important;
          display: flex !important;
          flex-direction: column !important;
          transform: translateX(105%) !important;
          visibility: hidden !important;
          pointer-events: none !important;
          transition: transform 0.42s cubic-bezier(0.25, 0.46, 0.45, 0.94), visibility 0.42s ease !important;
          box-shadow: -10px 0 50px rgba(0,0,0,0.15) !important;
        }
        .cart-drawer.open {
          transform: translateX(0) !important;
          visibility: visible !important;
          pointer-events: auto !important;
        }
        .cart-overlay {
          position: fixed !important; inset: 0 !important;
          background: rgba(0,0,0,0.6) !important;
          z-index: 100004 !important;
          opacity: 0 !important; visibility: hidden !important;
          pointer-events: none !important;
          transition: opacity 0.4s ease, visibility 0.4s ease !important;
          backdrop-filter: blur(4px) !important;
        }
        .cart-overlay.open {
          opacity: 1 !important; visibility: visible !important;
          pointer-events: auto !important;
        }
        .cart-footer {
          padding: 1.25rem 1.5rem calc(1.5rem + env(safe-area-inset-bottom, 0px)) !important;
          border-top: 1px solid rgba(0,0,0,0.08) !important;
          background: #ffffff !important;
          position: relative !important;
          z-index: 10 !important;
          box-shadow: 0 -4px 15px rgba(0,0,0,0.04) !important;
        }
        .cart-footer #checkoutBtn,
        .cart-footer .btn-primary {
          display: block !important;
          width: 100% !important;
          min-height: 48px !important;
          font-size: 0.95rem !important;
          font-weight: 700 !important;
          letter-spacing: 1px !important;
          border-radius: 12px !important;
          cursor: pointer !important;
          position: relative !important;
          z-index: 11 !important;
        }

        @media (max-width: 768px) {
          .navbar { display: flex !important; align-items: center !important; justify-content: space-between !important; padding: 0.6rem 1rem !important; height: 56px !important; }
          .nav-logo { position: static !important; transform: none !important; display: flex !important; align-items: center !important; gap: 8px !important; margin: 0 !important; }
          .nav-logo-img { height: 30px !important; width: auto !important; max-width: 100px !important; }
          .nav-logo-text { display: inline-block !important; font-size: 1.25rem !important; margin: 0 !important; }
          .nav-links { display: none !important; }
          .nav-actions { display: flex !important; align-items: center !important; margin-left: auto !important; }
          #searchBtn, .profile-btn, .navbar .cart-btn { display: none !important; }
          .hamburger { display: flex !important; }
          .mobile-bottom-nav {
            display: flex !important;
            align-items: center !important;
            justify-content: space-around !important;
            position: fixed !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            height: 62px !important;
            padding-bottom: env(safe-area-inset-bottom, 0px) !important;
            background: rgba(255, 255, 255, 0.98) !important;
            backdrop-filter: blur(20px) !important;
            -webkit-backdrop-filter: blur(20px) !important;
            border-top: 1px solid rgba(0, 0, 0, 0.08) !important;
            box-shadow: 0 -4px 25px rgba(0, 0, 0, 0.08) !important;
            z-index: 99999 !important;
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
            transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease !important;
          }
          /* When cart drawer, side menu, or brand intro is active, bottom nav slides down */
          body.cart-open .mobile-bottom-nav,
          body.side-menu-open .mobile-bottom-nav,
          body.intro-active .mobile-bottom-nav,
          body:has(#brandIntro:not(.hidden)) .mobile-bottom-nav {
            transform: translateY(125%) !important;
            opacity: 0 !important;
            pointer-events: none !important;
            visibility: hidden !important;
          }
          body {
            padding-bottom: calc(75px + env(safe-area-inset-bottom, 0px)) !important;
          }
          .footer {
            padding-bottom: calc(95px + env(safe-area-inset-bottom, 0px)) !important;
          }
          .footer-bottom {
            padding-bottom: 1.5rem !important;
          }
          .wa-float {
            bottom: calc(75px + env(safe-area-inset-bottom, 0px)) !important;
            right: 1.2rem !important;
          }
          .mob-nav-item {
            flex: 1 !important;
            height: 100% !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 3px !important;
            background: none !important;
            border: none !important;
            text-decoration: none !important;
            color: #64748b !important;
            font-family: 'Inter', sans-serif !important;
            font-size: 0.68rem !important;
            font-weight: 600 !important;
            letter-spacing: 0.2px !important;
            cursor: pointer !important;
            position: relative !important;
            transition: color 0.2s ease, transform 0.15s ease !important;
            -webkit-tap-highlight-color: transparent !important;
          }
          .mob-nav-item:active { transform: scale(0.92) !important; }
          .mob-nav-item.active { color: #e8000d !important; }
          .mob-nav-item.active .mob-nav-icon svg { stroke: #e8000d !important; transform: scale(1.08) !important; }
          .mob-nav-item.active::after {
            content: '' !important;
            position: absolute !important;
            top: 0 !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            width: 22px !important;
            height: 3px !important;
            background: #e8000d !important;
            border-radius: 0 0 3px 3px !important;
          }
          .mob-nav-icon {
            position: relative !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: 24px !important;
            height: 24px !important;
          }
          .mob-nav-icon svg { stroke: currentColor !important; stroke-width: 2 !important; }
          .mob-nav-label { line-height: 1 !important; font-size: 0.68rem !important; font-weight: 600 !important; }
          .mob-cart-badge {
            position: absolute !important;
            top: -5px !important;
            right: -9px !important;
            background: #e8000d !important;
            color: #ffffff !important;
            font-size: 0.62rem !important;
            font-weight: 800 !important;
            min-width: 17px !important;
            height: 17px !important;
            border-radius: 999px !important;
            display: none !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 4px !important;
            border: 1.5px solid #ffffff !important;
            box-shadow: 0 2px 6px rgba(232, 0, 13, 0.35) !important;
          }
          .mob-cart-badge.show { display: flex !important; }
        }
      `;
      document.head.appendChild(styleEl);
    }

    // 1. Auto-inject Mobile Bottom Nav HTML if not already in document
    if (!document.getElementById('mobileBottomNav')) {
      const navHtml = `
  <nav class="mobile-bottom-nav" id="mobileBottomNav" aria-label="Mobile Navigation">
    <a href="index.html" class="mob-nav-item" id="mobNavHome">
      <div class="mob-nav-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>
      <span class="mob-nav-label">Home</span>
    </a>

    <a href="category.html?cat=all" class="mob-nav-item" id="mobNavShop">
      <div class="mob-nav-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5"/>
          <rect x="14" y="3" width="7" height="7" rx="1.5"/>
          <rect x="14" y="14" width="7" height="7" rx="1.5"/>
          <rect x="3" y="14" width="7" height="7" rx="1.5"/>
        </svg>
      </div>
      <span class="mob-nav-label">Shop</span>
    </a>

    <button type="button" class="mob-nav-item" id="mobNavSearch">
      <div class="mob-nav-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
      </div>
      <span class="mob-nav-label">Search</span>
    </button>

    <button type="button" class="mob-nav-item" id="mobNavCart">
      <div class="mob-nav-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
        <span class="mob-cart-badge" id="mobCartCount">0</span>
      </div>
      <span class="mob-nav-label">Cart</span>
    </button>

    <a href="profile.html" class="mob-nav-item" id="mobNavProfile">
      <div class="mob-nav-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <span class="mob-nav-label">Account</span>
    </a>
  </nav>`;
      document.body.insertAdjacentHTML('beforeend', navHtml);
    }

    // 2. Auto-inject Search Modal HTML if not already in document
    if (!document.getElementById('searchModalOverlay')) {
      const searchHtml = `
  <div class="search-modal-overlay" id="searchModalOverlay">
    <div class="search-modal" id="searchModal">
      <div class="search-modal-header">
        <div class="search-input-wrap">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="search-icon-svg" id="searchSubmitIcon" style="cursor: pointer;" title="Search">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" id="searchInputField" placeholder="Search shirts, pants, t-shirts, cotton..." autocomplete="off" />
          <button type="button" class="search-clear-btn" id="searchClearBtn" aria-label="Clear">✕</button>
        </div>
        <button type="button" class="search-close-btn" id="searchModalClose" aria-label="Close">Cancel</button>
      </div>
      
      <div class="search-modal-body">
        <div class="search-default-view" id="searchDefaultView">
          <div class="search-suggestions">
            <p class="search-section-title">TRENDING SEARCHES</p>
            <div class="search-tags">
              <a href="category.html?search=plain%20shirt" class="search-tag">Plain Shirt</a>
              <a href="category.html?search=linen%20shirt" class="search-tag">Linen Shirt</a>
              <a href="category.html?search=jean%20pant" class="search-tag">Jean Pant</a>
              <a href="category.html?search=hoodie" class="search-tag">Hoodies T-Shirt</a>
              <a href="category.html?search=cotton%20pant" class="search-tag">Cotton Pant</a>
              <a href="category.html?search=collar" class="search-tag">Collar T-Shirt</a>
              <a href="category.html?search=drop%20shoulder" class="search-tag">Drop Shoulder</a>
              <a href="category.html?search=printed%20shirt" class="search-tag">Printed Shirt</a>
            </div>
          </div>

          <div class="search-quick-cats">
            <p class="search-section-title">QUICK CATEGORIES</p>
            <div class="quick-cat-grid">
              <a href="category.html?cat=shirt" class="quick-cat-card">
                <span class="quick-cat-emoji">👔</span>
                <span>Shirts</span>
              </a>
              <a href="category.html?cat=pant" class="quick-cat-card">
                <span class="quick-cat-emoji">👖</span>
                <span>Pants</span>
              </a>
              <a href="category.html?cat=tshirt" class="quick-cat-card">
                <span class="quick-cat-emoji">👕</span>
                <span>T-Shirts</span>
              </a>
              <a href="category.html?cat=all" class="quick-cat-card">
                <span class="quick-cat-emoji">🛍️</span>
                <span>View All</span>
              </a>
            </div>
          </div>
        </div>

        <!-- Live Instant Search Results Container -->
        <div class="search-live-results" id="searchLiveResults" style="display: none;"></div>
      </div>
    </div>
  </div>`;
      document.body.insertAdjacentHTML('beforeend', searchHtml);
    }

    // 3. Set active tab dynamically based on current page URL
    const homeItem = document.getElementById('mobNavHome');
    const shopItem = document.getElementById('mobNavShop');
    const profileItem = document.getElementById('mobNavProfile');

    if (homeItem) homeItem.classList.remove('active');
    if (shopItem) shopItem.classList.remove('active');
    if (profileItem) profileItem.classList.remove('active');

    if (pathname.includes('category') || pathname.includes('product')) {
      if (shopItem) shopItem.classList.add('active');
    } else if (pathname.includes('profile')) {
      if (profileItem) profileItem.classList.add('active');
    } else {
      if (homeItem) homeItem.classList.add('active');
    }

    // Smooth scroll to top if already on active page
    if (homeItem && !homeItem._hasScrollClick) {
      homeItem._hasScrollClick = true;
      homeItem.addEventListener('click', (e) => {
        if (pathname.endsWith('index.html') || pathname.endsWith('/') || pathname === '') {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }

    if (profileItem && !profileItem._hasScrollClick) {
      profileItem._hasScrollClick = true;
      profileItem.addEventListener('click', (e) => {
        if (pathname.includes('profile')) {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }

    if (shopItem && !shopItem._hasScrollClick) {
      shopItem._hasScrollClick = true;
      shopItem.addEventListener('click', (e) => {
        if (pathname.includes('category') && window.location.search.includes('cat=all')) {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }

    // 4. Cart Button interaction
    const mobCartBtn = document.getElementById('mobNavCart');
    if (mobCartBtn && !mobCartBtn._hasClick) {
      mobCartBtn._hasClick = true;
      mobCartBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const mainCartBtn = document.getElementById('cartBtn');
        if (mainCartBtn) {
          mainCartBtn.click();
        } else if (typeof window.openCart === 'function') {
          window.openCart();
        } else {
          window.location.href = 'index.html#cart';
        }
      });
    }

    // 5. Search Modal & Live Instant Search Engine
    const searchOverlay = document.getElementById('searchModalOverlay');
    const searchInput = document.getElementById('searchInputField');
    const searchClear = document.getElementById('searchClearBtn');
    const searchClose = document.getElementById('searchModalClose');
    const searchSubmitIcon = document.getElementById('searchSubmitIcon');

    // Helper: Retrieve products from window or localStorage
    function getAvailableProducts() {
      if (Array.isArray(window.products) && window.products.length > 0) return window.products;
      if (Array.isArray(window.ALL_PRODUCTS) && window.ALL_PRODUCTS.length > 0) return window.ALL_PRODUCTS;
      try {
        const stored = JSON.parse(localStorage.getItem('sc_products') || '[]');
        if (Array.isArray(stored) && stored.length > 0) return stored;
      } catch (e) {}
      return [];
    }

    // Helper: Escape HTML
    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    // Helper: Highlight query matches in text
    function highlightQuery(text, query) {
      if (!text) return '';
      if (!query) return escapeHtml(text);
      const cleanQ = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!cleanQ) return escapeHtml(text);
      const regex = new RegExp(`(${cleanQ})`, 'gi');
      return escapeHtml(text).replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    // Helper: Map category key to friendly name
    function getCategoryLabel(cat) {
      const c = String(cat || '').toLowerCase().trim();
      if (c === 'shirt' || c === 'shirts') return 'Shirt';
      if (c === 'tshirt' || c === 't-shirt' || c === 'tshirts' || c === 't-shirts') return 'T-Shirt';
      if (c === 'pant' || c === 'pants' || c === 'trouser' || c === 'trousers' || c === 'jeans') return 'Pant';
      if (c === 'shorts' || c === 'short') return 'Shorts';
      if (c === 'caps' || c === 'cap') return 'Cap';
      if (c === 'keychains' || c === 'keychain') return 'Keychain';
      return cat ? String(cat).charAt(0).toUpperCase() + String(cat).slice(1) : 'Apparel';
    }

    // Intelligent multi-word relevance matching algorithm
    function filterProductsByQuery(query, productsList) {
      const q = query.toLowerCase().trim();
      if (!q) return [];

      const queryWords = q.split(/\s+/).filter(Boolean);

      const aliases = {
        'tee': 'tshirt',
        'tees': 'tshirt',
        't-shirt': 'tshirt',
        't shirt': 'tshirt',
        'tshirts': 'tshirt',
        't-shirts': 'tshirt',
        'jean': 'pant',
        'jeans': 'pant',
        'trouser': 'pant',
        'trousers': 'pant',
        'chino': 'pant',
        'chinos': 'pant',
        'cargo': 'pant',
        'polo': 'tshirt',
        'round': 'tshirt',
        'over': 'tshirt'
      };

      const results = [];

      for (const p of productsList) {
        if (!p) continue;
        const name = String(p.name || '').toLowerCase();
        const cat = String(p.cat || '').toLowerCase();
        const desc = String(p.description || p.desc || '').toLowerCase();
        const fabric = String(p.fabric || '').toLowerCase();
        const fit = String(p.fit || '').toLowerCase();
        const sleeve = String(p.sleeve || '').toLowerCase();
        const color = String(p.color || '').toLowerCase();
        const searchable = `${name} ${cat} ${desc} ${fabric} ${fit} ${sleeve} ${color}`;

        let score = 0;

        if (name === q) score += 120;
        else if (name.startsWith(q)) score += 80;
        else if (name.includes(q)) score += 60;
        else if (cat.includes(q)) score += 40;
        else if (searchable.includes(q)) score += 20;

        let allWordsFound = true;
        for (const w of queryWords) {
          const alias = aliases[w] || w;
          if (searchable.includes(w) || searchable.includes(alias)) {
            score += 15;
          } else {
            allWordsFound = false;
          }
        }

        if (score > 0 || allWordsFound) {
          results.push({ product: p, score: score + (allWordsFound ? 25 : 0) });
        }
      }

      results.sort((a, b) => b.score - a.score);
      return results.map(r => r.product);
    }

    // Render live results UI
    function renderLiveSearchResults(matches, query) {
      const liveResults = document.getElementById('searchLiveResults');
      const defaultView = document.getElementById('searchDefaultView');
      if (!liveResults) return;

      const trimmedQ = (query || '').trim();
      if (!trimmedQ) {
        liveResults.style.display = 'none';
        liveResults.innerHTML = '';
        if (defaultView) defaultView.style.display = 'block';
        return;
      }

      if (defaultView) defaultView.style.display = 'none';
      liveResults.style.display = 'block';

      if (matches.length === 0) {
        liveResults.innerHTML = `
          <div class="search-empty-state">
            <div class="search-empty-icon">🔍</div>
            <h3 class="search-empty-title">No products found for "${escapeHtml(trimmedQ)}"</h3>
            <p class="search-empty-text">We couldn't find exact matches. Try searching for shirts, pants, t-shirts, cotton, or tap below:</p>
            <div class="search-empty-tags">
              <button type="button" class="search-tag-chip" data-search="Shirt">👔 Shirts</button>
              <button type="button" class="search-tag-chip" data-search="T-Shirt">👕 T-Shirts</button>
              <button type="button" class="search-tag-chip" data-search="Pant">👖 Pants</button>
              <button type="button" class="search-tag-chip" data-search="Cotton">Pure Cotton</button>
              <button type="button" class="search-tag-chip" data-search="Linen">Linen</button>
            </div>
          </div>
        `;
        return;
      }

      const displayList = matches.slice(0, 6);

      liveResults.innerHTML = `
        <div class="search-results-header">
          <span>Matching Products (<strong>${matches.length}</strong>)</span>
          <a href="category.html?search=${encodeURIComponent(trimmedQ)}" class="search-view-all-link">View all ➔</a>
        </div>
        <div class="search-product-list">
          ${displayList.map(p => {
            const imgUrl = (p.images && p.images[0]) || p.img || 'Logo.png';
            const price = Number(p.price || 0);
            const orig = Number(p.original || 0);
            const off = p.off || (orig > price && orig > 0 ? Math.round(((orig - price) / orig) * 100) : 0);
            return `
              <a href="product.html?id=${encodeURIComponent(p.id)}" class="search-prod-item" data-id="${p.id}">
                <div class="search-prod-img-wrap">
                  <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(p.name)}" class="search-prod-img" onerror="this.src='Logo.png'" />
                </div>
                <div class="search-prod-info">
                  <div class="search-prod-top">
                    <span class="search-prod-cat">${escapeHtml(getCategoryLabel(p.cat))}</span>
                    ${p.badge ? `<span class="search-prod-badge">${escapeHtml(p.badge)}</span>` : (off > 0 ? `<span class="search-prod-off-badge">${off}% OFF</span>` : '')}
                  </div>
                  <h4 class="search-prod-name">${highlightQuery(p.name, trimmedQ)}</h4>
                  <div class="search-prod-price-row">
                    <span class="search-prod-price">₹${price.toLocaleString('en-IN')}</span>
                    ${orig > price ? `<span class="search-prod-orig">₹${orig.toLocaleString('en-IN')}</span>` : ''}
                    <span class="search-prod-stock-tag">⚡ In Stock</span>
                  </div>
                </div>
                <div class="search-prod-arrow">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </a>
            `;
          }).join('')}
        </div>
        <a href="category.html?search=${encodeURIComponent(trimmedQ)}" class="search-view-all-btn">
          <span>See all <strong>${matches.length}</strong> products for "<strong>${escapeHtml(trimmedQ)}</strong>"</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </a>
      `;
    }

    let searchDebounceTimer = null;
    function performLiveSearch(query) {
      clearTimeout(searchDebounceTimer);
      const q = (query || '').trim();

      if (searchClear) {
        searchClear.classList.toggle('visible', q.length > 0);
      }

      if (!q) {
        renderLiveSearchResults([], '');
        return;
      }

      searchDebounceTimer = setTimeout(() => {
        const allProds = getAvailableProducts();
        const matches = filterProductsByQuery(q, allProds);
        renderLiveSearchResults(matches, q);
      }, 100);
    }

    // Expose global helper for clicking suggestion chips
    window.applySearchSuggestion = function(keyword) {
      if (searchInput) {
        searchInput.value = keyword;
        searchInput.focus();
        performLiveSearch(keyword);
      }
    };

    function openSearchModal() {
      if (!searchOverlay) return;
      searchOverlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      setTimeout(() => {
        if (searchInput) {
          searchInput.focus();
          if (searchInput.value.trim().length > 0) {
            performLiveSearch(searchInput.value);
          }
        }
      }, 150);
    }

    function closeSearchModal() {
      if (!searchOverlay) return;
      searchOverlay.classList.remove('open');
      document.body.style.overflow = '';
      if (searchInput) searchInput.blur();
    }

    const mobSearchBtn = document.getElementById('mobNavSearch');
    if (mobSearchBtn && !mobSearchBtn._hasClick) {
      mobSearchBtn._hasClick = true;
      mobSearchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openSearchModal();
      });
    }

    const topSearchBtn = document.getElementById('searchBtn');
    if (topSearchBtn && !topSearchBtn._hasClick) {
      topSearchBtn._hasClick = true;
      topSearchBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openSearchModal();
      });
    }

    if (searchClose && !searchClose._hasClick) {
      searchClose._hasClick = true;
      searchClose.addEventListener('click', closeSearchModal);
    }

    if (searchOverlay && !searchOverlay._hasClick) {
      searchOverlay._hasClick = true;
      searchOverlay.addEventListener('click', (e) => {
        if (e.target === searchOverlay) closeSearchModal();
      });
    }

    // Click submit icon on input
    const iconBtn = document.getElementById('searchSubmitIcon') || searchSubmitIcon;
    if (iconBtn && !iconBtn._hasClick) {
      iconBtn._hasClick = true;
      iconBtn.addEventListener('click', () => {
        const query = searchInput ? searchInput.value.trim() : '';
        if (query) {
          closeSearchModal();
          window.location.href = `category.html?search=${encodeURIComponent(query)}`;
        }
      });
    }

    // Search input live typing & enter key
    if (searchInput && !searchInput._hasInput) {
      searchInput._hasInput = true;
      searchInput.addEventListener('input', () => {
        performLiveSearch(searchInput.value);
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const query = searchInput.value.trim();
          if (query) {
            closeSearchModal();
            window.location.href = `category.html?search=${encodeURIComponent(query)}`;
          }
        } else if (e.key === 'Escape') {
          closeSearchModal();
        }
      });
    }

    // Search clear button
    if (searchClear && !searchClear._hasClick) {
      searchClear._hasClick = true;
      searchClear.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
        }
        performLiveSearch('');
      });
    }

    // Event delegation for search tag chips & trending searches
    if (searchOverlay && !searchOverlay._hasTagDelegate) {
      searchOverlay._hasTagDelegate = true;
      searchOverlay.addEventListener('click', (e) => {
        const chip = e.target.closest('.search-tag-chip');
        if (chip && chip.dataset && chip.dataset.search) {
          e.preventDefault();
          window.applySearchSuggestion(chip.dataset.search);
        }
      });
    }

    // 6. Reactive Drawer & Bottom Nav Coordination
    function syncDrawerStates() {
      const isCartOpen = !!document.querySelector('.cart-drawer.open, #cartDrawer.open');
      const isSideOpen = !!document.querySelector('.side-menu.open, #sideMenu.open');
      const isIntroActive = document.body.classList.contains('intro-active') || !!document.querySelector('#brandIntro:not(.hidden)');
      document.body.classList.toggle('cart-open', isCartOpen);
      document.body.classList.toggle('side-menu-open', isSideOpen);
      document.body.classList.toggle('intro-active', isIntroActive);
    }

    try {
      const drawerObserver = new MutationObserver(syncDrawerStates);
      drawerObserver.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
    } catch(e) {}

    document.addEventListener('click', () => {
      setTimeout(syncDrawerStates, 20);
    });

    function hookCartFunctions() {
      if (typeof window.openCart === 'function' && !window.openCart._isHooked) {
        const origOpenCart = window.openCart;
        window.openCart = function(...args) {
          document.body.classList.add('cart-open');
          return origOpenCart.apply(this, args);
        };
        window.openCart._isHooked = true;
      }
      if (typeof window.closeCart === 'function' && !window.closeCart._isHooked) {
        const origCloseCart = window.closeCart;
        window.closeCart = function(...args) {
          document.body.classList.remove('cart-open');
          return origCloseCart.apply(this, args);
        };
        window.closeCart._isHooked = true;
      }
    }
    hookCartFunctions();
    window.addEventListener('load', hookCartFunctions);

    // Initial badge sync and storage event listener
    syncMobileCartBadge();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileBottomNav);
  } else {
    initMobileBottomNav();
  }

  window.addEventListener('storage', (e) => {
    if (e.key === 'sc_cart') syncMobileCartBadge();
  });

  window.syncMobileCartBadge = syncMobileCartBadge;
})();
