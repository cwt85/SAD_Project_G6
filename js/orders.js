/* =========================================================
   購物車、訂單、付款、退款與評價功能 (orders.js)
========================================================= */

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

  favoriteList.innerHTML = buildSimpleRoomTable(userFavorites, "favorite");
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

  cartList.innerHTML = buildSimpleRoomTable(userCart, "cart");
}

function getUserSavedItems(items) {
  return items.filter(item =>
    String(item.userId || currentUser.id) === String(currentUser.id)
  );
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
                <td colspan="${isCart ? 6 : 5}">房源已下架或不存在。</td>
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
              <td>NT$ ${Number(isCart && selectedType ? selectedType.price : getLowestRoomTypePrice(room)).toLocaleString()}</td>
              <td>${escapeHtml(item.addedAt || "舊資料")}</td>
              <td>
                <button class="secondary-btn" onclick="showRoomDetail(${room.id})">查看</button>
                ${isCart ? `<button class="primary-btn" onclick="createOrder(${room.id})">建立訂單</button>` : ""}
                <button class="danger-btn" onclick="removeSavedRoom('${type}', ${room.id})">移除</button>
              </td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;
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

function getCartSelectedRoomType(room) {
  if (!room || !currentUser) return null;

  const item = cart.find(cartItem =>
    Number(cartItem.roomId || cartItem.id) === Number(room.id) &&
    String(cartItem.userId || currentUser.id) === String(currentUser.id)
  );

  if (!item) return null;

  return getRoomTypeById(room, item.selectedTypeId);
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
function createOrder(roomId) {
  if (!requireCustomer()) return;

  try {
    const room = findRoom(roomId);

    if (!isRoomSelectable(room)) {
      alert("房源已下架或不可預訂，無法建立訂單。");
      return;
    }

    const booking = validateBookingInputs(document.getElementById("searchNotice"));
    if (!booking.valid) return;

    if (!isRoomAvailableForBooking(room, booking.checkIn, booking.checkOut)) {
      alert("此房源不在可訂期間內或目前無可售房型。");
      return;
    }

    const selectedType = getSelectedRoomType(room) || getCartSelectedRoomType(room);

    if (!selectedType) {
      alert("請先選擇房型。");
      return;
    }

    selectedRoomTypes[room.id] = selectedType.id;

    if (booking.guests > Number(selectedType.capacity || 0)) {
      alert("入住人數超過此房型可入住人數。");
      return;
    }

    const availableStock = getAvailableRoomTypeStock(room.id, selectedType.id, booking.checkIn, booking.checkOut);

    if (availableStock <= 0) {
      alert("此房型在指定日期已有重疊訂單，後順位訂單無法成立。系統建議改選其他日期或房型，並提供客服協助補償處理。");
      return;
    }

    const pricePerNight = Number(selectedType.price) || Number(room.price) || 0;
    const totalAmount = pricePerNight * booking.nights;

    if (totalAmount <= 0) {
      alert("價格計算失敗，請重新操作。");
      return;
    }

    const confirmed = confirm(
      `請確認訂單內容：\n` +
      `房源：${room.name}\n` +
      `房型：${selectedType.name}\n` +
      `入住：${booking.checkIn}\n` +
      `退房：${booking.checkOut}\n` +
      `人數：${booking.guests}\n` +
      `晚數：${booking.nights}\n` +
      `單晚：NT$ ${pricePerNight.toLocaleString()}\n` +
      `總金額：NT$ ${totalAmount.toLocaleString()}`
    );

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
      checkOut: booking.checkOut,
      nights: booking.nights,
      people: booking.guests,
      pricePerNight,
      amount: totalAmount,
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

    orders.unshift(order);
    cart = cart.filter(item =>
      !(Number(item.roomId || item.id) === Number(room.id) &&
        String(item.userId || currentUser.id) === String(currentUser.id))
    );

    if (typeof integrateLodgingOrderToItinerary === "function") {
      integrateLodgingOrderToItinerary(order);
    }

    saveAppData();
    alert("訂單建立成功，系統已自動確認訂單。請至歷史訂單完成銀行轉帳付款。");
    showSection("orders");
  } catch (error) {
    console.error("建立訂單失敗：", error);
    alert("系統建立訂單失敗，請重新操作。");
  }
}

// ===== 渲染訂單列表 =====
function renderOrders() {
  const orderList = document.getElementById("orderList");
  if (!orderList) return;

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
              ${escapeHtml(order.checkIn)} ~ ${escapeHtml(order.checkOut || "未指定")}
              <br>
              <small>${Number(order.people || 0)} 人｜${Number(order.nights || 1)} 晚</small>
            </td>
            <td>
              NT$ ${Number(order.amount || 0).toLocaleString()}
              <br>
              <small>NT$ ${Number(order.pricePerNight || order.amount || 0).toLocaleString()} / 晚</small>
            </td>
            <td>
              <span class="order-status">${escapeHtml(getOrderStatusText(order))}</span>
              ${order.bankDueAt && order.paymentStatus === "未付款" ? `<br><small>付款期限：${escapeHtml(order.bankDueAt)}</small>` : ""}
              ${order.refundStatus ? `<br><small>${escapeHtml(order.refundStatus)}：NT$ ${Number(order.refundAmount || 0).toLocaleString()}</small>` : ""}
            </td>
            <td>
              ${renderOrderActions(order)}
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderOrderActions(order) {
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
    <button class="secondary-btn" onclick="payOrder(${order.id})">銀行轉帳付款</button>
    <button class="danger-btn" onclick="cancelOrder(${order.id})">取消 / 退款</button>
    <button class="secondary-btn" onclick="reviewOrder(${order.id})">評價</button>
  `;
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
function payOrder(orderId) {
  if (!requireCustomer()) return;

  const order = findOrder(orderId);

  if (!canOperateOrder(order)) return;

  if (order.bookingStatus === "已取消") {
    alert("已取消訂單不可付款。");
    return;
  }

  if (order.paymentStatus !== "未付款" && order.paymentStatus !== "付款異常") {
    alert("此訂單不是未付款狀態。");
    return;
  }

  const dueAt = Number(order.bankDueAtTimestamp) || new Date(order.bankDueAt).getTime();

  if (dueAt && dueAt < Date.now()) {
    order.paymentStatus = "未付款";
    order.status = "付款逾期";
    saveAppData();
    renderAll();
    alert("顧客未在期限內完成轉帳，訂單維持未付款狀態。");
    return;
  }

  const paidAmount = prompt(
    `銀行轉帳資訊：\n` +
    `銀行：808 玉山銀行\n` +
    `帳號：1234-5678-9000\n` +
    `應付金額：NT$ ${Number(order.amount).toLocaleString()}\n` +
    `付款期限：${order.bankDueAt}\n\n` +
    `請輸入本次轉帳金額以模擬人工確認：`
  );

  if (paidAmount === null) return;

  const amount = Number(paidAmount);

  if (!amount || amount <= 0) {
    alert("付款金額格式錯誤，訂單維持未付款狀態。");
    return;
  }

  if (amount !== Number(order.amount)) {
    order.paymentStatus = "付款異常";
    order.status = "付款金額異常";
    saveAppData();
    renderAll();
    alert("轉帳金額與訂單金額不符，系統已標記異常通知處理。");
    return;
  }

  order.paymentStatus = "已付款";
  order.bookingStatus = "已確認";
  order.status = "已付款";
  order.paidAt = new Date().toLocaleString("zh-TW");

  if (typeof integrateLodgingOrderToItinerary === "function") {
    integrateLodgingOrderToItinerary(order);
  }

  saveAppData();
  renderAll();
  alert("付款成功，訂單狀態已更新為已付款。");
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
    if (!canOperateOrder(order)) return;

    if (order.bookingStatus === "已取消") {
      alert("已取消訂單不可評價。");
      return;
    }

    const reviewUnlockedByAdmin = order.bookingStatus === "已退房" || order.bookingStatus === "已完成";

    if (order.paymentStatus !== "已付款" && !reviewUnlockedByAdmin) {
      alert("訂單尚未完成付款，無法提交評價。");
      return;
    }

    if (!reviewUnlockedByAdmin && new Date(order.checkOut) > new Date()) {
      alert("訂單尚未完成，退房後才能評價。");
      return;
    }

    if (order.review) {
      alert("此訂單已提交過評價。");
      return;
    }

    const ratingValue = prompt("請輸入評分（1-5）：");
    if (ratingValue === null) return;

    const rating = Number(ratingValue);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      alert("評分格式錯誤，請輸入 1 到 5 的整數。");
      return;
    }

    const comment = prompt("請輸入入住體驗內容：");

    if (!comment || !comment.trim()) {
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
      comment: comment.trim(),
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
