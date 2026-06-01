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

function showNotice(element, type, message) {
  if (!element) return;
  element.innerHTML = `<div class="notice ${type}">${escapeHtml(message)}</div>`;
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
