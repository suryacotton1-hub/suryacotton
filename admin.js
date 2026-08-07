/* =========================================
   SURYA COTTANS — ADMIN DASHBOARD JS
   ========================================= */

// ---- IMPORT FIREBASE SDKs VIA ESM CDN ----
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, setDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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

// --- LOGIN OVERLAY ---
const loginOverlay = document.getElementById('adminLoginOverlay');
const loginBtn = document.getElementById('adminLoginBtn');
const loginPass = document.getElementById('adminPass');
const loginErr = document.getElementById('adminLoginError');
const dashboard = document.getElementById('adminDashboard');

loginBtn.addEventListener('click', () => {
  if (loginPass.value === 'admin123') {
    loginOverlay.classList.add('hidden');
    dashboard.classList.remove('hidden');
    initDashboard();
  } else {
    loginErr.style.display = 'block';
  }
});

// --- NAVIGATION TABS & MOBILE DRAWER ---
const adminSidebar = document.getElementById('adminSidebar');
const sidebarBackdrop = document.getElementById('sidebarBackdrop');
const mobileNavToggle = document.getElementById('mobileNavToggle');
const closeSidebarBtn = document.getElementById('closeSidebarBtn');

function openMobileSidebar() {
  if (adminSidebar) adminSidebar.classList.add('open');
  if (sidebarBackdrop) sidebarBackdrop.classList.add('show');
}
function closeMobileSidebar() {
  if (adminSidebar) adminSidebar.classList.remove('open');
  if (sidebarBackdrop) sidebarBackdrop.classList.remove('show');
}

if (mobileNavToggle) mobileNavToggle.addEventListener('click', openMobileSidebar);
if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeMobileSidebar);
if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeMobileSidebar);

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    document.getElementById('pageTitle').textContent = btn.textContent;
    
    closeMobileSidebar();
  });
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
let products = [];
let orders = [];

async function loadData() {
  // Load products from Firestore
  try {
    const querySnapshot = await getDocs(collection(db, "products"));
    const firestoreProducts = [];
    querySnapshot.forEach((doc) => {
      firestoreProducts.push({ id: doc.id, ...doc.data() });
    });
    if (firestoreProducts.length > 0) {
      const seenMap = new Map();
      firestoreProducts.forEach(p => {
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
        return {
          ...p,
          id: isNaN(parseInt(p.id)) ? p.id : parseInt(p.id),
          off: calcOff,
          rating: p.rating || 4.8,
          reviews: p.reviews !== undefined ? p.reviews : 0
        };
      });
      localStorage.setItem('sc_products', JSON.stringify(products));
    } else {
      products = JSON.parse(localStorage.getItem('sc_products') || '[]');
    }
  } catch(e) {
    console.error("Error fetching products from Firestore:", e);
    products = JSON.parse(localStorage.getItem('sc_products') || '[]');
  }
  
  // Load orders from Firestore
  try {
    const ordersSnap = await getDocs(collection(db, "orders"));
    const firestoreOrders = [];
    ordersSnap.forEach((doc) => {
      firestoreOrders.push({ firestoreId: doc.id, ...doc.data() });
    });
    if (firestoreOrders.length > 0) {
      orders = firestoreOrders;
      localStorage.setItem('sc_all_orders', JSON.stringify(orders));
    } else {
      orders = JSON.parse(localStorage.getItem('sc_all_orders') || '[]');
    }
  } catch(e) {
    console.error("Error fetching orders from Firestore:", e);
    orders = JSON.parse(localStorage.getItem('sc_all_orders') || '[]');
  }
  
  renderOverview();
  renderProducts();
  if (typeof renderOrders === 'function') renderOrders();
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

// --- PRODUCTS TAB ---
function renderProducts() {
  const tbody = document.getElementById('productsTableBody');
  tbody.innerHTML = products.map(p => {
    const mainImg = (p.images && p.images.length > 0) ? p.images[0] : (p.img || 'Logo.png');
    const priceStr = p.price !== undefined ? p.price.toLocaleString() : '0';
    const originalStr = p.original !== undefined ? p.original.toLocaleString() : '0';
    return `
      <tr>
        <td><img src="${mainImg}" class="prod-img" alt="${p.name}" /></td>
        <td><strong>${p.name}</strong><br><small>${p.badge || 'No Badge'}</small></td>
        <td style="text-transform: capitalize;">${p.cat}</td>
        <td>₹${priceStr} <br><small style="text-decoration:line-through; color:var(--text-light)">₹${originalStr}</small></td>
        <td style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button class="action-btn" onclick="window.openEditProduct('${p.id}')">Edit</button>
          <button class="action-btn" style="color: var(--red);" onclick="window.deleteProduct('${p.id}')">Delete</button>
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
      <div class="form-group"><label>Brand</label><input type="text" id="df_brand"></div>
      <div class="form-group"><label>Fabric</label><input type="text" id="df_fabric"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Sleeve Type</label><select id="df_sleeve"><option value="Half Sleeve">Half Sleeve</option><option value="Full Sleeve">Full Sleeve</option></select></div>
      <div class="form-group"><label>Fit</label><input type="text" id="df_fit"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Color (Optional)</label><input type="text" id="df_color"></div>
      <div class="form-group"><label>Size</label><div class="checkbox-group" id="df_size"><label><input type="checkbox" value="S"> S</label><label><input type="checkbox" value="M"> M</label><label><input type="checkbox" value="L"> L</label><label><input type="checkbox" value="XL"> XL</label><label><input type="checkbox" value="XXL"> XXL</label></div></div>
    </div>
  `,
  pant: `
    <div class="form-row">
      <div class="form-group"><label>Brand</label><input type="text" id="df_brand"></div>
      <div class="form-group"><label>Fabric</label><input type="text" id="df_fabric"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Fit</label><select id="df_fit"><option value="Slim Fit">Slim Fit</option><option value="Regular Fit">Regular Fit</option><option value="Straight Fit">Straight Fit</option><option value="Relaxed Fit">Relaxed Fit</option><option value="Baggy Fit">Baggy Fit</option><option value="Mom Fit">Mom Fit</option><option value="Cargo Fit">Cargo Fit</option><option value="Jogger Fit">Jogger Fit</option></select></div>
      <div class="form-group"><label>Waist Size</label><div class="checkbox-group" id="df_waist"><label><input type="checkbox" value="28"> 28</label><label><input type="checkbox" value="30"> 30</label><label><input type="checkbox" value="32"> 32</label><label><input type="checkbox" value="34"> 34</label><label><input type="checkbox" value="36"> 36</label><label><input type="checkbox" value="38"> 38</label></div></div>
    </div>
    <div class="form-group"><label>Color (Optional)</label><input type="text" id="df_color"></div>
  `,
  tshirt: `
    <div class="form-row">
      <div class="form-group"><label>Brand</label><input type="text" id="df_brand"></div>
      <div class="form-group"><label>Fabric</label><input type="text" id="df_fabric"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Neck Type</label><select id="df_neck"><option value="Round Neck">Round Neck</option><option value="Collar">Collar</option></select></div>
      <div class="form-group"><label>Sleeve Type</label><select id="df_sleeve"><option value="Half Sleeve">Half Sleeve</option><option value="Full Sleeve">Full Sleeve</option><option value="3/4 Sleeve">3/4 Sleeve</option><option value="Sleeveless">Sleeveless</option></select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Fit</label><select id="df_fit"><option value="Regular">Regular</option><option value="Oversized">Oversized</option></select></div>
      <div class="form-group"><label>Size</label><div class="checkbox-group" id="df_size"><label><input type="checkbox" value="S"> S</label><label><input type="checkbox" value="M"> M</label><label><input type="checkbox" value="L"> L</label><label><input type="checkbox" value="XL"> XL</label><label><input type="checkbox" value="XXL"> XXL</label></div></div>
    </div>
    <div class="form-group"><label>Color (Optional)</label><input type="text" id="df_color"></div>
  `,
  shorts: `
    <div class="form-row">
      <div class="form-group"><label>Brand</label><input type="text" id="df_brand"></div>
      <div class="form-group"><label>Waist Size</label><input type="text" id="df_waist" placeholder="e.g. 30, 32, 34"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Color (Optional)</label><input type="text" id="df_color"></div>
      <div class="form-group"><label>Size</label><div class="checkbox-group" id="df_size"><label><input type="checkbox" value="M"> M</label><label><input type="checkbox" value="L"> L</label><label><input type="checkbox" value="XL"> XL</label><label><input type="checkbox" value="XXL"> XXL</label></div></div>
    </div>
  `,
  caps: `
    <div class="form-row">
      <div class="form-group"><label>Color</label><input type="text" id="df_color"></div>
      <div class="form-group"><label>Size</label><select id="df_size"><option value="Free Size">Free Size</option><option value="Adjustable">Adjustable</option></select></div>
    </div>
  `,
  keychains: `
    <p style="color: var(--text-light); font-size: 0.9rem;">No extra category specific fields required.</p>
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
    const val = currentValues[sz] !== undefined ? currentValues[sz] : 10;
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
  const dFields = ['brand', 'fabric', 'sleeve', 'fit', 'color', 'neck', 'waist'];
  dFields.forEach(f => {
    const el = document.getElementById(`df_${f}`);
    if (el && p[f]) el.value = p[f];
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
    const dFields = ['brand', 'fabric', 'sleeve', 'fit', 'color', 'neck', 'waist'];
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
    const dFields = ['brand', 'fabric', 'sleeve', 'fit', 'color', 'neck', 'waist'];
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
    // 1. Upload new image files directly to Supabase Storage 'product-images' bucket
    const uploadedUrls = [];
    for (const file of selectedFiles) {
      try {
        const publicUrl = await uploadProductImage(file);
        uploadedUrls.push(publicUrl);
      } catch (uploadErr) {
        // If image upload fails, do not save incomplete product data. Show proper error message instead.
        alert(`Error: Image upload to Supabase Storage failed.\n\n${uploadErr.message}`);
        throw uploadErr; // Abort saving product to Firestore!
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
    const dFields = ['brand', 'fabric', 'sleeve', 'fit', 'color', 'neck', 'waist'];
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
      newProductData.id = docRef.id;
      products.push(newProductData);
    } else {
      const id = idVal;
      await withTimeout(setDoc(doc(db, "products", String(id)), newProductData, { merge: true }));
      const pIdx = products.findIndex(x => String(x.id) === String(id));
      if (pIdx > -1) {
        products[pIdx] = { ...products[pIdx], ...newProductData };
      }
    }
    
    // Deduplicate products before saving
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
      return idMatch || nameMatch || phoneMatch;
    });
  }
  
  if (sortedOrders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 3rem 1rem; color: #64748b;">
      <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔍</div>
      <strong>No orders found matching "${query}"</strong><br>
      <small>Try searching by Order ID (e.g. 102), Customer Name, or Phone Number.</small>
    </td></tr>`;
    return;
  }
  
  tbody.innerHTML = sortedOrders.map(o => {
    const d = new Date(o.date).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
    const statClass = (o.status || 'Processing').toLowerCase();
    
    return `
      <tr>
        <td>#${o.id}</td>
        <td>${d}</td>
        <td><strong>${o.customerName || 'Unknown'}</strong><br><small>${o.customerPhone || ''}</small></td>
        <td>₹${o.total.toLocaleString()}</td>
        <td>
          <select class="status-select" onchange="window.updateOrderStatus('${o.id}', this.value)">
            <option value="Processing" ${statClass==='processing'?'selected':''}>Processing</option>
            <option value="Shipped" ${statClass==='shipped'?'selected':''}>Shipped</option>
            <option value="Delivered" ${statClass==='delivered'?'selected':''}>Delivered</option>
            <option value="Cancelled" ${statClass==='cancelled'?'selected':''}>Cancelled</option>
          </select>
        </td>
        <td><button class="action-btn" onclick="window.viewOrderDetails('${o.id}')">View Items</button></td>
      </tr>
    `;
  }).join('');
}

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

  let html = `
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:1.25rem; margin-bottom:1.5rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem; border-bottom:1px dashed #cbd5e1; padding-bottom:0.75rem;">
        <span style="font-weight:800; color:#0f172a; font-size:1.1rem;">Order #${o.id}</span>
        <span style="font-size:0.8rem; color:#64748b; background:#f1f5f9; padding:4px 8px; border-radius:6px; border:1px solid #e2e8f0;">🕒 ${d}</span>
      </div>
      <div style="line-height:1.7; font-size:0.95rem; color:#334155;">
        <p style="margin-bottom:4px;"><strong>👤 Customer:</strong> ${o.customerName || 'Unknown'} <span style="color:#64748b; font-size:0.85rem;">(${o.customerEmail || 'No email'})</span></p>
        <p style="margin-bottom:4px;"><strong>📱 Phone:</strong> ${o.customerPhone || 'N/A'} ${o.customerAltPhone ? `<span style="color:#64748b;">(Alt: ${o.customerAltPhone})</span>` : ''}</p>
        <p style="margin-bottom:0;"><strong>📍 Address:</strong> ${o.customerAddress || 'N/A'}, ${o.customerCity || ''}, ${o.customerState || ''} - <strong>${o.customerPin || ''}</strong></p>
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
      <span style="color:#22c55e;">₹${o.total.toLocaleString()}</span>
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
