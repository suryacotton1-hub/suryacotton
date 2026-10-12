/* =========================================
   SURYA COTTON — LIVE STOREFRONT SYNC
   Fetches products from Firebase Firestore and syncs across all pages
   ========================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCI5Wp50544lasNyUgeXaXG0JXGEjeQ36s",
  authDomain: "surya-cottans.firebaseapp.com",
  projectId: "surya-cottans",
  messagingSenderId: "654029093109",
  appId: "1:654029093109:web:60246a1322fdf002ba6dbc",
  measurementId: "G-KWC6WYYJ0R"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

signInAnonymously(auth).catch((error) => {
  console.warn("Storefront anonymous auth warning:", error);
});

let syncPromise = null;

async function syncProductsFromFirestore(force = false) {
  // Legacy dummy products filter
  const dummyNames = ['Plain Shirt', 'Linen Shirt', 'Printed Shirt', 'Branded Shirt', 'Checked Shirt', 'Stripped Shirt', 'Denim Shirt', 'Jean Pant', 'Cotton Pant', 'Baggy Pant', 'Mom Fit Pant', 'Track Pant', 'Hoodies T-Shirt', 'Collar T-Shirt', 'Drop Shoulder T-Shirt', 'Full Sleeve T-Shirt'];
  
  // Check sessionStorage for recent fetch (within last 30 seconds) unless forced
  const lastSync = sessionStorage.getItem('sc_last_sync_time');
  const now = Date.now();
  if (!force && lastSync && (now - parseInt(lastSync, 10)) < 30000 && localStorage.getItem('sc_products')) {
    try {
      const cached = JSON.parse(localStorage.getItem('sc_products'));
      if (Array.isArray(cached) && !cached.some(p => dummyNames.includes(p.name))) {
        dispatchSyncedEvents(cached);
        return;
      }
    } catch (e) {
      // Ignore parse error and proceed to fetch
    }
  }

  // Deduplicate in-flight requests
  if (syncPromise) return syncPromise;

  syncPromise = (async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "products"));
      const fetchedProducts = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        data.id = docSnap.id; // Include Firestore doc id
        fetchedProducts.push(data);
      });

      let cleanProducts = [];
      if (fetchedProducts.length > 0) {
        const seenMap = new Map();
        fetchedProducts.forEach(p => {
          if (!p) return;
          const key = String(p.id || '').trim();
          if (key) {
            seenMap.set(key, p);
          }
        });
        cleanProducts = Array.from(seenMap.values()).map(p => {
          const origVal = parseInt(p.original) || 0;
          const priceVal = parseInt(p.price) || 0;
          const calcOff = (origVal > priceVal && origVal > 0) ? Math.round(((origVal - priceVal) / origVal) * 100) : (p.off || 0);
          return {
            ...p,
            off: calcOff,
            rating: p.rating || 4.8,
            reviews: p.reviews !== undefined ? p.reviews : 0
          };
        });

        // Strictly sort chronologically: Latest (Newest) uploaded product first!
        cleanProducts.sort((a, b) => {
          const timeA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
          const timeB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
          return timeB - timeA;
        });
      }

      localStorage.setItem('sc_products', JSON.stringify(cleanProducts));
      sessionStorage.setItem('sc_last_sync_time', Date.now().toString());
      dispatchSyncedEvents(cleanProducts);
    } catch (err) {
      console.error("Failed to sync products from Firestore:", err);
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}

function dispatchSyncedEvents(fetchedProducts) {
  if (typeof window !== 'undefined') {
    window.products = fetchedProducts;
    window.ALL_PRODUCTS = fetchedProducts;
  }

  window.dispatchEvent(new CustomEvent('scProductsSynced', { detail: fetchedProducts }));

  if (typeof window.renderProducts === 'function') {
    window.renderProducts(window.activeFilter || 'all');
  } else if (typeof window.renderGrid === 'function') {
    window.renderGrid();
  } else if (typeof window.renderProduct === 'function' && typeof window.getProductId === 'function') {
    const pid = window.getProductId();
    const p = fetchedProducts.find(x => String(x.id) === String(pid) || Number(x.id) === Number(pid));
    if (p) {
      window.renderProduct(p);
      if (typeof window.initProductAnimations === 'function') {
        setTimeout(window.initProductAnimations, 100);
      }
    }
  }
}

// Start sync on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => syncProductsFromFirestore());
} else {
  syncProductsFromFirestore();
}
