/* =========================================================
   應用程式初始化與主要流程 (app.js)
========================================================= */

// ===== 初始化應用 =====
async function initializeApp() {
  console.log("應用程式初始化中...");

  initAuth();

  await loadRooms();
  loadAppData();

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

  if (adminBtn) {
    adminBtn.style.display = !isLoggedIn || currentUser.role !== "admin" ? "none" : "block";
  }

  if (favoriteBtn) {
    favoriteBtn.style.display = !isLoggedIn ? "none" : "block";
  }

  if (cartBtn) {
    cartBtn.style.display = !isLoggedIn ? "none" : "block";
  }

  if (orderBtn) {
    orderBtn.style.display = !isLoggedIn ? "none" : "block";
  }

  if (itineraryBtn) {
    itineraryBtn.style.display = "block";
  }

  if (trainBtn) {
    trainBtn.style.display = "block";
  }

  if (homeBtn) {
    homeBtn.style.display = "block";
  }

  // 購物車按鈕標籤
  if (cartBtn && isLoggedIn && cart.length > 0) {
    cartBtn.innerHTML = `購物車 <span class="badge">${cart.length}</span>`;
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

// ===== 頁面載入完成後初始化 =====
document.addEventListener("DOMContentLoaded", initializeApp);

// ===== 確保 roomDetail section 存在 =====
ensureRoomDetailSection();
