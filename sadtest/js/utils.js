/* =========================================================
   共用工具函式 (utils.js)
========================================================= */

// ===== DOM 操作 =====
function setValue(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.value = value;
  }
}

function getValue(id) {
  const element = document.getElementById(id);
  return element ? element.value : "";
}

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  }
}

const originalWindowAlert = typeof window !== "undefined" && typeof window.alert === "function"
  ? window.alert.bind(window)
  : null;

const noticeDialogMeta = {
  success: {
    title: "操作成功",
    label: "SUCCESS"
  },
  warning: {
    title: "請注意",
    label: "NOTICE"
  },
  error: {
    title: "無法完成操作",
    label: "ERROR"
  },
  info: {
    title: "系統提示",
    label: "INFO"
  }
};

function showNotice(element, type, message) {
  if (element) {
    element.innerHTML = "";
  }

  showDialogNotice(type, message);
}

function showDialogNotice(type = "info", message = "") {
  const dialog = ensureNoticeDialog();
  const safeType = noticeDialogMeta[type] ? type : "info";
  const meta = noticeDialogMeta[safeType];

  if (!dialog) {
    if (originalWindowAlert) {
      originalWindowAlert(String(message || ""));
    }
    return;
  }

  dialog.className = `notice-dialog ${safeType}`;
  dialog.querySelector(".notice-dialog-label").textContent = meta.label;
  dialog.querySelector(".notice-dialog-title").textContent = meta.title;
  dialog.querySelector(".notice-dialog-message").textContent = String(message || "");

  if (typeof dialog.showModal === "function") {
    if (dialog.open) {
      dialog.close();
    }
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
    dialog.classList.add("is-open");
  }

  const actionButton = dialog.querySelector(".notice-dialog-action");
  if (actionButton) {
    actionButton.focus();
  }
}

function ensureNoticeDialog() {
  if (typeof document === "undefined" || !document.body) return null;

  let dialog = document.getElementById("appNoticeDialog");
  if (dialog) return dialog;

  dialog = document.createElement("dialog");
  dialog.id = "appNoticeDialog";
  dialog.className = "notice-dialog info";
  dialog.innerHTML = `
    <div class="notice-dialog-card">
      <div class="notice-dialog-accent" aria-hidden="true"></div>
      <div class="notice-dialog-content">
        <span class="notice-dialog-label">INFO</span>
        <h3 class="notice-dialog-title">系統提示</h3>
        <p class="notice-dialog-message"></p>
      </div>
      <button type="button" class="notice-dialog-close" aria-label="關閉提示" onclick="closeNoticeDialog()">&times;</button>
      <button type="button" class="primary-btn notice-dialog-action" onclick="closeNoticeDialog()">知道了</button>
    </div>
  `;

  dialog.addEventListener("click", event => {
    if (event.target === dialog) {
      closeNoticeDialog();
    }
  });

  document.body.appendChild(dialog);
  return dialog;
}

function closeNoticeDialog() {
  const dialog = document.getElementById("appNoticeDialog");
  if (!dialog) return;

  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
    dialog.classList.remove("is-open");
  }
}

function installDialogAlert() {
  if (typeof window === "undefined" || window.__dialogAlertInstalled) return;
  window.__dialogAlertInstalled = true;
  window.alert = function dialogAlert(message) {
    showDialogNotice("info", message);
  };
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      ensureNoticeDialog();
      installDialogAlert();
    });
  } else {
    ensureNoticeDialog();
    installDialogAlert();
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ===== 資料查詢 =====
function findRoom(roomId) {
  return rooms.find(room => Number(room.id) === Number(roomId));
}

function findOrder(orderId) {
  return orders.find(order => order.id === orderId);
}

function findUser(account) {
  return users.find(user => user.account === account);
}

// ===== 房型相關 =====
function getSelectedRoomType(room) {
  const roomTypeId = selectedRoomTypes[room.id];
  if (!roomTypeId || !room.roomTypes) return null;
  return room.roomTypes.find(type => type.id === roomTypeId);
}

function selectRoomType(roomId, typeId) {
  selectedRoomTypes[roomId] = typeId;

  if (typeof saveAppData === "function") {
    saveAppData();
  }

  const room = findRoom(roomId);
  if (room && typeof renderRoomDetail === "function") {
    renderRoomDetail(room);
  }
}

function getMaxRoomTypeCapacity(room) {
  if (!room.roomTypes || room.roomTypes.length === 0) return room.capacity || 2;
  return Math.max(...room.roomTypes.map(type => type.capacity || 2));
}

function getLowestRoomTypePrice(room) {
  if (!room.roomTypes || room.roomTypes.length === 0) return room.price || 0;
  return Math.min(...room.roomTypes.map(type => type.price || room.price || 0));
}

// ===== 房源圖片 =====
function getRoomCoverImage(roomId) {
  const index = Math.abs(Number(roomId) || 0) % defaultRoomImages.length;
  return defaultRoomImages[index];
}

function getRoomImages(roomId) {
  const index = Math.abs(Number(roomId) || 0) % defaultRoomImages.length;
  return [
    defaultRoomImages[index],
    defaultRoomImages[(index + 1) % defaultRoomImages.length],
    defaultRoomImages[(index + 2) % defaultRoomImages.length]
  ];
}

// ===== 房型生成 =====
function generateDefaultRoomTypes(room) {
  const basePrice = Number(room.price) || 3000;
  const maxCapacity = Number(room.capacity) || 2;

  const roomTypes = [
    {
      id: `type-standard-${room.id}`,
      name: "標準房",
      price: basePrice,
      capacity: maxCapacity,
      bedType: "1 張雙人床",
      stock: 5,
      desc: "基礎房型"
    },
    {
      id: `type-deluxe-${room.id}`,
      name: "豪華房",
      price: Math.round(basePrice * 1.3),
      capacity: maxCapacity + 1,
      bedType: "1 張雙人床 + 1 張單人床",
      stock: 3,
      desc: "升級房型"
    }
  ];

  return roomTypes;
}

function getNextRoomId() {
  if (rooms.length === 0) return 1;
  return Math.max(...rooms.map(r => Number(r.id) || 0)) + 1;
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
    showNotice(notice, "error", "僅限管理員登入後才可進入管理員後台。請先登入管理員帳號。" );
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
        return onclick.includes(`showSection('${id}'`) || onclick.includes(`showSection(\"${id}\"`);
      });
  }

  if (btn) {
    btn.classList.add("active");
  }

  renderAll();
}

// ===== 登入檢查 =====
function requireLogin() {
  if (!isLoggedIn) {
    alert("請先登入後再操作。");
    return false;
  }
  return true;
}

// ===== 日期與價格格式化 =====
function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("zh-TW");
  } catch {
    return value;
  }
}

function formatPrice(value) {
  return Number(value || 0).toLocaleString();
}
