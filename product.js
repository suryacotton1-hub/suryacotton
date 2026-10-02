/* =============================================
   SURYA COTTANS — PRODUCT PAGE JS
   ============================================= */

// ---- PRODUCT DATA ----
const defaultProducts = [];
// Load cached products or fallback to default data
let products = JSON.parse(localStorage.getItem('sc_products') || '[]');
if (!Array.isArray(products)) products = [];

// Remove any lingering dummy products
const dummyProductNames = ['Plain Shirt', 'Linen Shirt', 'Printed Shirt', 'Branded Shirt', 'Checked Shirt', 'Stripped Shirt', 'Denim Shirt', 'Jean Pant', 'Cotton Pant', 'Baggy Pant', 'Mom Fit Pant', 'Track Pant', 'Hoodies T-Shirt', 'Collar T-Shirt', 'Drop Shoulder T-Shirt', 'Full Sleeve T-Shirt'];
if (products.some(p => dummyProductNames.includes(p.name))) {
  products = [];
  localStorage.setItem('sc_products', JSON.stringify([]));
}

if (typeof window !== 'undefined') {
  window.products = products;
}

// ---- CART ----
let cart = JSON.parse(localStorage.getItem('sc_cart') || '[]');
let wishlist = JSON.parse(localStorage.getItem('sc_wish') || '[]');
function saveCart() { localStorage.setItem('sc_cart', JSON.stringify(cart)); }

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

// ---- CART UI ----
function updateCartUI() {
  const total = cart.reduce((s,i) => s + i.qty, 0);
  const count = document.getElementById('cartCount');
  if (count) { count.textContent = total; count.classList.toggle('show', total > 0); }
  const totalEl = document.getElementById('cartTotal');
  if (totalEl) totalEl.textContent = '₹' + cart.reduce((s,i) => s + i.price * i.qty, 0).toLocaleString();
}

function renderCartItems() {
  const container = document.getElementById('cartItems');
  if (!container) return;
  if (!cart.length) { container.innerHTML = '<p class="cart-empty">Your cart is empty 🛍️</p>'; return; }
  container.innerHTML = cart.map(item => {
    const cId = item.cartItemId || item.id;
    const variantInfo = (item.size || item.color) ? `<p style="font-size: 0.75rem; color: #888; margin-bottom: 0.3rem;">${item.color ? 'Color: '+item.color : ''}${item.size && item.color ? ' | ' : ''}${item.size ? 'Size: '+item.size : ''}</p>` : '';
    return `
    <div class="cart-item">
      <img class="cart-item-img" src="${item.img}" alt="${item.name}" />
      <div class="cart-item-info">
        <p class="cart-item-name">${item.name}</p>
        ${variantInfo}
        <p class="cart-item-price">₹${item.price.toLocaleString()}</p>
        <div class="cart-item-qty">
          <button class="qty-btn" onclick="chgQty('${cId}',-1)">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="chgQty('${cId}',+1)">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="rmCart('${cId}')">✕</button>
    </div>`;
  }).join('');
}

function addToCart(product) {
  // Use cartItemId if provided, else fallback to id
  const cartId = product.cartItemId || product.id;
  const ex = cart.find(i => (i.cartItemId || i.id) === cartId);
  if (ex) ex.qty += qty;
  else cart.push({ ...product, qty });
  saveCart(); updateCartUI();
  showToast(`✓ "${product.name}" added to cart!`);
  const btn = document.getElementById('cartBtn');
  if (btn) { btn.style.transform = 'scale(1.35)'; setTimeout(() => btn.style.transform = '', 300); }
}

function chgQty(cartId, d) {
  const item = cart.find(i => String(i.cartItemId || i.id) === String(cartId));
  if (!item) return;
  if (d > 0) {
    const p = products.find(x => String(x.id) === String(item.id) || Number(x.id) === Number(item.id));
    if (p) {
      const availStock = p.sizeStock && item.size && p.sizeStock[item.size] !== undefined ? parseInt(p.sizeStock[item.size]) : (p.stock !== undefined ? parseInt(p.stock) : 10);
      if (item.qty + d > availStock) {
        showToast(`Only ${availStock} item(s) available in stock!`);
        return;
      }
    }
  }
  item.qty += d;
  if (item.qty <= 0) rmCart(cartId);
  else { saveCart(); updateCartUI(); renderCartItems(); }
}
function rmCart(cartId) { 
  cart = cart.filter(i => String(i.cartItemId || i.id) !== String(cartId)); 
  saveCart(); updateCartUI(); renderCartItems(); 
}

// Cart drawer
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

// Navbar hamburger
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');
if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => { hamburger.classList.toggle('open'); navLinks.classList.toggle('open'); });
  navLinks.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', () => { hamburger.classList.remove('open'); navLinks.classList.remove('open'); }));
}

// ---- PRODUCT PAGE INIT ----
let qty = 1;
let selectedSize = '';
let currentImgIdx = 0;

function getProductId() {
  const p = new URLSearchParams(window.location.search);
  const idVal = p.get('id');
  if (!idVal) return 1;
  return isNaN(idVal) ? idVal : (Number(idVal) || 1);
}

function renderProduct(p) {
  document.title = `${p.name} – SuryaCottans`;
  document.getElementById('pageTitle').textContent = `${p.name} – SuryaCottans`;
  document.getElementById('bcName').textContent = p.name;
  document.getElementById('bcCat').textContent = p.cat.charAt(0).toUpperCase() + p.cat.slice(1);
  document.getElementById('bcCat').href = `category.html?cat=${encodeURIComponent(p.cat)}`;

  const isAccessories = p.cat === 'caps' || p.cat === 'cap' || p.cat === 'keychains';
  if (!p.sizes || p.sizes.length === 0) {
    if (p.size) {
      p.sizes = [p.size];
    } else if (p.cat === 'pant' || String(p.cat).toLowerCase() === 'pant') {
      p.sizes = ['28', '30', '32', '34', '36', '38'];
    } else if (isAccessories) {
      p.sizes = ['Free Size'];
    } else {
      p.sizes = ['S', 'M', 'L', 'XL', 'XXL'];
    }
  }
  if (!p.colors || p.colors.length === 0) p.colors = [{ hex: '#212121', name: 'Black' }, { hex: '#ffffff', name: 'White' }];

  // Ratings
  const stars = Math.round(p.rating);
  document.getElementById('pdStars').textContent = '★'.repeat(stars) + '☆'.repeat(5-stars);
  document.getElementById('pdRatingVal').textContent = p.rating;
  document.getElementById('pdReviewCount').textContent = `(${p.reviews} reviews)`;

  // Name
  document.getElementById('pdName').textContent = p.name;

  // Price
  document.getElementById('pdPriceCurrent').textContent = '₹' + p.price.toLocaleString();
  document.getElementById('pdPriceOriginal').textContent = '₹' + p.original.toLocaleString();
  document.getElementById('pdPriceOff').textContent = p.off + '% OFF';

  // Badge
  const badgeEl = document.getElementById('pdBadge');
  badgeEl.textContent = p.badge || '';

  // 1. Render Product Highlights Badges
  const hlEl = document.getElementById('pdHighlights');
  if (hlEl) {
    const chips = [];
    if (p.brand) chips.push(`<span class="pd-highlight-chip"><span class="chip-icon">🏷️</span> Brand: <strong>${p.brand}</strong></span>`);
    if (p.fabric) chips.push(`<span class="pd-highlight-chip"><span class="chip-icon">🧵</span> Fabric: <strong>${p.fabric}</strong></span>`);
    if (p.fit) chips.push(`<span class="pd-highlight-chip"><span class="chip-icon">✂️</span> Fit: <strong>${p.fit}</strong></span>`);
    if (p.sleeve) chips.push(`<span class="pd-highlight-chip"><span class="chip-icon">👔</span> Sleeve: <strong>${p.sleeve}</strong></span>`);
    if (p.neck) chips.push(`<span class="pd-highlight-chip"><span class="chip-icon">👔</span> Collar: <strong>${p.neck}</strong></span>`);
    if (p.color) chips.push(`<span class="pd-highlight-chip"><span class="chip-icon">🎨</span> Color: <strong>${p.color}</strong></span>`);
    hlEl.innerHTML = chips.join('');
    hlEl.style.display = chips.length > 0 ? 'flex' : 'none';
  }

  // 2. Color Option Display
  const colorGroup = document.getElementById('pdColorGroup');
  const colorName = document.getElementById('pdColorName');
  const colorTag = document.getElementById('pdColorTag');
  if (colorGroup && colorName && colorTag) {
    if (p.color && String(p.color).trim().length > 0) {
      colorGroup.style.display = 'block';
      colorName.textContent = p.color;
      colorTag.innerHTML = `<span>🎨</span> <span>${p.color}</span>`;
    } else {
      colorGroup.style.display = 'none';
    }
  }

  // Gallery
  currentImgIdx = 0;
  renderGallery(p);

  // Category strip
  renderCategoryStrip(p);

  // Sizes
  selectedSize = '';
  renderSizes(p);

  // 3. Product Specifications Grid
  const specsGrid = document.getElementById('pdSpecsGrid');
  const specsCard = document.getElementById('pdSpecsCard');
  if (specsGrid && specsCard) {
    const specs = [];
    if (p.brand) specs.push({ label: 'Brand', icon: '🏷️', val: p.brand });
    if (p.fabric) specs.push({ label: 'Fabric / Material', icon: '🧵', val: p.fabric });
    if (p.fit) specs.push({ label: 'Fit Type', icon: '✂️', val: p.fit });
    if (p.sleeve) specs.push({ label: 'Sleeve Length', icon: '👔', val: p.sleeve });
    if (p.neck) specs.push({ label: 'Collar / Neck Style', icon: '👔', val: p.neck });
    if (p.color) specs.push({ label: 'Primary Color', icon: '🎨', val: p.color });
    if (p.subcat || p.subcategory) specs.push({ label: 'Style / Subcategory', icon: '✨', val: p.subcat || p.subcategory });
    if (p.cat) specs.push({ label: 'Category', icon: '📂', val: p.cat.toUpperCase() });

    // Stock availability
    const totalStock = p.sizeStock && typeof p.sizeStock === 'object' && Object.keys(p.sizeStock).length > 0 
      ? Object.values(p.sizeStock).reduce((a, b) => a + (parseInt(b) || 0), 0)
      : (p.stock !== undefined ? parseInt(p.stock) : 10);
    const stockStatus = totalStock <= 0 ? 'Out of Stock' : (totalStock < 10 ? `Low Stock (Only ${totalStock} left)` : `In Stock (${totalStock} available)`);
    specs.push({ label: 'Availability', icon: '📦', val: stockStatus });

    if (p.waist && Array.isArray(p.waist) && p.waist.length > 0) {
      specs.push({ label: 'Waist Sizes Available', icon: '👖', val: p.waist.join(', ') });
    } else if (p.sizes && Array.isArray(p.sizes) && p.sizes.length > 0) {
      specs.push({ label: 'Sizes Available', icon: '📏', val: p.sizes.join(', ') });
    }

    if (specs.length > 0) {
      specsCard.style.display = 'block';
      specsGrid.innerHTML = specs.map(s => `
        <div class="pd-spec-item">
          <span class="pd-spec-label"><span>${s.icon}</span> ${s.label}</span>
          <span class="pd-spec-val">${s.val}</span>
        </div>
      `).join('');
    } else {
      specsCard.style.display = 'none';
    }
  }

  // 4. Size & Fit Tab Note
  const sizeFitNote = document.getElementById('pdSizeFitNote');
  if (sizeFitNote) {
    sizeFitNote.textContent = p.fit ? `Fit Style: ${p.fit}. Please refer to the size chart below for the ideal fit.` : 'Please refer to the size chart below for the ideal fit.';
  }

  // Desc
  document.getElementById('pdDesc').textContent = p.desc || 'No description available for this product.';
  const featEl = document.getElementById('pdFeatures');
  if (featEl) {
    const dynamicFeatures = [];
    if (p.brand) dynamicFeatures.push(`Crafted by ${p.brand} with superior attention to detail`);
    if (p.fabric) dynamicFeatures.push(`Material: ${p.fabric} for maximum comfort & breathable wear`);
    if (p.fit) dynamicFeatures.push(`Tailored ${p.fit} for a modern, confident silhouette`);
    if (p.sleeve) dynamicFeatures.push(`Sleeve Type: ${p.sleeve}`);
    if (p.neck) dynamicFeatures.push(`Collar / Neck Style: ${p.neck}`);
    if (p.color) dynamicFeatures.push(`Color: ${p.color}`);
    dynamicFeatures.push('Authentic & 100% Quality Assured from SuryaCottons');
    featEl.innerHTML = dynamicFeatures.map(f => `<li>${f}</li>`).join('');
  }

  // Reviews
  const rvEl = document.getElementById('pdReviewsList');
  if (rvEl) {
    const defaultReviews = p.reviewsData || [];
    const allGlobalReviews = JSON.parse(localStorage.getItem('sc_all_reviews') || '[]');
    const dynamicReviews = allGlobalReviews.filter(r => r.productId === p.id && (r.status === 'approved' || !r.status));
    const reviews = [...dynamicReviews, ...defaultReviews];
    
    if (reviews.length === 0) {
      rvEl.innerHTML = '<p style="color:#777; font-size:0.9rem;">No reviews yet. Be the first to review!</p>';
    } else {
      rvEl.innerHTML = reviews.map(r => {
        const imgHtml = r.image ? `
          <div class="pd-rv-image-wrap" style="margin-top: 0.75rem;">
            <img src="${r.image}" alt="Customer Review Photo" class="pd-rv-image" style="width: 86px; height: 86px; object-fit: cover; border-radius: 10px; cursor: pointer; border: 1.5px solid #e2e8f0; transition: transform 0.2s;" onclick="window.openReviewLightbox('${r.image}')" />
          </div>` : '';
        return `
        <div class="pd-review-card">
          <div class="pd-rv-header">
            <span class="pd-rv-stars">${'★'.repeat(r.stars || 5)}${'☆'.repeat(5-(r.stars || 5))}</span>
            <span class="pd-rv-name">${r.name || 'Anonymous'}</span>
            <span class="pd-rv-date">${r.date || ''} ${r.loc ? '· ' + r.loc : ''}</span>
          </div>
          <p class="pd-rv-text">${r.text || ''}</p>
          ${imgHtml}
        </div>`;
      }).join('');
    }
  }

  // Related
  renderRelated(p);
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

function renderGallery(p) {
  const thumbsEl = document.getElementById('pdThumbs');
  const mainImg = document.getElementById('pdMainImg');
  const mainWrap = document.getElementById('pdMainWrap');
  if (mainWrap) {
    if (isProductTotallyStockedOut(p)) {
      mainWrap.classList.add('is-stockout');
    } else {
      mainWrap.classList.remove('is-stockout');
    }
  }

  const images = (p.images && p.images.length > 0) ? p.images : [p.img || 'Logo.png'];

  thumbsEl.innerHTML = images.map((img, i) => `
    <div class="pd-thumb ${i===0?'active':''}" data-idx="${i}">
      <img src="${img}" alt="View ${i+1}" />
    </div>`).join('');

  mainImg.src = images[0];
  mainImg.alt = p.name;

  thumbsEl.querySelectorAll('.pd-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      currentImgIdx = parseInt(thumb.dataset.idx);
      setMainImg(images, currentImgIdx);
    });
  });

  const prevBtn = document.getElementById('pdPrev');
  const nextBtn = document.getElementById('pdNext');
  
  if (prevBtn) {
    prevBtn.replaceWith(prevBtn.cloneNode(true));
    document.getElementById('pdPrev').addEventListener('click', () => {
      currentImgIdx = (currentImgIdx - 1 + images.length) % images.length;
      setMainImg(images, currentImgIdx);
    });
  }
  if (nextBtn) {
    nextBtn.replaceWith(nextBtn.cloneNode(true));
    document.getElementById('pdNext').addEventListener('click', () => {
      currentImgIdx = (currentImgIdx + 1) % images.length;
      setMainImg(images, currentImgIdx);
    });
  }
  initDesktopZoom();
}

function setMainImg(images, idx) {
  const mainImg = document.getElementById('pdMainImg');
  if (!mainImg) return;
  mainImg.style.opacity = '0';
  mainImg.style.transform = 'scale(1.04)';
  setTimeout(() => {
    mainImg.src = images[idx];
    mainImg.style.opacity = '1';
    mainImg.style.transform = 'scale(1)';
    const preview = document.getElementById('pdZoomPreview');
    if (preview) preview.style.backgroundImage = `url("${images[idx]}")`;
  }, 180);
  document.querySelectorAll('.pd-thumb').forEach((t,i) => t.classList.toggle('active', i===idx));
}

// ---- CATEGORY STRIP (replaces color swatches) ----
function renderCategoryStrip(current) {
  const stripEl = document.getElementById('pdCatStrip');
  const labelEl = document.getElementById('pdCatLabel');
  if (!stripEl) return;

  // Update label with capitalized category
  const catName = current.cat.charAt(0).toUpperCase() + current.cat.slice(1);
  if (labelEl) labelEl.textContent = catName;

  // Filter same-category products that are of the EXACT SAME type
  let siblings = products.filter(p => {
    if (String(p.id) === String(current.id) || Number(p.id) === Number(current.id)) return false;
    if (p.cat !== current.cat) return false;
    
    // Extract base name before any hyphens (e.g., "Plain Shirt - Slim Fit" -> "Plain Shirt")
    const getBaseName = name => name.split(' - ')[0].trim().toLowerCase();
    
    const base1 = getBaseName(p.name);
    const base2 = getBaseName(current.name);
    
    return base1 === base2 || base1.includes(base2) || base2.includes(base1);
  });

  if (siblings.length === 0) {
    // Hide the group if no siblings of the same exact type
    const group = document.getElementById('pdCatGroup');
    if (group) group.style.display = 'none';
    return;
  }

  // Show the group
  const group = document.getElementById('pdCatGroup');
  if (group) group.style.display = '';

  stripEl.innerHTML = siblings.map(p => `
    <a class="pd-cat-thumb" href="product.html?id=${p.id}" title="${p.name}">
      <div class="pd-cat-thumb-img">
        <img src="${p.img}" alt="${p.name}" loading="lazy" />
      </div>
      <span class="pd-cat-thumb-name">${p.name}</span>
    </a>`).join('');
}

function renderSizes(p) {
  const el = document.getElementById('pdSizes');
  const nameEl = document.getElementById('pdSizeName');
  const guideBtn = document.getElementById('pdSizeGuideBtn');

  // Hide size guide button for caps and keychains
  if (guideBtn) {
    const isAccessories = p.cat === 'caps' || p.cat === 'cap' || p.cat === 'keychains';
    guideBtn.style.display = isAccessories ? 'none' : '';
  }
  
  if (!p.sizes || p.sizes.length === 0) return;

  el.innerHTML = p.sizes.map(s => {
    const isOut = p.sizeStock && (p.sizeStock[s] === 0 || p.sizeStock[s] === "0" || parseInt(p.sizeStock[s]) <= 0);
    const outClass = isOut ? ' out' : '';
    const titleAttr = isOut ? ' title="Out of Stock"' : '';
    return `<button class="pd-size-btn${outClass}" data-size="${s}" type="button"${titleAttr}>${s}</button>`;
  }).join('');

  if (nameEl) nameEl.textContent = 'Select a size';

  el.querySelectorAll('.pd-size-btn:not(.out)').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSize = btn.dataset.size;
      if (nameEl) nameEl.textContent = selectedSize;
      el.querySelectorAll('.pd-size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Cap quantity if it exceeds available stock for this size
      const availStock = p.sizeStock && p.sizeStock[selectedSize] !== undefined ? parseInt(p.sizeStock[selectedSize]) : (p.stock || 100);
      if (qty > availStock && availStock > 0) {
        qty = availStock;
        document.getElementById('pdQtyVal').textContent = qty;
        showToast(`Quantity capped to available stock (${availStock})`);
      }
    });
  });

  // If only 1 size option (e.g. Free Size / Adjustable for caps), auto-select it
  if (p.sizes.length === 1) {
    const singleBtn = el.querySelector('.pd-size-btn:not(.out)');
    if (singleBtn) {
      singleBtn.click();
    }
  }
}

function renderRelated(current) {
  // Reverted to original logic: show other products in the same category, fill with random if needed
  const related = products.filter(p => p.id !== current.id && p.cat === current.cat).slice(0, 4);
  const fill = products.filter(p => p.id !== current.id && !related.includes(p));
  const shown = [...related, ...fill].slice(0, 4);

  const grid = document.getElementById('pdRelatedGrid');
  const section = document.querySelector('.pd-related');
  
  if (shown.length === 0) {
    if (section) section.style.display = 'none';
    if (grid) grid.innerHTML = '';
    return;
  }
  
  if (section) section.style.display = 'block';

  grid.innerHTML = shown.map(p => {
    const isStockout = isProductTotallyStockedOut(p);
    const stockoutOverlay = isStockout ? `<div class="stockout-slash-overlay"><div class="slash-line"></div><span class="slash-text">OUT OF STOCK</span></div>` : '';
    return `
    <div class="pd-rel-card ${isStockout ? 'stockout-card' : ''}" onclick="window.location.href='product.html?id=${p.id}'">
      <div class="pd-rel-img" style="position:relative;"><img src="${p.img}" alt="${p.name}" loading="lazy" />${stockoutOverlay}</div>
      <div class="pd-rel-info">
        <p class="pd-rel-cat">${p.cat}</p>
        <p class="pd-rel-name">${p.name}</p>
        <span class="pd-rel-price">₹${p.price.toLocaleString()}</span>
        <span class="pd-rel-orig">₹${p.original.toLocaleString()}</span>
      </div>
    </div>`;
  }).join('');
}

// ---- QTY CONTROLS ----
document.getElementById('pdQtyMinus').addEventListener('click', () => {
  if (qty > 1) { qty--; document.getElementById('pdQtyVal').textContent = qty; }
});
document.getElementById('pdQtyPlus').addEventListener('click', () => {
  const pid = getProductId();
  const p = products.find(x => String(x.id) === String(pid) || Number(x.id) === Number(pid));
  let maxAvail = 10;
  if (p) {
    if (selectedSize && p.sizeStock && p.sizeStock[selectedSize] !== undefined) {
      maxAvail = parseInt(p.sizeStock[selectedSize]);
    } else if (p.sizeStock && Object.keys(p.sizeStock).length > 0) {
      maxAvail = Math.max(...Object.values(p.sizeStock).map(v => parseInt(v) || 0));
    } else if (p.stock !== undefined) {
      maxAvail = parseInt(p.stock);
    }
  }
  if (qty < maxAvail) { 
    qty++; 
    document.getElementById('pdQtyVal').textContent = qty; 
  } else {
    showToast(`Only ${maxAvail} item(s) available in stock!`);
  }
});

// ---- CTA ----
function handleAddToCart() {
  if (!selectedSize) { 
    openSizeSelectModal('cart');
    return; 
  }
  const pid = getProductId();
  const p = products.find(x => String(x.id) === String(pid) || Number(x.id) === Number(pid));
  if (!p) return;
  
  const availStock = p.sizeStock && p.sizeStock[selectedSize] !== undefined ? parseInt(p.sizeStock[selectedSize]) : (p.stock !== undefined ? parseInt(p.stock) : 10);
  if (availStock <= 0) {
    showToast(`Sorry, Size "${selectedSize}" is currently Out of Stock!`);
    return;
  }
  
  const cartItemId = `${p.id}-${selectedSize}`;
  const ex = cart.find(i => (i.cartItemId || i.id) === cartItemId);
  const newTotalQty = ex ? (ex.qty + qty) : qty;
  if (newTotalQty > availStock) {
    showToast(`Cannot add! Only ${availStock} item(s) available in Size "${selectedSize}".`);
    return;
  }
  
  if (ex) ex.qty += qty;
  else cart.push({ 
    id: p.id, 
    cartItemId: cartItemId,
    name: p.name, 
    img: p.img, 
    price: p.price, 
    original: p.original, 
    qty,
    size: selectedSize
  });
  
  saveCart(); updateCartUI();
  showToast(`✓ "${p.name}" added to cart!`);
  const btn = document.getElementById('cartBtn');
  if (btn) { btn.style.transform = 'scale(1.35)'; setTimeout(() => btn.style.transform = '', 300); }
}

function handleBuyNow() {
  if (!selectedSize) { 
    openSizeSelectModal('buy');
    return; 
  }
  const pid = getProductId();
  const p = products.find(x => String(x.id) === String(pid) || Number(x.id) === Number(pid));
  if (!p) return;
  
  const availStock = p.sizeStock && p.sizeStock[selectedSize] !== undefined ? parseInt(p.sizeStock[selectedSize]) : (p.stock !== undefined ? parseInt(p.stock) : 10);
  if (availStock <= 0) {
    showToast(`Sorry, Size "${selectedSize}" is currently Out of Stock!`);
    return;
  }
  if (qty > availStock) {
    showToast(`Only ${availStock} item(s) available in Size "${selectedSize}".`);
    return;
  }
  
  const cartItemId = `${p.id}-${selectedSize}`;
  const buyNowCart = [{
    id: p.id, 
    cartItemId: cartItemId,
    name: p.name, 
    img: p.img, 
    price: p.price, 
    original: p.original, 
    qty,
    size: selectedSize
  }];
  localStorage.setItem('sc_buy_now', JSON.stringify(buyNowCart));
  window.location.href = 'checkout.html?mode=buynow';
}

// ---- SELECT SIZE MODAL LOGIC ----
let pendingAction = null;

function openSizeSelectModal(action) {
  pendingAction = action;
  const modal = document.getElementById('pdSizeSelectModal');
  const sizesContainer = document.getElementById('pdSsmSizes');
  const overlay = document.getElementById('pdModalOverlay');
  if (!modal || !sizesContainer) return;
  
  const p = products.find(x => String(x.id) === String(getProductId()) || Number(x.id) === Number(getProductId()));
  if (!p || !p.sizes) return;
  
  sizesContainer.innerHTML = p.sizes.map(s => {
    const isOut = p.sizeStock && (p.sizeStock[s] === 0 || p.sizeStock[s] === "0" || parseInt(p.sizeStock[s]) <= 0);
    const outClass = isOut ? ' out' : '';
    const titleAttr = isOut ? ' title="Out of Stock"' : '';
    return `<button class="pd-size-btn ssm-size-btn${outClass}" data-size="${s}" type="button"${titleAttr}>${s}</button>`;
  }).join('');
  
  // Mark active if already selected (just in case)
  if (selectedSize) {
    const activeBtn = Array.from(sizesContainer.querySelectorAll('.ssm-size-btn')).find(b => b.dataset.size === selectedSize);
    if (activeBtn) activeBtn.classList.add('active');
  }
  
  sizesContainer.querySelectorAll('.ssm-size-btn:not(.out)').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSize = btn.dataset.size;
      // Sync UI with main page
      const nameEl = document.getElementById('pdSizeName');
      if (nameEl) nameEl.textContent = selectedSize;
      
      document.querySelectorAll('#pdSizes .pd-size-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.size === selectedSize);
      });
      sizesContainer.querySelectorAll('.ssm-size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const availStock = p.sizeStock && p.sizeStock[selectedSize] !== undefined ? parseInt(p.sizeStock[selectedSize]) : (p.stock || 10);
      if (qty > availStock && availStock > 0) {
        qty = availStock;
        document.getElementById('pdQtyVal').textContent = qty;
        showToast(`Quantity capped to available stock (${availStock})`);
      }
    });
  });
  
  modal.classList.add('open');
  overlay.classList.add('open');
}

const ssmClose = document.getElementById('pdSizeSelectClose');
const ssmContinue = document.getElementById('pdSsmContinueBtn');

if (ssmClose) {
  ssmClose.addEventListener('click', () => {
    document.getElementById('pdSizeSelectModal').classList.remove('open');
    document.getElementById('pdModalOverlay').classList.remove('open');
    pendingAction = null;
  });
}

if (ssmContinue) {
  ssmContinue.addEventListener('click', () => {
    if (!selectedSize) {
      showToast('⚠️ Please select a size first');
      return;
    }
    document.getElementById('pdSizeSelectModal').classList.remove('open');
    document.getElementById('pdModalOverlay').classList.remove('open');
    
    if (pendingAction === 'cart') handleAddToCart();
    else if (pendingAction === 'buy') handleBuyNow();
    pendingAction = null;
  });
}

// Desktop CTA
document.getElementById('pdAddCartBtn').addEventListener('click', handleAddToCart);
document.getElementById('pdBuyBtn').addEventListener('click', handleBuyNow);

// Mobile CTA
document.getElementById('pdMobAddBtn').addEventListener('click', handleAddToCart);
document.getElementById('pdMobBuyBtn').addEventListener('click', handleBuyNow);

// ---- TABS ----
document.querySelectorAll('.pd-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.pd-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.pd-tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.getElementById('tab-' + tab.dataset.tab);
    if (panel) panel.classList.add('active');
  });
});

// ---- SIZE MODAL ----
const sizeModal   = document.getElementById('pdSizeModal');
const modalOverlay = document.getElementById('pdModalOverlay');
const modalClose  = document.getElementById('pdModalClose');

document.getElementById('pdSizeGuideBtn').addEventListener('click', () => {
  sizeModal.classList.add('open');
  modalOverlay.classList.add('open');
});
modalClose.addEventListener('click', () => { sizeModal.classList.remove('open'); modalOverlay.classList.remove('open'); });
modalOverlay.addEventListener('click', () => { sizeModal.classList.remove('open'); modalOverlay.classList.remove('open'); });

// ---- MAIN IMG transition style ----
const mainImg = document.getElementById('pdMainImg');
mainImg.style.transition = 'opacity 0.18s ease, transform 0.18s ease';

// ---- INIT ----
updateCartUI();
const pid = getProductId();
const product = products.find(p => String(p.id) === String(pid) || Number(p.id) === Number(pid));
if (typeof window !== 'undefined') {
  window.getProductId = getProductId;
  window.renderProduct = renderProduct;
  window.initProductAnimations = initProductAnimations;
}
if (product) {
  renderProduct(product);
  setTimeout(initProductAnimations, 100);
}
else {
  // Wait for Firestore sync before redirecting if product was just added by admin
  window.addEventListener('scProductsSynced', (e) => {
    const synced = e.detail || [];
    const found = synced.find(p => String(p.id) === String(pid) || Number(p.id) === Number(pid));
    if (found) {
      renderProduct(found);
      setTimeout(initProductAnimations, 100);
    } else {
      showToast('Product not found in catalogue.');
      setTimeout(() => { window.location.href = 'category.html?cat=all'; }, 2000);
    }
  });
}

// ---- GSAP ANIMATIONS ----
function initProductAnimations() {
  if (typeof gsap === 'undefined') return;
  
  if (typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
  }

  const tl = gsap.timeline();
  
  tl.fromTo('.pd-main-img-wrap', 
    { opacity: 0, y: 30 }, 
    { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }
  )
  .fromTo('.pd-thumb', 
    { opacity: 0, x: -20 }, 
    { opacity: 1, x: 0, duration: 0.5, stagger: 0.1, ease: "power2.out" }, 
    "-=0.5"
  );

  gsap.fromTo('.pd-info > *', 
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: "power2.out", delay: 0.2 }
  );
}

// Navbar scroll
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

// Review form removed — reviews are now submitted from Profile → Delivered Orders

// ---- AMAZON / FLIPKART STYLE IMAGE ZOOM (DESKTOP) ----
function initDesktopZoom() {
  const wrap = document.getElementById('pdMainWrap');
  const mainImg = document.getElementById('pdMainImg');
  const lens = document.getElementById('pdZoomLens');
  const preview = document.getElementById('pdZoomPreview');
  if (!wrap || !mainImg || !lens || !preview) return;

  function updateZoomImg() {
    preview.style.backgroundImage = `url("${mainImg.src}")`;
  }

  if (wrap._zoomInitialized) {
    updateZoomImg();
    return;
  }
  wrap._zoomInitialized = true;

  wrap.addEventListener('mouseenter', () => {
    if (window.innerWidth <= 768) return;
    updateZoomImg();
    wrap.classList.add('zooming');
  });

  wrap.addEventListener('mouseleave', () => {
    wrap.classList.remove('zooming');
  });

  wrap.addEventListener('mousemove', (e) => {
    if (window.innerWidth <= 768 || !wrap.classList.contains('zooming')) return;
    const rect = wrap.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const lensW = lens.offsetWidth || 150;
    const lensH = lens.offsetHeight || 150;

    let lensX = x - lensW / 2;
    let lensY = y - lensH / 2;

    if (lensX < 0) lensX = 0;
    if (lensY < 0) lensY = 0;
    if (lensX > rect.width - lensW) lensX = rect.width - lensW;
    if (lensY > rect.height - lensH) lensY = rect.height - lensH;

    lens.style.left = `${lensX}px`;
    lens.style.top = `${lensY}px`;

    const ratioX = lensX / (rect.width - lensW);
    const ratioY = lensY / (rect.height - lensH);

    preview.style.backgroundPosition = `${ratioX * 100}% ${ratioY * 100}%`;
  });
}

window.openReviewLightbox = function(url) {
  const overlay = document.getElementById('pdLightboxOverlay');
  const img = document.getElementById('pdLightboxImg');
  if (overlay && img) {
    img.src = url;
    overlay.style.display = 'flex';
  }
};

const lbCloseBtn = document.getElementById('pdLightboxClose');
const lbOverlay = document.getElementById('pdLightboxOverlay');
if (lbCloseBtn && lbOverlay) {
  lbCloseBtn.addEventListener('click', () => lbOverlay.style.display = 'none');
  lbOverlay.addEventListener('click', (e) => {
    if (e.target === lbOverlay) lbOverlay.style.display = 'none';
  });
}

