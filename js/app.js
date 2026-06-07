/* =========================================================
   應用程式初始化與主要流程 (app.js)
========================================================= */

// ===== 初始化應用 =====
async function initializeApp() {
  console.log("應用程式初始化中...");

  initAuth();
  initBackToTopButton();

  await loadRooms();
  loadAppData();

  initCrossTabSync();

  renderAll();

  if (location.hash.includes("itineraryShare=")) {
    showSection("itinerary");
  }

  // 預設顯示首頁
  const homeBtn = Array.from(document.querySelectorAll("nav button")).find(btn => {
    const onclick = btn.getAttribute("onclick") || "";
    return onclick.includes("showSection('home'") || onclick.includes("showSection(\"home\"");
  });

  if (homeBtn) {
    homeBtn.click();
  }
}

// ===== 跨分頁資料同步 =====
// 背景：本應用的共用資料（已註冊使用者名單、行程、訂單等）都存在 localStorage，
// 但 localStorage 只是「儲存層」會在分頁之間共享，JS 記憶體中的變數
//（let users / let itineraries ...）卻是「每個分頁各自獨立」的，
// 只有在該分頁載入當下才會從 localStorage 讀進記憶體一次，之後不會自動更新。
//
// 因此會出現：分頁 A 註冊了「小美」、分頁 B 註冊了「小明」之後，
// 回到分頁 A 邀請「小明」當旅伴時，分頁 A 記憶體中過時的 users 名單裡根本沒有
// 「小明」，因而顯示「找不到使用者」。
//
// 監聽瀏覽器原生的 storage 事件——當「其他分頁」修改了 localStorage 時，
// 目前分頁就會收到通知，藉此把記憶體同步成最新內容並重新渲染畫面。
// 注意：對於使用者名單（AUTH_STORAGE_KEY）只同步 users 陣列本身，
// 刻意不呼叫會一併覆寫 currentUser / isLoggedIn 的 loadAuthState()，
// 避免別的分頁登入/登出而連帶影響到本分頁目前的登入狀態。
function initCrossTabSync() {
  window.addEventListener("storage", (event) => {
    // event.key 為 null 代表整個 storage 被清空（例如呼叫了 localStorage.clear()）
    if (event.key === null || event.key === AUTH_STORAGE_KEY) {
      syncUsersFromStorage();
    }
    if (event.key === null || event.key === APP_STORAGE_KEY) {
      loadAppData();
      renderAll();
    }
  });
}

// ===== 全域 UI 重新渲染 =====
function renderAll() {
  updateNavigation();
  updateLoginStatus();
  renderRooms(rooms);
  renderFavorites();
  renderCart();
  renderOrders();
  renderAdminRooms();
  renderAdminManagementSelects();
  calculatePricingPreview();
  renderChat();
  renderItineraryModule();
  renderTrainModule();
  renderBonusPointBar();
  renderHomeDashboard();
}

// ===== 更新導航欄 =====
function updateNavigation() {
  const adminBtn = document.querySelector("nav button[onclick*=\"admin\"]");
  const favoriteBtn = document.querySelector("nav button[onclick*=\"favorite\"]");
  const cartBtn = document.querySelector("nav button[onclick*=\"cart\"]");
  const orderBtn = document.querySelector("nav button[onclick*=\"order\"]");
  const itineraryBtn = document.querySelector('nav button[data-section="itinerary"]');
  const trainBtn = document.querySelector('nav button[data-section="train"]');
  const homeBtn = document.querySelector('nav button[data-section="home"]');
  const chatBtn = document.querySelector('nav button[data-section="chat"]');
  const isAdminUser = typeof isAdmin === "function"
    ? isAdmin()
    : Boolean(isLoggedIn && currentUser && currentUser.role === "admin");

  if (adminBtn) {
    adminBtn.style.display = isAdminUser ? "block" : "none";
  }

  if (favoriteBtn) {
    favoriteBtn.style.display = !isLoggedIn || isAdminUser ? "none" : "block";
  }

  if (cartBtn) {
    cartBtn.style.display = !isLoggedIn || isAdminUser ? "none" : "block";
  }

  if (orderBtn) {
    orderBtn.style.display = !isLoggedIn ? "none" : "block";
  }

  if (itineraryBtn) {
    itineraryBtn.style.display = isAdminUser ? "none" : "block";
  }

  if (trainBtn) {
    trainBtn.style.display = isAdminUser ? "none" : "block";
  }

  if (homeBtn) {
    homeBtn.style.display = "block";
  }

  const currentUserId = currentUser ? String(currentUser.id) : "";
  const favoriteCount = isLoggedIn && currentUser
    ? favorites.filter(item => String(item.userId || currentUser.id) === currentUserId).length
    : 0;
  const cartCount = isLoggedIn && currentUser
    ? cart.filter(item => String(item.userId || currentUser.id) === currentUserId).length
    : 0;

  if (favoriteBtn && isLoggedIn && favoriteCount > 0) {
    favoriteBtn.innerHTML = `收藏清單 <span class="badge">${favoriteCount}</span>`;
  } else if (favoriteBtn) {
    favoriteBtn.innerHTML = "收藏清單";
  }

  if (cartBtn && isLoggedIn && cartCount > 0) {
    cartBtn.innerHTML = `購物車 <span class="badge">${cartCount}</span>`;
  } else if (cartBtn) {
    cartBtn.innerHTML = "購物車";
  }

  // 聊天按鈕未讀標示
  if (chatBtn) {
    if (isLoggedIn && currentUser) {
      chatBtn.style.display = "block";
      if (currentUser.role === "admin") {
        // 管理員在 nav 上不顯示聊天室（用後台）
        chatBtn.style.display = "none";
      } else {
        const userUnread = typeof getUserUnreadCount === "function" ? getUserUnreadCount() : 0;
        chatBtn.innerHTML = userUnread > 0
          ? `聊天室 <span class="badge">${userUnread}</span>`
          : "聊天室";
      }
    } else {
      chatBtn.style.display = "none";
    }
  }
}

// ===== 更新登入狀態 =====
function updateLoginStatus() {
  const loginBtn = document.querySelector('nav button[data-section="login"]');
  const authActionBtn = document.getElementById("authActionBtn");

  if (isLoggedIn) {
    if (loginBtn) {
      const displayName = currentUser.displayName || currentUser.account;
      loginBtn.innerHTML = `${displayName} | 登出`;
      loginBtn.setAttribute(
        "onclick",
        "logout()"
      );
    }

    if (authActionBtn) {
      authActionBtn.textContent = "登出";
      authActionBtn.className = "danger-btn auth-action-btn";
      authActionBtn.setAttribute("onclick", "logout()");
    }

    updateLoginMode();
  } else {
    if (loginBtn) {
      loginBtn.innerHTML = "登入 / 註冊";
      loginBtn.setAttribute(
        "onclick",
        "showSection('login', this)"
      );
    }

    if (authActionBtn) {
      authActionBtn.textContent = "登入 / 註冊";
      authActionBtn.className = "secondary-btn auth-action-btn";
      authActionBtn.setAttribute("onclick", "showSection('login')");
    }
  }
}

function renderHomeDashboard() {
  const dashboard = document.getElementById("homeDashboard");
  if (!dashboard) return;

  const visibleTrips = isLoggedIn && currentUser && typeof getVisibleItineraries === "function"
    ? getVisibleItineraries()
    : [];
  const activeTrip = typeof getActiveItinerary === "function" ? getActiveItinerary() : null;
  const userLodgingOrders = isLoggedIn && currentUser
    ? orders.filter(order => isAdmin() || String(order.userId) === String(currentUser.id))
    : [];
  const userTrainOrders = isLoggedIn && currentUser
    ? trainOrders.filter(order => isAdmin() || String(order.userId) === String(currentUser.id) || String(order.holderUserId || "") === String(currentUser.id))
    : [];
  const totalPoints = typeof getCurrentBonusPoints === "function" ? getCurrentBonusPoints() : Number(trainBonusPoints || 0);

  dashboard.innerHTML = `
    <div class="home-dashboard-grid">
      <div class="summary-item">
        <span>目前行程</span>
        <strong>${activeTrip ? escapeHtml(activeTrip.name) : "尚未選擇"}</strong>
      </div>
      <div class="summary-item">
        <span>行程數</span>
        <strong>${visibleTrips.length}</strong>
      </div>
      <div class="summary-item">
        <span>住宿訂單</span>
        <strong>${userLodgingOrders.length}</strong>
      </div>
      <div class="summary-item">
        <span>車票訂單</span>
        <strong>${userTrainOrders.length}</strong>
      </div>
<div class="summary-item">
  <span>紅利點數</span>
  <strong id="summaryBonusPointsText">${Number(totalPoints || 0).toLocaleString()} 點</strong>
</div>
  `;
}

// ===== 頁面切換 =====
function showSection(id, btn) {
  document.querySelectorAll("section").forEach(section => {
    section.classList.remove("active");
  });

  const isAdminUser = typeof isAdmin === "function"
    ? isAdmin()
    : Boolean(isLoggedIn && currentUser && currentUser.role === "admin");
  const adminHiddenSections = ["itinerary", "train", "favorite", "cart"];
  if (isAdminUser && adminHiddenSections.includes(id)) {
    id = "admin";
    btn = null;
  }

  let targetSection = document.getElementById(id);

  if (id === "admin" && (!currentUser || currentUser.role !== "admin")) {
    const notice = document.getElementById("loginNotice");
    showNotice(notice, "error", "僅限管理員登入後才可進入管理員後台。請先登入管理員帳號。");
    targetSection = document.getElementById("login");
    id = "login";
  }

  if (targetSection) {
    targetSection.classList.add("active");
  }

  document.querySelectorAll("nav button").forEach(button => {
    button.classList.remove("active");
  });

  if (!btn) {
    btn = document.querySelector(`nav button[data-section="${id}"]`) ||
      Array.from(document.querySelectorAll("nav button")).find(button => {
        const onclick = button.getAttribute("onclick") || "";
        return (
          onclick.includes(`showSection('${id}'`) ||
          onclick.includes(`showSection(\"${id}\"`)
        );
      });
  }

  if (btn) {
    btn.classList.add("active");
  }

  renderAll();
}

function initBackToTopButton() {
  if (typeof window === "undefined") return;
  updateBackToTopButton();
  window.addEventListener("scroll", updateBackToTopButton, { passive: true });
}

function updateBackToTopButton() {
  const button = document.getElementById("backToTopBtn");
  if (!button || typeof window === "undefined") return;
  button.classList.toggle("visible", Number(window.scrollY || 0) > 260);
}

function scrollToTop() {
  if (typeof window === "undefined") return;
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

// ===== 頁面載入完成後初始化 =====
document.addEventListener("DOMContentLoaded", initializeApp);

// ===== 確保 roomDetail section 存在 =====
ensureRoomDetailSection();
