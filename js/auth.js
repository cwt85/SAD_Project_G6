/* =========================================================
   登入 / 註冊功能
========================================================= */

const AUTH_STORAGE_KEY = "taitungBookingAuth";
const AUTH_CODE_EXPIRE_MS = 5 * 60 * 1000;
const AUTH_RESEND_COOLDOWN_MS = 60 * 1000;
const AUTH_MAX_VERIFY_ATTEMPTS = 5;
const ADMIN_REGISTER_INVITE_CODE = "ADMIN2026";

let lastCodeSentAt = {};

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
  const pwInput = document.getElementById(inputId);
  if (!pwInput) return;

  pwInput.type = pwInput.type === "password" ? "text" : "password";
  if (button) button.textContent = pwInput.type === "password" ? "顯示" : "隱藏";
}

function getSelectedLoginRole() {
  return document.querySelector('input[name="loginRole"]:checked')?.value || "customer";
}

function getSelectedRegisterRole() {
  return document.querySelector('input[name="registerRole"]:checked')?.value || "customer";
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

function createUser({ account, displayName, role, password = null }) {
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
  const codeGroup = document.getElementById("codeGroup");
  const sendCodeBtn = document.getElementById("sendCodeBtn");
  const accountInput = document.getElementById("accountInput");
  const notice = document.getElementById("loginNotice");

  if (role === "admin") {
    if (passwordGroup) passwordGroup.style.display = "block";
    if (codeGroup) codeGroup.style.display = "none";
    if (sendCodeBtn) sendCodeBtn.style.display = "none";
    if (accountInput) accountInput.placeholder = "admin@example.com";
  } else {
    if (passwordGroup) passwordGroup.style.display = "none";
    if (codeGroup) codeGroup.style.display = "block";
    if (sendCodeBtn) sendCodeBtn.style.display = "inline-block";
    if (accountInput) accountInput.placeholder = "example@mail.com / 0912345678";
  }

  if (notice) notice.innerHTML = "";
}

function updateRegisterMode() {
  const role = getSelectedRegisterRole();
  const adminFields = document.getElementById("adminRegisterFields");
  const regPassword = document.getElementById("regPassword");
  const regConfirmPassword = document.getElementById("regConfirmPassword");
  const regInviteCode = document.getElementById("regInviteCode");

  if (adminFields) adminFields.style.display = role === "admin" ? "contents" : "none";

  [regPassword, regConfirmPassword, regInviteCode].forEach(input => {
    if (input) input.required = role === "admin";
  });
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

  const admin = findUser(account);

  if (!admin || admin.role !== "admin") {
    showNotice(notice, "error", "管理員帳號不存在。");
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

function sendCode() {
  const account = getLoginAccount();
  const notice = document.getElementById("loginNotice");

  if (!validateAccount(account, notice)) return;

  const user = findUser(account);
  if (!user || user.role !== "customer") {
    showNotice(notice, "error", "此顧客帳號尚未註冊，請先完成註冊。");
    switchAuthTab("register");
    setValue("regAccount", account);
    return;
  }

  if (!canSendCode(account, notice)) return;
  generateVerificationCode(account);
  showCodeNotice(notice, account);
}

function completeCustomerLogin() {
  const account = getLoginAccount();
  const code = getValue("verifyCode").trim();
  const notice = document.getElementById("loginNotice");

  if (!account || !code) {
    showNotice(notice, "error", "請輸入帳號與驗證碼。");
    return;
  }

  if (!validateAccount(account, notice)) return;

  const user = findUser(account);
  if (!user || user.role !== "customer") {
    showNotice(notice, "error", "找不到顧客帳號，請先註冊。");
    return;
  }

  if (!verifyCode(account, code, notice)) return;

  setLoginState(user);
  delete verificationCodes[account];
  delete lastCodeSentAt[account];
  showNotice(notice, "success", `歡迎 ${user.displayName || user.account} 登入。`);
  clearLoginForm();
  updateAuthUI();
  renderAll();
  setTimeout(() => showSection("search"), 300);
}

function sendRegisterCode() {
  const account = normalizeAccount(getValue("regAccount"));
  const displayName = getValue("regDisplayName").trim();
  const notice = document.getElementById("loginNotice");

  if (!displayName) {
    showNotice(notice, "error", "請輸入顯示名稱。");
    return;
  }

  if (!validateAccount(account, notice)) return;

  if (findUser(account)) {
    showNotice(notice, "warning", "此帳號已註冊，請改用登入。");
    return;
  }

  if (!canSendCode(account, notice)) return;
  generateVerificationCode(account);
  showCodeNotice(notice, account);
}

function completeRegister() {
  const role = getSelectedRegisterRole();
  const account = normalizeAccount(getValue("regAccount"));
  const displayName = getValue("regDisplayName").trim();
  const code = getValue("regVerifyCode").trim();
  const notice = document.getElementById("loginNotice");

  if (!displayName || !account || !code) {
    showNotice(notice, "error", "請完整填寫註冊資料與驗證碼。");
    return;
  }

  if (!validateAccount(account, notice)) return;

  if (findUser(account)) {
    showNotice(notice, "warning", "此帳號已註冊，請直接登入。");
    return;
  }

  if (!verifyCode(account, code, notice)) return;

  let password = null;
  if (role === "admin") {
    const passwordResult = validateAdminRegisterPassword(notice);
    if (!passwordResult.ok) return;
    password = passwordResult.password;
  }

  const newUser = createUser({ account, displayName, role, password });
  users.push(newUser);
  delete verificationCodes[account];
  delete lastCodeSentAt[account];
  setLoginState(newUser);
  saveAuthState();

  showNotice(notice, "success", `${getRoleName(role)}註冊成功，歡迎 ${displayName}。`);
  clearRegisterForm();
  clearLoginForm();
  updateAuthUI();
  renderAll();
  setTimeout(() => showSection(role === "admin" ? "admin" : "search"), 300);
}

function validateAdminRegisterPassword(notice) {
  const password = getValue("regPassword").trim();
  const confirmPassword = getValue("regConfirmPassword").trim();
  const inviteCode = getValue("regInviteCode").trim();

  if (!password || !confirmPassword || !inviteCode) {
    showNotice(notice, "error", "註冊管理員需填寫密碼、確認密碼與邀請碼。");
    return { ok: false };
  }

  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    showNotice(notice, "error", "管理員密碼至少 8 碼，且需包含英文與數字。");
    return { ok: false };
  }

  if (password !== confirmPassword) {
    showNotice(notice, "error", "兩次輸入的管理員密碼不一致。");
    return { ok: false };
  }

  if (inviteCode !== ADMIN_REGISTER_INVITE_CODE) {
    showNotice(notice, "error", "管理員邀請碼錯誤。");
    return { ok: false };
  }

  return { ok: true, password };
}

function generateVerificationCode(account) {
  const normalized = normalizeAccount(account);
  const code = String(Math.floor(100000 + Math.random() * 900000));

  verificationCodes[normalized] = {
    code,
    expiresAt: Date.now() + AUTH_CODE_EXPIRE_MS,
    attempts: 0
  };

  lastCodeSentAt[normalized] = Date.now();
  console.log(`驗證碼 (${normalized})：${code}`);
}

function verifyCode(account, code, notice) {
  const normalized = normalizeAccount(account);
  const record = verificationCodes[normalized];

  if (!record) {
    showNotice(notice, "error", "尚未取得驗證碼，請先發送驗證碼。");
    return false;
  }

  if (Date.now() > record.expiresAt) {
    delete verificationCodes[normalized];
    delete lastCodeSentAt[normalized];
    showNotice(notice, "error", "驗證碼已過期，請重新發送。");
    return false;
  }

  if (record.attempts >= AUTH_MAX_VERIFY_ATTEMPTS) {
    delete verificationCodes[normalized];
    delete lastCodeSentAt[normalized];
    showNotice(notice, "error", "驗證碼錯誤次數過多，請重新發送。");
    return false;
  }

  if (String(code) !== String(record.code)) {
    record.attempts += 1;
    const remainAttempts = AUTH_MAX_VERIFY_ATTEMPTS - record.attempts;
    showNotice(notice, "error", `驗證碼錯誤，還可嘗試 ${remainAttempts} 次。`);
    return false;
  }

  return true;
}

function canSendCode(account, notice) {
  const normalized = normalizeAccount(account);
  const lastSent = lastCodeSentAt[normalized];
  if (!verificationCodes[normalized]) return true;
  if (!lastSent) return true;

  const elapsed = Date.now() - lastSent;
  if (elapsed < AUTH_RESEND_COOLDOWN_MS) {
    const remainSeconds = Math.ceil((AUTH_RESEND_COOLDOWN_MS - elapsed) / 1000);
    showNotice(notice, "warning", `請 ${remainSeconds} 秒後再重新發送驗證碼。`);
    return false;
  }

  return true;
}

function showCodeNotice(notice, account) {
  const accountType = getAccountType(account) === "email" ? "Email" : "手機";
  showNotice(notice, "success", `驗證碼已發送至 ${accountType}。本系統為前端展示版，請至 Console 查看驗證碼。`);
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
  alert("已成功登出。");
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
  const defaultAdmin = findUser("admin@example.com");
  if (defaultAdmin) {
    defaultAdmin.role = "admin";
    defaultAdmin.password = defaultAdmin.password || "Admin1234";
    defaultAdmin.displayName = defaultAdmin.displayName || "系統管理員";
    return;
  }

  users.unshift({
    id: getNextUserId(),
    account: "admin@example.com",
    displayName: "系統管理員",
    type: "email",
    role: "admin",
    password: "Admin1234",
    createdAt: new Date().toLocaleString("zh-TW")
  });
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
    alert("此功能僅限管理員使用。");
    showSection("login");
    return false;
  }

  return true;
}

function requireCustomer() {
  if (!isCustomer()) {
    alert("此功能僅限顧客使用。");
    return false;
  }

  return true;
}

function clearLoginForm() {
  setValue("accountInput", "");
  setValue("passwordInput", "");
  setValue("verifyCode", "");
  updateLoginMode();
}

function clearRegisterForm() {
  setValue("regDisplayName", "");
  setValue("regAccount", "");
  setValue("regVerifyCode", "");
  setValue("regPassword", "");
  setValue("regConfirmPassword", "");
  setValue("regInviteCode", "");
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
    showNotice(notice, "error", "請輸入有效的 Email 或台灣手機號碼，例如 0912345678。");
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
