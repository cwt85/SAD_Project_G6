/* =========================================================
   購物車、訂單、付款、退款與評價功能 (orders.js)
========================================================= */

const LODGING_LONG_STAY_DISCOUNT_MIN_NIGHTS = 2;
const LODGING_LONG_STAY_DISCOUNT_RATE = 0.8;
const LODGING_LONG_STAY_DISCOUNT_LABEL = "訂房兩晚以上八折優惠";

// ===== 收藏功能 =====
function addFavorite(roomId) {
  if (!requireCustomer()) return;

  try {
    const room = findRoom(roomId);

    if (!isRoomSelectable(room)) {
      alert("房源已下架或不可訂，無法加入收藏。");
      return;
    }

    const alreadyExists = favorites.some(item =>
      Number(item.roomId || item.id) === Number(roomId) &&
      String(item.userId || currentUser.id) === String(currentUser.id)
    );

    if (alreadyExists) {
      alert("此房源已在收藏清單中。");
      return;
    }

    favorites.push({
      userId: currentUser.id,
      roomId: room.id,
      addedAt: new Date().toLocaleString("zh-TW")
    });

    saveAppData();
    alert("已加入收藏清單。");
    renderAll();
  } catch (error) {
    console.error("加入收藏失敗：", error);
    alert("系統處理失敗，請重新操作。");
  }
}

function renderFavorites() {
  const favoriteList = document.getElementById("favoriteList");
  if (!favoriteList) return;

  if (!isLoggedIn || !currentUser) {
    favoriteList.innerHTML = `<div class="notice warning">請先登入後查看收藏清單。</div>`;
    return;
  }

  const userFavorites = getUserSavedItems(favorites);

  if (userFavorites.length === 0) {
    favoriteList.innerHTML = `<div class="notice warning">尚無收藏房源。</div>`;
    return;
  }

  favoriteList.innerHTML = buildFavoriteRoomCards(userFavorites);
}

// ===== 購物車功能 =====
function addCart(roomId) {
  if (!requireCustomer()) return;

  try {
    const room = findRoom(roomId);

    if (!isRoomSelectable(room)) {
      alert("房源已下架或不可訂，無法加入購物車。");
      return;
    }

    const alreadyExists = cart.some(item =>
      Number(item.roomId || item.id) === Number(roomId) &&
      String(item.userId || currentUser.id) === String(currentUser.id)
    );

    if (alreadyExists) {
      alert("此房源已在購物車中。");
      return;
    }

    const selectedType = getSelectedRoomType(room) ||
      (Array.isArray(room.roomTypes) ? room.roomTypes.find(type => Number(type.stock) > 0) : null);

    if (selectedType) {
      selectedRoomTypes[room.id] = selectedType.id;
    }

    cart.push({
      userId: currentUser.id,
      roomId: room.id,
      selectedTypeId: selectedType ? selectedType.id : "",
      checkIn: getValue("checkIn"),
      checkInTime: getValue("checkInTime") || "15:00",
      checkOut: getValue("checkOut"),
      checkOutTime: getValue("checkOutTime") || "11:00",
      guests: Number(getValue("guests")) || 2,
      addedAt: new Date().toLocaleString("zh-TW")
    });

    saveAppData();
    alert("已加入購物車。");
    renderAll();
  } catch (error) {
    console.error("加入購物車失敗：", error);
    alert("系統處理失敗，請重新操作。");
  }
}

function renderCart() {
  const cartList = document.getElementById("cartList");
  if (!cartList) return;

  if (!isLoggedIn || !currentUser) {
    cartList.innerHTML = `<div class="notice warning">請先登入後查看購物車。</div>`;
    return;
  }

  const userCart = getUserSavedItems(cart);

  if (userCart.length === 0) {
    cartList.innerHTML = `<div class="notice warning">購物車目前沒有房源。</div>`;
    return;
  }

  cartList.innerHTML = buildCartRoomCards(userCart);
}

function getUserSavedItems(items) {
  return items.filter(item =>
    String(item.userId || currentUser.id) === String(currentUser.id)
  );
}

function getLodgingOrderPricing(pricePerNight, nights) {
  const unitPrice = Number(pricePerNight) || 0;
  const stayNights = Number(nights) || 0;
  const originalAmount = unitPrice * stayNights;
  const discountEligible = stayNights >= LODGING_LONG_STAY_DISCOUNT_MIN_NIGHTS && originalAmount > 0;
  const finalAmount = discountEligible
    ? Math.round(originalAmount * LODGING_LONG_STAY_DISCOUNT_RATE)
    : originalAmount;
  const discountAmount = Math.max(0, originalAmount - finalAmount);

  return {
    originalAmount,
    amount: finalAmount,
    discountEligible,
    discountAmount,
    discountRate: discountEligible ? LODGING_LONG_STAY_DISCOUNT_RATE : 1,
    discountLabel: discountEligible ? LODGING_LONG_STAY_DISCOUNT_LABEL : ""
  };
}

// ===== 建立收藏 / 購物車表格 =====
function buildSimpleRoomTable(items, type) {
  const isCart = type === "cart";

  return `
    <table>
      <thead>
        <tr>
          <th>房源</th>
          <th>地點</th>
          ${isCart ? "<th>房型</th>" : ""}
          ${isCart ? "<th>入住資訊</th>" : ""}
          <th>最低價格</th>
          <th>加入時間</th>
          <th>操作</th>
        </tr>
      </thead>

      <tbody>
        ${items.map(item => {
          const room = getSavedRoom(item);
          if (!room) {
            return `
              <tr>
                <td colspan="${isCart ? 7 : 5}">房源已下架或不存在。</td>
              </tr>
            `;
          }

          const selectedTypeId = getSavedSelectedRoomTypeId(item, room);
          const selectedType = getRoomTypeById(room, selectedTypeId);

          return `
            <tr>
              <td>${escapeHtml(room.name)}</td>
              <td>${escapeHtml(room.location || "未提供")}</td>
              ${isCart ? `
                <td>
                  <div class="cart-room-type-container">
                    <select class="cart-room-type-select" onchange="updateCartRoomType(${room.id}, this.value)">
                      ${renderCartRoomTypeOptions(room, selectedTypeId)}
                    </select>
                    <div class="cart-room-type-info">${renderCartRoomTypeSummary(selectedType)}</div>
                  </div>
                </td>
              ` : ""}
              ${isCart ? `<td>${renderCartBookingInputs(item, room)}</td>` : ""}
              <td>NT$ ${Number(isCart && selectedType ? selectedType.price : getLowestRoomTypePrice(room)).toLocaleString()}</td>
              <td>${escapeHtml(item.addedAt || "舊資料")}</td>
              <td>
                <button class="secondary-btn" onclick="showRoomDetail(${room.id})">查看</button>
                ${isCart ? `<button class="primary-btn" onclick="createOrder(${room.id}, 'cart')">建立訂單</button>` : ""}
                <button class="danger-btn" onclick="removeSavedRoom('${type}', ${room.id})">移除</button>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
}

function buildFavoriteRoomCards(items) {
  return `
    <div class="favorite-card-list">
      ${items.map(item => {
        const room = getSavedRoom(item);
        if (!room) {
          return `
            <article class="favorite-item-card unavailable">
              <div class="notice warning">房源已下架或不存在。</div>
              <button type="button" class="danger-btn" onclick="removeSavedRoom('favorite', ${Number(item.roomId || item.id) || 0})">移除</button>
            </article>
          `;
        }

        const lowestPrice = Number(getLowestRoomTypePrice(room)) || 0;

        return `
          <article class="favorite-item-card">
            <div>
              <span class="saved-list-eyebrow">${escapeHtml(room.location || "未提供地點")}</span>
              <h3>${escapeHtml(room.name)}</h3>
              <p>${escapeHtml(room.address || "未提供地址")}</p>
              <div class="saved-list-meta">
                <span>評價 ${Number(room.rating || 0).toFixed(1)}</span>
                <span>最多 ${getMaxRoomTypeCapacity(room)} 人</span>
                <span>${escapeHtml(room.stationDistance || "距離未提供")}</span>
              </div>
            </div>
            <div class="saved-list-price">
              <span>最低價</span>
              <strong>NT$ ${lowestPrice.toLocaleString()}</strong>
              <small>收藏時間：${escapeHtml(item.addedAt || "舊資料")}</small>
            </div>
            <div class="saved-list-actions">
              <button type="button" class="secondary-btn" onclick="showRoomDetail(${room.id})">查看</button>
              <button type="button" class="primary-btn" onclick="addCart(${room.id})">加入購物車</button>
              <button type="button" class="danger-btn" onclick="removeSavedRoom('favorite', ${room.id})">移除</button>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function buildCartRoomCards(items) {
  return `
    <div class="cart-card-list">
      ${items.map(item => {
        const room = getSavedRoom(item);
        if (!room) {
          return `
            <article class="cart-item-card unavailable">
              <div class="notice warning">房源已下架或不存在。</div>
              <button type="button" class="danger-btn" onclick="removeSavedRoom('cart', ${Number(item.roomId || item.id) || 0})">移除</button>
            </article>
          `;
        }

        const selectedTypeId = getSavedSelectedRoomTypeId(item, room);
        const selectedType = getRoomTypeById(room, selectedTypeId);
        const price = Number(selectedType ? selectedType.price : getLowestRoomTypePrice(room)) || 0;

        return `
          <article class="cart-item-card">
            <div class="cart-room-summary-card">
              <div class="cart-room-copy">
                <span class="cart-room-eyebrow">${escapeHtml(room.location || "未提供地點")}</span>
                <h3>${escapeHtml(room.name)}</h3>
                <p>${escapeHtml(room.address || "未提供地址")}</p>
                <div class="cart-room-mini-meta">
                  <span>評價 ${Number(room.rating || 0).toFixed(1)}</span>
                  <span>最多 ${getMaxRoomTypeCapacity(room)} 人</span>
                  <span>${escapeHtml(room.stationDistance || "距離未提供")}</span>
                </div>
              </div>
            </div>

            <div class="cart-room-type-container">
              <label for="cartRoomType-${Number(room.id)}">選擇房型</label>
              <select id="cartRoomType-${Number(room.id)}" class="cart-room-type-select" onchange="updateCartRoomType(${room.id}, this.value)">
                ${renderCartRoomTypeOptions(room, selectedTypeId)}
              </select>
              <div class="cart-room-type-info">${renderCartRoomTypeSummary(selectedType)}</div>
            </div>

            ${renderCartBookingInputs(item, room)}

            <aside class="cart-checkout-panel">
              <span>單晚價格</span>
              <strong>NT$ ${price.toLocaleString()}</strong>
              <small>加入時間：${escapeHtml(item.addedAt || "舊資料")}</small>
              <div class="cart-checkout-actions">
                <button type="button" class="secondary-btn" onclick="showRoomDetail(${room.id})">查看</button>
                <button type="button" class="primary-btn" onclick="createOrder(${room.id}, 'cart')">建立訂單</button>
                <button type="button" class="danger-btn" onclick="removeSavedRoom('cart', ${room.id})">移除</button>
              </div>
            </aside>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function renderCartBookingInputs(item, room) {
  const booking = getCartBookingValues(item, room);
  const roomId = Number(room.id);
  const checkOutMin = booking.checkIn ? getCartDateInputOffset(booking.checkIn, 1) : "";

  return `
    <div class="cart-booking-fields">
      <div class="cart-booking-heading">
        <div>
          <span>入住資訊</span>
          <strong>日期、人數與時間</strong>
        </div>
        <small>可直接在購物車調整</small>
      </div>

      <div class="cart-stay-block checkin">
        <span class="cart-stay-badge">IN</span>
        <div>
          <label for="cartCheckIn-${roomId}">入住日期</label>
          <input
            id="cartCheckIn-${roomId}"
            type="date"
            min="${escapeHtml(getCartDateInputOffset(getCartTodayInputValue(), 1))}"
            value="${escapeHtml(booking.checkIn)}"
            onchange="updateCartBookingField(${roomId}, 'checkIn', this.value)"
          />
        </div>
        <div>
          <label for="cartCheckInTime-${roomId}">入住時間</label>
          <input
            id="cartCheckInTime-${roomId}"
            type="time"
            value="${escapeHtml(booking.checkInTime)}"
            onchange="updateCartBookingField(${roomId}, 'checkInTime', this.value)"
          />
        </div>
      </div>

      <div class="cart-stay-connector"><span>至</span></div>

      <div class="cart-stay-block checkout">
        <span class="cart-stay-badge">OUT</span>
        <div>
          <label for="cartCheckOut-${roomId}">退房日期</label>
          <input
            id="cartCheckOut-${roomId}"
            type="date"
            min="${escapeHtml(checkOutMin)}"
            value="${escapeHtml(booking.checkOut)}"
            onchange="updateCartBookingField(${roomId}, 'checkOut', this.value)"
          />
        </div>
        <div>
          <label for="cartCheckOutTime-${roomId}">退房時間</label>
          <input
            id="cartCheckOutTime-${roomId}"
            type="time"
            value="${escapeHtml(booking.checkOutTime)}"
            onchange="updateCartBookingField(${roomId}, 'checkOutTime', this.value)"
          />
        </div>
      </div>

      <div class="cart-guest-control">
        <label for="cartGuests-${roomId}">入住人數</label>
        <input
          id="cartGuests-${roomId}"
          type="number"
          min="1"
          value="${escapeHtml(String(booking.guests))}"
          onchange="updateCartBookingField(${roomId}, 'guests', this.value)"
        />
      </div>
      <div class="cart-booking-summary ${booking.summaryType}">
        ${escapeHtml(booking.summary)}
      </div>
    </div>
  `;
}

function getCartBookingValues(item, room) {
  const checkIn = item.checkIn || "";
  const checkOut = item.checkOut || "";
  const checkInTime = item.checkInTime || getRoomCheckInTime(room);
  const checkOutTime = item.checkOutTime || getRoomCheckOutTime(room);
  const guests = Number(item.guests || 2);
  const nights = checkIn && checkOut ? getBookingNights(checkIn, checkOut) : 0;

  if (!checkIn || !checkOut) {
    return {
      checkIn,
      checkInTime,
      checkOut,
      checkOutTime,
      guests,
      nights,
      summary: "請選擇入住與退房日期",
      summaryType: "is-warning"
    };
  }

  if (nights <= 0) {
    return {
      checkIn,
      checkInTime,
      checkOut,
      checkOutTime,
      guests,
      nights,
      summary: "退房日期需晚於入住日期",
      summaryType: "is-warning"
    };
  }

  return {
    checkIn,
    checkInTime,
    checkOut,
    checkOutTime,
    guests,
    nights,
    summary: `共 ${nights} 晚，${guests} 人`,
    summaryType: ""
  };
}

function getSavedRoom(item) {
  return findRoom(item.roomId || item.id);
}

function getSavedSelectedRoomTypeId(item, room) {
  const preferredTypeId = item.selectedTypeId || selectedRoomTypes[room.id];
  const preferredType = getRoomTypeById(room, preferredTypeId);

  if (preferredType) {
    selectedRoomTypes[room.id] = preferredType.id;
    item.selectedTypeId = preferredType.id;
    return preferredType.id;
  }

  const firstAvailableType = Array.isArray(room.roomTypes)
    ? room.roomTypes.find(type => Number(type.stock) > 0) || room.roomTypes[0]
    : null;

  if (!firstAvailableType) return "";

  selectedRoomTypes[room.id] = firstAvailableType.id;
  item.selectedTypeId = firstAvailableType.id;
  return firstAvailableType.id;
}

function getRoomTypeById(room, typeId) {
  if (!room || !Array.isArray(room.roomTypes)) return null;
  return room.roomTypes.find(type => String(type.id) === String(typeId)) || null;
}

function renderCartRoomTypeOptions(room, selectedTypeId) {
  if (!Array.isArray(room.roomTypes) || room.roomTypes.length === 0) {
    return `<option value="">尚未設定房型</option>`;
  }

  return room.roomTypes.map(type => {
    const stock = Number(type.stock || 0);
    const stockStatus = stock > 0 ? `有房 ${stock}` : "客滿";
    const stockIcon = stock > 0 ? "" : "";
    return `
      <option value="${escapeHtml(type.id)}" ${String(type.id) === String(selectedTypeId) ? "selected" : ""} ${stock <= 0 ? "disabled" : ""}>
        ${stockIcon} ${escapeHtml(type.name)} • NT$ ${Number(type.price || 0).toLocaleString()} • ${stockStatus}
      </option>
    `;
  }).join("");
}

function renderCartRoomTypeSummary(type) {
  if (!type) return "（請先選擇房型）";
  const stock = Number(type.stock || 0);
  const stockStatus = stock > 0 ? "✓ 可訂" : "✗ 客滿";
  const capacity = type.capacity || "-";
  return `${stockStatus} • ${escapeHtml(type.name)} • ${capacity}人 • ${escapeHtml(type.bedType || "未提供")}`;
}

function updateCartRoomType(roomId, typeId) {
  if (!requireCustomer()) return;

  const room = findRoom(roomId);
  const roomType = getRoomTypeById(room, typeId);

  if (!roomType) {
    alert("找不到此房型，請重新選擇。");
    renderAll();
    return;
  }

  const item = cart.find(cartItem =>
    Number(cartItem.roomId || cartItem.id) === Number(roomId) &&
    String(cartItem.userId || currentUser.id) === String(currentUser.id)
  );

  if (item) {
    item.selectedTypeId = roomType.id;
  }

  selectedRoomTypes[roomId] = roomType.id;
  saveAppData();
  renderCart();
}

function updateCartBookingField(roomId, field, value) {
  if (!requireCustomer()) return;

  const item = getCartItem(roomId);
  if (!item) {
    showDialogNotice("error", "找不到購物車項目，請重新加入房源。");
    renderCart();
    return;
  }

  if (field === "guests") {
    item.guests = Number(value) || 0;
  } else {
    item[field] = value;
  }

  if (field === "checkIn" && item.checkIn) {
    const minimumCheckOut = getCartDateInputOffset(item.checkIn, 1);
    if (!item.checkOut || item.checkOut <= item.checkIn) {
      item.checkOut = minimumCheckOut;
    }
  }

  saveAppData();
  renderCart();
}

function getCartSelectedRoomType(room) {
  if (!room || !currentUser) return null;

  const item = getCartItem(room.id);

  if (!item) return null;

  return getRoomTypeById(room, item.selectedTypeId);
}

function getCartItem(roomId) {
  if (!currentUser) return null;

  return cart.find(cartItem =>
    Number(cartItem.roomId || cartItem.id) === Number(roomId) &&
    String(cartItem.userId || currentUser.id) === String(currentUser.id)
  ) || null;
}

function validateCartBookingInputs(roomId) {
  const room = findRoom(roomId);
  const item = getCartItem(roomId);

  if (!item || !room) {
    showDialogNotice("error", "找不到購物車入住資訊，請重新選擇。");
    return { valid: false };
  }

  const booking = getCartBookingValues(item, room);
  const guests = Number(booking.guests);

  if (!booking.checkIn || !booking.checkOut || !guests) {
    showDialogNotice("error", "請在購物車補齊入住日期、退房日期與人數。");
    return { valid: false };
  }

  if (!Number.isInteger(guests) || guests <= 0) {
    showDialogNotice("error", "人數需為大於 0 的整數。");
    return { valid: false };
  }

  const start = new Date(`${booking.checkIn}T${booking.checkInTime}`);
  const end = new Date(`${booking.checkOut}T${booking.checkOutTime}`);
  const startDateOnly = new Date(booking.checkIn);
  const endDateOnly = new Date(booking.checkOut);

  if (Number.isNaN(startDateOnly.getTime()) || Number.isNaN(endDateOnly.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    showDialogNotice("error", "日期或時間格式錯誤，請重新選擇。");
    return { valid: false };
  }

  const hoursBeforeCheckIn = (start - new Date()) / (1000 * 60 * 60);

  if (booking.nights <= 0) {
    showDialogNotice("error", "退房日期不可早於或等於入住日期。");
    return { valid: false };
  }

  if (hoursBeforeCheckIn < 24) {
    showDialogNotice("error", "需至少提前 24 小時預約。");
    return { valid: false };
  }

  if (booking.nights > 30) {
    showDialogNotice("error", "預訂期間不可超過 30 天。");
    return { valid: false };
  }

  return {
    valid: true,
    checkIn: booking.checkIn,
    checkInTime: booking.checkInTime,
    checkOut: booking.checkOut,
    checkOutTime: booking.checkOutTime,
    guests,
    nights: booking.nights
  };
}

function getDirectOrderBookingInputs(room) {
  const defaultCheckIn = getDirectOrderDefaultCheckIn(room);
  const rawCheckIn = getValue("checkIn");
  const rawCheckOut = getValue("checkOut");
  let checkIn = isValidDirectOrderDate(rawCheckIn) ? rawCheckIn : defaultCheckIn;
  let checkOut = isValidDirectOrderDate(rawCheckOut) ? rawCheckOut : "";

  if (!checkOut || checkOut <= checkIn) {
    checkOut = getCartDateInputOffset(checkIn, 1);
  }

  const guests = Number(getValue("guests")) || 2;
  const checkInTime = getValue("checkInTime") || getRoomCheckInTime(room);
  const checkOutTime = getValue("checkOutTime") || getRoomCheckOutTime(room);
  const start = new Date(`${checkIn}T${checkInTime}`);
  const end = new Date(`${checkOut}T${checkOutTime}`);
  const startDateOnly = new Date(checkIn);
  const endDateOnly = new Date(checkOut);

  if (!checkIn || !checkOut || Number.isNaN(startDateOnly.getTime()) || Number.isNaN(endDateOnly.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    showDialogNotice("error", "日期格式不正確，請重新選擇入住與退房日期。");
    return { valid: false };
  }

  if (!Number.isInteger(guests) || guests <= 0) {
    showDialogNotice("error", "入住人數必須為 1 人以上。");
    return { valid: false };
  }

  const nights = getBookingNights(checkIn, checkOut);
  const hoursBeforeCheckIn = (start - new Date()) / (1000 * 60 * 60);

  if (nights <= 0) {
    showDialogNotice("error", "退房日期必須晚於入住日期。");
    return { valid: false };
  }

  if (hoursBeforeCheckIn < 24) {
    showDialogNotice("error", "入住時間需至少晚於現在 24 小時。");
    return { valid: false };
  }

  if (nights > 30) {
    showDialogNotice("error", "單筆訂單最多可預訂 30 晚。");
    return { valid: false };
  }

  return {
    valid: true,
    checkIn,
    checkInTime,
    checkOut,
    checkOutTime,
    guests,
    nights
  };
}

function getDirectOrderDefaultCheckIn(room) {
  let checkIn = getCartDateInputOffset(getCartTodayInputValue(), 2);

  if (room && isValidDirectOrderDate(room.bookingStart) && room.bookingStart > checkIn) {
    checkIn = room.bookingStart;
  }

  if (room && isValidDirectOrderDate(room.bookingEnd) && checkIn >= room.bookingEnd) {
    const latestCheckIn = getCartDateInputOffset(room.bookingEnd, -1);
    if (isValidDirectOrderDate(latestCheckIn)) {
      checkIn = latestCheckIn;
    }
  }

  return checkIn;
}

function isValidDirectOrderDate(value) {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

function getCartTodayInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCartDateInputOffset(value, offset) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setDate(date.getDate() + Number(offset || 0));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function removeSavedRoom(type, roomId) {
  const list = type === "cart" ? cart : favorites;
  const index = list.findIndex(item =>
    Number(item.roomId || item.id) === Number(roomId) &&
    String(item.userId || currentUser.id) === String(currentUser.id)
  );

  if (index >= 0) {
    list.splice(index, 1);
    saveAppData();
    renderAll();
  }
}

// ===== 建立訂單 =====
async function createOrder(roomId, source = "search") {
  if (!requireCustomer()) return;

  let pendingOrder = null;

  try {
    const room = findRoom(roomId);

    if (!isRoomSelectable(room)) {
      showDialogNotice("error", "房源已下架或不可預訂，無法建立訂單。");
      return;
    }

    const booking = source === "cart"
      ? validateCartBookingInputs(room.id)
      : getDirectOrderBookingInputs(room);
    if (!booking.valid) return;

    // 按下「建立訂單」當下，先針對「即將入住的日期 / Check-in 時間」與行程中已安排的車票做衝突預警，
    // 讓使用者在訂單真正成立之前就能注意到（不影響後續下單流程，純粹是提早提醒）。
    if (typeof checkProspectiveBookingConflict === "function") {
      checkProspectiveBookingConflict({
        date: booking.checkIn,
        type: "lodging",
        time: booking.checkInTime,
        label: room.name
      });
    }

    if (!isRoomAvailableForBooking(room, booking.checkIn, booking.checkOut)) {
      showDialogNotice("warning", "此房源不在可訂期間內或目前無可售房型。");
      return;
    }

    const selectedType = source === "cart"
      ? getCartSelectedRoomType(room) || getSelectedRoomType(room)
      : getSelectedRoomType(room) || getCartSelectedRoomType(room);

    if (!selectedType) {
      showDialogNotice("warning", "請先選擇房型。");
      return;
    }

    selectedRoomTypes[room.id] = selectedType.id;

    if (booking.guests > Number(selectedType.capacity || 0)) {
      showDialogNotice("warning", "入住人數超過此房型可入住人數。");
      return;
    }

    const availableStock = getAvailableRoomTypeStock(room.id, selectedType.id, booking.checkIn, booking.checkOut);

    if (availableStock <= 0) {
      createFailedOverlapOrder(room, selectedType, booking);
      return;
    }

    const pricePerNight = Number(selectedType.price) || Number(room.price) || 0;
    const pricing = getLodgingOrderPricing(pricePerNight, booking.nights);
    const totalAmount = pricing.amount;

    if (totalAmount <= 0) {
      showDialogNotice("error", "價格計算失敗，請重新操作。");
      return;
    }

    const confirmed = await showOrderConfirmDialog({
      room,
      selectedType,
      booking,
      pricePerNight,
      pricing
    });

    if (!confirmed) return;

    const bankDueAtTimestamp = Date.now() + 24 * 60 * 60 * 1000;

    const order = {
      id: Date.now(),
      userId: currentUser.id,
      userName: currentUser.displayName || currentUser.account,
      userAccount: currentUser.account,
      roomId: room.id,
      roomName: room.name,
      roomTypeId: selectedType.id,
      roomTypeName: selectedType.name,
      roomTypeCapacity: selectedType.capacity,
      bedType: selectedType.bedType,
      location: room.location,
      address: room.address,
      checkIn: booking.checkIn,
      checkInTime: booking.checkInTime,
      checkOut: booking.checkOut,
      checkOutTime: booking.checkOutTime,
      nights: booking.nights,
      people: booking.guests,
      pricePerNight,
      originalAmount: pricing.originalAmount,
      amount: pricing.amount,
      discountEligible: pricing.discountEligible,
      discountRate: pricing.discountRate,
      discountAmount: pricing.discountAmount,
      discountLabel: pricing.discountLabel,
      discountStatus: pricing.discountEligible ? "付款成功後套用" : "",
      bookingStatus: "已確認",
      paymentStatus: "未付款",
      status: "已確認 / 未付款",
      refundAmount: 0,
      refundStatus: "",
      bankDueAt: new Date(bankDueAtTimestamp).toLocaleString("zh-TW"),
      bankDueAtTimestamp,
      createdAt: new Date().toLocaleString("zh-TW"),
      createdAtTimestamp: Date.now()
    };

    pendingOrder = order;
    orders.unshift(order);
    cart = cart.filter(item =>
      !(Number(item.roomId || item.id) === Number(room.id) &&
        String(item.userId || currentUser.id) === String(currentUser.id))
    );

    if (typeof integrateLodgingOrderToItinerary === "function") {
      integrateLodgingOrderToItinerary(order);
    }

    saveAppData();
    showDialogNotice("success", "訂單建立成功，系統已自動確認訂單。請至歷史訂單完成銀行轉帳付款。");
    showSection("orders");
  } catch (error) {
    console.error("建立訂單失敗：", error);
    if (pendingOrder) {
      pendingOrder.manualReviewStatus = "待人工處理";
      pendingOrder.manualReviewReason = "訂單建立後狀態更新失敗";
      pendingOrder.status = `${pendingOrder.status || "已確認"} / 待人工處理`;
    }
    queueManualReview("order-create-failure", error, {
      orderId: pendingOrder ? pendingOrder.id : "",
      roomId
    });
    showDialogNotice("error", "系統建立訂單失敗，已進入人工處理，請稍後由客服協助。");
  }
}

function showOrderConfirmDialog({ room, selectedType, booking, pricePerNight, pricing }) {
  if (typeof document === "undefined" || !document.body) {
    return Promise.resolve(false);
  }

  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    const roomName = escapeHtml(room.name || "未命名房源");
    const roomTypeName = escapeHtml(selectedType.name || "未命名房型");
    const checkInLabel = escapeHtml(getOrderDialogDateLabel(booking.checkIn));
    const checkOutLabel = escapeHtml(getOrderDialogDateLabel(booking.checkOut));
    const priceText = Number(pricePerNight || 0).toLocaleString();
    const priceSummary = pricing || getLodgingOrderPricing(pricePerNight, booking.nights);
    const originalText = Number(priceSummary.originalAmount || 0).toLocaleString();
    const discountText = Number(priceSummary.discountAmount || 0).toLocaleString();
    const totalText = Number(priceSummary.amount || 0).toLocaleString();
    const discountRow = priceSummary.discountEligible ? `
          <div>
            <span>${escapeHtml(priceSummary.discountLabel)}</span>
            <strong>- NT$ ${discountText}</strong>
          </div>
    ` : "";

    dialog.className = "order-confirm-dialog";
    dialog.innerHTML = `
      <div class="order-confirm-card">
        <button type="button" class="order-confirm-close" aria-label="取消建立訂單">&times;</button>
        <div class="order-confirm-heading">
          <span>訂單確認</span>
          <h3>建立住宿訂單</h3>
          <p>請確認入住資訊、房型與付款金額，確認後系統會建立訂單並保留房型庫存。</p>
        </div>

        <div class="order-confirm-stay">
          <div class="order-confirm-date-card">
            <span>入住</span>
            <strong>${checkInLabel}</strong>
            <small>${escapeHtml(booking.checkInTime || "15:00")}</small>
          </div>
          <div class="order-confirm-date-divider">至</div>
          <div class="order-confirm-date-card checkout">
            <span>退房</span>
            <strong>${checkOutLabel}</strong>
            <small>${escapeHtml(booking.checkOutTime || "11:00")}</small>
          </div>
        </div>

        <div class="order-confirm-detail-grid">
          <div>
            <span>房源</span>
            <strong>${roomName}</strong>
          </div>
          <div>
            <span>房型</span>
            <strong>${roomTypeName}</strong>
          </div>
          <div>
            <span>入住人數</span>
            <strong>${Number(booking.guests || 0)} 人</strong>
          </div>
          <div>
            <span>住宿晚數</span>
            <strong>${Number(booking.nights || 0)} 晚</strong>
          </div>
        </div>

        <div class="order-confirm-total">
          <div>
            <span>單晚房價</span>
            <strong>NT$ ${priceText}</strong>
          </div>
          <div>
            <span>原始總額</span>
            <strong>NT$ ${originalText}</strong>
          </div>
          ${discountRow}
          <div>
            <span>應付總金額</span>
            <strong>NT$ ${totalText}</strong>
          </div>
        </div>

        <div class="order-confirm-actions">
          <button type="button" class="secondary-btn order-confirm-cancel">取消</button>
          <button type="button" class="primary-btn order-confirm-submit">建立訂單</button>
        </div>
      </div>
    `;

    let resolved = false;
    const finish = confirmed => {
      if (resolved) return;
      resolved = true;
      resolve(confirmed);

      if (dialog.open && typeof dialog.close === "function") {
        dialog.close();
      }

      dialog.remove();
    };

    dialog.querySelector(".order-confirm-close").addEventListener("click", () => finish(false));
    dialog.querySelector(".order-confirm-cancel").addEventListener("click", () => finish(false));
    dialog.querySelector(".order-confirm-submit").addEventListener("click", () => finish(true));
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      finish(false);
    });
    dialog.addEventListener("click", event => {
      if (event.target === dialog) {
        finish(false);
      }
    });

    document.body.appendChild(dialog);

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
      dialog.classList.add("is-open");
    }

    const submitButton = dialog.querySelector(".order-confirm-submit");
    if (submitButton) {
      submitButton.focus();
    }
  });
}

function getOrderDialogDateLabel(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value || "未指定";

  return date.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  });
}

// ===== 渲染訂單列表 =====
function renderOrders() {
  const orderList = document.getElementById("orderList");
  if (!orderList) return;

  try {
  if (!isLoggedIn || !currentUser) {
    orderList.innerHTML = `<div class="notice warning">請先登入後查看歷史訂單。</div>`;
    return;
  }

  const visibleOrders = orders.filter(order =>
    isAdmin() || String(order.userId) === String(currentUser.id)
  );

  if (visibleOrders.length === 0) {
    orderList.innerHTML = `<div class="notice warning">無訂單資料。</div>`;
    return;
  }

  orderList.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>訂單時間</th>
          <th>房源 / 房型</th>
          <th>入住資訊</th>
          <th>價格明細</th>
          <th>狀態</th>
          <th>操作</th>
        </tr>
      </thead>

      <tbody>
        ${visibleOrders.map(order => `
          <tr>
            <td>${escapeHtml(order.createdAt)}</td>
            <td>
              ${escapeHtml(order.roomName)}
              <br>
              <small>${escapeHtml(order.roomTypeName || "未指定房型")}｜${escapeHtml(order.bedType || "床型未提供")}</small>
            </td>
            <td>
              ${escapeHtml(formatOrderStayPeriod(order))}
              <br>
              <small>${Number(order.people || 0)} 人｜${Number(order.nights || 1)} 晚</small>
            </td>
            <td>
              ${renderOrderPriceDetails(order)}
            </td>
            <td>
              <span class="order-status">${escapeHtml(getOrderStatusText(order))}</span>
              ${order.bankDueAt && order.paymentStatus === "未付款" ? `<br><small>付款期限：${escapeHtml(order.bankDueAt)}</small>` : ""}
              ${order.refundStatus ? `<br><small>${escapeHtml(order.refundStatus)}：NT$ ${Number(order.refundAmount || 0).toLocaleString()}</small>` : ""}
              ${order.manualReviewStatus ? `<br><small class="manual-review-note">${escapeHtml(order.manualReviewStatus)}：${escapeHtml(order.manualReviewReason || "系統更新失敗")}</small>` : ""}
            </td>
            <td>
              ${renderOrderActions(order)}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  } catch (error) {
    console.error("歷史訂單讀取失敗：", error);
    orderList.innerHTML = `<div class="notice error">歷史訂單讀取失敗，請重新整理或稍後再試。</div>`;
  }
}

function renderOrderActions(order) {
  if (order.bookingStatus === "無法成立") {
    return `
      <div class="notice warning">
        後順位訂單已自動取消，系統已補償 ${Number(order.compensationPoints || 0)} 點紅利。
      </div>
    `;
  }

  if (isAdmin()) {
    const disabled = order.bookingStatus === "已取消" ? "disabled" : "";

    return `
      <div class="order-admin-actions">
        <button class="secondary-btn" ${disabled} onclick="adminUpdateOrderStatus(${order.id}, '已退房')">設為已退房</button>
        <button class="primary-btn" ${disabled} onclick="adminUpdateOrderStatus(${order.id}, '已完成')">設為已完成</button>
      </div>
      ${order.adminUpdatedAt ? `<small>最後更新：${escapeHtml(order.adminUpdatedAt)}</small>` : ""}
    `;
  }

  return `
    <div class="order-action-stack">
      <button class="secondary-btn" onclick="payOrder(${order.id})">銀行轉帳付款</button>
      <button class="danger-btn" onclick="cancelOrder(${order.id})">取消 / 退款</button>
      ${renderReviewAction(order)}
    </div>
  `;
}

function renderReviewAction(order) {
  if (order.review) {
    return `<span class="review-submitted-chip">已評價</span>`;
  }

  return `
    <button class="secondary-btn" onclick="toggleReviewForm(${order.id})">評價</button>
    <div id="reviewForm-${order.id}" class="order-review-form hidden">
      <label for="reviewRating-${order.id}">評分</label>
      <select id="reviewRating-${order.id}">
        <option value="5">5 星</option>
        <option value="4">4 星</option>
        <option value="3">3 星</option>
        <option value="2">2 星</option>
        <option value="1">1 星</option>
      </select>
      <label for="reviewComment-${order.id}">入住體驗</label>
      <textarea id="reviewComment-${order.id}" rows="3" placeholder="請輸入這次住宿體驗"></textarea>
      <button class="primary-btn" onclick="submitReviewFromForm(${order.id})">送出評價</button>
    </div>
  `;
}

function formatOrderStayPeriod(order) {
  const checkInTime = order.checkInTime ? ` ${order.checkInTime}` : "";
  const checkOutTime = order.checkOutTime ? ` ${order.checkOutTime}` : "";
  return `${order.checkIn || "未指定"}${checkInTime} ~ ${order.checkOut || "未指定"}${checkOutTime}`;
}

function renderOrderPriceDetails(order) {
  const amount = Number(order.amount || 0);
  const pricePerNight = Number(order.pricePerNight || order.amount || 0);
  const originalAmount = Number(order.originalAmount || amount);
  const discountAmount = Number(order.discountAmount || 0);
  const discountLabel = order.discountLabel || "";
  const hasDiscount = discountAmount > 0 && originalAmount > amount;

  return `
    NT$ ${amount.toLocaleString()}
    <br>
    <small>NT$ ${pricePerNight.toLocaleString()} / 晚</small>
    ${hasDiscount ? `
      <br>
      <small>${escapeHtml(discountLabel)}：原價 NT$ ${originalAmount.toLocaleString()}，折抵 NT$ ${discountAmount.toLocaleString()}</small>
    ` : ""}
  `;
}

function queueManualReview(type, error, payload = {}) {
  if (!Array.isArray(manualReviewQueue)) {
    manualReviewQueue = [];
  }

  const item = {
    id: `manual-${Date.now()}-${manualReviewQueue.length + 1}`,
    type,
    status: "待人工處理",
    message: error && error.message ? error.message : String(error || "系統更新失敗"),
    payload,
    createdAt: new Date().toLocaleString("zh-TW")
  };

  manualReviewQueue.unshift(item);
  return item;
}

function createFailedOverlapOrder(room, selectedType, booking) {
  const compensationPoints = 20;
  const failedOrder = {
    id: Date.now(),
    userId: currentUser.id,
    userName: currentUser.displayName || currentUser.account,
    userAccount: currentUser.account,
    roomId: room.id,
    roomName: room.name,
    roomTypeId: selectedType.id,
    roomTypeName: selectedType.name,
    roomTypeCapacity: selectedType.capacity,
    bedType: selectedType.bedType,
    location: room.location,
    address: room.address,
    checkIn: booking.checkIn,
    checkInTime: booking.checkInTime,
    checkOut: booking.checkOut,
    checkOutTime: booking.checkOutTime,
    nights: booking.nights,
    people: booking.guests,
    pricePerNight: Number(selectedType.price || room.price || 0),
    amount: 0,
    bookingStatus: "無法成立",
    paymentStatus: "免付款",
    status: "無法成立 / 已補償",
    refundAmount: 0,
    refundStatus: "",
    compensationPoints,
    overlapHandled: true,
    overlapReason: "指定日期房型庫存已被先成立訂單占用，後順位訂單自動取消。",
    createdAt: new Date().toLocaleString("zh-TW"),
    createdAtTimestamp: Date.now()
  };

  orders.unshift(failedOrder);

  if (typeof addBonusPoints === "function") {
    addBonusPoints(
      compensationPoints,
      `訂房重疊補償：${room.name} ${selectedType.name}`,
      "lodging-overlap-compensation",
      currentUser.id
    );
  }

  saveAppData();
  renderAll();
  showSection("orders");
  alert(`此房型在指定日期已有重疊訂單，後順位訂單已自動取消。系統已補償 ${compensationPoints} 點紅利。`);
}

function adminUpdateOrderStatus(orderId, nextStatus) {
  if (!requireAdmin()) return;

  try {
    const order = findOrder(orderId);
    if (!canOperateOrder(order)) return;

    if (order.bookingStatus === "已取消") {
      alert("已取消訂單不可改為退房或完成。");
      return;
    }

    if (nextStatus !== "已退房" && nextStatus !== "已完成") {
      alert("不支援的訂單狀態。");
      return;
    }

    order.bookingStatus = nextStatus;
    order.status = `${nextStatus} / ${order.paymentStatus || "未付款"}`;
    order.adminUpdatedAt = new Date().toLocaleString("zh-TW");
    order.adminUpdatedBy = currentUser.account;

    saveAppData();
    renderAll();
    alert(`訂單已更新為「${nextStatus}」，顧客可以進入歷史訂單提交評價。`);
  } catch (error) {
    console.error("管理員更新訂單狀態失敗：", error);
    alert("系統更新訂單狀態失敗，請重新操作。");
  }
}

// ===== 銀行轉帳付款 =====
async function payOrder(orderId) {
  if (!requireCustomer()) return;

  let order = null;

  try {
    order = findOrder(orderId);

    if (!canOperateOrder(order)) return;

    if (order.bookingStatus === "已取消") {
      showDialogNotice("warning", "已取消訂單不可付款。");
      return;
    }

    if (order.paymentStatus !== "未付款" && order.paymentStatus !== "付款異常") {
      showDialogNotice("warning", "此訂單不是未付款狀態。");
      return;
    }

    const dueAt = Number(order.bankDueAtTimestamp) || new Date(order.bankDueAt).getTime();

    if (dueAt && dueAt < Date.now()) {
      order.paymentStatus = "未付款";
      order.status = "付款逾期";
      saveAppData();
      renderAll();
      showDialogNotice("warning", "顧客未在期限內完成轉帳，訂單維持未付款狀態。");
      return;
    }

    const paidAmount = await showBankTransferDialog(order);

    if (paidAmount === null) return;

    const amount = Number(paidAmount);

    if (!amount || amount <= 0) {
      showDialogNotice("error", "付款金額格式錯誤，訂單維持未付款狀態。");
      return;
    }

    if (amount !== Number(order.amount)) {
      order.paymentStatus = "付款異常";
      order.status = "付款金額異常";
      saveAppData();
      renderAll();
      showDialogNotice("warning", "轉帳金額與訂單金額不符，系統已標記異常通知處理。");
      return;
    }

    order.paymentStatus = "已付款";
    order.bookingStatus = "已確認";
    order.status = "已付款";
    order.paidAt = new Date().toLocaleString("zh-TW");
    if (Number(order.discountAmount || 0) > 0) {
      order.discountStatus = "已套用";
      order.discountAppliedAt = order.paidAt;
    }

    if (typeof integrateLodgingOrderToItinerary === "function") {
      integrateLodgingOrderToItinerary(order);
    }

    saveAppData();
    renderAll();
    showDialogNotice("success", "付款成功，訂單狀態已更新為已付款。");
  } catch (error) {
    console.error("付款狀態更新失敗：", error);
    if (order) {
      order.paymentStatus = "付款異常";
      order.manualReviewStatus = "待人工處理";
      order.manualReviewReason = "銀行轉帳狀態更新失敗";
      order.status = "付款狀態更新失敗 / 待人工處理";
    }
    queueManualReview("payment-update-failure", error, {
      orderId
    });
    showDialogNotice("error", "付款狀態更新失敗，請重新操作或通知客服處理。");
  }
}

function showBankTransferDialog(order) {
  if (typeof document === "undefined" || !document.body) {
    return Promise.resolve(null);
  }

  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    const amountText = Number(order.amount || 0).toLocaleString();
    const dueAtText = escapeHtml(order.bankDueAt || "未指定");
    const orderName = escapeHtml(order.roomName || "住宿訂單");
    const stayPeriod = escapeHtml(formatOrderStayPeriod(order));
    const discountAmount = Number(order.discountAmount || 0);
    const originalAmount = Number(order.originalAmount || order.amount || 0);
    const discountNote = discountAmount > 0 ? `
            <small>${escapeHtml(order.discountLabel || LODGING_LONG_STAY_DISCOUNT_LABEL)}：原價 NT$ ${originalAmount.toLocaleString()}，折抵 NT$ ${discountAmount.toLocaleString()}</small>
    ` : "";

    dialog.className = "bank-transfer-dialog";
    dialog.innerHTML = `
      <div class="bank-transfer-card">
        <button type="button" class="bank-transfer-close" aria-label="取消付款">&times;</button>

        <div class="bank-transfer-heading">
          <span>銀行轉帳</span>
          <h3>確認付款資訊</h3>
          <p>請依下列帳戶完成轉帳，並輸入本次轉帳金額以模擬人工核帳。</p>
        </div>

        <div class="bank-transfer-summary">
          <div>
            <span>訂單</span>
            <strong>${orderName}</strong>
            <small>${stayPeriod}</small>
          </div>
          <div>
            <span>應付金額</span>
            <strong>NT$ ${amountText}</strong>
            ${discountNote}
            <small>付款期限：${dueAtText}</small>
          </div>
        </div>

        <div class="bank-transfer-account">
          <div>
            <span>銀行</span>
            <strong>808 玉山銀行</strong>
          </div>
          <div>
            <span>轉帳帳號</span>
            <strong>1234-5678-9000</strong>
          </div>
        </div>

        <label class="bank-transfer-input-label" for="bankTransferAmountInput">本次轉帳金額</label>
        <div class="bank-transfer-input-row">
          <span>NT$</span>
          <input id="bankTransferAmountInput" type="number" min="1" step="1" inputmode="numeric" placeholder="${amountText}" />
        </div>
        <p class="bank-transfer-helper">輸入金額需與應付金額完全相符，才會更新為已付款。</p>

        <div class="bank-transfer-actions">
          <button type="button" class="secondary-btn bank-transfer-cancel">取消</button>
          <button type="button" class="primary-btn bank-transfer-submit">確認付款</button>
        </div>
      </div>
    `;

    let resolved = false;
    const amountInput = dialog.querySelector("#bankTransferAmountInput");
    const finish = value => {
      if (resolved) return;
      resolved = true;
      resolve(value);

      if (dialog.open && typeof dialog.close === "function") {
        dialog.close();
      }

      dialog.remove();
    };

    dialog.querySelector(".bank-transfer-close").addEventListener("click", () => finish(null));
    dialog.querySelector(".bank-transfer-cancel").addEventListener("click", () => finish(null));
    dialog.querySelector(".bank-transfer-submit").addEventListener("click", () => finish(amountInput.value.trim()));
    amountInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        finish(amountInput.value.trim());
      }
    });
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      finish(null);
    });
    dialog.addEventListener("click", event => {
      if (event.target === dialog) {
        finish(null);
      }
    });

    document.body.appendChild(dialog);

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
      dialog.classList.add("is-open");
    }

    amountInput.focus();
  });
}

// ===== 取消訂單與退款 =====
function cancelOrder(orderId) {
  if (!requireCustomer()) return;

  try {
    const order = findOrder(orderId);
    if (!canOperateOrder(order)) return;

    if (order.bookingStatus === "已取消") {
      alert("此訂單已取消。");
      return;
    }

    const refund = calculateRefund(order);

    if (!refund.cancelable) {
      alert("訂單已超過可取消期限，無法取消。");
      return;
    }

    const confirmed = confirm(
      `${refund.ruleText}\n` +
      `可退款金額：NT$ ${refund.amount.toLocaleString()}\n` +
      `是否確認取消訂單？`
    );

    if (!confirmed) return;

    order.bookingStatus = "已取消";
    order.status = "已取消";
    order.refundAmount = refund.amount;
    order.refundStatus = order.paymentStatus === "已付款" ? "退款完成" : "未付款免退款";
    order.cancelledAt = new Date().toLocaleString("zh-TW");

    saveAppData();
    renderAll();
    alert(`取消完成。${order.refundStatus}，金額 NT$ ${refund.amount.toLocaleString()}。`);
  } catch (error) {
    console.error("取消與退款失敗：", error);
    alert("系統計算退款或更新訂單失敗，請重新操作或人工處理。");
  }
}

function calculateRefund(order) {
  const checkInDate = new Date(order.checkIn);

  if (!order.checkIn || Number.isNaN(checkInDate.getTime())) {
    throw new Error("入住日期錯誤");
  }

  const today = new Date();
  const daysBefore = Math.ceil((checkInDate - today) / (1000 * 60 * 60 * 24));

  if (daysBefore < 0) {
    return {
      cancelable: false,
      amount: 0,
      ruleText: "訂單已超過入住日期，無法取消。"
    };
  }

  if (order.paymentStatus !== "已付款") {
    return {
      cancelable: true,
      amount: 0,
      ruleText: "訂單尚未付款，取消後無退款金額。"
    };
  }

  if (daysBefore >= 10) {
    return {
      cancelable: true,
      amount: Number(order.amount) || 0,
      ruleText: "入住前 10 天以上：全額退款。"
    };
  }

  if (daysBefore >= 4) {
    return {
      cancelable: true,
      amount: Math.round((Number(order.amount) || 0) * 0.7),
      ruleText: "入住前 4 至 9 天：扣除 30%。"
    };
  }

  return {
    cancelable: true,
    amount: 0,
    ruleText: "入住前 3 天內：不予退款。"
  };
}

// ===== 評價功能 =====
function reviewOrder(orderId) {
  if (!requireCustomer()) return;

  try {
    const order = findOrder(orderId);
    const eligibility = getReviewEligibility(order);
    if (!eligibility.valid) {
      alert(eligibility.message);
      return;
    }

    const ratingValue = prompt("請輸入評分（1-5）：");
    if (ratingValue === null) return;

    const comment = prompt("請輸入入住體驗內容：");
    if (comment === null) return;

    submitReview(orderId, ratingValue, comment);
  } catch (error) {
    console.error("提交評價失敗：", error);
    alert("評價提交失敗，請重新操作。");
  }
}

function toggleReviewForm(orderId) {
  const form = document.getElementById(`reviewForm-${orderId}`);
  if (!form) return;
  form.classList.toggle("hidden");
}

function submitReviewFromForm(orderId) {
  const ratingValue = getValue(`reviewRating-${orderId}`);
  const comment = getValue(`reviewComment-${orderId}`);
  submitReview(orderId, ratingValue, comment);
}

function submitReview(orderId, ratingValue, commentValue) {
  if (!requireCustomer()) return;

  try {
    const order = findOrder(orderId);
    const eligibility = getReviewEligibility(order);
    if (!eligibility.valid) {
      alert(eligibility.message);
      return;
    }

    const rating = Number(ratingValue);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      alert("評分格式錯誤，請輸入 1 到 5 的整數。");
      return;
    }

    const comment = String(commentValue || "").trim();

    if (!comment) {
      alert("評價內容不可空白。");
      return;
    }

    const room = findRoom(order.roomId);
    if (!room) {
      alert("房源不存在，評價提交失敗。");
      return;
    }

    if (!Array.isArray(room.reviews)) {
      room.reviews = [];
    }

    const review = {
      orderId: order.id,
      userId: currentUser.id,
      userName: currentUser.displayName || currentUser.account,
      rating,
      comment,
      createdAt: new Date().toLocaleString("zh-TW")
    };

    room.reviews.unshift(review);
    order.review = review;
    order.bookingStatus = "已完成";
    order.status = "已完成";
    room.rating = calculateRoomRating(room);

    saveAppData();
    renderAll();
    alert("評價已提交並公開顯示在房源頁面。");
  } catch (error) {
    console.error("提交評價失敗：", error);
    alert("評價提交失敗，請重新操作。");
  }
}

function getReviewEligibility(order) {
  if (!canOperateOrder(order)) {
    return { valid: false, message: "找不到可評價的訂單。" };
  }

  if (order.bookingStatus === "已取消") {
    return { valid: false, message: "已取消訂單不可評價。" };
  }

  const reviewUnlockedByAdmin = order.bookingStatus === "已退房" || order.bookingStatus === "已完成";

  if (order.paymentStatus !== "已付款" && !reviewUnlockedByAdmin) {
    return { valid: false, message: "訂單尚未完成付款，無法提交評價。" };
  }

  if (!reviewUnlockedByAdmin && new Date(order.checkOut) > new Date()) {
    return { valid: false, message: "訂單尚未完成，退房後才能評價。" };
  }

  if (order.review) {
    return { valid: false, message: "此訂單已提交過評價。" };
  }

  return { valid: true, message: "" };
}

function calculateRoomRating(room) {
  const reviews = Array.isArray(room.reviews) ? room.reviews : [];

  if (reviews.length === 0) {
    return Number(room.rating) || 0;
  }

  const average = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length;
  return Math.round(average * 10) / 10;
}

// ===== 訂單檢核與狀態工具 =====
function getAvailableRoomTypeStock(roomId, roomTypeId, checkIn, checkOut, excludedOrderId = null) {
  const room = findRoom(roomId);
  if (!room || !Array.isArray(room.roomTypes)) return 0;

  const type = room.roomTypes.find(item => String(item.id) === String(roomTypeId));
  if (!type) return 0;

  const overlappedOrders = orders.filter(order =>
    Number(order.id) !== Number(excludedOrderId) &&
    Number(order.roomId) === Number(roomId) &&
    String(order.roomTypeId) === String(roomTypeId) &&
    order.bookingStatus !== "已取消" &&
    order.bookingStatus !== "無法成立" &&
    isDateRangeOverlap(checkIn, checkOut, order.checkIn, order.checkOut)
  );

  return Math.max(0, (Number(type.stock) || 0) - overlappedOrders.length);
}

function isDateRangeOverlap(startA, endA, startB, endB) {
  if (!startA || !endA || !startB || !endB) return false;
  return new Date(startA) < new Date(endB) && new Date(endA) > new Date(startB);
}

function canOperateOrder(order) {
  if (!order) {
    alert("找不到此訂單。");
    return false;
  }

  if (!isAdmin() && String(order.userId) !== String(currentUser.id)) {
    alert("無法操作其他顧客的訂單。");
    return false;
  }

  return true;
}

function isRoomSelectable(room) {
  return Boolean(
    room &&
    room.status !== "inactive" &&
    Array.isArray(room.roomTypes) &&
    room.roomTypes.some(type => Number(type.stock) > 0)
  );
}

function getOrderStatusText(order) {
  if (order.status) return order.status;
  return `${order.bookingStatus || "已確認"} / ${order.paymentStatus || "未付款"}`;
}
