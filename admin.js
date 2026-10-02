/* =========================================
   SURYA COTTANS — ADMIN DASHBOARD JS
   ========================================= */

// Automatic Clean URL Sanitizer
(function () {
  try {
    if (window.location.protocol.startsWith('http') && window.location.pathname.endsWith('.html')) {
      let cleanPath = window.location.pathname.replace(/\.html$/, '');
      const cleanUrl = cleanPath + window.location.search + window.location.hash;
      window.history.replaceState(null, '', cleanUrl);
    }
  } catch (e) {}
})();

// ---- IMPORT FIREBASE SDKs VIA ESM CDN ----
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, setDoc, getDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { uploadProductImage, deleteProductImage } from "./supabase-config.js";
import { migrateExistingProductImages } from "./migrate-images.js";

// ---- CONFIGURATION AND INITIALIZATION ----
const firebaseConfig = {
  apiKey: "AIzaSyCI5Wp50544lasNyUgeXaXG0JXGEjeQ36s",
  authDomain: "surya-cottans.firebaseapp.com",
  projectId: "surya-cottans",
  messagingSenderId: "654029093109",
  appId: "1:654029093109:web:60246a1322fdf002ba6dbc",
  measurementId: "G-KWC6WYYJ0R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Sign in anonymously so that Firebase Security Rules allow writes
signInAnonymously(auth).catch((error) => {
  console.error("Anonymous auth failed:", error);
});

// --- GLOBAL APPLICATION STATE ---
let products = [];
let orders = [];

// --- AUTHENTICATION HELPERS (Cross-tab & Multi-window support) ---
function checkAdminAuth() {
  return localStorage.getItem('sc_admin_auth_798') === 'true' ||
         sessionStorage.getItem('sc_admin_auth_798') === 'true';
}

function setAdminAuth() {
  localStorage.setItem('sc_admin_auth_798', 'true');
  sessionStorage.setItem('sc_admin_auth_798', 'true');
}

function clearAdminAuth() {
  localStorage.removeItem('sc_admin_auth_798');
  sessionStorage.removeItem('sc_admin_auth_798');
  localStorage.removeItem('sc_admin_auth');
  sessionStorage.removeItem('sc_admin_auth');
}

// --- LOGIN OVERLAY ---
const loginOverlay = document.getElementById('adminLoginOverlay');
const loginBtn = document.getElementById('adminLoginBtn');
const loginPass = document.getElementById('adminPass');
const loginErr = document.getElementById('adminLoginError');
const dashboard = document.getElementById('adminDashboard');

function doAdminLogin() {
  const enteredPass = (loginPass ? loginPass.value.trim() : '');
  if (enteredPass === 'Suryacotton@798') {
    if (loginErr) loginErr.style.display = 'none';
    setAdminAuth();
    if (loginOverlay) loginOverlay.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');
    try {
      initDashboard();
    } catch (err) {
      console.warn("Login init error:", err);
    }
  } else {
    if (loginErr) {
      loginErr.textContent = 'Invalid passcode. Please try again.';
      loginErr.style.display = 'block';
    }
  }
}

if (loginBtn) {
  loginBtn.addEventListener('click', doAdminLogin);
}

if (loginPass) {
  loginPass.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') doAdminLogin();
  });
}

// Admin Logout
const adminLogoutBtn = document.getElementById('adminLogoutBtn');
if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener('click', () => {
    clearAdminAuth();
    window.location.reload();
  });
}

// --- NAVIGATION TABS & MOBILE DRAWER ---
const adminSidebar = document.getElementById('adminSidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const mobileNavToggle = document.getElementById('mobileNavToggle');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');

function openMobileSidebar() {
  const sb = document.getElementById('adminSidebar') || adminSidebar;
  const bd = document.getElementById('sidebarBackdrop') || sidebarBackdrop;
  if (sb) sb.classList.add('open');
  if (bd) bd.classList.add('show');
  document.body.classList.add('sidebar-drawer-open');
}
function closeMobileSidebar() {
  const sb = document.getElementById('adminSidebar') || adminSidebar;
  const bd = document.getElementById('sidebarBackdrop') || sidebarBackdrop;
  if (sb) sb.classList.remove('open');
  if (bd) bd.classList.remove('show');
  document.body.classList.remove('sidebar-drawer-open');
}

window.openMobileSidebar = openMobileSidebar;
window.closeMobileSidebar = closeMobileSidebar;

if (mobileNavToggle) mobileNavToggle.addEventListener('click', openMobileSidebar);
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeMobileSidebar);
if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeMobileSidebar);

// Global event delegation for mobile drawer (fail-safe for dynamic rendering / page reloads)
document.addEventListener('click', (e) => {
  const toggle = e.target.closest('#mobileNavToggle') || e.target.closest('.mobile-nav-toggle');
  if (toggle) {
    e.preventDefault();
    openMobileSidebar();
    return;
  }
  const close = e.target.closest('#closeSidebarBtn') || e.target.closest('.close-sidebar-btn') || e.target.closest('#sidebarBackdrop') || e.target.closest('.sidebar-backdrop');
  if (close) {
    e.preventDefault();
    closeMobileSidebar();
    return;
  }
});

// Robust Tab Switching (Global & Fail-Safe)
window.switchAdminTab = function(tabName) {
  if (!tabName) return;

  // 1. Update button states
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // 2. Update content sections
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  const targetSection = document.getElementById('tab-' + tabName);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // 3. Update title
  const activeBtn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle && activeBtn) {
    pageTitle.textContent = activeBtn.textContent.trim();
  }

  // 4. Force-close any open modals or mobile backdrops that could capture clicks
  const prodModal = document.getElementById('productEditModal');
  const orderModal = document.getElementById('orderViewModal');
  if (prodModal) prodModal.classList.remove('show');
  if (orderModal) orderModal.classList.remove('show');
  closeMobileSidebar();

  // 5. Fresh render for active section
  try {
    if (tabName === 'overview') renderOverview();
    else if (tabName === 'products') renderProducts();
    else if (tabName === 'orders') renderOrders();
    else if (tabName === 'reviews') renderReviews();
  } catch (renderErr) {
    console.warn(`Render notice for tab ${tabName}:`, renderErr);
  }
};

// Global event delegation for nav buttons (works across reloads and tab discards)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-btn');
  if (btn && btn.dataset && btn.dataset.tab) {
    window.switchAdminTab(btn.dataset.tab);
  }
});

// Close modals on clicking overlay backdrop outside the modal box
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('show');
    }
  });
});

// ESC key listener to close any open modal or drawer
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(o => o.classList.remove('show'));
    closeMobileSidebar();
  }
});

// Tab/Window Switch Re-sync & Unresponsive Guard
function onTabRevisit() {
  if (checkAdminAuth()) {
    if (loginOverlay) loginOverlay.classList.add('hidden');
    if (dashboard) dashboard.classList.remove('hidden');

    // Ensure desktop layout is completely clean of any mobile backdrops
    if (window.innerWidth > 992) {
      closeMobileSidebar();
    }

    // Quietly sync latest data from storage in case changes occurred in another tab
    try {
      const storedProds = JSON.parse(localStorage.getItem('sc_products') || '[]');
      if (Array.isArray(storedProds) && storedProds.length > 0) {
        products = storedProds;
      }
      const storedOrders = JSON.parse(localStorage.getItem('sc_all_orders') || '[]');
      if (Array.isArray(storedOrders) && storedOrders.length > 0) {
        orders = storedOrders;
      }
      const activeTab = document.querySelector('.nav-btn.active')?.dataset?.tab || 'overview';
      if (activeTab === 'overview') renderOverview();
      else if (activeTab === 'products') renderProducts();
      else if (activeTab === 'orders') renderOrders();
      else if (activeTab === 'reviews') renderReviews();
    } catch (e) {
      console.warn("Tab revisit re-sync notice:", e);
    }
  }
}

window.addEventListener('focus', onTabRevisit);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    onTabRevisit();
  }
});

// --- TOAST ---
const toast = document.getElementById('toast');
let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// --- DATA INITIALIZATION ---
async function loadData() {
  // Load products from Firestore
  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    const firestoreProducts = [];
    querySnapshot.forEach((docSnap) => {
      // docSnap.id is the authoritative unique identifier in Firestore
      const data = docSnap.data() || {};
      firestoreProducts.push({ ...data, id: String(docSnap.id).trim() });
    });
    if (firestoreProducts.length > 0) {
      const seenMap = new Map();
      firestoreProducts.forEach(p => {
        if (!p) return;
        const key = String(p.id || '').trim();
        if (key) {
          seenMap.set(key, p);
        }
      });
      products = Array.from(seenMap.values()).map(p => {
        const origVal = parseInt(p.original) || 0;
        const priceVal = parseInt(p.price) || 0;
        const calcOff = (origVal > priceVal && origVal > 0) ? Math.round(((origVal - priceVal) / origVal) * 100) : (p.off || 0);
        return {
          ...p,
          id: String(p.id).trim(),
          off: calcOff,
          rating: p.rating || 4.8,
          reviews: p.reviews !== undefined ? p.reviews : 0
        };
      });
      localStorage.setItem('sc_products', JSON.stringify(products));
    } else {
      products = [];
      localStorage.setItem('sc_products', JSON.stringify([]));
    }
  } catch(e) {
    console.error("Error fetching products from Firestore:", e);
    products = [];
    localStorage.setItem('sc_products', JSON.stringify([]));
  }
  
  // Load orders from Backend API (Supabase DB), Firestore & local storage
  try {
    const combinedMap = new Map();

    // 1. Fetch from Backend API (Supabase DB)
    try {
      const getBackendUrl = () => {
        if (typeof window !== 'undefined' && window.BACKEND_URL) return window.BACKEND_URL.replace(/\/$/, '');
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:3000';
        return 'https://backend-s6kq.onrender.com';
      };
      const bRes = await fetch(`${getBackendUrl()}/api/orders`);
      if (bRes.ok) {
        const bData = await bRes.json();
        if (bData.orders && Array.isArray(bData.orders)) {
          bData.orders.forEach(bo => {
            combinedMap.set(String(bo.id), {
              id: bo.id,
              date: bo.created_at,
              customerName: bo.customer_name,
              customerEmail: bo.customer_email,
              customerPhone: bo.customer_phone,
              customerAltPhone: bo.customer_alt_phone,
              customerAddress: bo.shipping_address,
              customerCity: bo.city,
              customerState: bo.state,
              customerPin: bo.pincode,
              items: bo.products || [],
              total: parseFloat(bo.total_amount) || 0,
              status: bo.payment_status === 'PAID' ? 'Processing' : bo.payment_status,
              shiprocket_order_id: bo.shiprocket_order_id,
              shipment_id: bo.shiprocket_shipment_id,
              awb_code: bo.awb_code,
              courier_name: bo.courier_name,
              shipment_status: bo.shipment_status,
              tracking_url: bo.tracking_url
            });
          });
        }
      }
    } catch(bErr) {
      console.warn("Backend orders fetch notice:", bErr.message);
    }

    // 2. Fetch from Firestore
    try {
      const ordersSnap = await getDocs(collection(db, "orders"));
      ordersSnap.forEach((doc) => {
        const data = doc.data();
        const existing = combinedMap.get(String(data.id));
        combinedMap.set(String(data.id), { firestoreId: doc.id, ...existing, ...data });
      });
    } catch(fsErr) {
      console.warn("Firestore orders fetch notice:", fsErr.message);
    }

    // 3. Merge Local Storage Orders
    const localOrders = JSON.parse(localStorage.getItem('sc_all_orders') || '[]');
    localOrders.forEach(o => {
      if (o && o.id) {
        const existing = combinedMap.get(String(o.id));
        if (!existing) {
          combinedMap.set(String(o.id), o);
        } else {
          combinedMap.set(String(o.id), { ...o, ...existing });
        }
      }
    });

    orders = Array.from(combinedMap.values());
    localStorage.setItem('sc_all_orders', JSON.stringify(orders));
  } catch(e) {
    console.error("Error fetching orders:", e);
    orders = JSON.parse(localStorage.getItem('sc_all_orders') || '[]');
  }

  // Load free shipping setting from Firestore or local fallback
  try {
    const settingsSnap = await getDoc(doc(db, "settings", "shipping"));
    if (settingsSnap.exists()) {
      const isFree = !!settingsSnap.data().freeShipping;
      localStorage.setItem('sc_free_shipping', String(isFree));
      const toggle = document.getElementById('freeShippingToggle');
      if (toggle) toggle.checked = isFree;
      updateFreeShippingLabel(isFree);
    } else {
      const isFree = localStorage.getItem('sc_free_shipping') === 'true';
      const toggle = document.getElementById('freeShippingToggle');
      if (toggle) toggle.checked = isFree;
      updateFreeShippingLabel(isFree);
    }
  } catch (e) {
    const isFree = localStorage.getItem('sc_free_shipping') === 'true';
    const toggle = document.getElementById('freeShippingToggle');
    if (toggle) toggle.checked = isFree;
    updateFreeShippingLabel(isFree);
  }

  renderOverview();
  renderProducts();
  if (typeof renderOrders === 'function') renderOrders();

  // ── Background Shiprocket Status Sync (Fallback) ──
  // Non-blocking: sync Shiprocket statuses on admin page load to catch missed webhooks
  try {
    const getBackendUrl = () => {
      if (typeof window !== 'undefined' && window.BACKEND_URL) return window.BACKEND_URL.replace(/\/$/, '');
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:3000';
      return 'https://backend-s6kq.onrender.com';
    };
    fetch(`${getBackendUrl()}/api/admin/sync-shiprocket-status`)
      .then(r => r.json())
      .then(syncData => {
        if (syncData.success && syncData.synced > 0) {
          console.log(`[SHIPROCKET FALLBACK] Admin sync: ${syncData.synced} order(s) updated.`, syncData.changes);
          // Re-fetch fresh orders from backend and re-render
          fetch(`${getBackendUrl()}/api/orders`)
            .then(r2 => r2.json())
            .then(freshData => {
              if (freshData.orders && Array.isArray(freshData.orders)) {
                freshData.orders.forEach(bo => {
                  const existing = orders.find(o => String(o.id) === String(bo.id));
                  if (existing) {
                    existing.shipment_status = bo.shipment_status;
                    existing.awb_code = bo.awb_code || existing.awb_code;
                    existing.courier_name = bo.courier_name || existing.courier_name;
                    existing.shiprocket_order_id = bo.shiprocket_order_id || existing.shiprocket_order_id;
                    existing.shipment_id = bo.shiprocket_shipment_id || existing.shipment_id;
                    existing.tracking_url = bo.tracking_url || existing.tracking_url;
                  }
                });
                localStorage.setItem('sc_all_orders', JSON.stringify(orders));
                renderOrders();
                showToast(`Shiprocket sync: ${syncData.synced} status update(s) applied.`);
              }
            })
            .catch(() => {});
        }
      })
      .catch(syncErr => {
        console.warn('[SHIPROCKET FALLBACK] Background sync notice:', syncErr.message);
      });
  } catch (e) {
    // Non-critical: silently ignore sync errors
  }
}

window.toggleFreeShipping = async function(isChecked) {
  localStorage.setItem('sc_free_shipping', String(isChecked));
  updateFreeShippingLabel(isChecked);
  showToast(isChecked ? 'Delivery cost turned OFF (FREE Shipping ₹0)' : 'Normal Delivery cost enabled (₹40)');
  try {
    await setDoc(doc(db, "settings", "shipping"), { freeShipping: isChecked }, { merge: true });
  } catch(e) {
    console.warn("Firestore shipping setting update error:", e);
  }
};

function updateFreeShippingLabel(isFree) {
  const lbl = document.getElementById('freeShippingStatusLabel');
  if (lbl) {
    lbl.textContent = isFree ? '✅ Delivery Cost is OFF (FREE Shipping Active)' : 'Turn OFF Delivery Cost (FREE Shipping)';
    lbl.style.color = isFree ? '#166534' : '#0f172a';
  }
}

function initDashboard() {
  loadData();
  renderOrders();
  renderReviews();
}

// --- OVERVIEW TAB ---
function renderOverview() {
  const totalRev = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  document.getElementById('statRevenue').textContent = '₹' + totalRev.toLocaleString();
  document.getElementById('statOrders').textContent = orders.length;
  document.getElementById('statProducts').textContent = products.length;
}

// --- PRODUCTS TAB FILTERS & SEARCH ---
let adminProdSearchQuery = '';
let adminProdCatFilter = 'all';

window.filterAdminProducts = function() {
  const inp = document.getElementById('productSearchInput');
  const clearBtn = document.getElementById('clearProdSearch');
  adminProdSearchQuery = inp ? inp.value.trim().toLowerCase() : '';
  if (clearBtn) clearBtn.style.display = adminProdSearchQuery.length > 0 ? 'flex' : 'none';
  renderProducts();
};

window.setAdminCatFilter = function(cat) {
  adminProdCatFilter = cat || 'all';
  document.querySelectorAll('.admin-cat-pill').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-cat') === adminProdCatFilter);
  });
  renderProducts();
};

// --- PRODUCTS TAB ---
function renderProducts() {
  const tbody = document.getElementById('productsTableBody');
  const countBadge = document.getElementById('productsCountBadge');
  if (!tbody) return;

  let filtered = [...products];

  // Category filter
  if (adminProdCatFilter && adminProdCatFilter !== 'all') {
    filtered = filtered.filter(p => {
      const c = String(p.cat || '').toLowerCase();
      const target = adminProdCatFilter.toLowerCase();
      if (c === target) return true;
      if (target === 'tshirt' && (c === 't-shirt' || c === 'tshirts' || c === 't-shirts')) return true;
      if (target === 'shirt' && c === 'shirts') return true;
      if (target === 'pant' && (c === 'pants' || c === 'jeans' || c === 'trouser' || c === 'trousers')) return true;
      if (target === 'shorts' && (c === 'short' || c === 'shorts')) return true;
      if (target === 'caps' && (c === 'cap' || c === 'caps')) return true;
      if (target === 'keychains' && (c === 'keychain' || c === 'keychains')) return true;
      return false;
    });
  }

  // Search filter
  if (adminProdSearchQuery) {
    filtered = filtered.filter(p => {
      const q = adminProdSearchQuery;
      const name = String(p.name || '').toLowerCase();
      const brand = String(p.brand || '').toLowerCase();
      const subcat = String(p.subcat || p.subcategory || '').toLowerCase();
      const fabric = String(p.fabric || '').toLowerCase();
      const fit = String(p.fit || '').toLowerCase();
      const color = String(p.color || '').toLowerCase();
      const id = String(p.id || '').toLowerCase();
      return name.includes(q) || brand.includes(q) || subcat.includes(q) || fabric.includes(q) || fit.includes(q) || color.includes(q) || id.includes(q);
    });
  }

  if (countBadge) {
    if (products.length === 0) {
      countBadge.textContent = '';
    } else if (filtered.length === products.length) {
      countBadge.textContent = `(${products.length} Products Total)`;
    } else {
      countBadge.textContent = `(Showing ${filtered.length} of ${products.length} Products)`;
    }
  }

  if (!filtered || filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 3rem 1rem; color: #64748b;">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">📦</div>
          <strong style="font-size: 1.1rem; color: #0f172a; display: block; margin-bottom: 0.25rem;">${products.length === 0 ? 'No Products in Catalogue' : 'No Matching Products Found'}</strong>
          <p style="margin: 0; font-size: 0.88rem; color: #64748b;">${products.length === 0 ? 'Click <strong>+ Add Product</strong> above to upload your first product.' : 'Try changing your search term or category filter.'}</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const mainImg = (p.images && p.images.length > 0) ? p.images[0] : (p.img || 'Logo.png');
    const priceStr = p.price !== undefined ? p.price.toLocaleString() : '0';
    const originalStr = p.original !== undefined ? p.original.toLocaleString() : '0';

    // Stock calculation & per-size preview
    let stockDisplay = '';
    const totalStock = p.sizeStock && typeof p.sizeStock === 'object' && Object.keys(p.sizeStock).length > 0 
      ? Object.values(p.sizeStock).reduce((a, b) => a + (parseInt(b) || 0), 0)
      : (p.stock !== undefined ? parseInt(p.stock) : 0);
    
    if (totalStock <= 0) {
      stockDisplay = `<span class="prod-stock-badge prod-stock-out">Out of Stock</span>`;
    } else if (totalStock < 10) {
      stockDisplay = `<span class="prod-stock-badge prod-stock-low">Low: ${totalStock} left</span>`;
    } else {
      stockDisplay = `<span class="prod-stock-badge prod-stock-in">${totalStock} in Stock</span>`;
    }

    // Detail tags preview
    const metaTags = [];
    if (p.brand) metaTags.push(`Brand: ${p.brand}`);
    if (p.fabric) metaTags.push(`Fabric: ${p.fabric}`);
    if (p.fit) metaTags.push(`Fit: ${p.fit}`);
    if (p.sleeve) metaTags.push(`Sleeve: ${p.sleeve}`);
    if (p.neck) metaTags.push(`Neck: ${p.neck}`);
    if (p.color) metaTags.push(`Color: ${p.color}`);
    const metaTagsHtml = metaTags.slice(0, 4).map(t => `<span class="prod-meta-tag">${t}</span>`).join('');

    const subcatLabel = (p.subcat || p.subcategory) ? `<span style="display:block; font-size:0.75rem; color:#64748b; font-weight:600;">${p.subcat || p.subcategory}</span>` : '';

    return `
      <tr>
        <td><img src="${mainImg}" class="prod-img" alt="${p.name}" /></td>
        <td>
          <strong style="color:#0f172a; font-size:0.95rem;">${p.name}</strong>
          ${p.badge ? `<br><span style="font-size:0.75rem; color:var(--red); font-weight:700;">★ ${p.badge}</span>` : ''}
          <div style="margin-top:4px;">${metaTagsHtml}</div>
        </td>
        <td>
          <strong style="text-transform: capitalize; color:#0f172a;">${p.cat}</strong>
          ${subcatLabel}
        </td>
        <td>₹${priceStr} <br><small style="text-decoration:line-through; color:var(--text-light)">₹${originalStr}</small></td>
        <td>${stockDisplay}</td>
        <td>
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
            <button class="action-btn" onclick="window.openEditProduct('${p.id}')">Edit</button>
            <button class="action-btn" style="color: var(--red);" onclick="window.deleteProduct('${p.id}')">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Delete Product
window.deleteProduct = async function(id) {
  if (confirm('Are you sure you want to delete this product?')) {
    try {
      const prodToDelete = products.find(x => String(x.id) === String(id));
      if (prodToDelete) {
        if (prodToDelete.images && Array.isArray(prodToDelete.images)) {
          for (const imgUrl of prodToDelete.images) {
            await deleteProductImage(imgUrl);
          }
        } else if (prodToDelete.img) {
          await deleteProductImage(prodToDelete.img);
        }
      }
      await deleteDoc(doc(db, "products", String(id)));
      products = products.filter(x => String(x.id) !== String(id));
      localStorage.setItem('sc_products', JSON.stringify(products));
      renderProducts();
      renderOverview();
      showToast('Product deleted successfully.');
    } catch(e) {
      console.error("Error deleting document: ", e);
      showToast('Failed to delete product.');
    }
  }
};

// --- DYNAMIC PRODUCT MODAL LOGIC ---
const prodModal = document.getElementById('productEditModal');
const catSelect = document.getElementById('editProdCat');
const dynamicFieldsContainer = document.getElementById('dynamicFieldsContainer');
const fileInput = document.getElementById('editProdImages');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
let selectedFiles = []; // Holds File objects for upload
let existingImages = []; // Holds existing image URLs

const categoryTemplates = {
  shirt: `
    <div class="form-row">
      <div class="form-group">
        <label>Subcategory / Style</label>
        <select id="df_subcat">
          <option value="">-- Select Style (Optional) --</option>
          <option value="Plain Shirt">Plain Shirt</option>
          <option value="Linen Shirt">Linen Shirt</option>
          <option value="Printed Shirt">Printed Shirt</option>
          <option value="Branded Shirt">Branded Shirt</option>
          <option value="Checked Shirt">Checked Shirt</option>
          <option value="Stripped Shirt">Stripped Shirt</option>
          <option value="Denim Shirt">Denim Shirt</option>
          <option value="Casual Shirt">Casual Shirt</option>
          <option value="Formal Shirt">Formal Shirt</option>
        </select>
      </div>
      <div class="form-group"><label>Brand</label><input type="text" id="df_brand" placeholder="e.g. SuryaCottons"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Fabric</label><input type="text" id="df_fabric" placeholder="e.g. 100% Cotton, Linen"></div>
      <div class="form-group"><label>Fit</label><input type="text" id="df_fit" placeholder="e.g. Slim Fit, Regular Fit"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Sleeve Type</label><select id="df_sleeve"><option value="Full Sleeve">Full Sleeve</option><option value="Half Sleeve">Half Sleeve</option><option value="Roll-up Sleeve">Roll-up Sleeve</option></select></div>
      <div class="form-group"><label>Collar / Neck Type</label><input type="text" id="df_neck" placeholder="e.g. Spread Collar, Mandarin, Button-down"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Color</label><input type="text" id="df_color" placeholder="e.g. Navy Blue, White"></div>
      <div class="form-group"><label>Size</label><div class="checkbox-group" id="df_size"><label><input type="checkbox" value="S"> S</label><label><input type="checkbox" value="M"> M</label><label><input type="checkbox" value="L"> L</label><label><input type="checkbox" value="XL"> XL</label><label><input type="checkbox" value="XXL"> XXL</label></div></div>
    </div>
  `,
  pant: `
    <div class="form-row">
      <div class="form-group">
        <label>Subcategory / Style</label>
        <select id="df_subcat">
          <option value="">-- Select Style (Optional) --</option>
          <option value="Jean Pant">Jean Pant</option>
          <option value="Cotton Pant">Cotton Pant</option>
          <option value="Baggy Pant">Baggy Pant</option>
          <option value="Mom Fit Pant">Mom Fit Pant</option>
          <option value="Track Pant">Track Pant</option>
          <option value="Cargo Pant">Cargo Pant</option>
          <option value="Chinos">Chinos</option>
          <option value="Formal Trouser">Formal Trouser</option>
        </select>
      </div>
      <div class="form-group"><label>Brand</label><input type="text" id="df_brand" placeholder="e.g. SuryaCottons"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Fabric</label><input type="text" id="df_fabric" placeholder="e.g. Cotton Twill, Denim, Stretch"></div>
      <div class="form-group"><label>Fit</label><select id="df_fit"><option value="Slim Fit">Slim Fit</option><option value="Regular Fit">Regular Fit</option><option value="Straight Fit">Straight Fit</option><option value="Relaxed Fit">Relaxed Fit</option><option value="Baggy Fit">Baggy Fit</option><option value="Mom Fit">Mom Fit</option><option value="Cargo Fit">Cargo Fit</option><option value="Jogger Fit">Jogger Fit</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Color</label><input type="text" id="df_color" placeholder="e.g. Black, Khaki, Denim Blue"></div>
      <div class="form-group"><label>Waist Size</label><div class="checkbox-group" id="df_waist"><label><input type="checkbox" value="28"> 28</label><label><input type="checkbox" value="30"> 30</label><label><input type="checkbox" value="32"> 32</label><label><input type="checkbox" value="34"> 34</label><label><input type="checkbox" value="36"> 36</label><label><input type="checkbox" value="38"> 38</label></div></div>
    </div>
  `,
  tshirt: `
    <div class="form-row">
      <div class="form-group">
        <label>Subcategory / Style</label>
        <select id="df_subcat">
          <option value="">-- Select Style (Optional) --</option>
          <option value="Collar T-Shirt">Collar T-Shirt</option>
          <option value="Drop Shoulder T-Shirt">Drop Shoulder T-Shirt</option>
          <option value="Full Sleeve T-Shirt">Full Sleeve T-Shirt</option>
          <option value="Hoodies T-Shirt">Hoodies T-Shirt</option>
          <option value="Round Neck T-Shirt">Round Neck T-Shirt</option>
          <option value="Oversized T-Shirt">Oversized T-Shirt</option>
        </select>
      </div>
      <div class="form-group"><label>Brand</label><input type="text" id="df_brand" placeholder="e.g. SuryaCottons"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Fabric</label><input type="text" id="df_fabric" placeholder="e.g. 100% Combed Cotton, Bio-Wash"></div>
      <div class="form-group"><label>Neck Type</label><select id="df_neck"><option value="Round Neck">Round Neck</option><option value="Collar">Collar (Polo)</option><option value="V-Neck">V-Neck</option><option value="Hooded">Hooded</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Sleeve Type</label><select id="df_sleeve"><option value="Half Sleeve">Half Sleeve</option><option value="Full Sleeve">Full Sleeve</option><option value="Drop Shoulder">Drop Shoulder</option><option value="Sleeveless">Sleeveless</option></select></div>
      <div class="form-group"><label>Fit</label><select id="df_fit"><option value="Regular">Regular</option><option value="Oversized">Oversized</option><option value="Slim Fit">Slim Fit</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Color</label><input type="text" id="df_color" placeholder="e.g. Jet Black, Olive Green"></div>
      <div class="form-group"><label>Size</label><div class="checkbox-group" id="df_size"><label><input type="checkbox" value="S"> S</label><label><input type="checkbox" value="M"> M</label><label><input type="checkbox" value="L"> L</label><label><input type="checkbox" value="XL"> XL</label><label><input type="checkbox" value="XXL"> XXL</label></div></div>
    </div>
  `,
  shorts: `
    <div class="form-row">
      <div class="form-group">
        <label>Subcategory / Style</label>
        <select id="df_subcat">
          <option value="">-- Select Style (Optional) --</option>
          <option value="Cargo Shorts">Cargo Shorts</option>
          <option value="Denim Shorts">Denim Shorts</option>
          <option value="Cotton Shorts">Cotton Shorts</option>
          <option value="Athletic Shorts">Athletic Shorts</option>
        </select>
      </div>
      <div class="form-group"><label>Brand</label><input type="text" id="df_brand" placeholder="e.g. SuryaCottons"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Fabric</label><input type="text" id="df_fabric" placeholder="e.g. Cotton, Denim"></div>
      <div class="form-group"><label>Color</label><input type="text" id="df_color" placeholder="e.g. Beige, Grey, Navy"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Waist Size</label><input type="text" id="df_waist" placeholder="e.g. 30, 32, 34"></div>
      <div class="form-group"><label>Size</label><div class="checkbox-group" id="df_size"><label><input type="checkbox" value="M"> M</label><label><input type="checkbox" value="L"> L</label><label><input type="checkbox" value="XL"> XL</label><label><input type="checkbox" value="XXL"> XXL</label></div></div>
    </div>
  `,
  caps: `
    <div class="form-row">
      <div class="form-group">
        <label>Subcategory / Style</label>
        <select id="df_subcat">
          <option value="">-- Select Style (Optional) --</option>
          <option value="Baseball Cap">Baseball Cap</option>
          <option value="Snapback Cap">Snapback Cap</option>
          <option value="Embroidered Cap">Embroidered Cap</option>
        </select>
      </div>
      <div class="form-group"><label>Brand</label><input type="text" id="df_brand" placeholder="e.g. SuryaCottons"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Color</label><input type="text" id="df_color" placeholder="e.g. Black, Maroon"></div>
      <div class="form-group"><label>Size</label><select id="df_size"><option value="Free Size">Free Size</option><option value="Adjustable">Adjustable</option></select></div>
    </div>
  `,
  keychains: `
    <div class="form-row">
      <div class="form-group">
        <label>Subcategory / Style</label>
        <select id="df_subcat">
          <option value="">-- Select Style (Optional) --</option>
          <option value="Leather Keychain">Leather Keychain</option>
          <option value="Metallic Crest Keychain">Metallic Crest Keychain</option>
          <option value="Fabric Keychain">Fabric Keychain</option>
        </select>
      </div>
      <div class="form-group"><label>Brand</label><input type="text" id="df_brand" placeholder="e.g. SuryaCottons"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Material / Fabric</label><input type="text" id="df_fabric" placeholder="e.g. Genuine Leather, Alloy Metal"></div>
      <div class="form-group"><label>Color</label><input type="text" id="df_color" placeholder="e.g. Tan Brown, Silver"></div>
    </div>
  `
};

function renderSizeStockInputs(initialStockMap = null) {
  const container = document.getElementById('sizeStockContainer');
  const grid = document.getElementById('sizeStockGrid');
  const stockInput = document.getElementById('editProdStock');
  if (!container || !grid) return;

  // Find all checked size/waist checkboxes in dynamic fields
  let checkedSizes = [];
  const sizeEl = document.getElementById('df_size');
  if (sizeEl && sizeEl.classList.contains('checkbox-group')) {
    sizeEl.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => checkedSizes.push(cb.value));
  }
  const waistEl = document.getElementById('df_waist');
  if (waistEl && waistEl.classList.contains('checkbox-group')) {
    waistEl.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => checkedSizes.push(cb.value));
  }

  if (checkedSizes.length === 0) {
    container.style.display = 'none';
    if (stockInput) {
      stockInput.readOnly = false;
      stockInput.style.background = '';
      stockInput.style.cursor = '';
    }
    return;
  }

  container.style.display = 'block';
  if (stockInput) {
    stockInput.readOnly = true;
    stockInput.style.background = '#f1f5f9';
    stockInput.style.cursor = 'not-allowed';
  }

  // Preserve any currently typed values in existing input fields if initialStockMap is null
  let currentValues = {};
  if (initialStockMap) {
    currentValues = { ...initialStockMap };
  } else {
    grid.querySelectorAll('.size-stock-input').forEach(inp => {
      currentValues[inp.dataset.size] = parseInt(inp.value) || 0;
    });
  }

  grid.innerHTML = checkedSizes.map(sz => {
    const val = currentValues[sz] !== undefined ? currentValues[sz] : 1;
    return `
      <div style="background: white; border: 1px solid #cbd5e1; padding: 0.5rem; border-radius: 8px; text-align: center;">
        <label style="font-size: 0.8rem; font-weight: 700; color: #334155; display: block; margin-bottom: 4px;">Size ${sz}</label>
        <input type="number" class="size-stock-input" data-size="${sz}" value="${val}" min="0" style="width: 100%; padding: 4px; text-align: center; font-weight: 700; border: 1.5px solid var(--black); border-radius: 6px;" oninput="window.calcTotalStockFromSizes()" />
      </div>
    `;
  }).join('');

  window.calcTotalStockFromSizes();
}

window.calcTotalStockFromSizes = function() {
  const grid = document.getElementById('sizeStockGrid');
  const stockInput = document.getElementById('editProdStock');
  if (!grid || !stockInput) return;
  let total = 0;
  grid.querySelectorAll('.size-stock-input').forEach(inp => {
    total += (parseInt(inp.value) || 0);
  });
  stockInput.value = total;
};

window.syncCategoryPills = function(catVal) {
  const grid = document.getElementById('categorySelectorGrid');
  if (!grid) return;
  grid.querySelectorAll('.cat-pill-btn').forEach(btn => {
    if (btn.getAttribute('data-val') === catVal) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
};

function updateDynamicFields(cat) {
  dynamicFieldsContainer.innerHTML = categoryTemplates[cat] || '';
  window.syncCategoryPills(cat);
  
  const formDetails = document.getElementById('productFormDetails');
  const saveBtn = document.getElementById('saveProductBtn');
  
  if (cat) {
    if (formDetails) formDetails.style.display = 'block';
    if (saveBtn) saveBtn.style.display = 'block';
  } else {
    if (formDetails) formDetails.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'none';
  }

  // Attach change listeners to size/waist checkboxes
  dynamicFieldsContainer.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => renderSizeStockInputs());
  });
  renderSizeStockInputs();
}

const categoryGrid = document.getElementById('categorySelectorGrid');
if (categoryGrid) {
  categoryGrid.querySelectorAll('.cat-pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-val');
      if (catSelect) catSelect.value = val;
      updateDynamicFields(val);
    });
  });
}

catSelect.addEventListener('change', (e) => {
  updateDynamicFields(e.target.value);
});

// Image handling
fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  if (selectedFiles.length + existingImages.length + files.length > 5) {
    alert("You can only upload a maximum of 5 images.");
    return;
  }
  selectedFiles = selectedFiles.concat(files);
  renderImagePreviews();
});

function renderImagePreviews() {
  imagePreviewContainer.innerHTML = '';
  // Render existing images
  existingImages.forEach((url, idx) => {
    const div = document.createElement('div');
    div.className = 'image-preview-item';
    div.innerHTML = `
      <img src="${url}" />
      <button class="remove-btn" onclick="removeExistingImage(${idx})">✕</button>
    `;
    imagePreviewContainer.appendChild(div);
  });
  // Render new files
  selectedFiles.forEach((file, idx) => {
    const div = document.createElement('div');
    div.className = 'image-preview-item';
    const reader = new FileReader();
    reader.onload = (e) => {
      div.innerHTML = `
        <img src="${e.target.result}" />
        <button class="remove-btn" onclick="removeNewImage(${idx})">✕</button>
      `;
    };
    reader.readAsDataURL(file);
    imagePreviewContainer.appendChild(div);
  });
}

window.removeExistingImage = function(idx) {
  existingImages.splice(idx, 1);
  renderImagePreviews();
};
window.removeNewImage = function(idx) {
  selectedFiles.splice(idx, 1);
  renderImagePreviews();
};

window.openEditProduct = function(id) {
  const p = products.find(x => String(x.id) === String(id));
  if (!p) return;
  document.getElementById('editProdId').value = p.id;
  document.getElementById('editProdName').value = p.name;
  document.getElementById('editProdPrice').value = p.price;
  document.getElementById('editProdOriginal').value = p.original;
  document.getElementById('editProdStock').value = p.stock || '';
  document.getElementById('editProdCat').value = p.cat;
  document.getElementById('editProdBadge').value = p.badge || '';
  document.getElementById('editProdDesc').value = p.desc || '';
  
  updateDynamicFields(p.cat);
  
  // Populate dynamic fields if they exist in UI and product data
  const dFields = ['subcat', 'brand', 'fabric', 'sleeve', 'fit', 'color', 'neck', 'waist'];
  dFields.forEach(f => {
    const el = document.getElementById(`df_${f}`);
    if (el) {
      if (f === 'subcat') {
        el.value = p.subcat || p.subcategory || '';
      } else if (p[f] !== undefined) {
        el.value = p[f];
      }
    }
  });
  // Handle multi-select size
  const sizeEl = document.getElementById('df_size');
  if (sizeEl && p.size) {
    const pSizes = Array.isArray(p.size) ? p.size : [p.size];
    if (sizeEl.classList.contains('checkbox-group')) {
      const cbs = sizeEl.querySelectorAll('input[type="checkbox"]');
      cbs.forEach(cb => {
        if (pSizes.includes(cb.value)) cb.checked = true;
      });
    } else if (sizeEl.options) {
      Array.from(sizeEl.options).forEach(opt => {
        if (pSizes.includes(opt.value)) opt.selected = true;
      });
    }
  }
  // Handle multi-select waist
  const waistEl = document.getElementById('df_waist');
  if (waistEl && (p.waist || p.sizes || p.size)) {
    const src = p.waist || p.sizes || p.size;
    if (waistEl.classList.contains('checkbox-group')) {
      const pWaists = Array.isArray(src) ? src.map(String) : [String(src)];
      const cbs = waistEl.querySelectorAll('input[type="checkbox"]');
      cbs.forEach(cb => {
        if (pWaists.includes(cb.value)) cb.checked = true;
      });
    } else if (waistEl.tagName === 'SELECT') {
      const pWaists = Array.isArray(src) ? src.map(String) : [String(src)];
      Array.from(waistEl.options).forEach(opt => {
        if (pWaists.includes(opt.value)) opt.selected = true;
      });
    }
  }
  
  existingImages = p.images ? [...p.images] : (p.img ? [p.img] : []);
  selectedFiles = [];
  renderImagePreviews();
  renderSizeStockInputs(p.sizeStock || null);
  
  prodModal.classList.add('show');
};

document.getElementById('addProductBtn').addEventListener('click', () => {
  document.getElementById('editProdId').value = 'new';
  document.getElementById('editProdName').value = '';
  document.getElementById('editProdPrice').value = '';
  document.getElementById('editProdOriginal').value = '';
  document.getElementById('editProdStock').value = '';
  document.getElementById('editProdCat').value = '';
  document.getElementById('editProdBadge').value = '';
  document.getElementById('editProdDesc').value = '';
  
  updateDynamicFields('');
  
  existingImages = [];
  selectedFiles = [];
  renderImagePreviews();
  
  prodModal.classList.add('show');
});

document.getElementById('closeProductModal').addEventListener('click', () => prodModal.classList.remove('show'));

// --- COPY & PASTE PRODUCT LOGIC ---
const copyBtn = document.getElementById('copyProdBtn');
const pasteBtn = document.getElementById('pasteProdBtn');

if (copyBtn) {
  copyBtn.addEventListener('click', () => {
    const cat = document.getElementById('editProdCat').value;
    if (!cat) {
      alert('Please select a category and fill in product details before copying.');
      return;
    }
    const name = document.getElementById('editProdName').value;
    if (!name) {
      alert('Please enter a product name before copying.');
      return;
    }

    // Gather all fields EXCEPT images
    const copiedData = {
      name: name,
      price: document.getElementById('editProdPrice').value,
      original: document.getElementById('editProdOriginal').value,
      stock: document.getElementById('editProdStock').value,
      cat: cat,
      badge: document.getElementById('editProdBadge').value,
      desc: document.getElementById('editProdDesc').value
    };

    // Gather dynamic category fields
    const dFields = ['subcat', 'brand', 'fabric', 'sleeve', 'fit', 'color', 'neck', 'waist'];
    dFields.forEach(f => {
      const el = document.getElementById(`df_${f}`);
      if (el) {
        if (el.classList.contains('checkbox-group')) {
          const cbs = el.querySelectorAll('input[type="checkbox"]:checked');
          copiedData[f] = Array.from(cbs).map(c => c.value);
        } else if (el.tagName === 'SELECT' && el.multiple) {
          copiedData[f] = Array.from(el.selectedOptions).map(o => o.value);
        } else {
          copiedData[f] = el.value;
        }
      }
    });
    const sizeEl = document.getElementById('df_size');
    if (sizeEl) {
      if (sizeEl.classList.contains('checkbox-group')) {
        const cbs = sizeEl.querySelectorAll('input[type="checkbox"]:checked');
        copiedData.size = Array.from(cbs).map(c => c.value);
      } else if (sizeEl.multiple) {
        copiedData.size = Array.from(sizeEl.selectedOptions).map(o => o.value);
      } else {
        copiedData.size = sizeEl.value;
      }
    } else {
      const waistEl = document.getElementById('df_waist');
      if (waistEl && waistEl.classList.contains('checkbox-group')) {
        const cbs = waistEl.querySelectorAll('input[type="checkbox"]:checked');
        copiedData.size = Array.from(cbs).map(c => c.value);
      }
    }
    if (copiedData.size && Array.isArray(copiedData.size)) {
      copiedData.sizes = [...copiedData.size];
    } if (copiedData.waist && Array.isArray(copiedData.waist)) {
      copiedData.sizes = [...copiedData.waist];
      copiedData.size = [...copiedData.waist];
    }

    // Gather sizeStock map if visible
    const sizeStockGrid = document.getElementById('sizeStockGrid');
    if (sizeStockGrid && document.getElementById('sizeStockContainer').style.display !== 'none') {
      const sMap = {};
      sizeStockGrid.querySelectorAll('.size-stock-input').forEach(inp => {
        sMap[inp.dataset.size] = parseInt(inp.value) || 0;
      });
      copiedData.sizeStock = sMap;
    }

    localStorage.setItem('sc_copied_product_data', JSON.stringify(copiedData));
    localStorage.setItem('sc_copied_paste_count', '1'); // Reset count for new copy
    showToast('Product details copied! (Images excluded)');
  });
}

function getBaseProductName(name) {
  // Strip any trailing - 01, -01, 01, - 02, etc.
  return name.replace(/\s*-?\s*\d{2,}$/, '').trim();
}

if (pasteBtn) {
  pasteBtn.addEventListener('click', () => {
    const rawData = localStorage.getItem('sc_copied_product_data');
    if (!rawData) {
      alert('No copied product details found. Please click Copy on an existing product first.');
      return;
    }
    const copiedData = JSON.parse(rawData);

    // Set category and trigger dynamic field creation
    document.getElementById('editProdCat').value = copiedData.cat || '';
    updateDynamicFields(copiedData.cat || '');

    // Handle product name with incrementing suffix
    let baseName = getBaseProductName(copiedData.name || '');
    let pasteCount = parseInt(localStorage.getItem('sc_copied_paste_count') || '1');
    let suffix = pasteCount < 10 ? `0${pasteCount}` : `${pasteCount}`;
    document.getElementById('editProdName').value = `${baseName} ${suffix}`;

    // Fill other standard fields
    if (copiedData.price !== undefined) document.getElementById('editProdPrice').value = copiedData.price;
    if (copiedData.original !== undefined) document.getElementById('editProdOriginal').value = copiedData.original;
    if (copiedData.stock !== undefined) document.getElementById('editProdStock').value = copiedData.stock;
    if (copiedData.badge !== undefined) document.getElementById('editProdBadge').value = copiedData.badge;
    if (copiedData.desc !== undefined) document.getElementById('editProdDesc').value = copiedData.desc;

    // Fill dynamic fields
    const dFields = ['subcat', 'brand', 'fabric', 'sleeve', 'fit', 'color', 'neck', 'waist'];
    dFields.forEach(f => {
      const el = document.getElementById(`df_${f}`);
      if (el && copiedData[f] !== undefined && copiedData[f] !== null) {
        if (el.classList.contains('checkbox-group')) {
          const cbs = el.querySelectorAll('input[type="checkbox"]');
          const vals = Array.isArray(copiedData[f]) ? copiedData[f] : [copiedData[f]];
          cbs.forEach(cb => { if (vals.includes(cb.value)) cb.checked = true; });
        } else if (el.tagName === 'SELECT' && el.multiple) {
          const vals = Array.isArray(copiedData[f]) ? copiedData[f] : [copiedData[f]];
          Array.from(el.options).forEach(opt => { if (vals.includes(opt.value)) opt.selected = true; });
        } else {
          el.value = copiedData[f];
        }
      }
    });
    const sizeEl = document.getElementById('df_size');
    if (sizeEl && copiedData.size !== undefined && copiedData.size !== null) {
      const vals = Array.isArray(copiedData.size) ? copiedData.size : [copiedData.size];
      if (sizeEl.classList.contains('checkbox-group')) {
        const cbs = sizeEl.querySelectorAll('input[type="checkbox"]');
        cbs.forEach(cb => { if (vals.includes(cb.value)) cb.checked = true; });
      } else if (sizeEl.multiple) {
        Array.from(sizeEl.options).forEach(opt => { if (vals.includes(opt.value)) opt.selected = true; });
      } else {
        sizeEl.value = copiedData.size;
      }
    }
    const waistEl = document.getElementById('df_waist');
    const srcSize = copiedData.waist || copiedData.sizes || copiedData.size;
    if (waistEl && srcSize !== undefined && srcSize !== null) {
      const vals = Array.isArray(srcSize) ? srcSize.map(String) : [String(srcSize)];
      if (waistEl.classList.contains('checkbox-group')) {
        const cbs = waistEl.querySelectorAll('input[type="checkbox"]');
        cbs.forEach(cb => { if (vals.includes(cb.value)) cb.checked = true; });
      } else if (waistEl.tagName === 'SELECT') {
        Array.from(waistEl.options).forEach(opt => { if (vals.includes(opt.value)) opt.selected = true; });
      }
    }

    renderSizeStockInputs(copiedData.sizeStock || null);
    showToast(`Pasted details with suffix ${suffix}! Now add images and save.`);
  });
}

const migrateBtn = document.getElementById('migrateImagesBtn');
if (migrateBtn) {
  migrateBtn.addEventListener('click', async () => {
    if (!confirm("Start migrating all existing Base64 product images to Supabase Storage?")) return;
    const origText = migrateBtn.textContent;
    migrateBtn.disabled = true;
    try {
      const stats = await migrateExistingProductImages(db, products, (msg, percent) => {
        migrateBtn.textContent = `${percent}% - Migrating...`;
        console.log(msg);
      });
      alert(`Migration Completed!\n\nChecked: ${stats.totalChecked}\nMigrated: ${stats.migratedCount}\nErrors: ${stats.errorCount}`);
      renderProducts();
      renderOverview();
      localStorage.setItem('sc_products', JSON.stringify(products));
    } catch (err) {
      console.error("Migration error:", err);
      alert("An error occurred during migration: " + err.message);
    } finally {
      migrateBtn.textContent = origText;
      migrateBtn.disabled = false;
    }
  });
}

document.getElementById('saveProductBtn').addEventListener('click', async () => {
  const idVal = document.getElementById('editProdId').value;
  const isNew = idVal === 'new';
  const saveBtnText = document.querySelector('#saveProductBtn .btn-text');
  const spinner = document.getElementById('saveProductSpinner');
  
  // Basic validation
  const name = document.getElementById('editProdName').value;
  const price = parseInt(document.getElementById('editProdPrice').value) || 0;
  const cat = document.getElementById('editProdCat').value;
  if (!cat) { alert("Please select a Product Category first."); return; }
  if (!name) { alert("Product Name is required."); return; }
  
  saveBtnText.style.display = 'none';
  spinner.classList.remove('hidden');
  
  try {
    // 1. Upload new image files directly to Cloudinary (with auto WebP compression)
    const uploadedUrls = [];
    for (const file of selectedFiles) {
      try {
        const publicUrl = await uploadProductImage(file);
        uploadedUrls.push(publicUrl);
      } catch (uploadErr) {
        // If image upload fails, do not save incomplete product data. Show proper error message instead.
        alert(`Error: Image upload failed.\n\n${uploadErr.message}`);
        throw uploadErr; // Abort saving product to database!
      }
    }
    const allImages = existingImages.concat(uploadedUrls);
    
    // 2. Gather product data
    const origVal = parseInt(document.getElementById('editProdOriginal').value) || 0;
    let calcOff = 0;
    if (origVal > price && origVal > 0) {
      calcOff = Math.round(((origVal - price) / origVal) * 100);
    }
    const existingP = !isNew ? products.find(x => String(x.id) === String(idVal)) : null;

    const newProductData = {
      name: name,
      price: price,
      original: origVal,
      off: calcOff,
      rating: existingP && existingP.rating ? existingP.rating : 4.8,
      reviews: existingP && existingP.reviews !== undefined ? existingP.reviews : 0,
      stock: parseInt(document.getElementById('editProdStock').value) || 0,
      cat: cat,
      badge: document.getElementById('editProdBadge').value,
      desc: document.getElementById('editProdDesc').value,
      images: allImages,
      img: allImages.length > 0 ? allImages[0] : 'Logo.png' // fallback for older UI
    };
    
    // Gather dynamic fields
    const dFields = ['subcat', 'brand', 'fabric', 'sleeve', 'fit', 'color', 'neck', 'waist'];
    dFields.forEach(f => {
      const el = document.getElementById(`df_${f}`);
      if (el) {
        if (el.classList.contains('checkbox-group')) {
          const cbs = el.querySelectorAll('input[type="checkbox"]:checked');
          const vals = Array.from(cbs).map(c => c.value);
          if (vals.length > 0) newProductData[f] = vals;
        } else if (el.tagName === 'SELECT' && el.multiple) {
          const vals = Array.from(el.selectedOptions).map(o => o.value);
          if (vals.length > 0) newProductData[f] = vals;
        } else {
          newProductData[f] = el.value;
        }
      }
    });
    if (newProductData.subcat) {
      newProductData.subcategory = newProductData.subcat;
    }
    const sizeEl = document.getElementById('df_size');
    if (sizeEl) {
      if (sizeEl.classList.contains('checkbox-group')) {
        const cbs = sizeEl.querySelectorAll('input[type="checkbox"]:checked');
        newProductData.size = Array.from(cbs).map(c => c.value);
      } else if (sizeEl.multiple) {
        newProductData.size = Array.from(sizeEl.selectedOptions).map(o => o.value);
      } else {
        newProductData.size = sizeEl.value;
      }
    } else {
      const waistEl = document.getElementById('df_waist');
      if (waistEl && waistEl.classList.contains('checkbox-group')) {
        const cbs = waistEl.querySelectorAll('input[type="checkbox"]:checked');
        newProductData.size = Array.from(cbs).map(c => c.value);
      }
    }
    if (newProductData.size && Array.isArray(newProductData.size)) {
      newProductData.sizes = [...newProductData.size];
    } if (newProductData.waist && Array.isArray(newProductData.waist)) {
      newProductData.sizes = [...newProductData.waist];
      newProductData.size = [...newProductData.waist];
    }
    
    // Gather per-size stock map if visible
    const sizeStockGrid = document.getElementById('sizeStockGrid');
    if (sizeStockGrid && document.getElementById('sizeStockContainer').style.display !== 'none') {
      const sMap = {};
      sizeStockGrid.querySelectorAll('.size-stock-input').forEach(inp => {
        sMap[inp.dataset.size] = parseInt(inp.value) || 0;
      });
      newProductData.sizeStock = sMap;
      newProductData.stock = Object.values(sMap).reduce((a, b) => a + b, 0);
    }
    
// Helper to wrap promises with a timeout so Firestore doesn't hang indefinitely
function withTimeout(promise, ms = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Firebase Database is not responding (10s Timeout).\n\nPossible reasons:\n1. You haven't clicked 'Create Database' inside Firestore Database in Firebase Console.\n2. Security Rules were not Saved/Published.\n3. Internet connection or Ad-blocker is blocking Firebase."));
    }, ms);
    promise.then(res => {
      clearTimeout(timer);
      resolve(res);
    }).catch(err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

    // 3. Save to Firestore with 10s timeout protection
    if (isNew) {
      const docRef = await withTimeout(addDoc(collection(db, "products"), newProductData));
      newProductData.id = String(docRef.id);
      products.push(newProductData);
    } else {
      const id = String(idVal);
      await withTimeout(setDoc(doc(db, "products", id), newProductData, { merge: true }));
      const pIdx = products.findIndex(x => String(x.id) === id);
      if (pIdx > -1) {
        products[pIdx] = { ...products[pIdx], ...newProductData, id: id };
      }
    }
    
    // Deduplicate products using ONLY unique document ID (NEVER by name or truncated parseInt!)
    const seenMap = new Map();
    products.forEach(p => {
      if (!p) return;
      const key = String(p.id || '').trim();
      if (key) {
        seenMap.set(key, p);
      }
    });
    products = Array.from(seenMap.values());
    
    localStorage.setItem('sc_products', JSON.stringify(products));
    renderProducts();
    renderOverview();
    if (localStorage.getItem('sc_copied_product_data')) {
      let currentCount = parseInt(localStorage.getItem('sc_copied_paste_count') || '1');
      localStorage.setItem('sc_copied_paste_count', String(currentCount + 1));
    }
    prodModal.classList.remove('show');
    showToast(isNew ? 'Product added successfully!' : 'Product updated successfully!');
    
  } catch (err) {
    console.error("Error saving product:", err);
    alert("Failed to save product: " + err.message + "\n\n(Please check Firebase Storage/Firestore rules or enable Anonymous Sign-in in Firebase Console)");
  } finally {
    saveBtnText.style.display = 'inline';
    spinner.classList.add('hidden');
  }
});

// --- ORDERS TAB ---
window.filterOrders = function() {
  renderOrders();
};

function renderOrders() {
  const tbody = document.getElementById('ordersTableBody');
  if(!tbody) return;
  
  const searchInput = document.getElementById('orderSearchInput');
  const clearBtn = document.getElementById('clearOrderSearch');
  const query = searchInput ? searchInput.value.trim().toLowerCase().replace(/^#/, '') : '';
  
  if (clearBtn) {
    clearBtn.style.display = query.length > 0 ? 'flex' : 'none';
  }
  
  // Sort orders by date descending
  let sortedOrders = [...orders].sort((a,b) => new Date(b.date) - new Date(a.date));
  
  if (query) {
    sortedOrders = sortedOrders.filter(o => {
      const idMatch = String(o.id || '').toLowerCase().includes(query);
      const nameMatch = String(o.customerName || '').toLowerCase().includes(query);
      const phoneMatch = String(o.customerPhone || '').toLowerCase().includes(query);
      const awbMatch = String(o.awb_code || '').toLowerCase().includes(query);
      return idMatch || nameMatch || phoneMatch || awbMatch;
    });
  }
  
  if (sortedOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 3rem 1rem; color: #64748b;">
      <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
      <strong>No orders found matching "${query}"</strong><br>
      <small>Try searching by Order ID (e.g. 102), Customer Name, Phone, or AWB Code.</small>
    </td></tr>`;
    return;
  }
  
  tbody.innerHTML = sortedOrders.map(o => {
    const d = new Date(o.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
    const statClass = (o.status || 'Processing').toLowerCase();
    
    // Shipment Badge
    let shipBadge = `<span style="background:#f1f5f9; color:#475569; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:700;">NOT CREATED</span>`;
    const sStatus = (o.shipment_status || '').toUpperCase();
    if (sStatus === 'CANCELLED') {
      shipBadge = `<span style="background:#fee2e2; color:#b91c1c; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:700;">CANCELLED</span>`;
    } else if (sStatus === 'PICKUP_SCHEDULED') {
      shipBadge = `<span style="background:#ddd6fe; color:#5b21b6; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:700;">PICKUP SCHEDULED</span>`;
    } else if (o.awb_code || sStatus === 'READY_TO_SHIP' || sStatus === 'AWB_GENERATED') {
      shipBadge = `<span style="background:#dcfce7; color:#15803d; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:700;">READY (AWB: ${o.awb_code})</span>`;
    } else if (sStatus === 'AWB_PENDING' || sStatus === 'ORDER_CREATED') {
      shipBadge = `<span style="background:#fef3c7; color:#b45309; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:700;">AWB PENDING</span>`;
    } else if (sStatus === 'IN_TRANSIT' || sStatus === 'OUT_FOR_DELIVERY') {
      shipBadge = `<span style="background:#e0f2fe; color:#0369a1; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:700;">${sStatus.replace(/_/g,' ')}</span>`;
    } else if (sStatus === 'DELIVERED') {
      shipBadge = `<span style="background:#bbf7d0; color:#166534; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:700;">DELIVERED</span>`;
    }

    const needsRetry = sStatus !== 'CANCELLED' && (!o.awb_code || sStatus === 'AWB_PENDING' || sStatus === 'ORDER_CREATED');
    const canSchedulePickup = sStatus !== 'CANCELLED' && sStatus !== 'PICKUP_SCHEDULED' && sStatus !== 'IN_TRANSIT' && sStatus !== 'OUT_FOR_DELIVERY' && sStatus !== 'DELIVERED';

    return `
      <tr>
        <td>#${o.id}<br><small style="color:#64748b;">${o.shiprocket_order_id ? 'SR: ' + o.shiprocket_order_id : ''}</small></td>
        <td>${d}</td>
        <td><strong>${o.customerName || 'Unknown'}</strong><br><small>${o.customerPhone || ''}</small><br><small style="color:#64748b;">${o.customerEmail || ''}</small></td>
        <td>₹${(Number(o.total) || 0).toLocaleString('en-IN')}</td>
        <td>
          <div style="margin-bottom:6px;">
            <select class="status-select" onchange="window.updateOrderStatus('${o.id}', this.value)">
              <option value="Processing" ${statClass==='processing'?'selected':''}>Processing</option>
              <option value="Shipped" ${statClass==='shipped'?'selected':''}>Shipped</option>
              <option value="Delivered" ${statClass==='delivered'?'selected':''}>Delivered</option>
              <option value="Cancelled" ${statClass==='cancelled'?'selected':''}>Cancelled</option>
            </select>
          </div>
          <div>${shipBadge}</div>
        </td>
        <td>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <button class="action-btn" onclick="window.viewOrderDetails('${o.id}')">View Details</button>
            <button class="action-btn" style="background:#0f172a; color:white; border-color:#0f172a; font-size:0.75rem; padding:4px 8px;" onclick="window.resendOrderEmail('${o.id}')">✉️ Send Email</button>
            ${canSchedulePickup ? `<button class="action-btn" style="background:#16a34a; color:white; border-color:#16a34a; font-size:0.75rem; padding:4px 8px;" onclick="window.schedulePickup('${o.id}')">📦 Schedule Pickup</button>` : ''}
            ${needsRetry ? `<button class="action-btn" style="background:#3b82f6; color:white; border-color:#3b82f6; font-size:0.75rem; padding:4px 8px;" onclick="window.retryShiprocket('${o.id}')">🔄 Retry Shiprocket</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.schedulePickup = async function(id) {
  const o = orders.find(x => String(x.id) === String(id));
  if (!o) return;

  const getBackendUrl = () => {
    if (typeof window !== 'undefined' && window.BACKEND_URL) return window.BACKEND_URL.replace(/\/$/, '');
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:3000';
    return 'https://backend-s6kq.onrender.com';
  };

  // ── Phase 1: Verify order in database first ──
  showToast('Verifying order in database...');
  let verifyData;
  try {
    const verifyRes = await fetch(`${getBackendUrl()}/api/admin/schedule-pickup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: String(o.id), phase: 'verify' })
    });

    verifyData = await verifyRes.json();
    if (!verifyData.success) {
      alert(`⚠️ Pickup Verification Failed:\n\n${verifyData.error || 'Order could not be verified in database.'}`);
      return;
    }
  } catch (err) {
    alert(`❌ Server Connection Error: ${err.message}`);
    return;
  }

  // Show confirmation with verified backend data (real DB ID & AWB)
  const dbId = verifyData.db_order_id;
  const realAwb = verifyData.awb_code;
  const courier = verifyData.courier_name || 'Assigned Courier';
  const custName = verifyData.customer_name || 'N/A';

  const confirmMsg = `Schedule courier pickup?\n\n` +
    `Order ID (DB): #${dbId}\n` +
    `Customer: ${custName}\n` +
    `AWB Code: ${realAwb}\n` +
    `Courier: ${courier}\n` +
    `Shipment ID: ${verifyData.shiprocket_shipment_id}\n` +
    `Current Status: ${verifyData.shipment_status}\n\n` +
    `Click OK to confirm pickup scheduling with Shiprocket.`;

  if (!confirm(confirmMsg)) {
    showToast('Pickup scheduling cancelled.');
    return;
  }

  // ── Phase 2: Confirm — actually call Shiprocket ──
  showToast('Scheduling pickup with Shiprocket...');
  try {
    const confirmRes = await fetch(`${getBackendUrl()}/api/admin/schedule-pickup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: String(dbId), phase: 'confirm' })
    });

    const confirmData = await confirmRes.json();
    if (confirmData.success) {
      alert(`✅ Pickup Scheduled Successfully!\n\nOrder #${confirmData.db_order_id || dbId}\nAWB: ${confirmData.awb_code || realAwb}\nStatus: PICKUP_SCHEDULED\nMessage: ${confirmData.message || 'Courier will pick up the package.'}`);
      o.shipment_status = 'PICKUP_SCHEDULED';
      localStorage.setItem('sc_all_orders', JSON.stringify(orders));
      renderOrders();
    } else {
      alert(`⚠️ Pickup Request Notice:\n\n${confirmData.error || 'Failed to schedule pickup with Shiprocket.'}`);
    }
  } catch (err) {
    alert(`❌ Server Connection Error: ${err.message}`);
  }
};

window.retryShiprocket = async function(id) {
  const o = orders.find(x => String(x.id) === String(id));
  if (!o) return;

  if (!confirm(`Do you want to retry Shiprocket fulfillment and AWB generation for Order #${id}?`)) {
    return;
  }

  showToast('Connecting to Shiprocket API...');
  try {
    const getBackendUrl = () => {
      if (typeof window !== 'undefined' && window.BACKEND_URL) return window.BACKEND_URL.replace(/\/$/, '');
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:3000';
      return 'https://backend-s6kq.onrender.com';
    };
    const res = await fetch(`${getBackendUrl()}/api/admin/retry-shiprocket`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: String(id), order: o })
    });

    const data = await res.json();
    if (data.success) {
      alert(`✅ Success! Shiprocket Order & AWB Generated:\n\nAWB Code: ${data.awb_code || 'Assigned'}\nCourier: ${data.courier_name || 'Assigned'}\nStatus: ${data.shipment_status || 'READY_TO_SHIP'}`);
      // Refresh local state
      o.awb_code = data.awb_code;
      o.courier_name = data.courier_name;
      o.shipment_status = data.shipment_status;
      o.shiprocket_order_id = data.shiprocket_order_id || o.shiprocket_order_id;
      o.shipment_id = data.shipment_id || o.shipment_id;
      o.tracking_url = data.tracking_url;

      localStorage.setItem('sc_all_orders', JSON.stringify(orders));
      renderOrders();
    } else {
      alert(`⚠️ Shiprocket Retry Notice:\n\n${data.error || 'Failed to generate AWB. Check wallet balance or address details.'}`);
    }
  } catch (err) {
    alert(`❌ Server Connection Error: ${err.message}`);
  }
};

window.updateOrderStatus = async function(id, newStatus) {
  const oIdx = orders.findIndex(x => String(x.id) === String(id));
  if (oIdx > -1) {
    orders[oIdx].status = newStatus;
    localStorage.setItem('sc_all_orders', JSON.stringify(orders));
    showToast(`Order #${id} marked as ${newStatus}`);
    
    // Also sync status update to Firestore if it has a firestoreId
    const targetOrder = orders[oIdx];
    if (targetOrder.firestoreId) {
      try {
        await setDoc(doc(db, "orders", targetOrder.firestoreId), { status: newStatus }, { merge: true });
      } catch(e) {
        console.warn("Could not sync status to Firestore:", e);
      }
    }
  }
};

window.resendOrderEmail = async function(id) {
  const o = orders.find(x => String(x.id) === String(id));
  if (!o) return;

  const targetEmail = o.customerEmail || o.email;
  if (!targetEmail) {
    alert(`Order #${id} does not have a customer email address.`);
    return;
  }

  showToast(`Sending confirmation email to ${targetEmail}...`);

  const getBackendUrl = () => {
    if (typeof window !== 'undefined' && window.BACKEND_URL) return window.BACKEND_URL.replace(/\/$/, '');
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:3000';
    return 'https://backend-s6kq.onrender.com';
  };

  try {
    const res = await fetch(`${getBackendUrl()}/api/send-order-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(o)
    });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ Order confirmation email sent to ${targetEmail}!`);
    } else {
      alert(`⚠️ Email sending notice:\n\n${data.message || data.error || 'Please check that EMAILJS_TEMPLATE_ID and EMAILJS_PUBLIC_KEY are configured in .env'}`);
    }
  } catch (err) {
    alert(`❌ Server Connection Error: ${err.message}`);
  }
};

// View Order Modal
const orderModal = document.getElementById('orderViewModal');
window.viewOrderDetails = function(id) {
  const o = orders.find(x => String(x.id) === String(id));
  if (!o) return;
  
  const body = document.getElementById('orderDetailsBody');
  const d = new Date(o.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
  
  const phoneClean = (o.customerPhone || '').replace(/\D/g, '');
  const callBtn = o.customerPhone ? `<a href="tel:${o.customerPhone}" style="display:inline-flex; align-items:center; justify-content:center; gap:6px; background:#e0f2fe; color:#0369a1; padding:10px 14px; border-radius:8px; text-decoration:none; font-weight:700; font-size:0.9rem; flex:1; border:1px solid #bae6fd;">📞 Call Customer</a>` : '';
  const waBtn = phoneClean ? `<a href="https://wa.me/91${phoneClean}" target="_blank" style="display:inline-flex; align-items:center; justify-content:center; gap:6px; background:#dcfce7; color:#15803d; padding:10px 14px; border-radius:8px; text-decoration:none; font-weight:700; font-size:0.9rem; flex:1; border:1px solid #bbf7d0;">💬 WhatsApp</a>` : '';

  const trackLink = o.awb_code ? `https://shiprocket.co/tracking/${o.awb_code}` : null;

  let html = `
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1.25rem; margin-bottom:1.5rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem; border-bottom:1px dashed #cbd5e1; padding-bottom:0.75rem;">
        <span style="font-weight:800; color:#0f172a; font-size:1.1rem;">Order #${o.id}</span>
        <span style="font-size:0.8rem; color:#64748b; background:#f1f5f9; padding:4px 8px; border-radius:6px; border:1px solid #e2e8f0;">🕒 ${d}</span>
      </div>
      <div style="line-height:1.7; font-size:0.95rem; color:#334155;">
        <p style="margin-bottom:4px;"><strong>👤 Customer:</strong> ${o.customerName || 'Unknown'} <span style="color:#64748b; font-size:0.85rem;">(${o.customerEmail || 'No email'})</span></p>
        <p style="margin-bottom:4px;"><strong>📱 Phone:</strong> ${o.customerPhone || 'N/A'} ${o.customerAltPhone ? `<span style="color:#64748b;">(Alt: ${o.customerAltPhone})</span>` : ''}</p>
        <p style="margin-bottom:4px;"><strong>📍 Address:</strong> ${o.customerAddress || 'N/A'}, ${o.customerCity || ''}, ${o.customerState || ''} - <strong>${o.customerPin || ''}</strong></p>
      </div>

      <!-- Shiprocket & Logistics Details -->
      <div style="margin-top:1rem; background:#ffffff; border:1.5px solid #e2e8f0; border-radius:10px; padding:0.9rem 1rem;">
        <h5 style="margin:0 0 8px 0; color:#0f172a; font-size:0.95rem; display:flex; align-items:center; gap:6px;">🚚 Logistics & Fulfillment (Shiprocket)</h5>
        <div style="font-size:0.88rem; color:#475569; display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:8px;">
          <div><strong>Shiprocket Order ID:</strong> ${o.shiprocket_order_id || 'N/A'}</div>
          <div><strong>Shipment ID:</strong> ${o.shipment_id || 'N/A'}</div>
          <div><strong>Courier Partner:</strong> ${o.courier_name || 'Pending'}</div>
          <div><strong>AWB Code:</strong> <span style="font-weight:700; color:#0f172a;">${o.awb_code || 'AWB PENDING'}</span></div>
          <div><strong>Shipment Status:</strong> <span style="font-weight:700; color:${(o.shipment_status || '').toUpperCase() === 'CANCELLED' ? '#b91c1c' : '#e11d48'};">${o.shipment_status || 'ORDER_CREATED'}</span></div>
        </div>
        ${(o.shipment_status || '').toUpperCase() === 'CANCELLED' ? `<div style="margin-top:10px; background:#fee2e2; color:#b91c1c; padding:8px 12px; border-radius:8px; font-size:0.85rem; font-weight:700;">⚠️ This shipment has been cancelled in Shiprocket. Pickup scheduling is disabled.</div>` : ''}
        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
          ${trackLink ? `<a href="${trackLink}" target="_blank" style="display:inline-flex; align-items:center; gap:6px; background:#0f172a; color:#ffffff; padding:6px 12px; border-radius:6px; font-weight:700; font-size:0.82rem; text-decoration:none;">🔍 Track Shipment Live ↗</a>` : `<span style="font-size:0.82rem; color:#64748b; background:#f1f5f9; padding:6px 10px; border-radius:6px; font-weight:600;">AWB Pending Assignment</span>`}
          ${(o.shipment_status || '').toUpperCase() !== 'CANCELLED' && (o.shipment_status || '').toUpperCase() !== 'PICKUP_SCHEDULED' && (o.shipment_status || '').toUpperCase() !== 'DELIVERED' ? `<button type="button" onclick="window.schedulePickup('${o.id}')" style="background:#16a34a; color:#ffffff; border:none; padding:6px 12px; border-radius:6px; font-weight:700; font-size:0.82rem; cursor:pointer;">📦 Schedule Pickup</button>` : ''}
          ${(o.shipment_status || '').toUpperCase() !== 'CANCELLED' && (!o.awb_code || o.shipment_status === 'AWB_PENDING' || o.shipment_status === 'ORDER_CREATED') ? `<button type="button" onclick="window.retryShiprocket('${o.id}')" style="background:#3b82f6; color:#ffffff; border:none; padding:6px 12px; border-radius:6px; font-weight:700; font-size:0.82rem; cursor:pointer;">🔄 Retry Shiprocket / AWB</button>` : ''}
        </div>
      </div>

      <div style="display:flex; gap:0.75rem; margin-top:1.25rem; flex-wrap:wrap;">
        ${callBtn}
        ${waBtn}
      </div>
    </div>
    <h4 style="margin-bottom: 1rem; color:#0f172a; font-size:1.1rem; display:flex; align-items:center; gap:6px;">🛍️ Items Purchased</h4>
    <div style="display:flex; flex-direction:column; gap:0.75rem;">
  `;
  
  if (o.items && o.items.forEach) {
    o.items.forEach(i => {
      // Lookup product from products list for full details
      const matchedP = products.find(p => String(p.id) === String(i.id || i.productId)) ||
                       products.find(p => String(p.name || '').toLowerCase() === String(i.name || '').toLowerCase());
      const thumbImg = i.img || i.image || (matchedP ? (matchedP.img || (matchedP.images?.[0])) : null) || 'Logo.png';
      const catBadge = (matchedP && matchedP.cat) ? matchedP.cat.toUpperCase() : 'PRODUCT';
      const sizeText = i.size ? `Size: ${i.size}` : '';

      const prodId = i.id || i.productId || (matchedP ? matchedP.id : null);

      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#ffffff; border:1.5px solid #e2e8f0; padding:0.9rem 1rem; border-radius:14px; box-shadow:0 2px 6px rgba(0,0,0,0.03); gap: 1rem; flex-wrap: wrap; transition: all 0.2s ease;"
             onmouseover="this.style.borderColor='#e11d48'; this.style.transform='translateY(-2px)';"
             onmouseout="this.style.borderColor='#e2e8f0'; this.style.transform='none';">
          <div style="display:flex; align-items:center; gap:14px; flex: 1; min-width: 220px; cursor: pointer;" ${prodId ? `onclick="window.open('product.html?id=${prodId}', '_blank')"` : ''}>
            <img src="${thumbImg}" alt="${i.name}" style="width: 58px; height: 68px; border-radius: 10px; object-fit: cover; border: 1.5px solid #f1f5f9; background: #f8fafc; flex-shrink: 0;" />
            <div>
              <span style="font-size:0.68rem; font-weight:700; color:#e11d48; letter-spacing:1px; text-transform:uppercase;">${catBadge}</span>
              <div style="font-weight:700; color:#0f172a; font-size:1rem; line-height:1.3; margin-top: 2px;">${i.name}</div>
              <div style="display:flex; align-items:center; gap:8px; margin-top:6px; flex-wrap:wrap;">
                ${sizeText ? `<span style="background:#f1f5f9; color:#334155; font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:6px;">${sizeText}</span>` : ''}
                <span style="background:#f8fafc; color:#64748b; font-size:0.75rem; font-weight:600; padding:2px 8px; border-radius:6px;">₹${(i.price || 0).toLocaleString()} / unit</span>
              </div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:12px; text-align:right;">
            <span style="background:#0f172a; color:#ffffff; font-weight:800; font-size:0.85rem; padding:4px 10px; border-radius:8px;">Qty: ${i.qty}</span>
            <span style="font-weight:800; color:#0f172a; font-size:1.1rem; min-width:75px;">₹${((i.price || 0) * (i.qty || 1)).toLocaleString()}</span>
            ${prodId ? `<a href="product.html?id=${prodId}" target="_blank" onclick="event.stopPropagation()" style="display:inline-flex; align-items:center; gap:4px; background:#f1f5f9; color:#0f172a; font-weight:700; font-size:0.78rem; padding:6px 12px; border-radius:8px; text-decoration:none; border:1px solid #cbd5e1; transition: background 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">View ↗</a>` : ''}
          </div>
        </div>
      `;
    });
  }
  
  html += `
    </div>
    <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 1.5rem; padding: 1.25rem; background:#0f172a; color:#ffffff; border-radius:12px; font-weight: 800; font-size: 1.2rem; box-shadow:0 10px 25px -5px rgba(15,23,42,0.3);">
      <span>Total Paid</span>
      <span style="color:#22c55e;">₹${(Number(o.total) || 0).toLocaleString('en-IN')}</span>
    </div>
  `;
  
  body.innerHTML = html;
  if(orderModal) orderModal.classList.add('show');
};

const closeOrderModalBtn = document.getElementById('closeOrderModal');
if(closeOrderModalBtn) {
  closeOrderModalBtn.addEventListener('click', () => orderModal.classList.remove('show'));
}

// --- REVIEWS TAB ---
function renderReviews() {
  const tbody = document.getElementById('reviewsTableBody');
  if (!tbody) return;
  
  const allReviews = JSON.parse(localStorage.getItem('sc_all_reviews') || '[]');
  
  tbody.innerHTML = allReviews.map((r, idx) => {
    const starHtml = '★'.repeat(r.stars || 5) + '☆'.repeat(5 - (r.stars || 5));
    const status = r.status || 'approved'; // Default to approved for older reviews
    
    let actionButtons = '';
    if (status === 'pending') {
      actionButtons += `<button class="action-btn" style="background:#22c55e; color:white; border-color:#22c55e;" onclick="window.approveReview('${r.id}')">Approve</button> `;
    }
    actionButtons += `<button class="action-btn" style="background:var(--red); color:white; border-color:var(--red);" onclick="window.deleteReview('${r.id}')">Delete</button>`;
    
    return `
      <tr>
        <td>#${r.productId}</td>
        <td><strong>${r.name || 'Anonymous'}</strong></td>
        <td style="color:#fbbf24; font-size:1.1rem;">${starHtml}</td>
        <td style="max-width:240px;">
          <div style="font-size:0.9rem; line-height:1.4;">${r.text}</div>
          ${r.image ? `<div style="margin-top:6px;"><a href="${r.image}" target="_blank" title="Click to view full photo"><img src="${r.image}" alt="Review photo" style="width:48px; height:48px; object-fit:cover; border-radius:6px; border:1px solid #cbd5e1;" /></a></div>` : ''}
        </td>
        <td><span class="status-badge" style="padding:4px 8px; border-radius:4px; font-size:0.8rem; background:${status === 'pending' ? '#fef08a' : '#bbf7d0'}; color:${status === 'pending' ? '#854d0e' : '#166534'}">${status.toUpperCase()}</span></td>
        <td>${actionButtons}</td>
      </tr>
    `;
  }).join('');
  
  if (allReviews.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem;">No reviews found.</td></tr>`;
  }
}

window.approveReview = function(reviewId) {
  let allReviews = JSON.parse(localStorage.getItem('sc_all_reviews') || '[]');
  const idx = allReviews.findIndex(r => String(r.id) === String(reviewId));
  if (idx > -1) {
    allReviews[idx].status = 'approved';
    localStorage.setItem('sc_all_reviews', JSON.stringify(allReviews));
    renderReviews();
    showToast('Review approved and published.');
  }
};

window.deleteReview = function(reviewId) {
  if (!confirm('Are you sure you want to delete this review?')) return;
  let allReviews = JSON.parse(localStorage.getItem('sc_all_reviews') || '[]');
  allReviews = allReviews.filter(r => String(r.id) !== String(reviewId));
  localStorage.setItem('sc_all_reviews', JSON.stringify(allReviews));
  renderReviews();
  showToast('Review deleted permanently.');
};

// --- AUTO-UNLOCK / INITIALIZE DASHBOARD ON LOAD (After all bindings are ready) ---
if (checkAdminAuth()) {
  if (loginOverlay) loginOverlay.classList.add('hidden');
  if (dashboard) dashboard.classList.remove('hidden');
  try {
    initDashboard();
  } catch (initErr) {
    console.warn("Auto-unlock init notice:", initErr);
  }
}
