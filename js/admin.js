/* =========================================================
   管理員功能 (admin.js)
========================================================= */

let activeAdminPanel = "rooms";
let adminRoomFilters = {
  keyword: "",
  location: "",
  stock: "all",
  policy: "all"
};

function switchAdminPanel(panelKey) {
  const validPanels = ["rooms", "pricing", "history", "service"];
  activeAdminPanel = validPanels.includes(panelKey) ? panelKey : "rooms";

  document.querySelectorAll("[data-admin-panel]").forEach(button => {
    button.classList.toggle("active", button.dataset.adminPanel === activeAdminPanel);
  });

  document.querySelectorAll("[data-admin-panel-content]").forEach(panel => {
    panel.classList.toggle("active", panel.dataset.adminPanelContent === activeAdminPanel);
  });

  if ((activeAdminPanel === "pricing" || activeAdminPanel === "history") && typeof renderAdminManagementSelects === "function") {
    renderAdminManagementSelects();
  }

  if (activeAdminPanel === "service" && typeof renderAdminChat === "function") {
    renderAdminChat();
  }
}

function refreshAdminPanelUI() {
  switchAdminPanel(activeAdminPanel);
}

// ===== 新增 / 修改房源 =====
function saveRoomByAdmin() {
  if (!requireAdmin()) return;

  try {
  const name = getValue("adminName").trim();
  const location = getValue("adminLocation").trim();
  const address = getValue("adminAddress").trim();
  const imageUrls = getValue("adminImageUrls").trim();
  const price = Number(getValue("adminPrice"));
  const stock = Number(getValue("adminStock"));
  const stationDistance = getValue("adminStationDistance").trim();
  const checkInTime = getValue("adminCheckInTime").trim();
  const checkOutTime = getValue("adminCheckOutTime").trim();
  const bookingStart = getValue("adminBookingStart").trim();
  const bookingEnd = getValue("adminBookingEnd").trim();
  const facilities = getValue("adminFacilities").trim();
  const policies = getValue("adminPolicies").trim();
  const desc = getValue("adminDesc").trim();

  const notice = document.getElementById("adminNotice");
  const isEditing = editingRoomId !== null;
  const editingRoom = isEditing ? findRoom(editingRoomId) : null;
  const capacity = getAdminRoomCapacityValue(editingRoom);

  if (isEditing && !editingRoom) {
    showNotice(notice, "error", "找不到要修改的房源。");
    return;
  }

  if (!name || !location || !price || !stock || !checkInTime || !checkOutTime || !bookingStart || !bookingEnd || !desc) {
    showNotice(notice, "error", "必填資料未完整填寫，請補齊房源名稱、地點、價格、庫存、人數、入住/退房時間、訂房期間與描述。");
    return;
  }

  if (price <= 0 || stock <= 0 || capacity <= 0) {
    showNotice(notice, "error", "價格、可售房數量與入住人數必須大於 0。");
    return;
  }

  if (!isValidTimeString(checkInTime) || !isValidTimeString(checkOutTime)) {
    showNotice(notice, "error", "入住與退房時間格式錯誤，請使用 HH:MM。");
    return;
  }

  if (new Date(bookingEnd) < new Date(bookingStart)) {
    showNotice(notice, "error", "訂房結束日期不可早於起始日期。");
    return;
  }

  const images = imageUrls.split(",").map(url => url.trim()).filter(Boolean);
  const facilityList = facilities.split(",").map(item => item.trim()).filter(Boolean);
  const policyList = policies.split(",").map(item => item.trim()).filter(Boolean);

  if (images.some(url => !isValidImageUrl(url))) {
    showNotice(notice, "error", "圖片連結格式錯誤，請輸入 http 或 https 開頭的圖片網址。");
    return;
  }

  // 修改模式
  if (isEditing) {
    const room = editingRoom;
    const selectedTypes = getAdminSelectedRoomTypes({
      roomId: room.id,
      price,
      stock,
      capacity,
      existingRoom: room
    });

    room.name = name;
    room.location = location;
    room.address = address || room.address;
    room.price = getLowestRoomTypePrice({ ...room, roomTypes: selectedTypes }) || price;
    room.stock = stock;
    room.capacity = capacity;
    room.stationDistance = stationDistance || room.stationDistance || "未設定";
    room.checkInTime = checkInTime;
    room.checkOutTime = checkOutTime;
    room.bookingStart = bookingStart;
    room.bookingEnd = bookingEnd;
    room.facilities = facilityList.length ? facilityList : room.facilities;
    room.policies = policyList.length ? policyList : room.policies;
    room.desc = desc;
    room.images = images.length ? images : room.images;
    room.image = images[0] || room.image || (Array.isArray(room.images) ? room.images[0] : "") || getRoomCoverImage(room.id);
    room.roomTypes = selectedTypes;
    room.status = room.status || "active";
    room.updatedAt = new Date().toLocaleString("zh-TW");
    room.updatedBy = currentUser.account;

    showNotice(notice, "success", "房源資料修改成功。");

    editingRoomId = null;
    adminRoomTypes = [];
    clearAdminForm();
    saveAppData();
    renderAll();
    return;
  }

  // 新增模式
  const newRoomId = getNextRoomId();
  const selectedTypes = getAdminSelectedRoomTypes({
    roomId: newRoomId,
    price,
    stock,
    capacity
  });

  const newRoom = {
    id: newRoomId,
    name,
    location,
    address: address || "管理員尚未設定",
    price: getLowestRoomTypePrice({ price, roomTypes: selectedTypes }) || price,
    stock,
    rating: 4.5,
    capacity,
    stationDistance: stationDistance || "未設定",
    checkInTime,
    checkOutTime,
    bookingStart,
    bookingEnd,
    facilities: facilityList.length ? facilityList : ["待補充設備"],
    policies: policyList.length ? policyList : ["待補充政策"],
    desc,
    icon: "🛏️",
    image: images[0] || defaultRoomImages[newRoomId % defaultRoomImages.length],
    images: images.length ? images : getRoomImages(newRoomId),
    roomTypes: selectedTypes,
    status: "active",
    createdAt: new Date().toLocaleString("zh-TW"),
    createdBy: currentUser.account
  };

  rooms.unshift(newRoom);

  showNotice(notice, "success", "房源新增成功。");

  editingRoomId = null;
  adminRoomTypes = [];
  clearAdminForm();
  saveAppData();
  renderAll();
  } catch (error) {
    console.error("房源儲存失敗：", error);
    showNotice(document.getElementById("adminNotice"), "error", "系統儲存房源失敗，請重新操作。");
  }
}

function isValidTimeString(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));
}

function getAdminRoomCapacityValue(existingRoom = null) {
  const explicitCapacity = Number(getValue("adminCapacity"));
  if (explicitCapacity > 0) return explicitCapacity;

  const typeCapacity = getAdminRoomTypesMaxCapacity(adminRoomTypes);
  if (typeCapacity > 0) return typeCapacity;

  const existingCapacity = Number(existingRoom && existingRoom.capacity);
  if (existingCapacity > 0) return existingCapacity;

  return 2;
}

function getAdminRoomTypesMaxCapacity(types) {
  if (!Array.isArray(types) || types.length === 0) return 0;

  return types.reduce((max, type) => {
    const capacity = Number(type && type.capacity) || 0;
    return Math.max(max, capacity);
  }, 0);
}

function getAdminSelectedRoomTypes({ roomId, price, stock, capacity, existingRoom = null }) {
  const selectedTypes = adminRoomTypes.length > 0
    ? adminRoomTypes.map((type, index) => normalizeAdminRoomType(type, {
        roomId,
        index,
        price,
        stock,
        capacity
      }))
    : generateDefaultRoomTypes({ id: roomId, price, capacity });

  const pricedTypes = syncAdminRoomTypePrices(selectedTypes, price, existingRoom);
  return syncAdminRoomTypeStocks(pricedTypes, stock);
}

function normalizeAdminRoomType(type, { roomId, index, price, stock, capacity }) {
  return {
    ...type,
    id: type.id || `type-${roomId}-${index + 1}`,
    name: type.name || `房型 ${index + 1}`,
    price: Number(type.price) > 0 ? Number(type.price) : price,
    capacity: Number(type.capacity) > 0 ? Number(type.capacity) : capacity,
    stock: Number(type.stock) >= 0 ? Number(type.stock) : stock,
    bedType: type.bedType || "無",
    desc: type.desc || "無"
  };
}

function syncAdminRoomTypePrices(types, price, existingRoom = null) {
  const basePrice = Number(price);
  if (!Array.isArray(types) || types.length === 0 || basePrice <= 0) return types;

  if (!existingRoom) {
    const baseIndex = getAdminBaseRoomTypeIndex(types);
    if (baseIndex < 0) return types;

    return types.map((type, index) => index === baseIndex ? { ...type, price: basePrice } : type);
  }

  const previousBasePrice = Number(existingRoom.price) || getLowestRoomTypePrice(existingRoom) || 0;
  if (previousBasePrice <= 0 || Number(previousBasePrice) === basePrice) return types;

  const previousTypeIds = new Set(
    Array.isArray(existingRoom.roomTypes)
      ? existingRoom.roomTypes.map(type => String(type.id))
      : []
  );
  const priceRatio = basePrice / previousBasePrice;

  return types.map(type => {
    if (!previousTypeIds.has(String(type.id))) return type;

    const previousPrice = Number(type.price) || previousBasePrice;
    return {
      ...type,
      price: Math.max(1, Math.round(previousPrice * priceRatio))
    };
  });
}

function getAdminBaseRoomTypeIndex(types) {
  return types.findIndex(type => {
    const id = String(type.id || "").toLowerCase();
    const name = String(type.name || "");
    return id.includes("standard") || name.includes("標準");
  });
}

function syncAdminRoomTypeStocks(types, stock) {
  const totalStock = Math.max(0, Math.round(Number(stock) || 0));
  if (!Array.isArray(types) || types.length === 0) return types;

  if (types.length === 1) {
    return [{ ...types[0], stock: totalStock }];
  }

  const currentStocks = types.map(type => Math.max(0, Math.round(Number(type.stock) || 0)));
  const currentTotal = currentStocks.reduce((sum, value) => sum + value, 0);

  if (currentTotal === totalStock) return types;

  if (currentTotal <= 0) {
    const baseStock = Math.floor(totalStock / types.length);
    let remainder = totalStock % types.length;

    return types.map(type => {
      const nextStock = baseStock + (remainder > 0 ? 1 : 0);
      remainder -= 1;
      return { ...type, stock: nextStock };
    });
  }

  const distributed = currentStocks.map((value, index) => {
    const raw = (value / currentTotal) * totalStock;
    return {
      index,
      stock: Math.floor(raw),
      remainder: raw - Math.floor(raw)
    };
  });
  let remaining = totalStock - distributed.reduce((sum, item) => sum + item.stock, 0);

  distributed
    .slice()
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .forEach(item => {
      if (remaining <= 0) return;
      distributed[item.index].stock += 1;
      remaining -= 1;
    });

  return types.map((type, index) => ({
    ...type,
    stock: distributed[index].stock
  }));
}

// ===== 房源管理列表 =====
function renderAdminRooms() {
  const adminRoomList = document.getElementById("adminRoomList");

  if (!adminRoomList) return;

  const activeElement = document.activeElement;
  const shouldRestoreKeywordFocus = activeElement && activeElement.id === "adminRoomKeyword";
  const keywordSelectionStart = shouldRestoreKeywordFocus ? activeElement.selectionStart : null;
  const keywordSelectionEnd = shouldRestoreKeywordFocus ? activeElement.selectionEnd : null;

  if (!Array.isArray(rooms) || rooms.length === 0) {
    adminRoomList.innerHTML = `
      <div class="notice warning">
        目前沒有房源可管理。
      </div>
    `;
    refreshAdminPanelUI();
    return;
  }

  const filteredRooms = getFilteredAdminRooms();
  const totalRoomTypes = filteredRooms.reduce((sum, room) => sum + getAdminRoomTypeCount(room), 0);
  const totalStock = filteredRooms.reduce((sum, room) => sum + getAdminRoomTotalStock(room), 0);
  const visibleLocations = [...new Set(rooms.map(room => room.location).filter(Boolean))];

  adminRoomList.innerHTML = `
    <div class="admin-room-summary">
      <div>
        <span>房源總數</span>
        <strong>${rooms.length}</strong>
      </div>
      <div>
        <span>篩選結果</span>
        <strong>${filteredRooms.length}</strong>
      </div>
      <div>
        <span>房型總數</span>
        <strong>${totalRoomTypes}</strong>
      </div>
      <div>
        <span>總庫存</span>
        <strong>${totalStock}</strong>
      </div>
    </div>

    ${renderAdminRoomFilters(visibleLocations)}

    ${filteredRooms.length > 0 ? `
      <div class="admin-room-grid">
        ${filteredRooms.map(room => {
        const roomTypes = Array.isArray(room.roomTypes) ? room.roomTypes : [];
        const priceRange = getAdminRoomPriceRange(room);
        const totalTypeStock = getAdminRoomTotalStock(room);
        const coverImage = room.image || (Array.isArray(room.images) ? room.images[0] : "") || getRoomCoverImage(room.id);

        return `
          <article class="admin-room-card">
            <div class="admin-room-cover">
              <img src="${escapeHtml(coverImage)}" alt="${escapeHtml(room.name)}" onerror="this.src='${escapeHtml(getRoomCoverImage(room.id))}'" />
            </div>

            <div class="admin-room-content">
              <div class="admin-room-title-row">
                <div>
                  <h4>${escapeHtml(room.name)}</h4>
                  <p>${escapeHtml(room.location || "未設定地點")}｜${escapeHtml(room.address || "未設定地址")}</p>
                </div>
                <span class="admin-room-status">${totalTypeStock > 0 ? "可售中" : "無庫存"}</span>
              </div>

              <div class="admin-room-meta">
                <div><span>價格區間</span><strong>${escapeHtml(priceRange)}</strong></div>
                <div><span>房型 / 庫存</span><strong>${roomTypes.length} 種 / ${totalTypeStock} 間</strong></div>
                <div><span>可住人數</span><strong>${escapeHtml(String(getMaxRoomTypeCapacity(room)))} 人</strong></div>
                <div><span>評價</span><strong>${escapeHtml(String(room.rating || "未評分"))}</strong></div>
                <div><span>距離車站</span><strong>${escapeHtml(room.stationDistance || "未設定")}</strong></div>
                <div><span>入住 / 退房</span><strong>${escapeHtml(room.checkInTime || "15:00")} / ${escapeHtml(room.checkOutTime || "11:00")}</strong></div>
                <div><span>可訂期間</span><strong>${escapeHtml(room.bookingStart || "未設定")} ~ ${escapeHtml(room.bookingEnd || "未設定")}</strong></div>
              </div>

              <div class="admin-room-type-list">
                ${roomTypes.length ? roomTypes.map(type => `
                  <div class="admin-room-type-pill">
                    <strong>${escapeHtml(type.name)}</strong>
                    <span>NT$ ${Number(type.price || 0).toLocaleString()}｜${escapeHtml(String(type.capacity || "-"))} 人｜庫存 ${escapeHtml(String(type.stock || 0))}</span>
                  </div>
                `).join("") : `<div class="notice warning">尚未設定房型</div>`}
              </div>

              <div class="admin-room-tags">
                ${renderAdminTags(room.facilities, "待補充設備")}
              </div>
              <div class="admin-room-tags policy">
                ${renderAdminTags(getAdminRoomPolicies(room), "待補充政策")}
              </div>

              <p class="admin-room-desc">${escapeHtml(room.desc || "尚未填寫房源描述。")}</p>

              <div class="admin-room-actions">
                <button class="secondary-btn" onclick="showRoomDetail(${room.id})">查看前台</button>
                <button class="secondary-btn" onclick="editRoomByAdmin(${room.id})">修改資料</button>
                <button class="danger-btn" onclick="deleteRoomByAdmin(${room.id})">刪除房源</button>
              </div>
            </div>
          </article>
        `;
        }).join("")}
      </div>
    ` : `
      <div class="notice warning">
        目前沒有符合篩選條件的房源。
      </div>
    `}
  `;
  renderAdminManagementSelects();
  refreshAdminPanelUI();

  if (shouldRestoreKeywordFocus) {
    requestAnimationFrame(() => {
      const keywordInput = document.getElementById("adminRoomKeyword");
      if (!keywordInput) return;
      keywordInput.focus();
      keywordInput.setSelectionRange(keywordSelectionStart, keywordSelectionEnd);
    });
  }
}

function renderAdminRoomFilters(locations) {
  return `
    <div class="admin-room-filter-bar">
      <div>
        <label for="adminRoomKeyword">關鍵字</label>
        <input
          id="adminRoomKeyword"
          value="${escapeHtml(adminRoomFilters.keyword)}"
          placeholder="搜尋房源、地址、設備、政策"
          oninput="updateAdminRoomFilter('keyword', this.value)"
        />
      </div>
      <div>
        <label for="adminRoomLocationFilter">地點</label>
        <select id="adminRoomLocationFilter" onchange="updateAdminRoomFilter('location', this.value)">
          <option value="">全部地點</option>
          ${locations.map(location => `
            <option value="${escapeHtml(location)}" ${adminRoomFilters.location === location ? "selected" : ""}>${escapeHtml(location)}</option>
          `).join("")}
        </select>
      </div>
      <div>
        <label for="adminRoomStockFilter">庫存狀態</label>
        <select id="adminRoomStockFilter" onchange="updateAdminRoomFilter('stock', this.value)">
          <option value="all" ${adminRoomFilters.stock === "all" ? "selected" : ""}>全部</option>
          <option value="available" ${adminRoomFilters.stock === "available" ? "selected" : ""}>可售中</option>
          <option value="soldout" ${adminRoomFilters.stock === "soldout" ? "selected" : ""}>無庫存</option>
        </select>
      </div>
      <div>
        <label for="adminRoomPolicyFilter">住房政策</label>
        <select id="adminRoomPolicyFilter" onchange="updateAdminRoomFilter('policy', this.value)">
          <option value="all" ${adminRoomFilters.policy === "all" ? "selected" : ""}>全部</option>
          <option value="configured" ${adminRoomFilters.policy === "configured" ? "selected" : ""}>已設定</option>
          <option value="missing" ${adminRoomFilters.policy === "missing" ? "selected" : ""}>未設定</option>
        </select>
      </div>
      <div class="actions admin-room-filter-actions">
        <button class="secondary-btn" onclick="resetAdminRoomFilters()">清除篩選</button>
      </div>
    </div>
  `;
}

function updateAdminRoomFilter(key, value) {
  if (!Object.prototype.hasOwnProperty.call(adminRoomFilters, key)) return;
  adminRoomFilters[key] = String(value || "").trim();
  renderAdminRooms();
}

function resetAdminRoomFilters() {
  adminRoomFilters = {
    keyword: "",
    location: "",
    stock: "all",
    policy: "all"
  };
  renderAdminRooms();
}

function getFilteredAdminRooms() {
  const keyword = String(adminRoomFilters.keyword || "").toLowerCase();

  return rooms.filter(room => {
    const totalStock = getAdminRoomTotalStock(room);
    const policyCount = getAdminRoomPolicies(room).length;
    const searchableText = [
      room.name,
      room.location,
      room.address,
      room.desc,
      ...(Array.isArray(room.facilities) ? room.facilities : []),
      ...getAdminRoomPolicies(room),
      ...(Array.isArray(room.roomTypes) ? room.roomTypes.flatMap(type => [type.name, type.desc, type.bedType]) : [])
    ].join(" ").toLowerCase();

    return (
      (!keyword || searchableText.includes(keyword)) &&
      (!adminRoomFilters.location || room.location === adminRoomFilters.location) &&
      (adminRoomFilters.stock === "all" ||
        (adminRoomFilters.stock === "available" && totalStock > 0) ||
        (adminRoomFilters.stock === "soldout" && totalStock <= 0)) &&
      (adminRoomFilters.policy === "all" ||
        (adminRoomFilters.policy === "configured" && policyCount > 0) ||
        (adminRoomFilters.policy === "missing" && policyCount === 0))
    );
  });
}

function getAdminRoomTypeCount(room) {
  return Array.isArray(room.roomTypes) ? room.roomTypes.length : 0;
}

function getAdminRoomTotalStock(room) {
  if (!Array.isArray(room.roomTypes) || room.roomTypes.length === 0) {
    return Number(room.stock) || 0;
  }

  return room.roomTypes.reduce((sum, type) => sum + (Number(type.stock) || 0), 0);
}

function getAdminRoomPriceRange(room) {
  const prices = Array.isArray(room.roomTypes) && room.roomTypes.length > 0
    ? room.roomTypes.map(type => Number(type.price) || 0).filter(price => price > 0)
    : [Number(room.price) || 0].filter(price => price > 0);

  if (prices.length === 0) return "未設定";

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);

  if (minPrice === maxPrice) return `NT$ ${minPrice.toLocaleString()}`;
  return `NT$ ${minPrice.toLocaleString()} ~ ${maxPrice.toLocaleString()}`;
}

function renderAdminTags(items, fallback) {
  const list = Array.isArray(items) && items.length > 0 ? items : [fallback];
  return list.map(item => `<span>${escapeHtml(item)}</span>`).join("");
}

function getAdminRoomPolicies(room) {
  if (typeof getRoomPolicyList === "function") {
    return getRoomPolicyList(room);
  }

  return Array.isArray(room && room.policies) ? room.policies : [];
}

// ===== 編輯房源 =====
function editRoomByAdmin(roomId) {
  if (!requireAdmin()) return;

  const room = findRoom(roomId);
  const notice = document.getElementById("adminNotice");

  if (!room) {
    showNotice(notice, "error", "找不到此房源。");
    return;
  }

  editingRoomId = room.id;
  adminRoomTypes = Array.isArray(room.roomTypes) ? room.roomTypes.map(type => ({...type})) : [];
  const roomImages = Array.isArray(room.images) && room.images.length > 0
    ? room.images
    : (room.image ? [room.image] : []);

  setValue("adminName", room.name);
  setValue("adminLocation", room.location);
  setValue("adminAddress", room.address || "");
  setValue("adminImageUrls", roomImages.join(", "));
  setValue("adminPrice", room.price);
  setValue("adminStock", Array.isArray(room.roomTypes) && room.roomTypes.length > 0
    ? room.roomTypes.reduce((sum, type) => sum + (Number(type.stock) || 0), 0)
    : (Number(room.stock) || 1));
  setValue("adminCapacity", room.capacity || 2);
  setValue("adminStationDistance", room.stationDistance || "");
  setValue("adminCheckInTime", room.checkInTime || "15:00");
  setValue("adminCheckOutTime", room.checkOutTime || "11:00");
  setValue("adminBookingStart", room.bookingStart || "");
  setValue("adminBookingEnd", room.bookingEnd || "");
  setValue("adminFacilities", room.facilities ? room.facilities.join(", ") : "");
  setValue("adminPolicies", getAdminRoomPolicies(room).join(", "));
  setValue("adminDesc", room.desc || "");

  renderAdminRoomTypeList();
  showNotice(notice, "warning", `目前正在修改「${room.name}」。修改完成後請按儲存房源。`);

  switchAdminPanel("rooms");
  requestAnimationFrame(() => {
    document.getElementById("adminName")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  });
}

// ===== 刪除房源 =====
function deleteRoomByAdmin(roomId) {
  if (!requireAdmin()) return;

  const room = findRoom(roomId);
  const notice = document.getElementById("adminNotice");

  if (!room) {
    showNotice(notice, "error", "找不到此房源。");
    return;
  }

  const confirmed = confirm(`是否確定刪除「${room.name}」？`);

  if (!confirmed) return;

  rooms = rooms.filter(item => Number(item.id) !== Number(roomId));
  favorites = favorites.filter(item => Number(item.id) !== Number(roomId));
  cart = cart.filter(item => Number(item.id) !== Number(roomId));

  if (Number(editingRoomId) === Number(roomId)) {
    editingRoomId = null;
    clearAdminForm();
  }

  showNotice(notice, "success", "房源已刪除。");
  saveAppData();
  renderAll();
}

// ===== 取消編輯 =====
function cancelEditRoom() {
  editingRoomId = null;
  clearAdminForm();

  const notice = document.getElementById("adminNotice");
  showNotice(notice, "success", "已取消編輯，回到新增模式。");
}

// ===== 清空表單 =====
function clearAdminForm() {
  setValue("adminName", "");
  setValue("adminLocation", "");
  setValue("adminAddress", "");
  setValue("adminImageUrls", "");
  setValue("adminPrice", "");
  setValue("adminStock", "1");
  setValue("adminCapacity", "2");
  setValue("adminStationDistance", "");
  setValue("adminCheckInTime", "15:00");
  setValue("adminCheckOutTime", "11:00");
  setValue("adminBookingStart", "");
  setValue("adminBookingEnd", "");
  setValue("adminFacilities", "");
  setValue("adminPolicies", "");
  setValue("adminDesc", "");
  setValue("adminTypeName", "");
  setValue("adminTypePrice", "");
  setValue("adminTypeCapacity", "2");
  setValue("adminTypeStock", "1");
  setValue("adminTypeBed", "");
  setValue("adminTypeDesc", "");
  adminRoomTypes = [];
  renderAdminRoomTypeList();
}

// ===== 房型管理 =====
function addAdminRoomType() {
  if (!requireAdmin()) return;

  const type = getAdminRoomTypeFormData();
  const notice = document.getElementById("adminNotice");

  if (!type) return;

  adminRoomTypes.push(type);
  showNotice(notice, "success", `已新增房型：${escapeHtml(type.name)}。`);
  clearAdminRoomTypeInputs();
  renderAdminRoomTypeList();
}

function clearAdminRoomTypeInputs() {
  setValue("adminTypeName", "");
  setValue("adminTypePrice", "");
  setValue("adminTypeCapacity", "2");
  setValue("adminTypeStock", "1");
  setValue("adminTypeBed", "");
  setValue("adminTypeDesc", "");
}

function getAdminRoomTypeFormData() {
  const name = getValue("adminTypeName").trim();
  const price = Number(getValue("adminTypePrice"));
  const capacity = Number(getValue("adminTypeCapacity"));
  const stock = Number(getValue("adminTypeStock"));
  const bedType = getValue("adminTypeBed").trim();
  const desc = getValue("adminTypeDesc").trim();
  const notice = document.getElementById("adminNotice");

  if (!name || !price || !capacity || !stock) {
    showNotice(notice, "error", "請完整填寫房型名稱、價格、人數與庫存。" );
    return null;
  }

  if (price <= 0 || capacity <= 0 || stock <= 0) {
    showNotice(notice, "error", "房型價格、人數與庫存均需大於 0。" );
    return null;
  }

  return {
    id: `type-${Date.now()}-${name.replace(/\s+/g, "-")}`,
    name,
    price,
    capacity,
    stock,
    bedType: bedType || "無",
    desc: desc || "無"
  };
}

function renderAdminRoomTypeList() {
  const target = document.getElementById("adminRoomTypeList");

  if (!target) return;

  if (adminRoomTypes.length === 0) {
    target.innerHTML = `
      <div class="notice info">
        尚未新增房型，可先於上方填寫後新增。
      </div>
    `;
    return;
  }

  target.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>房型</th>
          <th>價格</th>
          <th>人數</th>
          <th>庫存</th>
          <th>床型</th>
          <th>說明</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        ${adminRoomTypes.map((type, index) => `
          <tr>
            <td>${escapeHtml(type.name)}</td>
            <td>NT$ ${Number(type.price).toLocaleString()}</td>
            <td>${escapeHtml(String(type.capacity))}</td>
            <td>${escapeHtml(String(type.stock))}</td>
            <td>${escapeHtml(type.bedType)}</td>
            <td>${escapeHtml(type.desc)}</td>
            <td>
              <button class="danger-btn" onclick="removeAdminRoomType(${index})">移除</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function removeAdminRoomType(index) {
  if (index < 0 || index >= adminRoomTypes.length) return;
  adminRoomTypes.splice(index, 1);
  renderAdminRoomTypeList();
}

function isValidImageUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
