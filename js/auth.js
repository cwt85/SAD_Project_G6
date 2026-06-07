/* =========================================================
   Login (auth.js)
========================================================= */

const AUTH_STORAGE_KEY = "taitungBookingAuth";
const DEFAULT_ADMIN_ACCOUNT = "admin@example.com";
const DEFAULT_ADMIN_PASSWORD = "Admin1234";
const DEFAULT_ADMIN_DISPLAY_NAME = "系統管理員";

function initAuth() {
  loadAuthState();
  ensureDefaultAdmin();
  updateLoginMode();
  updateRegisterMode();
  updateAuthUI();
}

function switchAuthTab(tab) {
  const tabLogin = document.getElementById("tabLogin");
  const tabRegister = document.getElementById("tabRegister");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const notice = document.getElementById("loginNotice");

  tabLogin?.classList.toggle("active", tab === "login");
  tabRegister?.classList.toggle("active", tab === "register");
  loginForm?.classList.toggle("active", tab === "login");
  registerForm?.classList.toggle("active", tab === "register");

  if (notice) notice.innerHTML = "";
}

function togglePasswordVisibility(inputId = "passwordInput", button) {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.type = input.type === "password" ? "text" : "password";
  if (button) button.textContent = input.type === "password" ? "顯示" : "隱藏";
}

function getSelectedLoginRole() {
  return getLoginAccount() === DEFAULT_ADMIN_ACCOUNT ? "admin" : "customer";
}

function getSelectedRegisterRole() {
  return "customer";
}

function getLoginAccount() {
  return normalizeAccount(getValue("accountInput"));
}

function getAccountType(account) {
  if (isValidEmail(account)) return "email";
  if (isValidPhone(account)) return "phone";
  return "";
}

function normalizeAccount(account) {
  return String(account || "").trim().toLowerCase();
}

function findUser(account) {
  const normalized = normalizeAccount(account);
  return users.find(user => normalizeAccount(user.account) === normalized);
}

function getNextUserId() {
  if (!Array.isArray(users) || users.length === 0) return 1;
  return Math.max(...users.map(user => Number(user.id) || 0)) + 1;
}

function createUser({ account, displayName, role, password = "" }) {
  return {
    id: getNextUserId(),
    account: normalizeAccount(account),
    displayName: displayName || normalizeAccount(account),
    type: getAccountType(normalizeAccount(account)),
    role,
    password,
    createdAt: new Date().toLocaleString("zh-TW")
  };
}

function updateLoginMode() {
  const role = getSelectedLoginRole();
  const passwordGroup = document.getElementById("passwordGroup");
  const accountInput = document.getElementById("accountInput");
  const passwordInput = document.getElementById("passwordInput");
  const notice = document.getElementById("loginNotice");

  if (passwordGroup) passwordGroup.style.display = "block";

  if (role === "admin") {
    if (accountInput) accountInput.placeholder = DEFAULT_ADMIN_ACCOUNT;
    if (passwordInput) passwordInput.placeholder = "請輸入管理員密碼";
  } else {
    if (accountInput) accountInput.placeholder = "admin@example.com / example@mail.com / 0912345678";
    if (passwordInput) passwordInput.placeholder = "請輸入密碼";
  }

  if (notice) notice.innerHTML = "";
}

function updateRegisterMode() {
  const passwordFields = document.getElementById("registerPasswordFields");
  if (passwordFields) passwordFields.style.display = "grid";
}

function login() {
  if (getSelectedLoginRole() === "admin") {
    loginAdmin();
    return;
  }

  completeCustomerLogin();
}

function loginAdmin() {
  const account = getLoginAccount();
  const password = getValue("passwordInput").trim();
  const notice = document.getElementById("loginNotice");

  if (!account || !password) {
    showNotice(notice, "error", "請輸入管理員帳號與密碼。");
    return;
  }

  if (account !== DEFAULT_ADMIN_ACCOUNT) {
    showNotice(notice, "error", "請使用預設管理員帳號登入。");
    return;
  }

  const admin = findUser(account);
  if (!admin || admin.role !== "admin") {
    showNotice(notice, "error", "找不到管理員帳號。");
    return;
  }

  if (admin.password !== password) {
    showNotice(notice, "error", "管理員密碼錯誤。");
    return;
  }

  setLoginState(admin);
  showNotice(notice, "success", `歡迎管理員 ${admin.displayName || admin.account} 登入。`);
  clearLoginForm();
  updateAuthUI();
  renderAll();
  setTimeout(() => showSection("admin"), 300);
}

function completeCustomerLogin() {
  const account = getLoginAccount();
  const password = getValue("passwordInput").trim();
  const notice = document.getElementById("loginNotice");

  if (!account || !password) {
    showNotice(notice, "error", "請輸入帳號與密碼。");
    return;
  }

  if (!validateAccount(account, notice)) return;

  const user = findUser(account);
  if (!user || user.role !== "customer") {
    showNotice(notice, "error", "找不到使用者帳號，請先註冊。");
    switchAuthTab("register");
    setValue("regAccount", account);
    return;
  }

  if (!user.password) {
    showNotice(notice, "error", "此帳號尚未設定密碼，請重新註冊或聯絡管理員。");
    return;
  }

  if (user.password !== password) {
    showNotice(notice, "error", "密碼錯誤，請重新輸入。");
    return;
  }

  setLoginState(user);
  showNotice(notice, "success", `歡迎 ${user.displayName || user.account} 登入。`);
  clearLoginForm();
  updateAuthUI();
  renderAll();
  // 登入成功後導向「旅程首頁」，讓使用者先看到總覽再自行決定下一步要去哪個模組。
  setTimeout(() => showSection("home"), 300);
}

function completeRegister() {
  const account = normalizeAccount(getValue("regAccount"));
  const displayName = getValue("regDisplayName").trim();
  const notice = document.getElementById("loginNotice");

  if (!displayName || !account) {
    showNotice(notice, "error", "請完整填寫註冊資料。");
    return;
  }

  if (!validateAccount(account, notice)) return;

  if (account === DEFAULT_ADMIN_ACCOUNT) {
    showNotice(notice, "error", "預設管理員帳號不可註冊為使用者。");
    return;
  }

  if (findUser(account)) {
    showNotice(notice, "warning", "此帳號已註冊，請直接登入。");
    return;
  }

  const passwordResult = validateRegisterPassword(notice);
  if (!passwordResult.ok) return;

  const newUser = createUser({
    account,
    displayName,
    role: "customer",
    password: passwordResult.password
  });

  users.push(newUser);
  setLoginState(newUser);
  saveAuthState();

  showNotice(notice, "success", `使用者註冊成功，歡迎 ${displayName}。`);
  clearRegisterForm();
  clearLoginForm();
  updateAuthUI();
  renderAll();
  // 註冊完成並自動登入後，導向「旅程首頁」而非住宿訂房頁，
  // 讓新使用者先看到總覽再自行決定下一步要去哪個模組。
  setTimeout(() => showSection("home"), 300);
}

function validateRegisterPassword(notice) {
  const password = getValue("regPassword").trim();
  const confirmPassword = getValue("regConfirmPassword").trim();

  if (!password || !confirmPassword) {
    showNotice(notice, "error", "請輸入密碼與確認密碼。");
    return { ok: false };
  }

  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    showNotice(notice, "error", "密碼需至少 8 碼，並包含英文與數字。");
    return { ok: false };
  }

  if (password !== confirmPassword) {
    showNotice(notice, "error", "兩次輸入的密碼不一致。");
    return { ok: false };
  }

  return { ok: true, password };
}

function logout() {
  if (!isLoggedIn) {
    showSection("login");
    return;
  }

  const confirmed = confirm("確定要登出嗎？");
  if (!confirmed) return;

  isLoggedIn = false;
  currentUser = null;

  if (typeof selectedRoomTypes !== "undefined") {
    selectedRoomTypes = {};
  }

  saveAuthState();
  if (typeof saveAppData === "function") {
    saveAppData();
  }
  clearLoginForm();
  updateAuthUI();
  renderAll();
  showSection("search");
  alert("已登出。");
}

function setLoginState(user) {
  isLoggedIn = true;
  currentUser = { ...user };
  saveAuthState();
}

function saveAuthState() {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
    isLoggedIn,
    currentUser,
    users
  }));
}

// 跨分頁同步「已註冊使用者名單」。
// 背景：users 只會在分頁載入當下從 localStorage 讀進記憶體一次，之後就不會主動再讀取。
// 如果在分頁 A 註冊了帳號，分頁 B 並不會自動知道，導致 findUser() 在邀請旅伴等
// 情境中找不到剛在別的分頁註冊好的使用者（在本機用 Live Server 因為有 Live Reload
// 會自動整頁重新整理而剛好把這個 bug 蓋掉，部署到 GitHub Pages 等沒有自動重整的
// 環境就會原形畢露）。這裡只同步「使用者名單」，刻意不去動 currentUser / isLoggedIn，
// 避免因為別的分頁登入/登出而連帶改變了本分頁目前的登入狀態。
function syncUsersFromStorage() {
  try {
    const savedState = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!savedState) return;

    const state = JSON.parse(savedState);
    if (Array.isArray(state.users) && state.users.length > 0) {
      users = state.users;
    }
  } catch (error) {
    console.error("使用者名單同步失敗：", error);
  }
}

function loadAuthState() {
  const savedState = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!savedState) return;

  try {
    const state = JSON.parse(savedState);
    users = Array.isArray(state.users) && state.users.length > 0 ? state.users : users;
    isLoggedIn = Boolean(state.isLoggedIn);
    currentUser = state.currentUser ? findUser(state.currentUser.account) || state.currentUser : null;
  } catch (error) {
    console.error("登入狀態讀取失敗", error);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }
}

function ensureDefaultAdmin() {
  const preservedAdmin = findUser(DEFAULT_ADMIN_ACCOUNT);
  const defaultAdmin = {
    id: 1,
    account: DEFAULT_ADMIN_ACCOUNT,
    displayName: DEFAULT_ADMIN_DISPLAY_NAME,
    type: "email",
    role: "admin",
    password: DEFAULT_ADMIN_PASSWORD,
    createdAt: preservedAdmin?.createdAt || new Date().toLocaleString("zh-TW")
  };
  const customerUsers = Array.isArray(users)
    ? users
      .filter(user => user && normalizeAccount(user.account) !== DEFAULT_ADMIN_ACCOUNT && user.role !== "admin")
      .map(user => ({ ...user, role: "customer" }))
    : [];

  users = [defaultAdmin, ...customerUsers];

  if (!isLoggedIn || !currentUser) {
    isLoggedIn = false;
    currentUser = null;
  } else if (normalizeAccount(currentUser.account) === DEFAULT_ADMIN_ACCOUNT) {
    currentUser = { ...defaultAdmin };
  } else {
    const activeCustomer = findUser(currentUser.account);
    currentUser = activeCustomer && activeCustomer.role === "customer" ? { ...activeCustomer } : null;
    isLoggedIn = Boolean(currentUser);
  }

  saveAuthState();
}

function isAdmin() {
  return isLoggedIn && currentUser && currentUser.role === "admin";
}

function isCustomer() {
  return isLoggedIn && currentUser && currentUser.role === "customer";
}

function requireLogin() {
  if (!isLoggedIn || !currentUser) {
    alert("請先登入後再操作。");
    showSection("login");
    return false;
  }

  return true;
}

function requireAdmin() {
  if (!isAdmin()) {
    alert("僅限管理員操作。");
    showSection("login");
    return false;
  }

  return true;
}

function requireCustomer() {
  if (!isCustomer()) {
    alert("僅限顧客帳號操作。");
    return false;
  }

  return true;
}

function clearLoginForm() {
  setValue("accountInput", "");
  setValue("passwordInput", "");
  updateLoginMode();
}

function clearRegisterForm() {
  setValue("regDisplayName", "");
  setValue("regAccount", "");
  setValue("regPassword", "");
  setValue("regConfirmPassword", "");
  updateRegisterMode();
}

function updateAuthUI() {
  setText("loginStatus", isLoggedIn ? "已登入" : "未登入");
  setText("currentUserName", currentUser ? currentUser.displayName || currentUser.account : "訪客");
  setText("currentUserRole", currentUser ? getRoleName(currentUser.role) : "未登入");

  document.body.classList.toggle("is-admin", isAdmin());
  document.body.classList.toggle("is-customer", isCustomer());
  document.body.classList.toggle("is-guest", !isLoggedIn);
}

function getRoleName(role) {
  if (role === "admin") return "管理員";
  if (role === "customer") return "顧客";
  return "訪客";
}

function validateAccount(account, notice) {
  if (!account) {
    showNotice(notice, "error", "請輸入 Email 或手機號碼。");
    return false;
  }

  if (!isValidEmail(account) && !isValidPhone(account)) {
    showNotice(notice, "error", "請輸入正確的 Email 或手機號碼，例如 0912345678。");
    return false;
  }

  return true;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value) {
  return /^09\d{8}$/.test(value);
}
