// ---- IMPORT FIREBASE SDKs VIA ESM CDN ----
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { uploadReviewImage } from "./supabase-config.js";

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
const auth = getAuth(app);
const db = getFirestore(app);

// ---- PRODUCTS DATABASE FOR WISHLIST ----
const defaultProducts = [];
let products = JSON.parse(localStorage.getItem('sc_products') || '[]');
if (!Array.isArray(products)) products = [];

// Remove any lingering dummy products
const dummyNames = ['Classic White Oxford Shirt', 'Premium Navy Blazer', 'Slim Fit Charcoal Trousers', 'White Embroidered Kurta', 'Bold Red Premium Tee', 'Linen Formal Shirt', 'Royal Sherwani Kurta', 'Casual Slim Jogger', 'Plain Shirt'];
if (products.some(p => dummyNames.includes(p.name))) {
  products = [];
  localStorage.setItem('sc_products', JSON.stringify([]));
}

// ---- DOM ELEMENTS ----
// Auth Panels
const authWrapper = document.getElementById('authWrapper');
const dashboardWrapper = document.getElementById('dashboardWrapper');
const toggleAuthBtn = document.getElementById('toggleAuthBtn');
const visualToggleText = document.getElementById('visualToggleText');
const loginBox = document.getElementById('loginBox');
const registerBox = document.getElementById('registerBox');

// Forms & Inputs
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');
const regNameInput = document.getElementById('regName');
const regEmailInput = document.getElementById('regEmail');
const regPasswordInput = document.getElementById('regPassword');

// Error / Loading Displays
const loginError = document.getElementById('loginError');
const registerError = document.getElementById('registerError');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');
const registerSubmitBtn = document.getElementById('registerSubmitBtn');

// Dashboard Elements
const userNameHeader = document.getElementById('userNameHeader');
const userEmailHeader = document.getElementById('userEmailHeader');
const profileAvatar = document.getElementById('profileAvatar');
const verificationBadge = document.getElementById('verificationBadge');
const verifyEmailBtn = document.getElementById('verifyEmailBtn');
const logoutBtn = document.getElementById('logoutBtn');

// Account Settings Form
const profileForm = document.getElementById('profileForm');
const profileNameInput = document.getElementById('profileName');
const profilePhoneInput = document.getElementById('profilePhone');
const profileAddressInput = document.getElementById('profileAddress');

// Order History
const ordersList = document.getElementById('ordersList');

// Wishlist
const wishlistGrid = document.getElementById('wishlistGrid');

// Avatar Modal
const avatarModalOverlay = document.getElementById('avatarModalOverlay');
const changeAvatarBtn = document.getElementById('changeAvatarBtn');
const avatarModalClose = document.getElementById('avatarModalClose');
const avatarPresets = document.querySelectorAll('.avatar-preset-img');
const customAvatarUrlInput = document.getElementById('customAvatarUrl');
const applyCustomAvatarBtn = document.getElementById('applyCustomAvatarBtn');

// ---- SESSION STATE ----
let currentUser = null;
let currentProfile = {};

// ---- NAV PROFILE PIC ----
function updateNavProfilePic(url) {
  const navPic = document.getElementById('navProfilePic');
  const navIcon = document.getElementById('navProfileIcon');
  if (!navPic) return;
  if (url) {
    navPic.src = url;
    navPic.classList.remove('hidden');
    if (navIcon) navIcon.style.display = 'none';
  } else {
    navPic.classList.add('hidden');
    if (navIcon) navIcon.style.display = '';
  }
}

// ---- TOAST FEEDBACK ----
const toast = document.getElementById('toast');
let toastTimer;
function showToast(msg) {
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ---- DYNAMIC AUTH TOGGLING ----
let isSignUpMode = false;
if (toggleAuthBtn) {
  toggleAuthBtn.addEventListener('click', () => {
    isSignUpMode = !isSignUpMode;
    if (isSignUpMode) {
      loginBox.classList.remove('active');
      setTimeout(() => {
        registerBox.classList.add('active');
      }, 250);
      toggleAuthBtn.textContent = 'SIGN IN HERE';
      visualToggleText.textContent = 'Already have an account?';
    } else {
      registerBox.classList.remove('active');
      setTimeout(() => {
        loginBox.classList.add('active');
      }, 250);
      toggleAuthBtn.textContent = 'SIGN UP NOW';
      visualToggleText.textContent = 'New to SuryaCotton?';
    }
  });
}

// Password view toggle
document.querySelectorAll('.password-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const input = document.getElementById(targetId);
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      btn.innerHTML = `<svg class="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    } else {
      input.type = 'password';
      btn.innerHTML = `<svg class="eye-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    }
  });
});

// ---- AUTH ACTIONS ----

// Login Form Submit
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';
    
    const email = loginEmailInput.value.trim();
    const password = loginPasswordInput.value.trim();
    
    if (!email || !password) {
      showFormError(loginError, 'Please enter your email and password.');
      return;
    }
    
    setLoadingState(loginSubmitBtn, true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showToast('✓ Successfully signed in!');
    } catch (err) {
      console.error(err);
      let errMsg = 'Failed to sign in. Please verify your credentials.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errMsg = 'Invalid email address or password.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'Please provide a valid email address.';
      }
      showFormError(loginError, errMsg);
    } finally {
      setLoadingState(loginSubmitBtn, false);
    }
  });
}

// Register Form Submit
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerError.style.display = 'none';
    
    const name = regNameInput.value.trim();
    const email = regEmailInput.value.trim();
    const password = regPasswordInput.value.trim();
    
    if (!name || !email || !password) {
      showFormError(registerError, 'Please complete all required fields.');
      return;
    }
    if (password.length < 6) {
      showFormError(registerError, 'Password must be at least 6 characters.');
      return;
    }
    
    setLoadingState(registerSubmitBtn, true);
    try {
      // 1. Create firebase user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // 2. Set default display name and seed avatar
      const defaultAvatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
      await updateProfile(user, {
        displayName: name,
        photoURL: defaultAvatar
      });
      
      // 3. Write User details to Firestore & fallback
      await saveUserData(user.uid, {
        name: name,
        email: email,
        phone: '',
        address: '',
        avatar: defaultAvatar,
        orders: []
      });
      
      showToast('✓ Welcome to SuryaCotton!');
    } catch (err) {
      console.error(err);
      let errMsg = 'Failed to create your account. Please try again.';
      if (err.code === 'auth/email-already-in-use') {
        errMsg = 'This email address is already in use.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'Please provide a valid email address.';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'Password is too weak. Make it stronger.';
      }
      showFormError(registerError, errMsg);
    } finally {
      setLoadingState(registerSubmitBtn, false);
    }
  });
}

// Google Sign-In / Sign-Up
const provider = new GoogleAuthProvider();
const setupGoogleLogin = (btnId, errorEl) => {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    errorEl.style.display = 'none';
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user has an existing record in Firestore, otherwise initialize
      const profile = await getUserProfile(user.uid);
      if (!profile) {
        await saveUserData(user.uid, {
          name: user.displayName || 'Google Member',
          email: user.email,
          phone: user.phoneNumber || '',
          address: '',
          avatar: user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName || 'SC')}`,
          orders: []
        });
      }
      showToast('✓ Successfully authenticated with Google!');
    } catch (err) {
      console.error(err);
      showFormError(errorEl, 'Google authentication failed or cancelled.');
    }
  });
};

setupGoogleLogin('googleLoginBtn', loginError);
setupGoogleLogin('googleRegisterBtn', registerError);

// Guest (Anonymous) Sign-In
const guestLoginBtn = document.getElementById('guestLoginBtn');
if (guestLoginBtn) {
  guestLoginBtn.addEventListener('click', async () => {
    if (loginError) loginError.style.display = 'none';
    try {
      const result = await signInAnonymously(auth);
      const user = result.user;
      
      // Set default guest profile
      const guestName = 'Guest';
      const guestAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=Guest${Date.now()}`;
      await updateProfile(user, {
        displayName: guestName,
        photoURL: guestAvatar
      });
      
      // Create profile in Firestore / local
      const existingProfile = await getUserProfile(user.uid);
      if (!existingProfile) {
        await saveUserData(user.uid, {
          name: guestName,
          email: '',
          phone: '',
          address: '',
          avatar: guestAvatar,
          orders: [],
          isGuest: true
        });
      }
      
      showToast('✓ Welcome, Guest! You can browse and shop.');
    } catch (err) {
      console.error(err);
      if (loginError) showFormError(loginError, 'Guest sign-in failed. Please try again.');
    }
  });
}

// Forgot Password Handler
const forgotPwdBtn = document.getElementById('forgotPwdBtn');
if (forgotPwdBtn) {
  forgotPwdBtn.addEventListener('click', async () => {
    const email = loginEmailInput.value.trim();
    if (!email) {
      showFormError(loginError, 'Please enter your email address to reset your password.');
      loginEmailInput.focus();
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      showToast('✉ Password reset link sent to your email!');
    } catch (err) {
      console.error(err);
      showFormError(loginError, 'Failed to send password reset. Verify the email address.');
    }
  });
}

// Verify Email Handler
if (verifyEmailBtn) {
  verifyEmailBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    try {
      await sendEmailVerification(currentUser);
      showToast('✉ Verification link sent! Check your inbox.');
      verifyEmailBtn.textContent = 'Sent!';
      verifyEmailBtn.disabled = true;
    } catch (err) {
      console.error(err);
      showToast('Failed to send verification link.');
    }
  });
}

// Log Out Handler
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await signOut(auth);
      showToast('Successfully signed out.');
    } catch (err) {
      console.error(err);
      showToast('Failed to sign out.');
    }
  });
}

// Helpers for UI feedback
function showFormError(element, message) {
  element.textContent = message;
  element.style.display = 'block';
}

function setLoadingState(btn, isLoading) {
  if (!btn) return;
  if (isLoading) {
    btn.classList.add('loading');
    btn.disabled = true;
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

// ---- DATABASE READ / WRITE OPERATIONS (FIRESTORE & FALLBACK) ----

async function getUserProfile(uid) {
  try {
    // Attempt Firestore load first
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data();
    }
  } catch (e) {
    console.warn("Firestore error reading profile, attempting local fallback:", e);
  }
  
  // Local storage fallback
  const localData = localStorage.getItem(`sc_profile_${uid}`);
  return localData ? JSON.parse(localData) : null;
}

async function saveUserData(uid, data) {
  // Always update locally
  localStorage.setItem(`sc_profile_${uid}`, JSON.stringify(data));
  
  try {
    // Attempt Firestore write
    const docRef = doc(db, "users", uid);
    await setDoc(docRef, data, { merge: true });
  } catch (e) {
    console.warn("Firestore error saving profile, saved in localStorage instead:", e);
  }
}

// ---- PROFILE SAVE FORM ----
function showSavePopup() {
  const overlay = document.getElementById('savePopupOverlay');
  if (!overlay) return;
  // Re-trigger checkmark animation by cloning the icon wrap
  const iconWrap = overlay.querySelector('.save-popup-icon-wrap');
  if (iconWrap) {
    const clone = iconWrap.cloneNode(true);
    iconWrap.parentNode.replaceChild(clone, iconWrap);
  }
  overlay.classList.add('show');
  clearTimeout(window._savePopupTimer);
  window._savePopupTimer = setTimeout(() => {
    overlay.classList.remove('show');
  }, 2800);
}

if (profileForm) {
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const saveBtn = document.getElementById('saveProfileBtn');
    const successBar = document.getElementById('saveSuccessBar');
    setLoadingState(saveBtn, true);
    if (successBar) successBar.classList.remove('show');

    const name = (profileNameInput ? profileNameInput.value.trim() : '');
    const phone = (profilePhoneInput ? profilePhoneInput.value.trim() : '');
    const address = (profileAddressInput ? profileAddressInput.value.trim() : '');

    // --- Always save to localStorage immediately ---
    const uid = currentUser ? currentUser.uid : (localStorage.getItem('sc_uid') || 'guest');
    const localKey = `sc_profile_${uid}`;
    const existingLocal = JSON.parse(localStorage.getItem(localKey) || '{}');
    const mergedData = { ...existingLocal, name, phone, address };
    localStorage.setItem(localKey, JSON.stringify(mergedData));

    // Update greeting in header
    if (userNameHeader) userNameHeader.textContent = name || userNameHeader.textContent;

    // Show the popup RIGHT AWAY — no async blocking
    showSavePopup();

    // Show success bar
    if (successBar) {
      successBar.classList.remove('show');
      successBar.style.display = 'none';
      void successBar.offsetWidth;
      successBar.style.display = '';
      successBar.classList.add('show');
      clearTimeout(window._saveBarTimer);
      window._saveBarTimer = setTimeout(() => successBar.classList.remove('show'), 4500);
    }

    setLoadingState(saveBtn, false);

    // --- Async: Firebase sync in background (non-blocking) ---
    if (currentUser) {
      try {
        await updateProfile(currentUser, { displayName: name });
        const firestoreData = await getUserProfile(currentUser.uid) || {};
        await saveUserData(currentUser.uid, { ...firestoreData, name, phone, address });
      } catch (err) {
        console.warn('Firebase sync failed (saved locally):', err);
      }
    }
  });
}

// Close popup on button click
const savePopupCloseBtn = document.getElementById('savePopupCloseBtn');
if (savePopupCloseBtn) {
  savePopupCloseBtn.addEventListener('click', () => {
    const overlay = document.getElementById('savePopupOverlay');
    if (overlay) overlay.classList.remove('show');
  });
}
// Close if clicking outside the box
const savePopupOverlay = document.getElementById('savePopupOverlay');
if (savePopupOverlay) {
  savePopupOverlay.addEventListener('click', (e) => {
    if (e.target === savePopupOverlay) savePopupOverlay.classList.remove('show');
  });
}

// ---- AUTH OBSERVER ----
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    localStorage.setItem('sc_isLoggedIn', 'true');
    localStorage.setItem('sc_uid', user.uid);
    
    const isAnonymous = user.isAnonymous;
    
    // Switch Views
    authWrapper.classList.add('hidden');
    dashboardWrapper.classList.remove('hidden');
    
    // Header Display metadata
    userNameHeader.textContent = user.displayName || (isAnonymous ? 'Guest' : 'Gentleman');
    userEmailHeader.textContent = isAnonymous ? 'Guest Account — No email linked' : (user.email || '');
    const avatarUrl = user.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.displayName || 'SC')}`;
    profileAvatar.src = avatarUrl;
    updateNavProfilePic(avatarUrl);
    
    // Email verification state — hide for anonymous users
    if (isAnonymous) {
      verificationBadge.textContent = 'Guest';
      verificationBadge.className = 'badge verification-badge';
      verificationBadge.style.background = '#334155';
      verificationBadge.style.color = '#fff';
      verifyEmailBtn.classList.add('hidden');
    } else if (user.emailVerified) {
      verificationBadge.textContent = 'Verified';
      verificationBadge.className = 'badge verification-badge verified';
      verificationBadge.style.background = '';
      verificationBadge.style.color = '';
      verifyEmailBtn.classList.add('hidden');
    } else {
      verificationBadge.textContent = 'Unverified';
      verificationBadge.className = 'badge verification-badge';
      verificationBadge.style.background = '';
      verificationBadge.style.color = '';
      verifyEmailBtn.classList.remove('hidden');
      verifyEmailBtn.textContent = 'Verify Email';
      verifyEmailBtn.disabled = false;
    }
    
    // Form placeholders pre-fills
    profileNameInput.value = user.displayName || '';
    
    // Retrieve Extended details from Firestore / fallback
    const profile = await getUserProfile(user.uid);
    if (profile) {
      currentProfile = profile;
      profilePhoneInput.value = profile.phone || '';
      profileAddressInput.value = profile.address || '';
      if (profile.avatar) {
        profileAvatar.src = profile.avatar;
        updateNavProfilePic(profile.avatar);
      }
      
      // Load orders from profile data
      renderOrders(profile.orders || []);
      
      // Background Shiprocket status sync for user's orders
      syncUserOrderStatuses(profile.orders || []);
    } else {
      // Local fallback checking if profile was stored under local sc_profile
      const fallback = localStorage.getItem(`sc_profile_${user.uid}`);
      if (fallback) {
        const parsed = JSON.parse(fallback);
        profilePhoneInput.value = parsed.phone || '';
        profileAddressInput.value = parsed.address || '';
        if (parsed.avatar) {
          profileAvatar.src = parsed.avatar;
          updateNavProfilePic(parsed.avatar);
        }
        renderOrders(parsed.orders || []);
        syncUserOrderStatuses(parsed.orders || []);
      } else {
        renderOrders([]);
      }
    }
    
    // Build Wishlist Items
    renderWishlist();
    
  } else {
    currentUser = null;
    currentProfile = {};
    localStorage.removeItem('sc_isLoggedIn');
    updateNavProfilePic(null);
    
    // Reset inputs (only if forms exist)
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
    
    // Switch Views
    dashboardWrapper.classList.add('hidden');
    authWrapper.classList.remove('hidden');
  }
});

// ---- ORDER HISTORY RENDER with TRACKING STEPPER ----
const STEPS = [
  { key: 'ordered',   label: 'Ordered',   icon: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><polyline points="16 3 12 7 8 3"/></svg>' },
  { key: 'pending',   label: 'Pending',   icon: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' },
  { key: 'shipping',  label: 'Shipping',  icon: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h5l2 5v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>' },
  { key: 'delivered', label: 'Delivered', icon: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>' }
];

function getStepIndex(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('cancel')) return -1; // Special: cancelled
  if (s.includes('deliver')) return 3;
  if (s.includes('ship') || s.includes('transit')) return 2;
  if (s.includes('pend') || s.includes('process') || s.includes('confirm')) return 1;
  return 0; // ordered/placed
}

function renderTracker(status) {
  const active = getStepIndex(status);
  
  // Cancelled orders get a distinct red badge instead of the stepper
  if (active === -1) {
    return `
      <div class="order-tracker" style="padding: 1rem 0;">
        <div style="display:flex; align-items:center; justify-content:center; gap:10px; background:#fee2e2; padding:0.8rem 1.2rem; border-radius:12px; border:1.5px solid #fecaca;">
          <svg viewBox="0 0 24 24" fill="none" stroke="#b91c1c" stroke-width="2.5" width="22" height="22"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <span style="color:#b91c1c; font-weight:800; font-size:0.95rem; letter-spacing:0.5px;">Cancelled</span>
        </div>
      </div>
    `;
  }
  
  const stepsHTML = STEPS.map((step, i) => {
    let cls = 'tracker-step';
    if (i < active) cls += ' completed';
    else if (i === active) cls += ' active';
    return `
      <div class="${cls}">
        <div class="step-dot">${step.icon}</div>
        <span class="step-label">${step.label}</span>
      </div>`;
  }).join('');
  return `<div class="order-tracker"><div class="tracker-steps">${stepsHTML}</div></div>`;
}

function renderOrders(orders) {
  if (!ordersList) return;
  
  if (!orders || orders.length === 0) {
    ordersList.innerHTML = `
      <div class="orders-empty">
        <div class="empty-icon">🛍️</div>
        <h4>No Orders Yet</h4>
        <p>Explore our premium collections and place your first order!</p>
        <a href="category.html?cat=all" class="btn-start-shopping">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          START SHOPPING
        </a>
      </div>
    `;
    return;
  }
  
  // Get user's existing reviews
  const uid = currentUser ? currentUser.uid : (localStorage.getItem('sc_uid') || 'guest');
  const allReviews = JSON.parse(localStorage.getItem('sc_all_reviews') || '[]');
  const userReviewedProductIds = allReviews
    .filter(r => r.uid === uid)
    .map(r => r.productId);
  
  // Merge status from global sc_all_orders to reflect admin changes AND Shiprocket status
  const allGlobalOrders = JSON.parse(localStorage.getItem('sc_all_orders') || '[]');
  const syncedOrders = orders.map(order => {
    const globalMatch = allGlobalOrders.find(go => go.id === order.id);
    if (globalMatch) {
      const merged = { ...order };
      if (globalMatch.status) merged.status = globalMatch.status;
      // Sync shipment_status from global orders (reflects Supabase/Shiprocket state)
      if (globalMatch.shipment_status) merged.shipment_status = globalMatch.shipment_status;
      if (globalMatch.awb_code) merged.awb_code = globalMatch.awb_code;
      if (globalMatch.courier_name) merged.courier_name = globalMatch.courier_name;
      return merged;
    }
    return order;
  });

  // Sort orders by date descending
  const sortedOrders = [...syncedOrders].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  ordersList.innerHTML = sortedOrders.map(order => {
    // Determine effective display status — shipment_status takes priority for cancelled
    const shipStatus = (order.shipment_status || '').toUpperCase();
    const isCancelled = shipStatus === 'CANCELLED';
    const displayStatus = isCancelled ? 'Cancelled' : (order.status || 'Processing');
    const isDelivered = !isCancelled && getStepIndex(displayStatus) === 3;
    
    const itemsHTML = (order.items || []).map(item => {
      let productId = item.id || item.productId;
      if (!productId && typeof products !== 'undefined') {
        const found = products.find(p => p.name === item.name);
        if (found) productId = found.id;
      }
      const hasReviewed = userReviewedProductIds.includes(productId);
      
      let reviewBtnHTML = '';
      if (isDelivered) {
        if (hasReviewed) {
          reviewBtnHTML = `
            <button class="order-review-btn reviewed" disabled>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              Reviewed
            </button>`;
        } else {
          reviewBtnHTML = `
            <button class="order-review-btn" data-id="${productId || ''}" data-name="${encodeURIComponent(item.name || '')}" data-img="${encodeURIComponent(item.img || 'product_shirt.png')}" onclick="window.openReviewModalFromBtn(this)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              Write Review
            </button>`;
        }
      }
      
      return `
        <div class="order-product-row">
          <img src="${item.img || 'product_shirt.png'}" class="order-product-img" alt="${item.name}">
          <div class="order-product-info">
            <p class="order-product-name">${item.name}</p>
            <p class="order-product-qty">Qty: ${item.qty} • ₹${item.price.toLocaleString()}</p>
            ${reviewBtnHTML}
          </div>
        </div>`;
    }).join('');
    
    const formattedDate = new Date(order.date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    
    const awbHTML = order.awb_code ? `
      <div style="margin-top: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
        <span style="background: #e0f2fe; color: #0369a1; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.78rem; font-weight: 700;">AWB: ${order.awb_code}</span>
        <span style="font-size: 0.78rem; color: #475569; font-weight: 500;">Courier: ${order.courier_name || 'Shiprocket Partner'}</span>
      </div>
    ` : `
      <div style="margin-top: 6px; display: flex; align-items: center; gap: 8px;">
        <span style="background: #f1f5f9; color: #64748b; padding: 0.2rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600;">AWB: Pending Courier Assignment</span>
      </div>
    `;

    // Status badge styling — red for cancelled
    const statusBadgeStyle = isCancelled
      ? 'background:#fee2e2; color:#b91c1c; border:1px solid #fecaca;'
      : '';

    return `
      <div class="order-card">
        <div class="order-header">
          <div class="order-meta-info">
            <span class="order-id">Order ID: #${order.id}</span>
            <span class="order-date">Placed on ${formattedDate}</span>
            ${awbHTML}
            <span style="font-size: 0.72rem; color: #64748b; margin-top: 4px; display: block;">* You can write a review here once the product is delivered.</span>
          </div>
          <span class="order-status-badge" ${statusBadgeStyle ? `style="${statusBadgeStyle}"` : ''}>${displayStatus}</span>
        </div>
        ${renderTracker(isCancelled ? 'cancelled' : displayStatus)}
        <div class="order-items-grid">
          ${itemsHTML}
        </div>
        <div class="order-total-price">
          Total Amount: ₹${order.total.toLocaleString()}
        </div>
        <div style="text-align: right; margin-top: 15px; display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap;">
          ${!isCancelled ? `<button onclick="window.trackShipmentLive('${order.awb_code || order.id}')" style="background: #e8000d; color: #fff; border: none; border-radius: 8px; font-size: 0.8rem; font-weight: 700; padding: 0.7rem 1.4rem; cursor: pointer; letter-spacing: 1px;">TRACK LIVE 🚚</button>` : ''}
          <button onclick="window.location.href='category.html?cat=all'" style="background: #0a0a0a; color: #fff; border: none; border-radius: 8px; font-size: 0.8rem; font-weight: 600; padding: 0.7rem 1.4rem; cursor: pointer; letter-spacing: 1px;">CONTINUE SHOPPING</button>
        </div>
      </div>
    `;
  }).join('');
}

// ─── Background Shiprocket Status Sync for User Orders ───
// Non-blocking: checks Shiprocket status for user's recent orders on profile load
async function syncUserOrderStatuses(userOrders) {
  if (!userOrders || userOrders.length === 0) return;

  const BACKEND_URL = (typeof window !== 'undefined' && window.BACKEND_URL)
    ? window.BACKEND_URL.replace(/\/$/, '')
    : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : 'https://backend-s6kq.onrender.com');

  // Only sync orders that have Shiprocket data and are not in terminal states
  const ordersToSync = userOrders
    .filter(o => (o.awb_code || o.shiprocket_order_id) &&
                 !(o.shipment_status || '').toUpperCase().match(/^(DELIVERED|CANCELLED)$/))
    .slice(0, 5); // Max 5 to avoid excessive API calls

  if (ordersToSync.length === 0) return;

  let hasChanges = false;
  const allGlobalOrders = JSON.parse(localStorage.getItem('sc_all_orders') || '[]');

  for (const order of ordersToSync) {
    const trackId = order.awb_code || order.id;
    try {
      const res = await fetch(`${BACKEND_URL}/api/shiprocket/track?id=${encodeURIComponent(trackId)}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.success) continue;

      // The tracking endpoint auto-syncs status to Supabase as a side-effect.
      // Also update local state if the status has changed.
      const liveStatus = (data.shipment_status || data.current_status || '').toUpperCase();
      const localStatus = (order.shipment_status || '').toUpperCase();

      if (liveStatus && liveStatus !== localStatus) {
        console.log(`[SHIPROCKET FALLBACK] User order ${order.id}: status changed ${localStatus || 'UNKNOWN'} → ${liveStatus}`);
        // Update in global orders for local persistence
        const globalIdx = allGlobalOrders.findIndex(go => String(go.id) === String(order.id));
        if (globalIdx > -1) {
          allGlobalOrders[globalIdx].shipment_status = liveStatus;
        }
        hasChanges = true;
      }
    } catch (e) {
      // Non-critical: silently continue
    }
  }

  if (hasChanges) {
    localStorage.setItem('sc_all_orders', JSON.stringify(allGlobalOrders));
    // Re-render orders with updated data
    renderOrders(userOrders);
    console.log('[SHIPROCKET FALLBACK] User profile orders re-rendered with updated statuses.');
  }
}

// ─── LIVE SHIPROCKET TRACKING SEARCH LOGIC ───────────────
window.trackShipmentLive = async function(trackId) {
  const resultBox = document.getElementById('liveTrackResult');
  const searchInput = document.getElementById('trackSearchInput');

  if (!trackId && searchInput) {
    trackId = searchInput.value.trim();
  }

  if (!trackId) {
    alert('Please enter an Order ID or AWB Tracking Number.');
    return;
  }

  if (!resultBox) {
    window.location.href = `track.html?id=${encodeURIComponent(trackId)}`;
    return;
  }

  if (searchInput) searchInput.value = trackId;

  resultBox.style.display = 'block';
  resultBox.innerHTML = `
    <div style="text-align: center; padding: 2rem 0;">
      <div class="rzp-spinner" style="margin: 0 auto 1rem;"></div>
      <h4 style="font-weight: 700; color: #0a0a0a;">Fetching Live Tracking Details...</h4>
      <p style="font-size: 0.88rem; color: #64748b;">Contacting Shiprocket Logistics servers</p>
    </div>
  `;
  resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const BACKEND_URL = (typeof window !== 'undefined' && window.BACKEND_URL)
      ? window.BACKEND_URL.replace(/\/$/, '')
      : (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
          ? 'http://localhost:3000' 
          : 'https://backend-s6kq.onrender.com');
    let trackEndpoint = `${BACKEND_URL}/api/shiprocket/track?id=${encodeURIComponent(trackId)}`;
    if (!BACKEND_URL && window.location.hostname.includes('netlify')) {
      trackEndpoint = `/.netlify/functions/shiprocket-track?id=${encodeURIComponent(trackId)}`;
    }

    const res = await fetch(trackEndpoint);
    const data = await res.json();

    if (resultBox) {
      if (data.success) {
        const scansHTML = (data.scans && data.scans.length > 0) ? data.scans.map(s => `
          <div style="display: flex; gap: 1rem; padding: 0.75rem 0; border-bottom: 1px dashed #e2e8f0; font-size: 0.88rem;">
            <div style="font-weight: 700; color: #e8000d; min-width: 120px;">${s.date || 'Scan'}</div>
            <div style="flex: 1; color: #334155; font-weight: 500;">${s.activity} ${s.location ? '<span style="color: #64748b;">(' + s.location + ')</span>' : ''}</div>
          </div>
        `).join('') : `
          <div style="padding: 1rem 0; color: #64748b; font-size: 0.88rem; font-style: italic;">
            Order registered in Shiprocket. Tracking scans will update once package is picked up by courier.
          </div>
        `;

        const officialTrackBtn = data.awb_code ? `
          <a href="https://shiprocket.co/tracking/${data.awb_code}" target="_blank" rel="noopener" style="background: #0a0a0a; color: #fff; padding: 0.75rem 1.4rem; border-radius: 10px; text-decoration: none; font-size: 0.82rem; font-weight: 700; letter-spacing: 1px; display: inline-flex; align-items: center; gap: 6px;">
            OFFICIAL SHIPROCKET TRACKING ↗
          </a>
        ` : `
          <span style="background: #f1f5f9; color: #64748b; padding: 0.6rem 1rem; border-radius: 8px; font-size: 0.8rem; font-weight: 600;">AWB Pending</span>
        `;

        resultBox.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
            <div>
              <span style="font-size: 0.75rem; font-weight: 800; color: #e8000d; text-transform: uppercase; letter-spacing: 1px;">Shiprocket Logistics Status</span>
              <h3 style="font-family: 'Playfair Display', serif; font-size: 1.5rem; font-weight: 700; margin: 0.2rem 0;">Status: ${data.current_status || 'ORDER_CREATED'}</h3>
              <p style="font-size: 0.88rem; color: #475569; margin: 0;">Courier Partner: <strong>${data.courier_name || 'Pending Assignment'}</strong> • AWB: <strong>${data.awb_code || 'AWB PENDING'}</strong></p>
            </div>
            ${officialTrackBtn}
          </div>

          <div style="background: #f8fafc; padding: 1.2rem; border-radius: 12px; margin-bottom: 1.5rem; display: flex; justify-content: space-around; flex-wrap: wrap; gap: 1rem; text-align: center;">
            <div>
              <span style="font-size: 0.75rem; color: #64748b; display: block; text-transform: uppercase; font-weight: 700;">Origin</span>
              <strong style="font-size: 0.95rem; color: #0a0a0a;">${data.origin || 'SuryaCottans Hub'}</strong>
            </div>
            <div>
              <span style="font-size: 0.75rem; color: #64748b; display: block; text-transform: uppercase; font-weight: 700;">Estimated Delivery</span>
              <strong style="font-size: 0.95rem; color: #16a34a;">${data.etd || '3-5 Business Days'}</strong>
            </div>
          </div>

          <h5 style="font-size: 0.95rem; font-weight: 700; color: #0a0a0a; margin-bottom: 0.8rem;">Shipment Scan Activity</h5>
          <div style="max-height: 250px; overflow-y: auto; background: #fff; padding: 0.5rem 1rem; border-radius: 10px; border: 1px solid #f1f5f9;">
            ${scansHTML}
          </div>
        `;
      } else {
        resultBox.innerHTML = `
          <div style="text-align: center; padding: 1.5rem 0; color: #e8000d;">
            <h4 style="font-weight: 700; margin-bottom: 0.4rem;">Order Tracking Info</h4>
            <p style="font-size: 0.9rem; color: #64748b;">${data.error || 'Tracking details will appear as soon as courier partner picks up package.'}</p>
          </div>
        `;
      }
    }
  } catch (err) {
    if (resultBox) {
      resultBox.innerHTML = `
        <div style="text-align: center; padding: 1.5rem 0;">
          <h4 style="font-weight: 700; color: #0a0a0a;">Order Received & Processing</h4>
          <p style="font-size: 0.9rem; color: #64748b; margin-top: 0.3rem;">Order ID #${trackId} is registered. Shipment tracking updates will populate once dispatched.</p>
        </div>
      `;
    }
  }
};

// Bind Track Search Button & Auto-track on URL param
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('trackSearchBtn');
  const input = document.getElementById('trackSearchInput');

  if (btn) {
    btn.addEventListener('click', () => window.trackShipmentLive());
  }
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') window.trackShipmentLive();
    });
  }

  // Auto trigger tracking if URL parameter 'id', 'awb', or 'order_id' is present
  const urlParams = new URLSearchParams(window.location.search);
  const trackIdFromUrl = urlParams.get('id') || urlParams.get('awb') || urlParams.get('order_id');
  if (trackIdFromUrl && document.getElementById('liveTrackResult')) {
    window.trackShipmentLive(trackIdFromUrl);
  }
});

// ---- WISHLIST RENDER ----
function renderWishlist() {
  if (typeof window !== 'undefined') {
    window.renderWishlist = renderWishlist;
    window.renderProducts = renderWishlist;
    const latestProducts = JSON.parse(localStorage.getItem('sc_products') || '[]');
    if (latestProducts && latestProducts.length > 0) {
      products = latestProducts;
    }
  }
  if (!wishlistGrid) return;
  
  const wishIds = JSON.parse(localStorage.getItem('sc_wish') || '[]');
  if (wishIds.length === 0) {
    document.getElementById('wishlistPanel').style.display = 'none';
    return;
  }
  
  document.getElementById('wishlistPanel').style.display = 'block';
  
  const wishItems = products.filter(p => wishIds.includes(p.id));
  
  wishlistGrid.innerHTML = wishItems.map(p => `
    <div class="wishlist-item-card" onclick="window.location.href='product.html?id=${p.id}'">
      <div class="wishlist-img-wrap">
        <img src="${p.img}" alt="${p.name}">
        <button class="wishlist-remove-btn" onclick="event.stopPropagation(); removeFromWishlist(${p.id})">✕</button>
      </div>
      <div class="wishlist-item-info">
        <h4 class="wishlist-item-name">${p.name}</h4>
        <p class="wishlist-item-price">₹${p.price.toLocaleString()}</p>
        <button class="wishlist-buy-btn" onclick="event.stopPropagation(); addWishToCart(${p.id})">
          Add to Cart
        </button>
      </div>
    </div>
  `).join('');
}

window.removeFromWishlist = function(id) {
  let wishIds = JSON.parse(localStorage.getItem('sc_wish') || '[]');
  wishIds = wishIds.filter(i => i !== id);
  localStorage.setItem('sc_wish', JSON.stringify(wishIds));
  renderWishlist();
  showToast('Removed from wishlist');
};

window.addWishToCart = function(id) {
  const p = products.find(prod => String(prod.id) === String(id) || Number(prod.id) === Number(id));
  if (!p) return;
  
  let cart = JSON.parse(localStorage.getItem('sc_cart') || '[]');
  const existing = cart.find(i => String(i.id) === String(id) || Number(i.id) === Number(id));
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...p, qty: 1 });
  }
  localStorage.setItem('sc_cart', JSON.stringify(cart));
  
  // Trigger navbar UI updates
  if (typeof updateCartUI === 'function') updateCartUI();
  openCart();
  showToast(`✓ Added "${p.name}" to cart!`);
};

// ---- AVATAR PICKER LOGIC ----

// Tab switching
document.querySelectorAll('.avatar-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.avatar-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.avatar-tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    const target = tab.dataset.tab === 'presets' ? 'tabPresets' : 'tabCustom';
    document.getElementById(target)?.classList.add('active');
  });
});

// Open modal
if (changeAvatarBtn) {
  changeAvatarBtn.addEventListener('click', () => {
    avatarModalOverlay.classList.add('show');
  });
}

// Close modal
const closeModal = () => {
  avatarModalOverlay.classList.remove('show');
};

if (avatarModalClose) avatarModalClose.addEventListener('click', closeModal);
if (avatarModalOverlay) {
  avatarModalOverlay.addEventListener('click', (e) => {
    if (e.target === avatarModalOverlay) closeModal();
  });
}

// Select preset (now uses data-url)
document.querySelectorAll('.avatar-preset-img').forEach(preset => {
  preset.addEventListener('click', async () => {
    const avatarUrl = preset.dataset.url;
    if (!avatarUrl) return;
    // Highlight
    document.querySelectorAll('.avatar-preset-img').forEach(p => p.classList.remove('selected'));
    preset.classList.add('selected');
    await updateAvatar(avatarUrl);
    setTimeout(closeModal, 400);
  });
});

// Custom URL Apply
if (applyCustomAvatarBtn) {
  applyCustomAvatarBtn.addEventListener('click', async () => {
    const url = customAvatarUrlInput.value.trim();
    if (!url) {
      showToast('Please enter a valid image URL');
      return;
    }
    
    await updateAvatar(url);
    customAvatarUrlInput.value = '';
    closeModal();
  });
}

async function updateAvatar(url) {
  // 1. Immediately update UI for instant feedback
  if (profileAvatar) profileAvatar.src = url;
  updateNavProfilePic(url);
  
  if (!currentUser) {
    localStorage.setItem('sc_guest_avatar', url);
    showToast('✓ Avatar updated locally!');
    return;
  }
  
  try {
    // 2. Update Auth profile photo in background
    await updateProfile(currentUser, { photoURL: url });
    
    // 3. Save in database
    const profile = await getUserProfile(currentUser.uid) || {};
    profile.avatar = url;
    await saveUserData(currentUser.uid, profile);
    
    showToast('✓ Profile avatar updated successfully!');
  } catch (err) {
    console.warn("Backend update failed, but UI is updated locally.", err);
    showToast('✓ Avatar updated locally (Backend save failed).');
    
    // Save to local storage as fallback so it persists on reload
    const fallbackData = JSON.parse(localStorage.getItem(`sc_profile_${currentUser.uid}`)) || {};
    fallbackData.avatar = url;
    localStorage.setItem(`sc_profile_${currentUser.uid}`, JSON.stringify(fallbackData));
  }
}

// =============================================
// ---- CART & MENU COMMON DRAWER HANDLERS (VANILLA COPIED AND ADJUSTED) ----
// =============================================
let cart = JSON.parse(localStorage.getItem('sc_cart') || '[]');
if (!Array.isArray(cart)) cart = [];

function saveCart() { localStorage.setItem('sc_cart', JSON.stringify(cart)); }

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
      <img class="cart-item-img" src="${item.img}" alt="${item.name}" style="width: 50px; height: 65px; object-fit: cover; border-radius: 8px;" />
      <div class="cart-item-info" style="flex: 1; margin-left: 1rem;">
        <p class="cart-item-name" style="font-weight: 700; font-size: 0.85rem;">${item.name}</p>
        <p class="cart-item-price" style="color: var(--red); font-weight: 700; font-size: 0.9rem;">₹${item.price.toLocaleString()}</p>
        <div class="cart-item-qty" style="display: flex; align-items: center; gap: 8px; margin-top: 5px;">
          <button class="qty-btn" onclick="changeQty(${item.id},-1)" style="width: 24px; height: 24px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; border-radius: 4px;">−</button>
          <span class="qty-num">${item.qty}</span>
          <button class="qty-btn" onclick="changeQty(${item.id},+1)" style="width: 24px; height: 24px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; border-radius: 4px;">+</button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart(${item.id})" style="color: #cbd5e1; font-size: 0.9rem;">✕</button>
    </div>`).join('');
}

window.changeQty = function(id, delta) {
  const item = cart.find(i => String(i.id) === String(id) || Number(i.id) === Number(id));
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(i => String(i.id) !== String(id) && Number(i.id) !== Number(id));
  }
  saveCart(); updateCartUI(); renderCartItems();
};

window.removeFromCart = function(id) {
  cart = cart.filter(i => String(i.id) !== String(id) && Number(i.id) !== Number(id));
  saveCart(); updateCartUI(); renderCartItems();
};

// Toggle Drawers
const cartOverlay = document.getElementById('cartOverlay');
const cartDrawer  = document.getElementById('cartDrawer');
const cartBtn     = document.getElementById('cartBtn');
const cartClose   = document.getElementById('cartClose');
const checkoutBtn = document.getElementById('checkoutBtn');
const hamburger   = document.getElementById('hamburger');
const navLinks    = document.getElementById('navLinks');

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
      const p = typeof products !== 'undefined' ? products.find(x => String(x.id) === String(item.id) || Number(x.id) === Number(item.id)) : null;
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
      // Already on profile.html, so just close cart and scroll to top
      closeCart();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    window.location.href = 'checkout.html';
  });
}

if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
  });
}

// Initial Call
updateCartUI();

// Address Autocomplete Logic
function setupAddressAutocomplete(inputId, suggestionsId) {
  const input = document.getElementById(inputId);
  const suggestionsBox = document.getElementById(suggestionsId);
  if (!input || !suggestionsBox) return;

  let debounceTimer;

  const fetchSuggestions = async (searchQuery, droppedPrefix = '') => {
    if(!searchQuery || searchQuery.trim().length < 3) return [];
    try {
      const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(searchQuery)}&limit=5&bbox=68.1,6.7,97.4,35.5`);
      const data = await res.json();
      if(data.features && data.features.length > 0) {
        return data.features.map(f => ({...f, droppedPrefix}));
      }
      
      let parts = searchQuery.split(',');
      if(parts.length > 1) {
        const dropped = parts.shift();
        return await fetchSuggestions(parts.join(',').trim(), droppedPrefix + dropped + ', ');
      } else {
        parts = searchQuery.split(' ');
        if(parts.length > 1) {
          const dropped = parts.shift();
          return await fetchSuggestions(parts.join(' ').trim(), droppedPrefix + dropped + ' ');
        }
      }
    } catch (e) {
      console.error("Fetch error", e);
    }
    return [];
  };

  input.addEventListener('input', function() {
    clearTimeout(debounceTimer);
    const originalQuery = this.value;
    if (originalQuery.length < 3) {
      suggestionsBox.classList.remove('active');
      return;
    }
    
    debounceTimer = setTimeout(async () => {
      const features = await fetchSuggestions(originalQuery);
      
      if (features && features.length > 0) {
        suggestionsBox.innerHTML = '';
        features.forEach(feature => {
          const props = feature.properties;
          let addrParts = [];
          if (props.street) addrParts.push(props.street);
          if (props.district || props.county) addrParts.push(props.district || props.county);
          if (props.city || props.town || props.village) addrParts.push(props.city || props.town || props.village);
          if (props.state) addrParts.push(props.state);
          if (props.postcode) addrParts.push(props.postcode);
          
          addrParts = [...new Set(addrParts)];
          const addrString = addrParts.join(', ');
          const mainName = props.name || props.street || props.city || 'Location';
          
          const div = document.createElement('div');
          div.className = 'suggestion-item';
          div.innerHTML = `
            <div class="sugg-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            </div>
            <div class="sugg-content">
              <div class="sugg-title">${mainName}</div>
              <div class="sugg-desc">${addrString}</div>
            </div>
          `;
          div.addEventListener('click', () => {
            input.value = feature.droppedPrefix + mainName + (addrString ? ', ' + addrString : '');
            suggestionsBox.classList.remove('active');
          });
          suggestionsBox.appendChild(div);
        });
        suggestionsBox.classList.add('active');
      } else {
        suggestionsBox.classList.remove('active');
      }
    }, 400);
  });

  document.addEventListener('click', function(e) {
    if (e.target !== input && !suggestionsBox.contains(e.target)) {
      suggestionsBox.classList.remove('active');
    }
  });
}

setupAddressAutocomplete('profileAddress', 'profileAddressSuggestions');

// =============================================
// ---- REVIEW MODAL LOGIC ----
// =============================================

const reviewModalOverlay = document.getElementById('reviewModalOverlay');
const reviewModalClose = document.getElementById('reviewModalClose');
const reviewModalCancelBtn = document.getElementById('reviewModalCancelBtn');
const reviewModalSubmitBtn = document.getElementById('reviewModalSubmitBtn');
const reviewStarsRow = document.getElementById('reviewStarsRow');
const reviewStarsLabel = document.getElementById('reviewStarsLabel');
const reviewRatingVal = document.getElementById('reviewRatingVal');
const reviewText = document.getElementById('reviewText');
const reviewProductId = document.getElementById('reviewProductId');
const reviewModalImg = document.getElementById('reviewModalImg');
const reviewModalName = document.getElementById('reviewModalName');
const reviewSuccessState = document.getElementById('reviewSuccessState');
const reviewModalProduct = document.getElementById('reviewModalProduct');
const reviewModalActions = document.querySelector('.review-modal-actions');
const reviewModalSections = document.querySelectorAll('.review-modal-section');
const reviewModalDivider = document.querySelector('.review-modal-divider');

const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

let selectedReviewFile = null;

// Attach photo upload events dynamically
function setupReviewImageEvents() {
  const uploadBox = document.getElementById('reviewPhotoUploadBox');
  const fileInput = document.getElementById('reviewImageInput');
  const previewWrap = document.getElementById('reviewImagePreviewWrap');
  const previewImg = document.getElementById('reviewImagePreview');
  const removeBtn = document.getElementById('removeReviewImageBtn');

  if (uploadBox && fileInput) {
    uploadBox.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      selectedReviewFile = file;
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (previewImg) previewImg.src = evt.target.result;
        if (previewWrap) previewWrap.style.display = 'block';
        if (uploadBox) uploadBox.style.display = 'none';
      };
      reader.readAsDataURL(file);
    };
  }

  if (removeBtn) {
    removeBtn.onclick = () => {
      selectedReviewFile = null;
      if (fileInput) fileInput.value = '';
      if (previewWrap) previewWrap.style.display = 'none';
      if (uploadBox) uploadBox.style.display = 'block';
    };
  }
}
setTimeout(setupReviewImageEvents, 100);


window.openReviewModalFromBtn = function(btn) {
  const id = btn.getAttribute('data-id');
  const name = decodeURIComponent(btn.getAttribute('data-name') || '');
  const img = decodeURIComponent(btn.getAttribute('data-img') || 'product_shirt.png');
  window.openReviewModal(id, name, img);
};

// Open review modal
window.openReviewModal = function(productId, productName, productImg) {
  const overlay = document.getElementById('reviewModalOverlay');
  if (!overlay) return;
  
  const rId = document.getElementById('reviewProductId');
  const rImg = document.getElementById('reviewModalImg');
  const rName = document.getElementById('reviewModalName');
  const rText = document.getElementById('reviewText');
  const rRatingVal = document.getElementById('reviewRatingVal');
  const rStarsLabel = document.getElementById('reviewStarsLabel');
  const rStarsRow = document.getElementById('reviewStarsRow');
  const rSuccess = document.getElementById('reviewSuccessState');
  const rProduct = document.getElementById('reviewModalProduct');
  const rDivider = document.querySelector('.review-modal-divider');
  const rSections = document.querySelectorAll('.review-modal-section');
  const rActions = document.querySelector('.review-modal-actions');

  // Reset state
  if (rId) rId.value = productId || '';
  if (rImg) rImg.src = productImg || 'product_shirt.png';
  if (rName) rName.textContent = productName || 'Product';
  if (rText) rText.value = '';
  if (rRatingVal) rRatingVal.value = 5;
  if (rStarsLabel) rStarsLabel.textContent = STAR_LABELS[5];

  selectedReviewFile = null;
  const uploadBox = document.getElementById('reviewPhotoUploadBox');
  const previewWrap = document.getElementById('reviewImagePreviewWrap');
  const fileInput = document.getElementById('reviewImageInput');
  if (fileInput) fileInput.value = '';
  if (previewWrap) previewWrap.style.display = 'none';
  if (uploadBox) uploadBox.style.display = 'block';
  
  // Reset stars to all active
  if (rStarsRow) {
    rStarsRow.querySelectorAll('.review-star').forEach(s => s.classList.add('active'));
  }
  
  // Show form, hide success
  if (rSuccess) rSuccess.classList.remove('show');
  if (rProduct) rProduct.style.display = '';
  if (rDivider) rDivider.style.display = '';
  if (rSections) rSections.forEach(s => s.style.display = '');
  if (rActions) rActions.style.display = '';
  
  // Open overlay
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
};

// Close review modal
function closeReviewModal() {
  if (!reviewModalOverlay) return;
  reviewModalOverlay.classList.remove('show');
  document.body.style.overflow = '';
}

if (reviewModalClose) reviewModalClose.addEventListener('click', closeReviewModal);
if (reviewModalCancelBtn) reviewModalCancelBtn.addEventListener('click', closeReviewModal);
if (reviewModalOverlay) {
  reviewModalOverlay.addEventListener('click', (e) => {
    if (e.target === reviewModalOverlay) closeReviewModal();
  });
}

// Star rating interaction
if (reviewStarsRow) {
  reviewStarsRow.querySelectorAll('.review-star').forEach(star => {
    star.addEventListener('click', () => {
      const val = parseInt(star.dataset.val);
      reviewRatingVal.value = val;
      if (reviewStarsLabel) reviewStarsLabel.textContent = STAR_LABELS[val] || '';
      
      reviewStarsRow.querySelectorAll('.review-star').forEach(s => {
        if (parseInt(s.dataset.val) <= val) s.classList.add('active');
        else s.classList.remove('active');
      });
    });
    
    // Hover effect
    star.addEventListener('mouseenter', () => {
      const val = parseInt(star.dataset.val);
      reviewStarsRow.querySelectorAll('.review-star').forEach(s => {
        if (parseInt(s.dataset.val) <= val) s.classList.add('active');
        else s.classList.remove('active');
      });
    });
  });
  
  // Reset to selected on mouseleave
  reviewStarsRow.addEventListener('mouseleave', () => {
    const currentVal = parseInt(reviewRatingVal.value) || 5;
    reviewStarsRow.querySelectorAll('.review-star').forEach(s => {
      if (parseInt(s.dataset.val) <= currentVal) s.classList.add('active');
      else s.classList.remove('active');
    });
  });
}

// Submit review
if (reviewModalSubmitBtn) {
  reviewModalSubmitBtn.addEventListener('click', async () => {
    const text = reviewText.value.trim();
    const stars = parseInt(reviewRatingVal.value) || 5;
    const rawId = reviewProductId.value;
    const productId = isNaN(parseInt(rawId)) ? rawId : parseInt(rawId);
    
    if (!text) {
      showToast('⚠️ Please write your review before submitting.');
      reviewText.focus();
      return;
    }
    
    if (productId === undefined || productId === null || productId === '') {
      showToast('Something went wrong. Please try again.');
      return;
    }

    const origBtnText = reviewModalSubmitBtn.innerHTML;
    let uploadedImageUrl = null;

    if (selectedReviewFile) {
      try {
        reviewModalSubmitBtn.disabled = true;
        reviewModalSubmitBtn.innerHTML = '⏳ Uploading photo...';
        uploadedImageUrl = await uploadReviewImage(selectedReviewFile);
      } catch (uploadErr) {
        console.error("Review photo upload failed:", uploadErr);
        showToast('⚠️ Failed to upload photo: ' + uploadErr.message);
        reviewModalSubmitBtn.disabled = false;
        reviewModalSubmitBtn.innerHTML = origBtnText;
        return;
      }
    }
    
    // Get user info
    const uid = currentUser ? currentUser.uid : (localStorage.getItem('sc_uid') || 'guest');
    const userName = currentUser ? (currentUser.displayName || 'Customer') : 'Guest';
    
    // Get user location from profile
    let userLoc = '';
    try {
      const profileData = JSON.parse(localStorage.getItem(`sc_profile_${uid}`) || '{}');
      if (profileData.address) {
        // Try to extract city from address
        const parts = profileData.address.split(',').map(s => s.trim());
        userLoc = parts.length >= 2 ? parts[parts.length - 2] : parts[0] || '';
      }
    } catch(e) {}
    
    const d = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const dateStr = `${months[d.getMonth()]} ${d.getFullYear()}`;
    
    const newReview = {
      id: Date.now(),
      productId: productId,
      uid: uid,
      name: userName,
      loc: userLoc,
      text: text,
      stars: stars,
      date: dateStr,
      status: 'pending'
    };

    if (uploadedImageUrl) {
      newReview.image = uploadedImageUrl;
    }

    reviewModalSubmitBtn.disabled = false;
    reviewModalSubmitBtn.innerHTML = origBtnText;
    
    // Save to localStorage
    const allGlobalReviews = JSON.parse(localStorage.getItem('sc_all_reviews') || '[]');
    allGlobalReviews.unshift(newReview);
    localStorage.setItem('sc_all_reviews', JSON.stringify(allGlobalReviews));
    
    // Show success state
    reviewModalProduct.style.display = 'none';
    if (reviewModalDivider) reviewModalDivider.style.display = 'none';
    reviewModalSections.forEach(s => s.style.display = 'none');
    if (reviewModalActions) reviewModalActions.style.display = 'none';
    
    // Re-trigger animation by cloning the icon
    const iconWrap = reviewSuccessState.querySelector('.review-success-icon');
    if (iconWrap) {
      const clone = iconWrap.cloneNode(true);
      iconWrap.parentNode.replaceChild(clone, iconWrap);
    }
    
    // Modify the success title to just be simple without mentioning admin
    const successTitle = reviewSuccessState.querySelector('h3');
    if (successTitle) successTitle.textContent = 'Thank You!';
    const successDesc = reviewSuccessState.querySelector('p');
    if (successDesc) successDesc.textContent = 'Your review has been successfully submitted.';

    reviewSuccessState.classList.add('show');
    
    showToast('✓ Thank you for your review!');
    
    // Re-render orders to update button state
    const profile = currentProfile || {};
    setTimeout(() => {
      renderOrders(profile.orders || []);
    }, 300);
    
    // Auto-close after delay
    setTimeout(() => {
      closeReviewModal();
    }, 2500);
  });
}

