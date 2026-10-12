/* =========================================
   SURYA COTTON — ADMIN DASHBOARD JS
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
import { getFirestore, collection, addDoc, getDocs, setDoc, getDoc, doc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { uploadProductImage, deleteProductImage } from "./supabase-config.js";
import { migrateExistingProductImages } from "./migrate-images.js";
import { EMAIL_CONFIG } from "./email-config.js";

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

// Instantly hydrate state from local cache so counters are never blank/0 on mobile or cold load
try {
  const cachedProds = JSON.parse(localStorage.getItem('sc_products') || '[]');
  if (Array.isArray(cachedProds) && cachedProds.length > 0) {
    products = cachedProds;
  }
} catch (e) {}

try {
  const cachedOrders = JSON.parse(localStorage.getItem('sc_all_orders') || '[]');
  if (Array.isArray(cachedOrders) && cachedOrders.length > 0) {
    orders = cachedOrders;
  }
} catch (e) {}

// --- CRYPTOGRAPHIC ZERO-KNOWLEDGE AUTHENTICATION ---
// Plaintext password is NEVER stored in code, JS files, or git.
// Even if an attacker inspects this file, SHA-256 is mathematically irreversible.
const ADMIN_SALT = 'SuryaCottons_Secure_Salt_2026';
const ADMIN_AUTH_HASH = 'a1a5de3393b3b8e667249c9972d51fcf40c03970037b94460e42ed4152c1823e';
const EXPECTED_SESSION_TOKEN = '326e3f4c69a01280fabaad49085a9825c4c225bbe61db1f3f1549059ad2af896';

// Universal SHA-256 fallback (works on HTTP, HTTPS, local files, mobile browsers)
function sha256Fallback(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i, j;
  let result = '';

  const words = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty];) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const i2 = i + j;
      const w15 = w[i - 15],
        w2 = w[i - 2];

      const a = hash[0],
        e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

async function computeSha256(str) {
  try {
    if (window.crypto && window.crypto.subtle && typeof window.crypto.subtle.digest === 'function') {
      const enc = new TextEncoder();
      const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.warn("Subtle crypto unavailable, using fallback:", e);
  }
  return sha256Fallback(str);
}

function checkAdminAuth() {
  const token = localStorage.getItem('sc_vault_token') || sessionStorage.getItem('sc_vault_token');
  return token === EXPECTED_SESSION_TOKEN;
}

function setAdminAuth() {
  localStorage.setItem('sc_vault_token', EXPECTED_SESSION_TOKEN);
  sessionStorage.setItem('sc_vault_token', EXPECTED_SESSION_TOKEN);
}

function clearAdminAuth() {
  localStorage.removeItem('sc_vault_token');
  sessionStorage.removeItem('sc_vault_token');
  localStorage.removeItem('sc_admin_auth_798');
  sessionStorage.removeItem('sc_admin_auth_798');
  localStorage.removeItem('sc_admin_auth');
  sessionStorage.removeItem('sc_admin_auth');
}

// Clear any accidental stale lockouts
try {
  const staleLockout = parseInt(localStorage.getItem('sc_admin_lockout_until') || '0', 10);
  if (staleLockout && Date.now() >= staleLockout) {
    localStorage.removeItem('sc_admin_lockout_until');
    localStorage.removeItem('sc_admin_failed_attempts');
  }
} catch (e) {}


// --- LOGIN OVERLAY & BRUTE-FORCE DEFENSE ---
const loginOverlay = document.getElementById('adminLoginOverlay');
const loginBtn = document.getElementById('adminLoginBtn');
const loginPass = document.getElementById('adminPass');
const loginErr = document.getElementById('adminLoginError');
const dashboard = document.getElementById('adminDashboard');

async function doAdminLogin() {
  const now = Date.now();
  const lockoutUntil = parseInt(localStorage.getItem('sc_admin_lockout_until') || '0', 10);
  if (lockoutUntil && now < lockoutUntil) {
    const minsLeft = Math.ceil((lockoutUntil - now) / 60000);
    if (loginErr) {
      loginErr.textContent = `⚠️ Security Lockout: Too many failed attempts. Try again in ${minsLeft} min(s).`;
      loginErr.style.display = 'block';
    }
    return;
  }

  const enteredPass = (loginPass ? loginPass.value.trim() : '');
  if (!enteredPass) {
    if (loginErr) {
      loginErr.textContent = 'Please enter the admin passcode.';
      loginErr.style.display = 'block';
    }
    return;
  }

  if (loginBtn) {
    loginBtn.disabled = true;
    loginBtn.textContent = 'Verifying Security Token...';
  }

  // Artificial 400ms latency to prevent rapid-fire automated brute force attacks
  await new Promise(res => setTimeout(res, 400));

  try {
    const computedHash = await computeSha256(enteredPass + ADMIN_SALT);
    if (computedHash === ADMIN_AUTH_HASH) {
      localStorage.removeItem('sc_admin_failed_attempts');
      localStorage.removeItem('sc_admin_lockout_until');
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
      let attempts = parseInt(localStorage.getItem('sc_admin_failed_attempts') || '0', 10) + 1;
      localStorage.setItem('sc_admin_failed_attempts', String(attempts));
      if (attempts >= 5) {
        const lockTime = Date.now() + 15 * 60 * 1000;
        localStorage.setItem('sc_admin_lockout_until', String(lockTime));
        if (loginErr) {
          loginErr.textContent = '⛔ Maximum attempts exceeded. Locked out for 15 minutes.';
          loginErr.style.display = 'block';
        }
      } else {
        if (loginErr) {
          loginErr.textContent = `❌ Invalid passcode. (${5 - attempts} attempt(s) remaining).`;
          loginErr.style.display = 'block';
        }
      }
    }
  } catch (err) {
    console.error("Auth error:", err);
    if (loginErr) {
      loginErr.textContent = 'Verification error. Please try again.';
      loginErr.style.display = 'block';
    }
  } finally {
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Access Dashboard';
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
  const getBackendUrl = () => {
    if (typeof window !== 'undefined' && window.BACKEND_URL) return window.BACKEND_URL.replace(/\/$/, '');
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:3000';
    return '';
  };

  // Safe fetch helper with AbortController timeout to prevent sleeping backends from blocking the admin UI
  const fetchWithTimeout = (url, options = {}, timeoutMs = 6000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(timer));
  };

  // 1. Load products from Firestore (Direct fast Google CDN)
  const fetchProductsTask = (async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "products"));
      const firestoreProducts = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() || {};
        firestoreProducts.push({ ...data, id: String(docSnap.id).trim() });
      });
      if (firestoreProducts.length > 0) {
        const seenMap = new Map();
        firestoreProducts.forEach(p => {
          if (!p) return;
          const key = String(p.id || '').trim();
          if (key) seenMap.set(key, p);
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

        // Strictly sort chronologically: Latest (Newest) uploaded products first!
        products.sort((a, b) => {
          const timeA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
          const timeB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
          return timeB - timeA;
        });

        localStorage.setItem('sc_products', JSON.stringify(products));
      }
    } catch(e) {
      console.warn("Firestore products fetch notice:", e);
      // Fallback: preserve existing memory or cached products so catalog count is not zeroed out
      if (!products || products.length === 0) {
        try {
          products = JSON.parse(localStorage.getItem('sc_products') || '[]');
        } catch(err) {}
      }
    }
  })();

  // 2. Load orders concurrently from Firestore and Backend API
  const fetchOrdersTask = (async () => {
    const combinedMap = new Map();

    // Start both Firestore orders and Backend orders concurrently
    const firestoreOrdersPromise = (async () => {
      try {
        const ordersSnap = await getDocs(collection(db, "orders"));
        return ordersSnap.docs.map(doc => ({ firestoreId: doc.id, ...doc.data() }));
      } catch (fsErr) {
        console.warn("Firestore orders fetch notice:", fsErr.message);
        return [];
      }
    })();

    const backendOrdersPromise = (async () => {
      try {
        const bRes = await fetchWithTimeout(`${getBackendUrl()}/api/orders`, {}, 6000);
        if (bRes.ok) {
          const bData = await bRes.json();
          if (bData.orders && Array.isArray(bData.orders)) {
            return bData.orders.map(bo => ({
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
            }));
          }
        }
      } catch (bErr) {
        console.warn("Backend orders fetch notice (timeout/cold-start):", bErr.message);
      }
      return [];
    })();

    const [fsResults, backendResults] = await Promise.all([
      firestoreOrdersPromise,
      backendOrdersPromise
    ]);

    // Backend results first
    (backendResults || []).forEach(bo => {
      if (bo && bo.id) combinedMap.set(String(bo.id), bo);
    });

    // Merge Firestore orders (Authoritative Source of Truth)
    (fsResults || []).forEach(fo => {
      if (fo && fo.id) {
        const existing = combinedMap.get(String(fo.id));
        combinedMap.set(String(fo.id), { ...existing, ...fo });
      }
    });

    // If network couldn't connect, fall back to cached orders
    if (combinedMap.size === 0) {
      try {
        const localOrders = JSON.parse(localStorage.getItem('sc_all_orders') || '[]');
        localOrders.forEach(o => {
          if (o && o.id) combinedMap.set(String(o.id), o);
        });
      } catch (e) {}
    }

    if (combinedMap.size > 0 || orders.length === 0) {
      orders = Array.from(combinedMap.values());
      localStorage.setItem('sc_all_orders', JSON.stringify(orders));
    }
  })();

  // 3. Load free shipping setting
  const fetchSettingsTask = (async () => {
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
  })();

  // Execute all tasks in parallel so the page loads within hundreds of milliseconds
  await Promise.allSettled([fetchProductsTask, fetchOrdersTask, fetchSettingsTask]);

  renderOverview();
  renderProducts();
  if (typeof renderOrders === 'function') renderOrders();

  // ── Background Shiprocket Status Sync (Fallback) ──
  // Non-blocking: sync Shiprocket statuses on admin page load to catch missed webhooks
  try {
    const getBackendUrl = () => {
      if (typeof window !== 'undefined' && window.BACKEND_URL) return window.BACKEND_URL.replace(/\/$/, '');
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:3000';
      return '';
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

let ordersUnsub = null;
let productsUnsub = null;

async function initDashboard() {
  // 1. Instant optimistic render from cache (0ms) so mobile users immediately see real counts without waiting
  if (products.length > 0 || orders.length > 0) {
    renderOverview();
    if (typeof renderProducts === 'function') renderProducts();
    if (typeof renderOrders === 'function') renderOrders();
  }

  // 2. Fetch fresh live data concurrently without freezing the screen
  await loadData();
  renderOverview();
  if (typeof renderOrders === 'function') renderOrders();
  if (typeof renderReviews === 'function') renderReviews();

  // Attach Realtime Firestore Listener for Incoming Orders
  if (!ordersUnsub) {
    try {
      ordersUnsub = onSnapshot(collection(db, "orders"), (snapshot) => {
        let changed = false;
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          const docId = String(change.doc.id);
          const orderId = String(data.id || docId);
          const existingIdx = orders.findIndex(o => String(o.id) === orderId || String(o.firestoreId) === docId);

          if (change.type === "added") {
            if (existingIdx === -1) {
              orders.unshift({ firestoreId: docId, ...data });
              changed = true;
            }
          } else if (change.type === "modified") {
            if (existingIdx > -1) {
              orders[existingIdx] = { ...orders[existingIdx], ...data, firestoreId: docId };
              changed = true;
            } else {
              orders.unshift({ firestoreId: docId, ...data });
              changed = true;
            }
          } else if (change.type === "removed") {
            if (existingIdx > -1) {
              orders.splice(existingIdx, 1);
              changed = true;
            }
          }
        });

        if (changed) {
          localStorage.setItem('sc_all_orders', JSON.stringify(orders));
          renderOverview();
          if (typeof renderOrders === 'function') renderOrders();
        }
      }, (err) => {
        console.warn("Realtime orders listener notice:", err);
      });
    } catch (e) {
      console.warn("Could not attach orders realtime listener:", e);
    }
  }

  // Attach Realtime Firestore Listener for Catalog Products
  if (!productsUnsub) {
    try {
      productsUnsub = onSnapshot(collection(db, "products"), (snapshot) => {
        let changed = false;
        snapshot.docChanges().forEach((change) => {
          const data = change.doc.data();
          const prodId = String(change.doc.id).trim();
          const existingIdx = products.findIndex(p => String(p.id).trim() === prodId);

          if (change.type === "added") {
            if (existingIdx === -1) {
              const origVal = parseInt(data.original) || 0;
              const priceVal = parseInt(data.price) || 0;
              const calcOff = (origVal > priceVal && origVal > 0) ? Math.round(((origVal - priceVal) / origVal) * 100) : (data.off || 0);
              products.push({
                ...data,
                id: prodId,
                off: calcOff,
                rating: data.rating || 4.8,
                reviews: data.reviews !== undefined ? data.reviews : 0
              });
              changed = true;
            }
          } else if (change.type === "modified") {
            if (existingIdx > -1) {
              const origVal = parseInt(data.original) || 0;
              const priceVal = parseInt(data.price) || 0;
              const calcOff = (origVal > priceVal && origVal > 0) ? Math.round(((origVal - priceVal) / origVal) * 100) : (data.off || 0);
              products[existingIdx] = {
                ...products[existingIdx],
                ...data,
                id: prodId,
                off: calcOff
              };
              changed = true;
            }
          } else if (change.type === "removed") {
            if (existingIdx > -1) {
              products.splice(existingIdx, 1);
              changed = true;
            }
          }
        });

        if (changed) {
          localStorage.setItem('sc_products', JSON.stringify(products));
          renderOverview();
          if (typeof renderProducts === 'function') renderProducts();
        }
      }, (err) => {
        console.warn("Realtime products listener notice:", err);
      });
    } catch (e) {
      console.warn("Could not attach products realtime listener:", e);
    }
  }
}

// --- OVERVIEW TAB ANALYTICS & VISUALIZATION ---

// Safe order total parser: strips currency signs, commas, and handles string concatenation bugs
function parseOrderTotal(order) {
  if (!order) return 0;
  let val = order.total !== undefined ? order.total : order.total_amount;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

// Safe order items extractor (handles items vs products field)
function getOrderItems(order) {
  if (!order) return [];
  if (Array.isArray(order.items) && order.items.length > 0) return order.items;
  if (Array.isArray(order.products) && order.products.length > 0) return order.products;
  return [];
}

// Official 6 Store Categories Registry (Strictly 6 categories: Shirts, T-Shirts, Pants, Shorts, Caps, Keychains)
const OFFICIAL_CATEGORIES = {
  shirt: { key: 'shirt', name: 'Shirts', icon: '👔' },
  tshirt: { key: 'tshirt', name: 'T-Shirts', icon: '👕' },
  pant: { key: 'pant', name: 'Pants', icon: '👖' },
  shorts: { key: 'shorts', name: 'Shorts', icon: '🩳' },
  caps: { key: 'caps', name: 'Caps', icon: '🧢' },
  keychains: { key: 'keychains', name: 'Keychains', icon: '🔑' }
};

function resolveCategory(cat, name = '') {
  let c = String(cat || '').trim().toLowerCase();
  const n = String(name || '').toLowerCase();

  // 1. Direct Category Match
  if (c === 'shirt' || c === 'shirts') return OFFICIAL_CATEGORIES.shirt;
  if (c === 'tshirt' || c === 't-shirt' || c === 'tshirts' || c === 't-shirts' || c === 'tee') return OFFICIAL_CATEGORIES.tshirt;
  if (c === 'pant' || c === 'pants' || c === 'jeans' || c === 'trouser' || c === 'trousers') return OFFICIAL_CATEGORIES.pant;
  if (c === 'shorts' || c === 'short') return OFFICIAL_CATEGORIES.shorts;
  if (c === 'caps' || c === 'cap' || c === 'hat') return OFFICIAL_CATEGORIES.caps;
  if (c === 'keychains' || c === 'keychain' || c === 'accessory' || c === 'accessories') return OFFICIAL_CATEGORIES.keychains;

  // 2. Comprehensive apparel keyword matching
  // T-Shirts:
  if (n.includes('t-shirt') || n.includes('tshirt') || n.includes('tee') || n.includes('polo') || n.includes('hoodie') || n.includes('sweatshirt') || n.includes('round neck') || n.includes('crewneck') || n.includes('crew neck')) {
    return OFFICIAL_CATEGORIES.tshirt;
  }
  // Pants:
  if (n.includes('pant') || n.includes('jean') || n.includes('trouser') || n.includes('cargo') || n.includes('denim') || n.includes('chino') || n.includes('jogger') || n.includes('track') || n.includes('waist')) {
    return OFFICIAL_CATEGORIES.pant;
  }
  // Shorts:
  if (n.includes('short') || n.includes('boxer') || n.includes('bermuda') || n.includes('swim')) {
    return OFFICIAL_CATEGORIES.shorts;
  }
  // Caps:
  if (n.includes('cap') || n.includes('hat') || n.includes('snapback') || n.includes('beanie') || n.includes('headwear')) {
    return OFFICIAL_CATEGORIES.caps;
  }
  // Keychains:
  if (n.includes('keychain') || n.includes('key ring') || n.includes('key chain') || n.includes('ring') || n.includes('chain') || n.includes('crest') || n.includes('strap') || n.includes('wallet')) {
    return OFFICIAL_CATEGORIES.keychains;
  }
  // Shirts (including Oxford, Flannels, Linen, Formal, etc.):
  if (n.includes('shirt') || n.includes('oxford') || n.includes('flannel') || n.includes('linen') || n.includes('formal') || n.includes('casual') || n.includes('kurta') || n.includes('blazer') || n.includes('suit') || n.includes('collar') || n.includes('button')) {
    return OFFICIAL_CATEGORIES.shirt;
  }

  // 3. Fallback: Default to Shirts (Apparel default). NEVER create or return 'other' or 'Other Apparel'!
  return OFFICIAL_CATEGORIES.shirt;
}

// Compute comprehensive sales analytics for Overview
function computeSalesAnalytics(ordersList, productsList) {
  let totalRevenue = 0;
  let totalUnitsSold = 0;
  let validOrdersCount = 0;
  let pendingOrdersCount = 0;

  // Base category registry - strictly the 6 official store categories
  const categoryStats = {
    'shirt': { key: 'shirt', name: 'Shirts', icon: '👔', units: 0, revenue: 0, catalogCount: 0 },
    'tshirt': { key: 'tshirt', name: 'T-Shirts', icon: '👕', units: 0, revenue: 0, catalogCount: 0 },
    'pant': { key: 'pant', name: 'Pants', icon: '👖', units: 0, revenue: 0, catalogCount: 0 },
    'shorts': { key: 'shorts', name: 'Shorts', icon: '🩳', units: 0, revenue: 0, catalogCount: 0 },
    'caps': { key: 'caps', name: 'Caps', icon: '🧢', units: 0, revenue: 0, catalogCount: 0 },
    'keychains': { key: 'keychains', name: 'Keychains', icon: '🔑', units: 0, revenue: 0, catalogCount: 0 }
  };

  // 1. Analyze active products in catalog
  let outOfStockCount = 0;
  (productsList || []).forEach(p => {
    let resolved = resolveCategory(p.cat, p.name);
    if (!categoryStats[resolved.key]) resolved = OFFICIAL_CATEGORIES.shirt;
    categoryStats[resolved.key].catalogCount += 1;
    const stockVal = parseInt(p.stock);
    if (!isNaN(stockVal) && stockVal <= 0) {
      outOfStockCount++;
    }
  });

  // 2. Track product sales performance
  const productMap = new Map();

  // Seed product map with all active catalog products
  (productsList || []).forEach(p => {
    const pKey = String(p.id || p.name).trim();
    let resolved = resolveCategory(p.cat, p.name);
    if (!categoryStats[resolved.key]) resolved = OFFICIAL_CATEGORIES.shirt;
    const thumbImg = (p.images && p.images[0]) || p.img || 'Logo.png';
    const priceVal = parseInt(p.price) || 0;
    productMap.set(pKey, {
      id: p.id,
      name: p.name || 'Untitled Product',
      img: thumbImg,
      catKey: resolved.key,
      catName: resolved.name,
      price: priceVal,
      unitsSold: 0,
      revenue: 0,
      sizes: {},
      stock: p.stock !== undefined ? p.stock : 'N/A',
      inCatalog: true
    });
  });

  // 3. Process orders
  (ordersList || []).forEach(order => {
    const isCancelled = String(order.status || '').toLowerCase() === 'cancelled' ||
                        String(order.shipment_status || '').toUpperCase() === 'CANCELLED';

    const isPending = !isCancelled && (
      String(order.status || '').toLowerCase() === 'processing' ||
      !order.shipment_status ||
      order.shipment_status === 'ORDER_CREATED' ||
      order.shipment_status === 'AWB_PENDING'
    );
    if (isPending) pendingOrdersCount++;

    if (!isCancelled) {
      validOrdersCount++;
      const orderRev = parseOrderTotal(order);
      totalRevenue += orderRev;

      const items = getOrderItems(order);
      items.forEach(item => {
        const qty = parseInt(item.qty || item.quantity) || 1;
        totalUnitsSold += qty;

        // Try to match product
        const matchedP = (productsList || []).find(p =>
          String(p.id).trim() === String(item.id || item.productId).trim() ||
          String(p.name || '').trim().toLowerCase() === String(item.name || '').trim().toLowerCase()
        );

        let resolved = resolveCategory(item.cat || (matchedP ? matchedP.cat : ''), item.name || (matchedP ? matchedP.name : ''));
        if (!categoryStats[resolved.key]) resolved = OFFICIAL_CATEGORIES.shirt;
        const unitPrice = parseFloat(item.price) || (matchedP ? parseFloat(matchedP.price) : 0) || 0;
        const itemRev = unitPrice * qty;

        // Update category stats (strictly within the 6 categories)
        categoryStats[resolved.key].units += qty;
        categoryStats[resolved.key].revenue += itemRev;

        // Update product stats
        const prodKey = matchedP ? String(matchedP.id).trim() : (item.id || item.name || 'unknown');
        let prodEntry = productMap.get(prodKey);
        if (!prodEntry) {
          prodEntry = {
            id: item.id || (matchedP ? matchedP.id : null),
            name: item.name || (matchedP ? matchedP.name : 'Unknown Product'),
            img: item.img || item.image || (matchedP ? (matchedP.img || matchedP.images?.[0]) : 'Logo.png'),
            catKey: resolved.key,
            catName: resolved.name,
            price: unitPrice,
            unitsSold: 0,
            revenue: 0,
            sizes: {},
            stock: matchedP ? matchedP.stock : 'N/A',
            inCatalog: !!matchedP
          };
          productMap.set(prodKey, prodEntry);
        }

        prodEntry.unitsSold += qty;
        prodEntry.revenue += itemRev;
        if (unitPrice > 0 && !prodEntry.price) prodEntry.price = unitPrice;

        const sizeLabel = String(item.size || '').trim() || 'Standard';
        prodEntry.sizes[sizeLabel] = (prodEntry.sizes[sizeLabel] || 0) + qty;
      });
    }
  });

  const allProducts = Array.from(productMap.values());
  allProducts.sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue);
  allProducts.forEach((p, idx) => {
    p.globalRank = idx + 1;
  });
  const soldProducts = allProducts.filter(p => p.unitsSold > 0);

  return {
    totalRevenue,
    totalOrders: ordersList.length,
    validOrdersCount,
    pendingOrdersCount,
    totalUnitsSold,
    soldProductsCount: soldProducts.length,
    outOfStockCount,
    categoryStats,
    productRanking: allProducts,
    soldProductRanking: soldProducts
  };
}

let categorySalesChartInstance = null;
let categoryRevenueChartInstance = null;
let currentOverviewRanking = [];

function renderSalesCharts(analytics) {
  if (typeof Chart === 'undefined') {
    setTimeout(() => {
      if (typeof Chart !== 'undefined') renderSalesCharts(analytics);
    }, 600);
    return;
  }

  const catKeys = Object.keys(analytics.categoryStats);
  const categories = catKeys.map(k => analytics.categoryStats[k]);
  const activeForUnits = categories.filter(c => c.units > 0);
  const activeForRevenue = categories.filter(c => c.revenue > 0);

  const chartColors = [
    '#e8000d', '#2563eb', '#16a34a', '#0f172a',
    '#d97706', '#7c3aed', '#0891b2', '#db2777'
  ];

  // 1. Doughnut Chart: Units Sold by Category
  const salesCanvas = document.getElementById('categorySalesChart');
  const salesEmpty = document.getElementById('categoryChartEmpty');

  if (salesCanvas) {
    if (activeForUnits.length === 0) {
      salesCanvas.style.display = 'none';
      if (salesEmpty) salesEmpty.style.display = 'block';
      if (categorySalesChartInstance) {
        categorySalesChartInstance.destroy();
        categorySalesChartInstance = null;
      }
    } else {
      salesCanvas.style.display = 'block';
      if (salesEmpty) salesEmpty.style.display = 'none';

      if (categorySalesChartInstance) {
        categorySalesChartInstance.destroy();
      }

      categorySalesChartInstance = new Chart(salesCanvas, {
        type: 'doughnut',
        data: {
          labels: activeForUnits.map(c => `${c.icon} ${c.name}`),
          datasets: [{
            data: activeForUnits.map(c => c.units),
            backgroundColor: chartColors.slice(0, activeForUnits.length),
            borderWidth: 2,
            borderColor: '#ffffff',
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '66%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                font: { size: 11, weight: '600', family: "'Outfit', sans-serif" },
                padding: 12
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const val = context.raw || 0;
                  const total = analytics.totalUnitsSold || 1;
                  const pct = Math.round((val / total) * 100);
                  return ` ${val} unit(s) (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }
  }

  // 2. Bar Chart: Revenue by Category
  const revCanvas = document.getElementById('categoryRevenueChart');
  const revEmpty = document.getElementById('revenueChartEmpty');

  if (revCanvas) {
    if (activeForRevenue.length === 0) {
      revCanvas.style.display = 'none';
      if (revEmpty) revEmpty.style.display = 'block';
      if (categoryRevenueChartInstance) {
        categoryRevenueChartInstance.destroy();
        categoryRevenueChartInstance = null;
      }
    } else {
      revCanvas.style.display = 'block';
      if (revEmpty) revEmpty.style.display = 'none';

      if (categoryRevenueChartInstance) {
        categoryRevenueChartInstance.destroy();
      }

      categoryRevenueChartInstance = new Chart(revCanvas, {
        type: 'bar',
        data: {
          labels: activeForRevenue.map(c => c.name),
          datasets: [{
            label: 'Revenue (₹)',
            data: activeForRevenue.map(c => c.revenue),
            backgroundColor: chartColors.slice(0, activeForRevenue.length),
            borderRadius: 6,
            maxBarThickness: 45
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(val) {
                  return '₹' + Number(val).toLocaleString('en-IN');
                },
                font: { size: 10, family: "'Outfit', sans-serif" }
              },
              grid: { color: 'rgba(226, 232, 240, 0.6)' }
            },
            x: {
              grid: { display: false },
              ticks: { font: { size: 11, weight: '600', family: "'Outfit', sans-serif" } }
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(context) {
                  return ` Revenue: ₹${Number(context.raw).toLocaleString('en-IN')}`;
                }
              }
            }
          }
        }
      });
    }
  }
}

function renderCategoryStatsGrid(analytics) {
  const grid = document.getElementById('categoryStatsGrid');
  if (!grid) return;

  const categories = Object.values(analytics.categoryStats);
  grid.innerHTML = categories.map(cat => {
    return `
      <div class="cat-stat-card">
        <div class="cat-stat-top">
          <span class="cat-stat-icon">${cat.icon}</span>
          <span class="cat-stat-badge">${cat.units} Sold</span>
        </div>
        <div class="cat-stat-name">${cat.name}</div>
        <div class="cat-stat-val">₹${Number(cat.revenue).toLocaleString('en-IN')}</div>
        <div class="cat-stat-sub">
          <span>📦 In Catalog: <strong>${cat.catalogCount}</strong></span>
          <span>👕 Sold: <strong>${cat.units} pcs</strong></span>
        </div>
      </div>
    `;
  }).join('');
}

function renderOverviewProductsTable(salesList) {
  const tbody = document.getElementById('overviewProductsTableBody');
  if (!tbody) return;

  currentOverviewRanking = salesList || [];
  const searchInput = document.getElementById('overviewProdSearch');
  const subEl = document.getElementById('overviewTableSub');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const isSearchActive = query.length > 0;

  let listToRender = currentOverviewRanking;
  if (isSearchActive) {
    listToRender = listToRender.filter(p =>
      String(p.name || '').toLowerCase().includes(query) ||
      String(p.catName || '').toLowerCase().includes(query) ||
      String(p.id || '').toLowerCase().includes(query)
    );
    if (subEl) {
      subEl.innerHTML = `Showing <strong>${listToRender.length}</strong> matching product(s) for "<em>${query}</em>"`;
    }
  } else {
    // Show only Top 10 Best Sellers by default
    listToRender = listToRender.slice(0, 10);
    if (subEl) {
      subEl.textContent = 'Showing Top 10 Best Sellers (Search any product above to check its sales)';
    }
  }

  if (listToRender.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding: 2.5rem 1rem; color: #64748b;">
          ${isSearchActive ? `No product found matching "${query}". Try searching by product name, category, or ID.` : 'No products found in catalog.'}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = listToRender.map((p, idx) => {
    const sizeKeys = Object.keys(p.sizes || {});
    let sizePills = sizeKeys.length > 0
      ? sizeKeys.map(sz => `<span class="size-pill">${sz}: <strong>${p.sizes[sz]}</strong></span>`).join(' ')
      : '<span style="color:#94a3b8; font-size:0.8rem;">0 units sold</span>';

    let stockDisplay = '';
    const numericStock = parseInt(p.stock);
    if (!isNaN(numericStock)) {
      if (numericStock <= 0) {
        stockDisplay = `<span style="background:#fee2e2; color:#b91c1c; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:700;">Out of Stock</span>`;
      } else if (numericStock <= 5) {
        stockDisplay = `<span style="background:#fef3c7; color:#b45309; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:700;">Low: ${numericStock} pcs</span>`;
      } else {
        stockDisplay = `<span style="background:#dcfce7; color:#15803d; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:700;">${numericStock} in stock</span>`;
      }
    } else {
      stockDisplay = `<span style="background:#f1f5f9; color:#475569; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:600;">Active Catalog</span>`;
    }

    const rankNum = p.globalRank || (idx + 1);
    let rankBadge = `<span class="rank-badge">${rankNum}</span>`;
    if (rankNum === 1 && p.unitsSold > 0) rankBadge = `<span class="rank-badge rank-1">🥇 1</span>`;
    else if (rankNum === 2 && p.unitsSold > 0) rankBadge = `<span class="rank-badge rank-2">🥈 2</span>`;
    else if (rankNum === 3 && p.unitsSold > 0) rankBadge = `<span class="rank-badge rank-3">🥉 3</span>`;
    else if (p.unitsSold > 0) rankBadge = `<span class="rank-badge">#${rankNum}</span>`;
    else rankBadge = `<span class="rank-badge" style="background:#f1f5f9; color:#94a3b8; font-weight:600;">-</span>`;

    return `
      <tr>
        <td>
          <div style="display:flex; align-items:center; gap: 10px;">
            ${rankBadge}
            <img src="${p.img || 'Logo.png'}" alt="${p.name}" style="width: 44px; height: 50px; border-radius: 8px; object-fit: cover; border: 1px solid #e2e8f0; background: #f8fafc; flex-shrink: 0;" />
            <div>
              <div style="font-weight: 700; color: #0f172a; font-size: 0.95rem; line-height: 1.3;">${p.name}</div>
              <small style="color: #64748b; font-size: 0.78rem;">ID: ${p.id || 'N/A'}</small>
            </div>
          </div>
        </td>
        <td>
          <span style="background:#f1f5f9; color:#334155; font-size:0.75rem; font-weight:700; padding:3px 8px; border-radius:6px; text-transform:uppercase;">
            ${p.catName || 'Product'}
          </span>
        </td>
        <td style="text-align: center;">
          <strong style="font-size: 1.05rem; color: ${p.unitsSold > 0 ? 'var(--red)' : '#64748b'};">${p.unitsSold} pcs</strong>
        </td>
        <td>
          <div style="display:flex; gap: 4px; flex-wrap: wrap;">
            ${sizePills}
          </div>
        </td>
        <td style="text-align: right; font-weight: 600;">
          ₹${Number(p.price || 0).toLocaleString('en-IN')}
        </td>
        <td style="text-align: right; font-weight: 800; color: #0f172a;">
          ₹${Number(p.revenue || 0).toLocaleString('en-IN')}
        </td>
        <td style="text-align: center;">
          ${stockDisplay}
        </td>
      </tr>
    `;
  }).join('');
}

window.filterOverviewProducts = function() {
  renderOverviewProductsTable(currentOverviewRanking);
};

// --- OVERVIEW TAB MAIN RENDER ---
function renderOverview() {
  const analytics = computeSalesAnalytics(orders, products);

  // 1. KPI Cards
  const revEl = document.getElementById('statRevenue');
  const revSubEl = document.getElementById('statRevenueSub');
  const ordersEl = document.getElementById('statOrders');
  const ordersSubEl = document.getElementById('statOrdersSub');
  const unitsEl = document.getElementById('statUnitsSold');
  const unitsSubEl = document.getElementById('statUnitsSoldSub');
  const prodEl = document.getElementById('statProducts');
  const prodSubEl = document.getElementById('statProductsSub');

  if (revEl) {
    revEl.textContent = '₹' + Math.round(analytics.totalRevenue).toLocaleString('en-IN');
    revEl.classList.remove('loading-pulse');
  }
  if (revSubEl) revSubEl.textContent = `${analytics.validOrdersCount} active/fulfilled order(s)`;

  if (ordersEl) {
    ordersEl.textContent = analytics.totalOrders.toLocaleString('en-IN');
    ordersEl.classList.remove('loading-pulse');
  }
  if (ordersSubEl) ordersSubEl.textContent = `${analytics.pendingOrdersCount} pending fulfillment`;

  if (unitsEl) {
    unitsEl.textContent = analytics.totalUnitsSold.toLocaleString('en-IN');
    unitsEl.classList.remove('loading-pulse');
  }
  if (unitsSubEl) unitsSubEl.textContent = `${analytics.soldProductsCount} product(s) sold`;

  if (prodEl) {
    prodEl.textContent = products.length.toLocaleString('en-IN');
    prodEl.classList.remove('loading-pulse');
  }
  if (prodSubEl) prodSubEl.textContent = analytics.outOfStockCount > 0 ? `${analytics.outOfStockCount} out of stock` : `All catalog products live`;

  // 2. Charts
  renderSalesCharts(analytics);

  // 3. Category Stats Cards Grid
  renderCategoryStatsGrid(analytics);

  // 4. Product-wise Sales Table
  renderOverviewProductsTable(analytics.productRanking);
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
      <div class="form-group"><label>Brand</label><input type="text" id="df_brand" placeholder="e.g. SuryaCotton"></div>
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
      <div class="form-group"><label>Brand</label><input type="text" id="df_brand" placeholder="e.g. SuryaCotton"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Fabric</label><input type="text" id="df_fabric" placeholder="e.g. Cotton Twill, Denim, Stretch"></div>
      <div class="form-group"><label>Fit</label><select id="df_fit"><option value="Slim Fit">Slim Fit</option><option value="Regular Fit">Regular Fit</option><option value="Straight Fit">Straight Fit</option><option value="Relaxed Fit">Relaxed Fit</option><option value="Baggy Fit">Baggy Fit</option><option value="Mom Fit">Mom Fit</option><option value="Cargo Fit">Cargo Fit</option><option value="Jogger Fit">Jogger Fit</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Color</label><input type="text" id="df_color" placeholder="e.g. Black, Khaki, Denim Blue"></div>
      <div class="form-group">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem; flex-wrap: wrap; gap: 0.5rem;">
          <label style="margin: 0; font-weight: 700;">Size Selection</label>
          <div class="pant-size-mode-toggle" id="pantSizeModeToggle">
            <button type="button" class="pant-size-toggle-btn active" data-mode="number" id="pantModeNumBtn">Number (28-38)</button>
            <button type="button" class="pant-size-toggle-btn" data-mode="letter" id="pantModeLetBtn">Letter (S-XXL)</button>
          </div>
        </div>
        <div class="checkbox-group" id="df_waist">
          <label><input type="checkbox" value="28"> 28</label>
          <label><input type="checkbox" value="30"> 30</label>
          <label><input type="checkbox" value="32"> 32</label>
          <label><input type="checkbox" value="34"> 34</label>
          <label><input type="checkbox" value="36"> 36</label>
          <label><input type="checkbox" value="38"> 38</label>
        </div>
        <div class="checkbox-group" id="df_size" style="display: none;">
          <label><input type="checkbox" value="S"> S</label>
          <label><input type="checkbox" value="M"> M</label>
          <label><input type="checkbox" value="L"> L</label>
          <label><input type="checkbox" value="XL"> XL</label>
          <label><input type="checkbox" value="XXL"> XXL</label>
        </div>
      </div>
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
      <div class="form-group"><label>Brand</label><input type="text" id="df_brand" placeholder="e.g. SuryaCotton"></div>
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
      <div class="form-group"><label>Brand</label><input type="text" id="df_brand" placeholder="e.g. SuryaCotton"></div>
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
      <div class="form-group"><label>Brand</label><input type="text" id="df_brand" placeholder="e.g. SuryaCotton"></div>
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
      <div class="form-group"><label>Brand</label><input type="text" id="df_brand" placeholder="e.g. SuryaCotton"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Material / Fabric</label><input type="text" id="df_fabric" placeholder="e.g. Genuine Leather, Alloy Metal"></div>
      <div class="form-group"><label>Color</label><input type="text" id="df_color" placeholder="e.g. Tan Brown, Silver"></div>
    </div>
  `
};

window.setPantSizeMode = function(mode) {
  const numBtn = document.getElementById('pantModeNumBtn');
  const letBtn = document.getElementById('pantModeLetBtn');
  const waistEl = document.getElementById('df_waist');
  const sizeEl = document.getElementById('df_size');
  if (!waistEl || !sizeEl) return;

  if (mode === 'letter') {
    if (letBtn) letBtn.classList.add('active');
    if (numBtn) numBtn.classList.remove('active');
    waistEl.style.display = 'none';
    sizeEl.style.display = 'flex';
    waistEl.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  } else {
    if (numBtn) numBtn.classList.add('active');
    if (letBtn) letBtn.classList.remove('active');
    waistEl.style.display = 'flex';
    sizeEl.style.display = 'none';
    sizeEl.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  }
  renderSizeStockInputs();
};

window.setupPantSizeToggle = function() {
  const numBtn = document.getElementById('pantModeNumBtn');
  const letBtn = document.getElementById('pantModeLetBtn');
  if (numBtn) {
    numBtn.onclick = (e) => {
      e.preventDefault();
      window.setPantSizeMode('number');
    };
  }
  if (letBtn) {
    letBtn.onclick = (e) => {
      e.preventDefault();
      window.setPantSizeMode('letter');
    };
  }
};

function renderSizeStockInputs(initialStockMap = null) {
  const container = document.getElementById('sizeStockContainer');
  const grid = document.getElementById('sizeStockGrid');
  const stockInput = document.getElementById('editProdStock');
  if (!container || !grid) return;

  // Find all checked size/waist checkboxes in dynamic fields
  let checkedSizes = [];
  const sizeEl = document.getElementById('df_size');
  if (sizeEl && sizeEl.classList.contains('checkbox-group') && sizeEl.style.display !== 'none') {
    sizeEl.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => checkedSizes.push(cb.value));
  }
  const waistEl = document.getElementById('df_waist');
  if (waistEl && waistEl.classList.contains('checkbox-group') && waistEl.style.display !== 'none') {
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

  if (cat === 'pant') {
    window.setupPantSizeToggle();
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

  if (p.cat === 'pant') {
    const rawSizes = p.sizes || p.size || p.waist || [];
    const sizeList = Array.isArray(rawSizes) ? rawSizes.map(String) : [String(rawSizes)];
    const isLetterSizes = sizeList.some(s => ['S', 'M', 'L', 'XL', 'XXL', 'XS', '3XL', 'XXXL'].includes(s.trim().toUpperCase()));
    if (isLetterSizes) {
      window.setPantSizeMode('letter');
    } else {
      window.setPantSizeMode('number');
    }
  }
  
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
  if (sizeEl && (p.size || p.sizes)) {
    const srcSize = p.size || p.sizes;
    const pSizes = Array.isArray(srcSize) ? srcSize.map(String) : [String(srcSize)];
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
    if (editProdCat.value === 'pant') {
      const sizeEl = document.getElementById('df_size');
      const isLetter = (sizeEl && sizeEl.style.display !== 'none');
      if (isLetter) {
        const cbs = sizeEl.querySelectorAll('input[type="checkbox"]:checked');
        copiedData.size = Array.from(cbs).map(c => c.value);
        copiedData.sizes = [...copiedData.size];
        copiedData.pantSizeMode = 'letter';
        delete copiedData.waist;
      } else {
        const waistEl = document.getElementById('df_waist');
        const cbs = waistEl ? waistEl.querySelectorAll('input[type="checkbox"]:checked') : [];
        copiedData.size = Array.from(cbs).map(c => c.value);
        copiedData.sizes = [...copiedData.size];
        copiedData.waist = [...copiedData.size];
        copiedData.pantSizeMode = 'number';
      }
    } else {
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

    if (copiedData.cat === 'pant') {
      const rawSizes = copiedData.sizes || copiedData.size || copiedData.waist || [];
      const sizeList = Array.isArray(rawSizes) ? rawSizes.map(String) : [String(rawSizes)];
      const isLetter = copiedData.pantSizeMode === 'letter' || sizeList.some(s => ['S', 'M', 'L', 'XL', 'XXL', 'XS', '3XL', 'XXXL'].includes(s.trim().toUpperCase()));
      if (isLetter) {
        window.setPantSizeMode('letter');
      } else {
        window.setPantSizeMode('number');
      }
    }

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
    if (catSelect.value === 'pant') {
      const sizeEl = document.getElementById('df_size');
      const waistEl = document.getElementById('df_waist');
      const isLetterMode = (sizeEl && sizeEl.style.display !== 'none');
      if (isLetterMode) {
        const cbs = sizeEl.querySelectorAll('input[type="checkbox"]:checked');
        const vals = Array.from(cbs).map(c => c.value);
        newProductData.size = vals;
        newProductData.sizes = vals;
        newProductData.sizeType = 'letter';
        delete newProductData.waist;
      } else if (waistEl) {
        const cbs = waistEl.querySelectorAll('input[type="checkbox"]:checked');
        const vals = Array.from(cbs).map(c => c.value);
        newProductData.size = vals;
        newProductData.sizes = vals;
        newProductData.waist = vals;
        newProductData.sizeType = 'number';
      }
    } else {
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
      newProductData.createdAt = new Date().toISOString();
      const docRef = await withTimeout(addDoc(collection(db, "products"), newProductData));
      newProductData.id = String(docRef.id);
      products.unshift(newProductData);
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
    
    // Strictly sort chronologically: Latest (Newest) uploaded products first!
    products.sort((a, b) => {
      const timeA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
      const timeB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
      return timeB - timeA;
    });

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

// Clear All Test/Fake Orders & Reset Overview Sales & Revenue
window.confirmClearAllOrders = async function() {
  const count = orders.length;
  const msg = count > 0 
    ? `⚠️ RESET ALL TEST ORDERS?\n\nThis will permanently delete all ${count} fake/test order(s) from Firestore and the database.\n\n• Total Revenue & Units Sold will reset to 0.\n• All active products in your catalog (${products.length} products) will remain 100% SAFE.\n• Going forward, only real customer orders will be recorded.\n\nAre you sure you want to proceed?`
    : `There are currently no orders to reset.`;

  if (count === 0) {
    alert(msg);
    return;
  }

  const confirmed = window.confirm(msg);
  if (!confirmed) return;

  await window.clearAllFakeOrders();
};

window.clearAllFakeOrders = async function() {
  const clearBtn = document.getElementById('clearAllOrdersBtn');
  if (clearBtn) {
    clearBtn.disabled = true;
    clearBtn.innerHTML = `<span>⏳ Deleting orders...</span>`;
  }
  showToast("Clearing all test orders from database...");

  try {
    // 1. Delete all order documents from Firestore
    try {
      const ordersSnap = await getDocs(collection(db, "orders"));
      const deletePromises = [];
      ordersSnap.forEach((docSnap) => {
        deletePromises.push(deleteDoc(doc(db, "orders", docSnap.id)));
      });
      await Promise.all(deletePromises);
      console.log(`[ADMIN] 🗑️ Deleted ${deletePromises.length} orders from Firestore.`);
    } catch (fsErr) {
      console.warn("[ADMIN] Firestore orders deletion warning:", fsErr);
    }

    // 2. Clear backend Supabase DB orders if any exist
    try {
      const getBackendUrl = () => {
        if (typeof window !== 'undefined' && window.BACKEND_URL) return window.BACKEND_URL.replace(/\/$/, '');
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:3000';
        return '';
      };
      await fetch(`${getBackendUrl()}/api/admin/clear-orders`, { method: 'POST' }).catch(() => {});
    } catch (bErr) {
      console.warn("[ADMIN] Backend orders clear warning:", bErr);
    }

    // 3. Clear local storage cache
    localStorage.removeItem('sc_all_orders');
    localStorage.setItem('sc_all_orders', JSON.stringify([]));

    // Clear any mock orders inside user profiles in localStorage
    try {
      const storedProfile = JSON.parse(localStorage.getItem('sc_user_profile') || 'null');
      if (storedProfile && Array.isArray(storedProfile.orders)) {
        storedProfile.orders = [];
        localStorage.setItem('sc_user_profile', JSON.stringify(storedProfile));
      }
    } catch (profErr) {}

    // 4. Reset in-memory orders
    orders = [];

    // 5. Update Overview & Orders UI
    renderOverview();
    renderOrders();

    showToast("✅ All test orders removed! Revenue & sales reset to 0.");
    console.log("[ADMIN] ✅ Order reset complete. Active catalog count intact:", products.length);
  } catch (err) {
    console.error("[ADMIN] Error during orders clear:", err);
    showToast("❌ Error clearing orders: " + err.message);
  } finally {
    if (clearBtn) {
      clearBtn.disabled = false;
      clearBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        <span>Reset Test Orders</span>`;
    }
  }
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
      <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">${query ? '🔍' : '📦'}</div>
      <strong style="font-size: 1.05rem; color: #0f172a;">${query ? `No orders found matching "${query}"` : 'No orders recorded yet'}</strong><br>
      <small style="color: #64748b;">${query ? 'Try searching by Order ID, Customer Name, Phone, or AWB Code.' : 'When customers place orders in your store, they will appear here automatically.'}</small>
    </td></tr>`;
    return;
  }
  
  tbody.innerHTML = sortedOrders.map(o => {
    const d = new Date(o.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
    const statClass = (o.status || 'Processing').toLowerCase();
    
    // Shipment Badge
    const sStatus = (o.shipment_status || 'PENDING_APPROVAL').toUpperCase();
    let shipBadge = `<span style="background:#fef9c3; color:#854d0e; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:700;">🟡 PENDING APPROVAL</span>`;
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
    } else {
      shipBadge = `<span style="background:#fef9c3; color:#854d0e; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:700;">🟡 PENDING APPROVAL</span>`;
    }

    const needsRetry = Boolean(o.shiprocket_order_id) && !o.awb_code && sStatus !== 'CANCELLED' && sStatus !== 'PICKUP_SCHEDULED' && sStatus !== 'PENDING_APPROVAL';
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
            ${canSchedulePickup ? `<button class="action-btn" style="background:#16a34a; color:white; border-color:#16a34a; font-size:0.75rem; padding:4px 8px;" onclick="window.schedulePickup('${o.id}')">📦 Approve & Schedule Pickup</button>` : ''}
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
    return '';
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
  const realAwb = verifyData.awb_code || 'Will be generated upon approval';
  const courier = verifyData.courier_name || 'Will be assigned upon approval';
  const custName = verifyData.customer_name || 'N/A';

  const confirmMsg = `[ADMIN APPROVAL REQUIRED]\n\n` +
    `Are you sure you want to approve and schedule courier pickup for this order?\n\n` +
    `Order ID: #${dbId}\n` +
    `Customer: ${custName}\n` +
    `Current Status: ${verifyData.shipment_status}\n\n` +
    `Click OK to grant Admin Approval, send order to Shiprocket and schedule courier pickup.`;

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
      return '';
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

  const targetEmail = (o.customerEmail || o.email || '').trim();
  if (!targetEmail || !targetEmail.includes('@')) {
    alert(`Order #${id} does not have a valid customer email address.`);
    return;
  }

  showToast(`Sending confirmation email to ${targetEmail}...`);

  const getBackendUrl = () => {
    if (typeof window !== 'undefined' && window.BACKEND_URL) return window.BACKEND_URL.replace(/\/$/, '');
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:3000';
    return '';
  };

  let sentViaServer = false;
  try {
    const res = await fetch(`${getBackendUrl()}/api/send-order-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(o)
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        showToast(`✅ Order confirmation email sent to ${targetEmail}!`);
        sentViaServer = true;
        return;
      }
    }
  } catch (err) {
    console.warn("Backend email notice:", err);
  }

  if (!sentViaServer) {
    // Client-side EmailJS fallback
    try {
      if (typeof window.emailjs !== 'undefined' && EMAIL_CONFIG.templateId && EMAIL_CONFIG.publicKey) {
        window.emailjs.init({ publicKey: EMAIL_CONFIG.publicKey });
        const formattedId = String(o.id).startsWith('SC-') ? String(o.id) : `SC-${o.id}`;
        const items = o.items || o.products || [];
        const itemsSummary = items.map(i => `• ${i.qty || 1}x ${i.name || 'Item'}${i.size ? ' (Size: ' + i.size + ')' : ''} - ₹${((i.price || 0) * (i.qty || 1)).toLocaleString('en-IN')}`).join('\n');
        const itemsHtml = items.map(i => `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 8px; font-weight: 600; color: #0f172a;">${i.name || 'Item'}</td>
            <td style="padding: 10px 8px; text-align: center;">${i.size || '-'}</td>
            <td style="padding: 10px 8px; text-align: center; font-weight: 600;">${i.qty || 1}</td>
            <td style="padding: 10px 8px; text-align: right; font-weight: 700;">₹${((i.price || 0) * (i.qty || 1)).toLocaleString('en-IN')}</td>
          </tr>
        `).join('');

        const addr = [
          o.customerAddress,
          o.customerCity,
          o.customerState,
          o.customerPin
        ].filter(Boolean).join(', ');

        const templateParams = {
          to_name: o.customerName || 'Valued Customer',
          to_email: targetEmail,
          customer_name: o.customerName || 'Valued Customer',
          customer_email: targetEmail,
          customer_phone: o.customerPhone || '',
          order_id: formattedId,
          order_date: o.date ? new Date(o.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleDateString('en-IN'),
          order_total: `₹${Number(o.total || 0).toLocaleString('en-IN')}`,
          total_amount: `₹${Number(o.total || 0).toLocaleString('en-IN')}`,
          payment_id: o.razorpay_payment_id || 'PREPAID',
          shipping_address: addr || 'Address provided at checkout',
          items_summary: itemsSummary,
          items_html: itemsHtml,
          tracking_url: o.tracking_url || `https://suryacotton.com/track.html?order=${formattedId}`,
          courier_name: o.courier_name || 'Assigned upon dispatch',
          awb_code: o.awb_code || 'Pending Dispatch',
          name: 'SuryaCotton',
          from_name: 'SuryaCotton',
          email: 'suryacotton1@gmail.com',
          reply_to: 'suryacotton1@gmail.com',
          store_name: EMAIL_CONFIG.storeName || 'SuryaCotton',
          support_email: EMAIL_CONFIG.supportEmail || 'suryacotton1@gmail.com'
        };

        await window.emailjs.send(EMAIL_CONFIG.serviceId, EMAIL_CONFIG.templateId, templateParams);
        showToast(`✅ Order confirmation email sent to ${targetEmail}!`);
      } else {
        alert('⚠️ EmailJS is not configured or SDK is unavailable.');
      }
    } catch (clientErr) {
      console.error("Client email error:", clientErr);
      alert(`⚠️ Email sending notice: ${clientErr.text || clientErr.message || 'Could not send email'}`);
    }
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
          ${(o.shipment_status || '').toUpperCase() !== 'CANCELLED' && (o.shipment_status || '').toUpperCase() !== 'PICKUP_SCHEDULED' && (o.shipment_status || '').toUpperCase() !== 'DELIVERED' ? `<button type="button" onclick="window.schedulePickup('${o.id}')" style="background:#16a34a; color:#ffffff; border:none; padding:6px 12px; border-radius:6px; font-weight:700; font-size:0.82rem; cursor:pointer;">📦 Approve & Schedule Pickup</button>` : ''}
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
