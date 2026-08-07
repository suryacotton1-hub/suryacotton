/* =============================================
   SURYA COTTANS — JS COMBINED
   Brand Intro + Cursor + Navbar + Hero Reveal + Products + Cart + Testimonials
   ============================================= */

// ---- BRAND INTRO ANIMATION ----
(function runBrandIntro() {
  const intro    = document.getElementById('brandIntro');
  const biName   = document.getElementById('biName');
  const biLine   = document.getElementById('biLine');
  const biTag    = document.getElementById('biTagline');
  const heroLeft = document.getElementById('heroLeft');
  const heroRight= document.getElementById('heroRight');

  if (!intro) { revealHero(); return; }

  // Phase 1 — show name big → shrinks
  setTimeout(() => {
    biName.classList.add('phase-show');
  }, 120);

  // Phase 2 — line + tagline appear
  setTimeout(() => {
    biLine.classList.add('phase-show');
    biTag.classList.add('phase-show');
  }, 600);

  // Phase 3 — hold, then exit
  setTimeout(() => {
    intro.classList.add('exit');
  }, 2200);

  // Phase 4 — remove overlay, reveal hero panels
  setTimeout(() => {
    intro.classList.add('hidden');
    revealHero();
  }, 2900);

  function revealHero() {
    if (heroLeft)  heroLeft.classList.add('revealed');
    if (heroRight) heroRight.classList.add('revealed');
  }
})();

// ---- INIT ON LOAD ----
window.addEventListener('load', () => {
  initScrollReveal();
  initParallax();
  initCollectionCardClicks();
  renderProducts('all'); // render all products randomly on start
});

// ---- SUBCATEGORIES DATA ----
const SUBCATEGORIES = {
  shirt: [
    'Plain Shirt', 'Linen Shirt', 'Printed Shirt', 'Branded Shirt',
    'Checked Shirt', 'Stripped Shirt', 'Denim Shirt'
  ],
  pant: [
    'Jean Pant', 'Cotton Pant', 'Baggy Pant', 'Mom Fit Pant', 'Track Pant'
  ],
  tshirt: [
    'Hoodies T-Shirt', 'Collar T-Shirt', 'Drop Shoulder T-Shirt',
    'Full Sleeve T-Shirt'
  ],
  shorts: [
    'Cargo Shorts', 'Denim Shorts', 'Cotton Shorts', 'Athletic Shorts'
  ],
  caps: [
    'Baseball Cap', 'Snapback Cap', 'Embroidered Cap'
  ],
  keychains: [
    'Leather Keychain', 'Metallic Crest Keychain'
  ]
};

// ---- COLLECTION CARD CLICKS — show subcategory marquee ----
function initCollectionCardClicks() {
  const bar   = document.getElementById('subcatMarqueeBar');
  const track = document.getElementById('subcatMarqueeTrack');
  const closeBtn = document.getElementById('subcatCloseBtn');

  document.querySelectorAll('.ct-card').forEach(card => {
    card.addEventListener('click', () => {
      const cat = card.dataset.cat;
      // Navigate to dedicated category page
      window.location.href = 'category.html?cat=' + cat;
    });
  });

  // Close button
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      bar.classList.remove('visible');
    });
  }
}

function filterAndScroll(cat) {
  // Activate the matching filter button
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.cat === cat || (cat === 'all' && b.dataset.cat === 'all'));
  });
  renderProducts(cat);
  // Scroll to products section
  const sec = document.getElementById('products');
  if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}



// ---- NAVBAR ----
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');

window.addEventListener('scroll', () => {
  if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 60);
  updateActiveLink();
});

// ---- SIDE MENU DRAWER ----
const sideMenu        = document.getElementById('sideMenu');
const sideMenuOverlay = document.getElementById('sideMenuOverlay');
const sideMenuClose   = document.getElementById('sideMenuClose');

function openSideMenu() {
  if (!sideMenu) return;
  sideMenu.classList.add('open');
  sideMenuOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  // Personalise user greeting
  const name    = localStorage.getItem('sc_user_name');
  const isLogin = localStorage.getItem('sc_isLoggedIn') === 'true';
  const nameEl  = document.getElementById('smUserName');
  const subEl   = document.getElementById('smUserSub');
  if (nameEl && isLogin && name) {
    nameEl.textContent = 'Hi, ' + name + '!';
    subEl.textContent  = 'View your orders & wishlist';
  }
}
function closeSideMenu() {
  if (!sideMenu) return;
  sideMenu.classList.remove('open');
  sideMenuOverlay.classList.remove('open');
  document.body.style.overflow = '';
}

if (hamburger)        hamburger.addEventListener('click', openSideMenu);
if (sideMenuClose)    sideMenuClose.addEventListener('click', closeSideMenu);
if (sideMenuOverlay)  sideMenuOverlay.addEventListener('click', closeSideMenu);

// Close drawer when any data-close link is clicked
document.querySelectorAll('.sm-link[data-close]').forEach(link => {
  link.addEventListener('click', closeSideMenu);
});



function updateActiveLink() {
  const sections = document.querySelectorAll('section[id]');
  let current = '';
  sections.forEach(s => {
    if (window.scrollY >= s.offsetTop - 120) current = s.id;
  });
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === '#' + current);
  });
}

// ---- SCROLL REVEAL ----
function initScrollReveal() {
  const revealEls = document.querySelectorAll(
    '.scroll-reveal, .scroll-reveal-left, .scroll-reveal-right, .why-card, .product-card, .coll-reveal'
  );
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const delay = el.dataset.delay ? parseInt(el.dataset.delay) : 0;
        setTimeout(() => el.classList.add('visible'), delay);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  revealEls.forEach(el => observer.observe(el));

  const psTitle = document.getElementById('psSplitTitle');
  if (psTitle) observer.observe(psTitle);
}

// ---- WEAR ANIMATION (Philosophy Section Normal Animation) ----
function initParallax() {
  const psSection  = document.getElementById('parallaxStatement');
  const psSub      = document.getElementById('psSub');
  
  if (!psSection) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        psSection.classList.add('is-visible');
        if (psSub) {
          setTimeout(() => psSub.classList.add('visible'), 600); // Trigger sub-text slightly after
        }
        observer.unobserve(psSection); // Run once
      }
    });
  }, { threshold: 0.3 });

  observer.observe(psSection);
}

// ---- PRODUCT DATA ----
const defaultProducts = [
  // ---- SHIRTS ----
  { id: 1,  name: "Plain Shirt",          cat: "shirt",  img: "Products/Shirt/Plain shirt.jpg",     price: 899,  original: 1299, off: 31, rating: 4.7, reviews: 312, badge: "Best Seller" },
  { id: 101,name: "Plain Shirt - Slim Fit",cat: "shirt", img: "Products/Shirt/Plain shirt.jpg",     price: 999,  original: 1399, off: 28, rating: 4.8, reviews: 145, badge: "" },
  { id: 102,name: "Plain Shirt - Premium",cat: "shirt",  img: "Products/Shirt/Plain shirt.jpg",     price: 1099, original: 1599, off: 31, rating: 4.9, reviews: 200, badge: "New" },
  { id: 2,  name: "Linen Shirt",          cat: "shirt",  img: "Products/Shirt/Linen shirt.png",     price: 1199, original: 1699, off: 29, rating: 4.8, reviews: 198, badge: "New"         },
  { id: 103,name: "Linen Shirt - Solid",  cat: "shirt",  img: "Products/Shirt/Linen shirt.png",     price: 1299, original: 1799, off: 27, rating: 4.7, reviews: 112, badge: "" },
  { id: 3,  name: "Printed Shirt",        cat: "shirt",  img: "Products/Shirt/Printed shirt.png",   price: 999,  original: 1399, off: 29, rating: 4.6, reviews: 245, badge: "Trending"   },
  { id: 104,name: "Printed Shirt - Floral",cat: "shirt", img: "Products/Shirt/Printed shirt.png",   price: 1099, original: 1499, off: 26, rating: 4.8, reviews: 321, badge: "Hot" },
  { id: 105,name: "Printed Shirt - Abstract",cat: "shirt",img: "Products/Shirt/Printed shirt.png",  price: 949,  original: 1399, off: 32, rating: 4.5, reviews: 89,  badge: "" },
  { id: 4,  name: "Branded Shirt",        cat: "shirt",  img: "Products/Shirt/Branded shirt.png",   price: 1499, original: 2199, off: 32, rating: 4.9, reviews: 167, badge: "Hot"         },
  { id: 5,  name: "Checked Shirt",        cat: "shirt",  img: "Products/Shirt/Checked shirt.png",   price: 1099, original: 1499, off: 27, rating: 4.7, reviews: 289, badge: ""            },
  { id: 106,name: "Checked Shirt - Vintage",cat: "shirt",img: "Products/Shirt/Checked shirt.png",   price: 1199, original: 1599, off: 25, rating: 4.6, reviews: 150, badge: "Trending" },
  { id: 6,  name: "Stripped Shirt",       cat: "shirt",  img: "Products/Shirt/Stripped shirt.png",  price: 999,  original: 1399, off: 29, rating: 4.5, reviews: 176, badge: ""            },
  { id: 7,  name: "Denim Shirt",          cat: "shirt",  img: "Products/Shirt/Denim shirt.png",     price: 1399, original: 1999, off: 30, rating: 4.8, reviews: 203, badge: "New"         },
  { id: 107,name: "Denim Shirt - Dark Wash",cat: "shirt",img: "Products/Shirt/Denim shirt.png",     price: 1499, original: 2099, off: 28, rating: 4.9, reviews: 312, badge: "Premium" },
  // ---- PANTS ----
  { id: 8,  name: "Jean Pant",            cat: "pant",   img: "Products/Pant/Jean pant.png",        price: 1299, original: 1899, off: 32, rating: 4.8, reviews: 421, badge: "Best Seller" },
  { id: 108,name: "Jean Pant - Black Wash",cat: "pant",  img: "Products/Pant/Jean pant.png",        price: 1399, original: 1999, off: 30, rating: 4.7, reviews: 215, badge: "New" },
  { id: 109,name: "Jean Pant - Slim Fit", cat: "pant",   img: "Products/Pant/Jean pant.png",        price: 1499, original: 2199, off: 31, rating: 4.9, reviews: 310, badge: "Premium" },
  { id: 9,  name: "Cotton Pant",          cat: "pant",   img: "Products/Pant/Cotton pant.png",      price: 999,  original: 1399, off: 29, rating: 4.7, reviews: 318, badge: ""            },
  { id: 110,name: "Cotton Pant - Beige",  cat: "pant",   img: "Products/Pant/Cotton pant.png",      price: 1099, original: 1499, off: 26, rating: 4.6, reviews: 150, badge: "" },
  { id: 10, name: "Baggy Pant",           cat: "pant",   img: "Products/Pant/Baggy pant.png",       price: 1199, original: 1699, off: 29, rating: 4.6, reviews: 256, badge: "Trending"   },
  { id: 111,name: "Baggy Pant - Vintage", cat: "pant",   img: "Products/Pant/Baggy pant.png",       price: 1299, original: 1799, off: 27, rating: 4.8, reviews: 180, badge: "Hot" },
  { id: 11, name: "Mom Fit Pant",         cat: "pant",   img: "Products/Pant/Mom fit pant.png",     price: 1099, original: 1599, off: 31, rating: 4.7, reviews: 189, badge: "New"         },
  { id: 112,name: "Mom Fit Pant - Light", cat: "pant",   img: "Products/Pant/Mom fit pant.png",     price: 1199, original: 1699, off: 29, rating: 4.5, reviews: 90, badge: "" },
  { id: 12, name: "Track Pant",           cat: "pant",   img: "Products/Pant/Track pant.png",       price: 799,  original: 1099, off: 27, rating: 4.5, reviews: 374, badge: "Hot"         },
  { id: 113,name: "Track Pant - Pro",     cat: "pant",   img: "Products/Pant/Track pant.png",       price: 899,  original: 1299, off: 30, rating: 4.7, reviews: 210, badge: "Premium" },
  { id: 114,name: "Track Pant - Casual",  cat: "pant",   img: "Products/Pant/Track pant.png",       price: 849,  original: 1199, off: 29, rating: 4.6, reviews: 150, badge: "" },
  // ---- T-SHIRTS ----
  { id: 13, name: "Hoodies T-Shirt",      cat: "tshirt", img: "Products/Tshirt/Hoodies tshirt.png",        price: 1299, original: 1899, off: 32, rating: 4.8, reviews: 512, badge: "Best Seller" },
  { id: 115,name: "Hoodies T-Shirt - Black",cat: "tshirt", img: "Products/Tshirt/Hoodies tshirt.png",      price: 1399, original: 1999, off: 30, rating: 4.9, reviews: 320, badge: "New" },
  { id: 116,name: "Hoodies T-Shirt - Graphic",cat: "tshirt",img: "Products/Tshirt/Hoodies tshirt.png",     price: 1499, original: 2099, off: 28, rating: 4.7, reviews: 210, badge: "" },
  { id: 14, name: "Collar T-Shirt",       cat: "tshirt", img: "Products/Tshirt/Collar tshirt.png",         price: 899,  original: 1299, off: 31, rating: 4.7, reviews: 298, badge: ""            },
  { id: 117,name: "Collar T-Shirt - Polo",cat: "tshirt", img: "Products/Tshirt/Collar tshirt.png",         price: 999,  original: 1399, off: 28, rating: 4.8, reviews: 150, badge: "Trending" },
  { id: 15, name: "Drop Shoulder T-Shirt",cat: "tshirt", img: "Products/Tshirt/Drop shoulder Tshirt.png",  price: 999,  original: 1399, off: 29, rating: 4.6, reviews: 341, badge: "Trending"   },
  { id: 118,name: "Drop Shoulder T-Shirt - Oversized",cat: "tshirt", img: "Products/Tshirt/Drop shoulder Tshirt.png",price: 1099, original: 1499, off: 26, rating: 4.9, reviews: 250, badge: "Premium" },
  { id: 119,name: "Drop Shoulder T-Shirt - Print",cat: "tshirt", img: "Products/Tshirt/Drop shoulder Tshirt.png",price: 1049, original: 1499, off: 30, rating: 4.7, reviews: 180, badge: "" },
  { id: 16, name: "Full Sleeve T-Shirt",  cat: "tshirt", img: "Products/Tshirt/Full sleeve Tshirt.png",    price: 1099, original: 1499, off: 27, rating: 4.9, reviews: 223, badge: "New"         },
  { id: 120,name: "Full Sleeve T-Shirt - Ribbed",cat: "tshirt",img: "Products/Tshirt/Full sleeve Tshirt.png", price: 1199, original: 1699, off: 29, rating: 4.8, reviews: 140, badge: "" },
  { id: 121,name: "Cargo Denim Shorts", cat: "shorts", img: "Logo.png", price: 699, original: 999, off: 30, rating: 4.7, reviews: 142, badge: "New" },
  { id: 122,name: "Cotton Chino Shorts", cat: "shorts", img: "Logo.png", price: 599, original: 899, off: 33, rating: 4.6, reviews: 98, badge: "" },
  { id: 123,name: "SuryaCotton Embroidered Cap", cat: "caps", img: "Logo.png", price: 399, original: 599, off: 33, rating: 4.8, reviews: 210, badge: "Trending" },
  { id: 124,name: "Classic Baseball Cap", cat: "caps", img: "Logo.png", price: 349, original: 499, off: 30, rating: 4.5, reviews: 115, badge: "" },
  { id: 125,name: "Leather Loop Keychain", cat: "keychains", img: "Logo.png", price: 199, original: 299, off: 33, rating: 4.9, reviews: 320, badge: "Hot" },
  { id: 126,name: "Metallic Crest Keychain", cat: "keychains", img: "Logo.png", price: 149, original: 249, off: 40, rating: 4.7, reviews: 180, badge: "" }
];
// Load cached products or fallback to default data
let products = JSON.parse(localStorage.getItem('sc_products') || '[]');
if (!products || !products.length) {
  products = [...defaultProducts];
} else {
  // Push any newly added default products that aren't in localStorage yet
  defaultProducts.forEach(dp => {
    if (!products.some(p => String(p.id) === String(dp.id))) {
      products.push(dp);
    }
  });
}
const seenMap = new Map();
products.forEach(p => {
  if (!p) return;
  const key = String(p.id || '').trim() || String(p.name || '').toLowerCase().trim();
  if (seenMap.has(key)) {
    seenMap.set(key, { ...seenMap.get(key), ...p });
  } else {
    seenMap.set(key, p);
  }
});
products = Array.from(seenMap.values()).map(p => {
  const origVal = parseInt(p.original) || 0;
  const priceVal = parseInt(p.price) || 0;
  const calcOff = (origVal > priceVal && origVal > 0) ? Math.round(((origVal - priceVal) / origVal) * 100) : (p.off || 0);
  const isPant = p && (p.cat === 'pant' || String(p.cat).toLowerCase() === 'pant');
  return {
    ...p,
    off: calcOff,
    rating: p.rating || 4.8,
    reviews: p.reviews !== undefined ? p.reviews : 0,
    sizes: isPant && (!p.sizes || p.sizes.length === 0 || p.sizes.includes('S')) ? ['28', '30', '32', '34', '36', '38'] : (p.sizes || ['S', 'M', 'L', 'XL', 'XXL'])
  };
});
localStorage.setItem('sc_products', JSON.stringify(products));
if (typeof window !== 'undefined') {
  window.products = products;
}

// ---- CART STATE ----
let cart = JSON.parse(localStorage.getItem('sc_cart') || '[]');
if (!Array.isArray(cart)) cart = [];
let wishlist = JSON.parse(localStorage.getItem('sc_wish') || '[]');
if (!Array.isArray(wishlist)) wishlist = [];

function saveCart() { localStorage.setItem('sc_cart', JSON.stringify(cart)); }
function saveWish()  { localStorage.setItem('sc_wish',  JSON.stringify(wishlist)); }

// ---- TOAST ----
const toast = document.getElementById('toast');
let toastTimer;
function showToast(msg) {
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ---- RENDER PRODUCTS ----
const grid = document.getElementById('productsGrid');
let activeFilter = 'all';

// ---- SHUFFLE UTILITY ----
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isProductTotallyStockedOut(p) {
  if (!p) return false;
  if (p.sizeStock && typeof p.sizeStock === 'object' && Object.keys(p.sizeStock).length > 0) {
    const totalSizeStock = Object.values(p.sizeStock).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    return totalSizeStock <= 0;
  }
  return p.stock !== undefined && parseInt(p.stock) <= 0;
}
window.isProductTotallyStockedOut = isProductTotallyStockedOut;

function renderProducts(cat) {
  if (!grid) return;
  activeFilter = cat;
  if (typeof window !== 'undefined') {
    window.activeFilter = cat;
    window.renderProducts = renderProducts;
    if (window.products && window.products.length) {
      products = window.products;
    }
  }
  
  // Filter products then shuffle for random display
  const base = cat === 'all' ? products : products.filter(p => p.cat === cat);
  const filteredProducts = shuffleArray(base);
  
  // Render cards
  const catLabel = { shirt: 'Shirt', pant: 'Pant', tshirt: 'T-Shirt', shorts: 'Shorts', caps: 'Caps', keychains: 'Keychains' };
  
  if (!filteredProducts.length) {
    grid.innerHTML = `<div class="empty-products-msg" style="grid-column: 1/-1; text-align: center; padding: 3.5rem 1rem; color: #666;">
      <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">🛍️</div>
      <h3 style="font-family: var(--font-display); font-size: 1.6rem; color: #222; margin-bottom: 0.4rem;">New Styles Arriving Soon</h3>
      <p style="font-size: 0.9rem; color: #777;">We are currently updating our ${catLabel[cat] || cat} collection. Check back shortly!</p>
    </div>`;
    return;
  }

  grid.innerHTML = filteredProducts.map((p, index) => {
    const isWish = wishlist.includes(p.id);
    const badgeHTML = p.badge ? `<div class="product-badge" data-type="${p.badge}">${p.badge}</div>` : '';
    const displayCat = catLabel[p.cat] || p.cat;
    const isStockout = isProductTotallyStockedOut(p);
    const stockoutOverlay = isStockout ? `<div class="stockout-slash-overlay"><div class="slash-line"></div><span class="slash-text">OUT OF STOCK</span></div>` : '';
    
    // Column position determines fly-in direction
    // Desktop: 3-col  → col 0 = from-left, col 1 = from-bottom, col 2 = from-right
    // Mobile:  2-col  → col 0 = from-left, col 1 = from-right  (no center)
    const col3 = index % 3; // desktop column (0,1,2)
    const col2 = index % 2; // mobile column  (0,1)
    
    let flyClass = '';
    if (col3 === 0)      flyClass = 'fly-left';
    else if (col3 === 1) flyClass = 'fly-bottom';
    else                 flyClass = 'fly-right';
    
    // Mobile override stored as data attribute
    const mobDir = col2 === 0 ? 'fly-left' : 'fly-right';
    
    return `
      <div class="product-card ${flyClass} ${isStockout ? 'stockout-card' : ''}" data-id="${p.id}" data-cat="${p.cat}" data-mob-dir="${mobDir}" onclick="window.location.href='product.html?id=${p.id}'">
        <div class="product-card-inner">
          <div class="product-img-wrap">
            <img src="${p.img}" alt="${p.name}" loading="lazy" />
            ${badgeHTML}
            ${stockoutOverlay}
            <button class="product-wish-float wish-btn ${isWish ? 'wishlisted' : ''}" onclick="event.stopPropagation(); toggleWishlist(${p.id}, this)">
              ${isWish ? '❤️' : '♡'}
            </button>
            <div class="product-actions" onclick="event.stopPropagation()">
              <button class="pa-btn add-cart-btn" onclick="addToCart(${p.id})">
                <span>Add to Cart</span>
              </button>
            </div>
          </div>
          <div class="product-info">
            <p class="product-cat">${displayCat}</p>
            <h3 class="product-name">${p.name}</h3>
            <div class="product-price">
              <span class="price-current">₹${p.price.toLocaleString()}</span>
              ${p.original > p.price ? `<span class="price-original">₹${p.original.toLocaleString()}</span>` : ''}
              ${p.off ? `<span class="price-off">${p.off}% off</span>` : ''}
            </div>
            <div class="product-rating">
              <span class="stars">${'★'.repeat(Math.floor(p.rating))}${p.rating % 1 !== 0 ? '★' : ''}</span>
              <span class="rating-count">(${p.reviews})</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Fly-in observer — triggers per row so all 3 land together
  observeProductCards();
}

function observeProductCards() {
  const cards = Array.from(grid.querySelectorAll('.product-card'));
  if (!cards.length) return;

  // Apply mobile direction overrides at 768px
  function applyMobileDir() {
    const isMobile = window.innerWidth <= 768;
    cards.forEach((card, idx) => {
      if (card.classList.contains('visible')) return;
      card.classList.remove('fly-left', 'fly-bottom', 'fly-right');
      if (isMobile) {
        // Switch to 2-col directions
        card.classList.add(card.dataset.mobDir || (idx % 2 === 0 ? 'fly-left' : 'fly-right'));
      } else {
        // Restore 3-col directions based on index
        const col = idx % 3;
        card.classList.add(col === 0 ? 'fly-left' : col === 1 ? 'fly-bottom' : 'fly-right');
      }
    });
  }
  applyMobileDir();
  window.addEventListener('resize', applyMobileDir, { passive: true });

  // Observe EVERY card individually so layout shifts or different heights on mobile never leave cards hidden
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const card = entry.target;
      const idx = cards.indexOf(card);
      const col = window.innerWidth <= 768 ? (idx % 2) : (idx % 3);
      
      setTimeout(() => {
        card.classList.add('visible');
      }, col * 60); // clean stagger across columns
      observer.unobserve(card);
    });
  }, { threshold: 0.05, rootMargin: '0px 0px 60px 0px' });

  cards.forEach(card => {
    // Check if card is already within viewport
    const rect = card.getBoundingClientRect();
    if (rect.top < window.innerHeight * 1.05 && rect.bottom > -50) {
      card.classList.add('visible');
    } else {
      observer.observe(card);
    }

    // Fallback safety: ensure all cards become visible or re-checked after images finish loading
    const img = card.querySelector('img');
    if (img) {
      img.addEventListener('load', () => {
        const updatedRect = card.getBoundingClientRect();
        if (updatedRect.top < window.innerHeight * 1.05 && updatedRect.bottom > -50) {
          card.classList.add('visible');
        }
      }, { once: true });
    }
  });

  // Safety fallback: if user scrolls fast or any card gets stuck hidden, reveal all visible/nearby cards
  setTimeout(() => {
    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      if (rect.top < window.innerHeight * 1.1 && rect.bottom > -50) {
        card.classList.add('visible');
      }
    });
  }, 250);
}

// ---- FILTER TABS ----
const filterTabs = document.getElementById('filterTabs');
if (filterTabs) {
  filterTabs.addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderProducts(btn.dataset.cat);
  });
}

// ---- CART FUNCTIONS ----
function addToCart(id) {
  const product = products.find(p => String(p.id) === String(id) || Number(p.id) === Number(id));
  if (!product) return;
  const existing = cart.find(i => String(i.id) === String(id) || Number(i.id) === Number(id));
  if (existing) { existing.qty += 1; }
  else { cart.push({ ...product, qty: 1 }); }
  saveCart();
  updateCartUI();
  showToast(`✓ "${product.name}" added to cart!`);
  // bounce cart icon
  const cartBtn = document.getElementById('cartBtn');
  if (cartBtn) {
    cartBtn.style.transform = 'scale(1.35)';
    setTimeout(() => cartBtn.style.transform = '', 300);
  }
}

function removeFromCart(id) {
  cart = cart.filter(i => String(i.id) !== String(id) && Number(i.id) !== Number(id));
  saveCart(); updateCartUI(); renderCartItems();
}

function changeQty(id, delta) {
  const item = cart.find(i => String(i.id) === String(id) || Number(i.id) === Number(id));
  if (!item) return;
  if (delta > 0) {
    const p = products.find(x => String(x.id) === String(item.id) || Number(x.id) === Number(item.id));
    if (p) {
      const availStock = p.sizeStock && item.size && p.sizeStock[item.size] !== undefined ? parseInt(p.sizeStock[item.size]) : (p.stock !== undefined ? parseInt(p.stock) : 10);
      if (item.qty + delta > availStock) {
        showToast(`Only ${availStock} item(s) available in stock!`);
        return;
      }
    }
  }
  item.qty += delta;
  if (item.qty <= 0) removeFromCart(id);
  else { saveCart(); updateCartUI(); renderCartItems(); }
}

function toggleWishlist(id, btn) {
  if (wishlist.includes(id)) {
    wishlist = wishlist.filter(i => i !== id);
    if(btn) {
      btn.classList.remove('wishlisted');
      btn.textContent = '♡';
    }
    showToast('Removed from wishlist');
  } else {
    wishlist.push(id);
    if(btn) {
      btn.classList.add('wishlisted');
      btn.textContent = '❤️';
    }
    showToast('❤️ Added to wishlist!');
  }
  saveWish();
}

function updateCartUI() {
  const total = cart.reduce((s, i) => s + i.qty, 0);
  const count = document.getElementById('cartCount');
  if (count) {
    count.textContent = total;
    count.classList.toggle('show', total > 0);
  }
  const totalEl = document.getElementById('cartTotal');
  if (totalEl) {
    totalEl.textContent = '₹' + cart.reduce((s, i) => s + i.price * i.qty, 0).toLocaleString();
  }
}

function renderCartItems() {
  const container = document.getElementById('cartItems');
  if (!container) return;
  if (!cart.length) {
    container.innerHTML = '<p class="cart-empty">Your cart is empty 🛍️</p>';
    return;
  }
  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <img class="cart-item-img" src="${item.img}" alt="${item.name}" />
      <div class="cart-item-info">
        <p class="cart-item-name">${item.name}</p>
        <p class="cart-item-price">₹${item.price.toLocaleString()}</p>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="changeQty(${item.id},-1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${item.id},+1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart(${item.id})">✕</button>
    </div>`).join('');
}

// ---- CART DRAWER TOGGLE ----
const cartOverlay = document.getElementById('cartOverlay');
const cartDrawer  = document.getElementById('cartDrawer');
const cartBtn     = document.getElementById('cartBtn');
const cartClose   = document.getElementById('cartClose');
const checkoutBtn = document.getElementById('checkoutBtn');

function openCart()  { if (cartDrawer && cartOverlay) { cartDrawer.classList.add('open'); cartOverlay.classList.add('open'); renderCartItems(); } }
function closeCart() { if (cartDrawer && cartOverlay) { cartDrawer.classList.remove('open'); cartOverlay.classList.remove('open'); } }

if (cartBtn) cartBtn.addEventListener('click', openCart);
if (cartClose) cartClose.addEventListener('click', closeCart);
if (cartOverlay) cartOverlay.addEventListener('click', closeCart);
if (checkoutBtn) {
  checkoutBtn.addEventListener('click', () => {
    if (!cart.length) { showToast('Your cart is empty!'); return; }
    
    // Validate stock before checkout
    for (const item of cart) {
      const p = products.find(x => String(x.id) === String(item.id) || Number(x.id) === Number(item.id));
      if (p) {
        const availStock = p.sizeStock && item.size && p.sizeStock[item.size] !== undefined ? parseInt(p.sizeStock[item.size]) : (p.stock !== undefined ? parseInt(p.stock) : 10);
        if (item.qty > availStock) {
          showToast(`Cannot checkout! Only ${availStock} item(s) available for "${item.name}" (${item.size || ''})`);
          return;
        }
      }
    }
    
    // Check if user is logged in
    const isLoggedIn = localStorage.getItem('sc_isLoggedIn') === 'true';
    if (!isLoggedIn) {
      showToast('Please login to continue checkout');
      setTimeout(() => { window.location.href = 'profile.html'; }, 1000);
      return;
    }
    
    window.location.href = 'checkout.html';
  });
}

// ---- TESTIMONIAL MARQUEE CLONE ----
const testiTrack = document.getElementById('testiTrack');
if (testiTrack) {
  try {
    const allGlobalReviews = JSON.parse(localStorage.getItem('sc_all_reviews') || '[]');
    const approvedReviews = allGlobalReviews.filter(r => r.status === 'approved' || !r.status);
    const recentReviews = approvedReviews.slice(0, 5);
    
    recentReviews.reverse().forEach(r => {
      const card = document.createElement('div');
      card.className = 'testi-card';
      const starsHtml = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'.repeat(r.stars || 5) + 
                        '<svg width="18" height="18" viewBox="0 0 24 24" fill="#e5e7eb"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>'.repeat(5 - (r.stars || 5));
      
      card.innerHTML = `
        <div class="testi-quote-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"></path><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25-.25 4-2.75 4v3c0 1 0 1 1 1z"></path></svg>
        </div>
        <div class="testi-user-info">
          <div class="testi-avatar"><img src="https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(r.name || 'User')}" alt="${r.name || 'User'}"></div>
          <div class="testi-meta">
            <h3>${r.name || 'Anonymous'}</h3>
            <p class="testi-role">${r.loc || 'India'}</p>
            <p class="testi-company"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Verified Buyer</p>
          </div>
        </div>
        <div class="testi-stars-new">
          ${starsHtml}
        </div>
        <p class="testi-text">&ldquo;${r.text}&rdquo;</p>
        ${r.image ? `
        <div class="testi-photo-wrap" style="margin-top: 1rem; display: flex; align-items: center; gap: 12px;">
          <div style="width: 65px; height: 65px; border-radius: 10px; overflow: hidden; border: 1.5px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.05); position: relative; cursor: pointer; flex-shrink: 0;" onclick="window.open('${r.image}', '_blank')" title="Click to view full photo">
            <img src="${r.image}" alt="Customer photo" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'" />
          </div>
          <span style="font-size: 0.72rem; font-weight: 700; color: #4f46e5; background: #e0e7ff; padding: 5px 12px; border-radius: 6px; letter-spacing: 0.5px;">📷 Verified Photo</span>
        </div>` : ''}
        <div class="testi-line"></div>
      `;
      testiTrack.insertBefore(card, testiTrack.firstChild);
    });
  } catch(e) { console.error(e); }

  // Clone cards to ensure smooth infinite marquee scroll
  const cards = Array.from(testiTrack.querySelectorAll('.testi-card'));
  if (cards.length > 0) {
    cards.forEach(card => {
      const clone = card.cloneNode(true);
      testiTrack.appendChild(clone);
    });
  }
}

// ---- CONTACT FORM ----
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', e => {
    e.preventDefault();
    showToast('✓ Message sent! We\'ll reply soon.');
    contactForm.reset();
  });
}

// ---- INIT ----
renderProducts('all');
updateCartUI();

// ---- HERO IMAGE SLIDER (AUTO PLAY) ----
(function initHeroSlider() {
  const slides = document.querySelectorAll('.hero-slide');
  if (slides.length === 0) return;
  
  let currentIdx = 0;
  
  function goToSlide(nextIdx) {
    if (nextIdx === currentIdx) return;
    
    // Position non-active slides
    slides.forEach((s, i) => {
      if (i !== currentIdx && i !== nextIdx) {
        s.className = 'hero-slide next';
      }
    });
    
    // Ensure next slide is in correct start position
    slides[nextIdx].className = 'hero-slide next';
    void slides[nextIdx].offsetWidth;
    
    // Animate
    slides[currentIdx].className = 'hero-slide prev';
    slides[nextIdx].className = 'hero-slide active';
    
    currentIdx = nextIdx;
  }
  
  setInterval(() => {
    const nextIdx = (currentIdx + 1) % slides.length;
    goToSlide(nextIdx);
  }, 4000);
})();

// Sync profile pic from localStorage on page load (Moved from index.html)
(function() {
  try {
    const isLoggedIn = localStorage.getItem('sc_isLoggedIn') === 'true';
    if (!isLoggedIn) return;
    const keys = Object.keys(localStorage).filter(k => k.startsWith('sc_profile_'));
    if (!keys.length) return;
    const profile = JSON.parse(localStorage.getItem(keys[0]) || '{}');
    const avatar = profile.avatar;
    if (avatar) {
      const navPic = document.getElementById('navProfilePic');
      const navIcon = document.getElementById('navProfileIcon');
      if (navPic) { navPic.src = avatar; navPic.classList.remove('hidden'); }
      if (navIcon) navIcon.style.display = 'none';
      
      const smImg = document.getElementById('smAvatarImg');
      const smIcon = document.getElementById('smAvatarIcon');
      if (smImg) { smImg.src = avatar; smImg.classList.remove('hidden'); }
      if (smIcon) smIcon.style.display = 'none';
    }
    const name = profile.name;
    if (name) {
      const smName = document.getElementById('smUserName');
      const smSub = document.getElementById('smUserSub');
      if (smName) smName.textContent = name;
      if (smSub) smSub.textContent = 'View your profile & orders';
    }
  } catch(e) {}
})();

// =============================================
// PROMOTIONAL FULLSCREEN SEQUENTIAL SLIDER LOGIC
// =============================================
(function() {
  const slides = document.querySelectorAll('#promoFsSlides .promo-fs-slide');
  const dots = document.querySelectorAll('#promoFsDots .promo-fs-dot');
  if (!slides.length) return;

  let currentIdx = 0;
  let slideTimer = null;

  function goToPromoSlide(nextIdx) {
    if (nextIdx === currentIdx) return;
    slides.forEach((slide, idx) => {
      slide.classList.remove('active', 'prev', 'next');
      if (idx === nextIdx) {
        slide.classList.add('active');
      } else if (idx === currentIdx) {
        slide.classList.add('prev');
      } else {
        slide.classList.add('next');
      }
    });

    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === nextIdx);
    });

    const ctaBtn = document.getElementById('promoFsCtaBtn');
    if (ctaBtn && slides[nextIdx]) {
      const targetHref = slides[nextIdx].getAttribute('href') || ('offers.html?banner=' + (nextIdx + 1));
      ctaBtn.setAttribute('href', targetHref);
    }

    currentIdx = nextIdx;
  }

  function startAutoSlide() {
    stopAutoSlide();
    slideTimer = setInterval(() => {
      const next = (currentIdx + 1) % slides.length;
      goToPromoSlide(next);
    }, 4200);
  }

  function stopAutoSlide() {
    if (slideTimer) clearInterval(slideTimer);
  }

  dots.forEach((dot, idx) => {
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      goToPromoSlide(idx);
      startAutoSlide();
    });
  });

  const sliderContainer = document.getElementById('promoFullscreenSlider');
  if (sliderContainer) {
    // Touch support for mobile swipe
    let startX = 0;
    sliderContainer.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      stopAutoSlide();
    }, { passive: true });

    sliderContainer.addEventListener('touchend', (e) => {
      const diffX = e.changedTouches[0].clientX - startX;
      if (Math.abs(diffX) > 40) {
        if (diffX < 0) {
          goToPromoSlide((currentIdx + 1) % slides.length);
        } else {
          goToPromoSlide((currentIdx - 1 + slides.length) % slides.length);
        }
      }
      startAutoSlide();
    }, { passive: true });
  }

  const ctaBtn = document.getElementById('promoFsCtaBtn');
  if (ctaBtn && slides[0]) {
    ctaBtn.setAttribute('href', slides[0].getAttribute('href') || 'offers.html?banner=1');
    ctaBtn.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    ctaBtn.addEventListener('touchend', (e) => {
      e.stopPropagation();
    });
  }

  startAutoSlide();
})();

