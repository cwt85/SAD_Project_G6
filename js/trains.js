/* =========================================================
   C 模組：火車票務流程
   - 車次查詢、訂票票種、票價優惠、付款取票
   - 分票、改退票、候補、異常通知、行程整合
========================================================= */

const TRAIN_STATIONS = [
  { name: "台北", km: 0 },
  { name: "松山", km: 8 },
  { name: "桃園", km: 42 },
  { name: "新竹", km: 78 },
  { name: "台中", km: 170 },
  { name: "彰化", km: 190 },
  { name: "嘉義", km: 260 },
  { name: "台南", km: 314 },
  { name: "高雄", km: 360 },
  { name: "花蓮", km: 420 },
  { name: "玉里", km: 505 },
  { name: "台東", km: 610 }
];

const TRAIN_RATE_BY_TYPE = {
  "區間車": 1.8,
  "莒光號": 2.3,
  "自強號": 2.8,
  "太魯閣": 3,
  "普悠瑪": 3
};

const TRAIN_SPEED_BY_TYPE = {
  "區間車": 58,
  "莒光號": 75,
  "自強號": 92,
  "太魯閣": 102,
  "普悠瑪": 105
};

const TRAIN_TICKET_TYPES = {
  general: { label: "一般票", factor: 1, note: "一般成人票" },
  student: { label: "學生票", factor: 0.88, note: "需備學生證" },
  senior: { label: "敬老票", factor: 0.6, note: "滿 65 歲" },
  accessibility: { label: "愛心票", factor: 0.6, note: "具身障手冊" },
  child: { label: "兒童票", factor: 0.7, note: "3-12 歲，0-3 歲依規定免費" }
};

const TRAIN_PAYMENT_METHODS = [
  "超商支付",
  "線上刷卡",
  "銀行轉帳",
  "LINE Pay"
];

const TRAIN_PICKUP_METHODS = [
  "超商取票",
  "車站櫃檯",
  "App 取票"
];

const TRAIN_SEARCH_TEMPLATES = [
  { trainType: "區間車", trainNo: "4152", depart: "06:20", seats: 0, delayMinutes: 0, status: "準點", transfer: false },
  { trainType: "莒光號", trainNo: "522", depart: "08:05", seats: 18, delayMinutes: 5, status: "誤點 5 分", transfer: false },
  { trainType: "自強號", trainNo: "308", depart: "09:40", seats: 34, delayMinutes: 0, status: "準點", transfer: false },
  { trainType: "普悠瑪", trainNo: "278", depart: "11:10", seats: 4, delayMinutes: 0, status: "準點", transfer: false },
  { trainType: "太魯閣", trainNo: "421", depart: "13:25", seats: 12, delayMinutes: 12, status: "誤點 12 分", transfer: false },
  { trainType: "自強號", trainNo: "326", depart: "15:30", seats: 0, delayMinutes: 0, status: "客滿", transfer: false },
  { trainType: "莒光號", trainNo: "754", depart: "17:45", seats: 24, delayMinutes: 0, status: "準點", transfer: true },
  { trainType: "普悠瑪", trainNo: "288", depart: "20:10", seats: 16, delayMinutes: 0, status: "停駛", transfer: false }
];

function renderTrainModule() {
  populateTrainStationSelects();
  renderTrainResults();
  renderTrainBookingPanel();
  renderTrainOrdersPanel();
}

function populateTrainStationSelects() {
  const fromSelect = document.getElementById("trainFromStation");
  const toSelect = document.getElementById("trainToStation");
  if (!fromSelect || !toSelect) return;

  const currentFrom = fromSelect.value || "台北";
  const currentTo = toSelect.value || "台東";
  const options = TRAIN_STATIONS
    .map(station => `<option value="${escapeAttribute(station.name)}">${escapeHtml(station.name)}</option>`)
    .join("");

  fromSelect.innerHTML = options;
  toSelect.innerHTML = options;
  fromSelect.value = currentFrom;
  toSelect.value = currentTo;

  if (!fromSelect.value) fromSelect.value = "台北";
  if (!toSelect.value) toSelect.value = "台東";
}

function prefillTrainToday() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  setValue("trainFromStation", "台北");
  setValue("trainToStation", "台東");
  setValue("trainDate", date.toISOString().slice(0, 10));
  setValue("trainPeriod", "morning");
  setValue("trainCabinFilter", "standard");
  const transfer = document.getElementById("trainAllowTransfer");
  if (transfer) transfer.checked = true;
  searchTrains();
}

function resetTrainSearch() {
  selectedTrainResultId = null;
  lastTrainSearchResults = [];
  setValue("trainPeriod", "all");
  setValue("trainCabinFilter", "standard");
  const transfer = document.getElementById("trainAllowTransfer");
  if (transfer) transfer.checked = false;
  const notice = document.getElementById("trainNotice");
  if (notice) notice.innerHTML = "";
  saveAppData();
  renderTrainModule();
}

function searchTrains() {
  const notice = document.getElementById("trainNotice");
  const fromStation = getValue("trainFromStation");
  const toStation = getValue("trainToStation");
  const travelDate = getValue("trainDate");
  const period = getValue("trainPeriod") || "all";
  const cabin = getValue("trainCabinFilter") || "standard";
  const allowTransfer = Boolean(document.getElementById("trainAllowTransfer")?.checked);

  if (!fromStation || !toStation || !travelDate) {
    showNotice(notice, "error", "請輸入出發站、抵達站與乘車日期。");
    return;
  }

  if (fromStation === toStation) {
    showNotice(notice, "error", "出發站與抵達站不可相同。");
    return;
  }

  lastTrainSearchResults = buildTrainSearchResults({
    fromStation,
    toStation,
    travelDate,
    period,
    cabin,
    allowTransfer
  });
  selectedTrainResultId = null;

  saveAppData();
  renderTrainModule();
  showNotice(
    notice,
    "success",
    `已顯示 ${lastTrainSearchResults.length} 筆車次，不能訂票的班次仍會保留於查詢結果。`
  );
}

function buildTrainSearchResults(criteria) {
  const distance = getTrainDistance(criteria.fromStation, criteria.toStation);
  return TRAIN_SEARCH_TEMPLATES
    .filter(template => criteria.allowTransfer || !template.transfer)
    .filter(template => matchTrainPeriod(template.depart, criteria.period))
    .map((template, index) => {
      const durationMinutes = calculateTrainDuration(template.trainType, distance, template.transfer);
      const arriveTime = addMinutesToTime(template.depart, durationMinutes + Number(template.delayMinutes || 0));
      const reservedTrain = template.trainType !== "區間車";
      const baseSeats = reservedTrain ? Number(template.seats || 0) : 0;
      const result = {
        id: `train-${criteria.travelDate}-${template.trainNo}-${index}`,
        fromStation: criteria.fromStation,
        toStation: criteria.toStation,
        travelDate: criteria.travelDate,
        cabin: criteria.cabin,
        trainType: template.trainType,
        trainNo: template.trainNo,
        departTime: template.depart,
        arriveTime,
        durationMinutes,
        distance,
        reservedTrain,
        transfer: Boolean(template.transfer),
        delayMinutes: Number(template.delayMinutes || 0),
        status: template.status,
        availableSeats: baseSeats
      };
      const availability = getTrainAvailability(result);
      return { ...result, ...availability };
    });
}

function renderTrainResults() {
  const container = document.getElementById("trainResults");
  if (!container) return;

  if (!Array.isArray(lastTrainSearchResults) || lastTrainSearchResults.length === 0) {
    container.innerHTML = `
      <div class="panel train-empty-panel">
        <h3>車次查詢流程 A</h3>
        <p>輸入出發站、抵達站、乘車日期與時段後，系統會顯示可訂與不可訂的車次、抵達狀態、剩餘座位與進階篩選結果。</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="panel">
      <div class="itinerary-panel-title compact">
        <div>
          <h2>車次查詢結果</h2>
          <p>含不可訂票班次，便於乘客檢視完整班表。</p>
        </div>
      </div>
      <div class="train-result-list">
        ${lastTrainSearchResults.map(result => renderTrainResultCard(result)).join("")}
      </div>
    </div>
  `;
}

function renderTrainResultCard(result) {
  const remainingSeats = getRemainingTrainSeats(result);
  const unbookable = !result.reservable || remainingSeats <= 0;
  const selected = selectedTrainResultId === result.id;
  const cabinText = result.cabin === "business" ? "商務車廂" : "標準車廂";

  return `
    <article class="train-result-card ${unbookable ? "unavailable" : ""} ${selected ? "selected" : ""}">
      <div class="train-result-head">
        <div>
          <span class="train-status-pill">${escapeHtml(result.status || "準點")}</span>
          <h3>${escapeHtml(result.trainType)} ${escapeHtml(result.trainNo)}</h3>
          <p>${escapeHtml(result.fromStation)} → ${escapeHtml(result.toStation)}${result.transfer ? "，含轉車" : ""}</p>
        </div>
        <strong>NT$ ${calculateTrainPrice(result, "general", false).finalPrice.toLocaleString()}</strong>
      </div>
      <div class="train-meta-grid">
        <div><span>行駛日期</span><strong>${escapeHtml(result.travelDate)}</strong></div>
        <div><span>發車</span><strong>${escapeHtml(result.departTime)}</strong></div>
        <div><span>抵達</span><strong>${escapeHtml(result.arriveTime)}</strong></div>
        <div><span>總行車</span><strong>${formatTrainDuration(result.durationMinutes)}</strong></div>
        <div><span>車廂</span><strong>${escapeHtml(cabinText)}</strong></div>
        <div><span>剩餘座位</span><strong>${result.reservedTrain ? remainingSeats : "非對號"}</strong></div>
      </div>
      <div class="train-result-actions">
        ${unbookable
          ? `<button class="secondary-btn" disabled>${escapeHtml(result.unavailableReason || "不可訂票")}</button>
             ${result.reservedTrain ? `<button class="secondary-btn" onclick="joinTrainWaitingList('${result.id}')">加入候補</button>` : ""}`
          : `<button class="primary-btn" onclick="selectTrainResult('${result.id}')">選定班次</button>`}
      </div>
    </article>
  `;
}

function selectTrainResult(resultId) {
  selectedTrainResultId = resultId;
  saveAppData();
  renderTrainModule();
  previewTrainPrice();
}

function renderTrainBookingPanel() {
  const container = document.getElementById("trainBookingPanel");
  if (!container) return;

  const result = getSelectedTrainResult();
  if (!result) {
    container.innerHTML = "";
    return;
  }

  const lodgingDiscount = getTrainLodgingDiscountInfo();
  const bonusPoints = typeof getCurrentBonusPoints === "function" ? getCurrentBonusPoints() : Number(trainBonusPoints || 0);
  container.innerHTML = `
    <div class="panel train-booking-panel">
      <div class="itinerary-panel-title compact">
        <div>
          <h2>訂票與票種管理流程 B/C/D</h2>
          <p>輸入乘客資料、選擇票種與座位偏好，系統會自動分配座位並套用最優惠折扣。</p>
        </div>
      </div>
      <div class="train-booking-grid">
        <div>
          <label for="trainPassengerId">身分證字號</label>
          <input id="trainPassengerId" placeholder="例如 A123456789" />
        </div>
        <div>
          <label for="trainPhone">電話</label>
          <input id="trainPhone" placeholder="例如 0912345678" />
        </div>
        <div>
          <label for="trainTicketType">票種</label>
          <select id="trainTicketType" onchange="previewTrainPrice()">
            ${Object.entries(TRAIN_TICKET_TYPES).map(([value, meta]) => `
              <option value="${value}">${escapeHtml(meta.label)} - ${escapeHtml(meta.note)}</option>
            `).join("")}
          </select>
        </div>
        <div>
          <label for="trainTicketQuantity">購票張數</label>
          <input id="trainTicketQuantity" type="number" min="1" max="${Math.max(1, Math.min(6, getRemainingTrainSeats(result)))}" value="1" oninput="previewTrainPrice()" onchange="previewTrainPrice()" />
        </div>
        <div>
          <label for="trainSeatPreference">座位偏好</label>
          <select id="trainSeatPreference">
            <option value="none">系統自動分配</option>
            <option value="window">靠窗</option>
            <option value="aisle">走道</option>
            <option value="quiet">安靜車廂</option>
          </select>
        </div>
        <div>
          <label for="trainPaymentMethod">付款方式</label>
          <select id="trainPaymentMethod">
            ${TRAIN_PAYMENT_METHODS.map(method => `<option value="${escapeAttribute(method)}">${escapeHtml(method)}</option>`).join("")}
          </select>
        </div>
        <div>
          <label for="trainPickupMethod">取票方式</label>
          <select id="trainPickupMethod">
            ${TRAIN_PICKUP_METHODS.map(method => `<option value="${escapeAttribute(method)}">${escapeHtml(method)}</option>`).join("")}
          </select>
        </div>
      </div>
      <label class="check-row train-check-row">
        <input id="trainUseLodgingDiscount" type="checkbox" ${lodgingDiscount.eligible ? "checked" : "disabled"} onchange="previewTrainPrice()" />
        B 模組訂房達指定天數折扣${lodgingDiscount.eligible ? `（${lodgingDiscount.label}）` : "（尚未符合）"}
      </label>
      <label class="check-row train-check-row">
        <input id="trainUseBonus" type="checkbox" ${bonusPoints > 0 ? "" : "disabled"} onchange="previewTrainPrice()" />
        使用紅利點數扣抵（目前 <span id="trainBonusPointsText">${Number(bonusPoints || 0).toLocaleString()}</span> 點）
      </label>
      <div id="trainPricePreview" class="train-price-preview"></div>
      <div class="actions">
        <button class="primary-btn" onclick="createTrainOrder()">建立訂票訂單</button>
      </div>
    </div>
  `;
}
function refreshTrainBonusDisplay() {
  const bonusPoints = typeof getCurrentBonusPoints === "function"
    ? Number(getCurrentBonusPoints() || 0)
    : Number(trainBonusPoints || 0);

  // 訂票面板：目前紅利點數
  const trainBonusText = document.getElementById("trainBonusPointsText");
  if (trainBonusText) {
    trainBonusText.textContent = bonusPoints.toLocaleString();
  }

  // 首頁 / Summary：紅利點數
  const summaryBonusText = document.getElementById("summaryBonusPointsText");
  if (summaryBonusText) {
    summaryBonusText.textContent = `${bonusPoints.toLocaleString()} 點`;
  }

  // 紅利點數橫幅
  const bonusBarPointsText = document.getElementById("bonusBarPointsText");
  if (bonusBarPointsText) {
    bonusBarPointsText.textContent = `${bonusPoints.toLocaleString()} 點`;
  }

  // 訂票紅利勾選框
  const bonusCheckbox = document.getElementById("trainUseBonus");
  if (bonusCheckbox) {
    bonusCheckbox.disabled = bonusPoints <= 0;
    if (bonusPoints <= 0) {
      bonusCheckbox.checked = false;
    }
  }

  if (typeof previewTrainPrice === "function") {
    previewTrainPrice();
  }
}
function previewTrainPrice() {
  const preview = document.getElementById("trainPricePreview");
  const result = getSelectedTrainResult();
  if (!preview || !result) return;

  const ticketType = getValue("trainTicketType") || "general";
  const quantity = getTrainTicketQuantity();
  const useLodgingDiscount = Boolean(document.getElementById("trainUseLodgingDiscount")?.checked);
  const useBonus = Boolean(document.getElementById("trainUseBonus")?.checked);
  const price = calculateTrainPrice(result, ticketType, useLodgingDiscount);
  const totalBasePrice = price.basePrice * quantity;
  const totalFinalPrice = price.finalPrice * quantity;
  const availableBonus = typeof getCurrentBonusPoints === "function" ? getCurrentBonusPoints() : Number(trainBonusPoints || 0);
  const bonus = useBonus ? Math.min(availableBonus, totalFinalPrice) : 0;
  const payable = Math.max(0, totalFinalPrice - bonus);
  const remainingSeats = getRemainingTrainSeats(result);
  const quantityWarning = quantity > remainingSeats
    ? `<div class="notice warning">目前剩餘 ${remainingSeats} 席，購票張數不可超過剩餘座位。</div>`
    : "";

  preview.innerHTML = `
    <div class="train-price-card">
      <div><span>單張原價</span><strong>NT$ ${price.basePrice.toLocaleString()}</strong></div>
      <div><span>張數</span><strong>${quantity} 張</strong></div>
      <div><span>原始總額</span><strong>NT$ ${totalBasePrice.toLocaleString()}</strong></div>
      <div><span>最優惠折扣</span><strong>${escapeHtml(price.discountLabel)}</strong></div>
      <div><span>紅利扣抵</span><strong>NT$ ${bonus.toLocaleString()}</strong></div>
      <div><span>應付金額</span><strong>NT$ ${payable.toLocaleString()}</strong></div>
    </div>
    ${quantityWarning}
  `;
}

function createTrainOrder() {
  if (!requireCustomer()) return;

  const result = getSelectedTrainResult();
  if (!result) {
    alert("請先選定班次。");
    return;
  }

  const availability = getTrainAvailability(result);
  if (!availability.reservable || getRemainingTrainSeats(result) <= 0) {
    alert(`此班次目前不可訂票：${availability.unavailableReason || "座位不足"}`);
    renderTrainModule();
    return;
  }

  if (!isBeforeTrainDeadline(result, 30)) {
    alert("訂票必須於發車 30 分鐘前完成。");
    return;
  }

  const passengerId = getValue("trainPassengerId").trim().toUpperCase();
  const phone = getValue("trainPhone").trim();
  const ticketType = getValue("trainTicketType") || "general";
  const quantity = getTrainTicketQuantity();
  const seatPreference = getValue("trainSeatPreference") || "none";
  const paymentMethod = getValue("trainPaymentMethod") || "線上刷卡";
  const pickupMethod = getValue("trainPickupMethod") || "App 取票";
  const useLodgingDiscount = Boolean(document.getElementById("trainUseLodgingDiscount")?.checked);
  const useBonus = Boolean(document.getElementById("trainUseBonus")?.checked);

  if (!passengerId || passengerId.length < 8 || !phone) {
    alert("請輸入身分證字號與電話。");
    return;
  }

  if (!/^09\d{8}$/.test(phone)) {
    alert("電話需為 09 開頭的 10 碼手機號碼。");
    return;
  }

  const remainingSeats = getRemainingTrainSeats(result);
  if (quantity < 1 || quantity > 6) {
    alert("每筆訂單購票張數需為 1 到 6 張。");
    return;
  }

  if (quantity > remainingSeats) {
    alert(`此班次目前僅剩 ${remainingSeats} 席，請調整購票張數。`);
    return;
  }

  const price = calculateTrainPrice(result, ticketType, useLodgingDiscount);
  const totalBasePrice = price.basePrice * quantity;
  const totalFinalPrice = price.finalPrice * quantity;
  const availableBonus = typeof getCurrentBonusPoints === "function" ? getCurrentBonusPoints() : Number(trainBonusPoints || 0);
  const usedBonus = useBonus ? Math.min(availableBonus, totalFinalPrice) : 0;
  const payableAmount = Math.max(0, totalFinalPrice - usedBonus);
  const seat = assignTrainSeats(result, seatPreference, quantity);
  const departAt = getTrainDateTime(result.travelDate, result.departTime);
  const paymentDueAt = new Date(departAt.getTime() - 20 * 60 * 1000);
  const order = {
    id: Date.now(),
    bookingNo: createTrainBookingNo(),
    userId: currentUser.id,
    holderUserId: currentUser.id,
    userName: currentUser.displayName || currentUser.account,
    userAccount: currentUser.account,
    passengerId,
    phone,
    fromStation: result.fromStation,
    toStation: result.toStation,
    travelDate: result.travelDate,
    trainType: result.trainType,
    trainNo: result.trainNo,
    departTime: result.departTime,
    arriveTime: result.arriveTime,
    durationMinutes: result.durationMinutes,
    delayMinutes: result.delayMinutes,
    statusText: result.status,
    distance: result.distance,
    cabin: result.cabin,
    transfer: result.transfer,
    ticketType,
    ticketTypeLabel: TRAIN_TICKET_TYPES[ticketType]?.label || "一般票",
    quantity,
    seatPreference,
    seats: seat.seats,
    seatNo: seat.seats.join("、"),
    seatWarning: seat.warning,
    paymentMethod,
    pickupMethod,
    unitBasePrice: price.basePrice,
    unitFinalPrice: price.finalPrice,
    basePrice: totalBasePrice,
    finalPrice: totalFinalPrice,
    discountLabel: price.discountLabel,
    discountFactor: price.discountFactor,
    usedBonus,
    payableAmount,
    paymentStatus: "未付款",
    bookingStatus: "已訂票",
    ticketStatus: "未取票",
    status: "已訂票 / 未付款",
    changedOnce: false,
    transferTo: "",
    ticketFolder: "我的票夾",
    paymentDueAt: paymentDueAt.toLocaleString("zh-TW"),
    pickupDueAt: paymentDueAt.toLocaleString("zh-TW"),
    createdAt: new Date().toLocaleString("zh-TW"),
    createdAtTimestamp: Date.now()
  };

  trainOrders.unshift(order);
  saveAppData();
  renderAll();
  alert(
    `訂票成功，訂票編號：${order.bookingNo}\n` +
    `請於發車 20 分鐘前完成付款與取票。\n` +
    `張數：${order.quantity} 張\n` +
    `${order.seatWarning ? `座位提醒：${order.seatWarning}` : `座位：${order.seatNo}`}`
  );
}

function renderTrainOrdersPanel() {
  const container = document.getElementById("trainOrdersPanel");
  if (!container) return;

  if (!isLoggedIn || !currentUser) {
    container.innerHTML = `
      <div class="panel">
        <h2>票券管理流程 D/E/G/H</h2>
        <div class="notice warning">請先登入後查看票券、付款、分票與改退票。</div>
      </div>
    `;
    return;
  }

  const visibleOrders = trainOrders.filter(order =>
    isAdmin() ||
    String(order.userId) === String(currentUser.id) ||
    String(order.holderUserId) === String(currentUser.id)
  );

  container.innerHTML = `
    <div class="panel">
      <div class="itinerary-panel-title compact">
        <div>
          <h2>我的火車票券</h2>
          <p>付款、取票、分票、改退票、候補與異常通知集中管理。</p>
        </div>
      </div>
      ${visibleOrders.length === 0 ? `<div class="notice warning">尚無火車票訂單。</div>` : `
        <div class="train-order-list">
          ${visibleOrders.map(order => renderTrainOrderCard(order)).join("")}
        </div>
      `}
    </div>
  `;
}

function renderTrainOrderCard(order) {
  const canPay = order.paymentStatus === "未付款";
  const canPickup = order.paymentStatus === "已付款" && order.ticketStatus === "未取票";
  const canSplit = canPickup && String(order.holderUserId) === String(currentUser.id);
  const canChange = canPickup && !order.changedOnce;
  const canRefund = order.paymentStatus === "已付款" && order.bookingStatus !== "已退票";
  const folder = order.ticketFolder || "我的票夾";

  return `
    <article class="train-order-card">
      <div class="train-result-head">
        <div>
          <span class="train-status-pill">${escapeHtml(order.status)}</span>
          <h3>${escapeHtml(order.trainType)} ${escapeHtml(order.trainNo)} / ${escapeHtml(order.bookingNo)}</h3>
          <p>${escapeHtml(order.travelDate)} ${escapeHtml(order.departTime)} → ${escapeHtml(order.arriveTime)}，${escapeHtml(order.fromStation)} 到 ${escapeHtml(order.toStation)}</p>
        </div>
        <strong>NT$ ${Number(order.payableAmount ?? order.finalPrice ?? 0).toLocaleString()}</strong>
      </div>
      <div class="train-meta-grid">
        <div><span>票種</span><strong>${escapeHtml(order.ticketTypeLabel)}</strong></div>
        <div><span>張數</span><strong>${Number(order.quantity || 1)} 張</strong></div>
        <div><span>座位</span><strong>${escapeHtml(order.seatNo || "待分配")}</strong></div>
        <div><span>單張票價</span><strong>NT$ ${Number(order.unitFinalPrice || order.finalPrice || 0).toLocaleString()}</strong></div>
        <div><span>折扣</span><strong>${escapeHtml(order.discountLabel || "無")}</strong></div>
        <div><span>付款</span><strong>${escapeHtml(order.paymentMethod)}</strong></div>
        <div><span>取票</span><strong>${escapeHtml(order.pickupMethod)}</strong></div>
        <div><span>票夾</span><strong>${escapeHtml(folder)}</strong></div>
      </div>
      ${order.seatWarning ? `<div class="notice warning">${escapeHtml(order.seatWarning)}</div>` : ""}
      ${order.abnormalNotice ? `<div class="notice error">${escapeHtml(order.abnormalNotice)}</div>` : ""}
      ${order.refundStatus ? `<div class="notice info">${escapeHtml(order.refundStatus)}</div>` : ""}
      <div class="actions">
        <button class="primary-btn" ${canPay ? "" : "disabled"} onclick="payTrainOrder(${order.id})">付款</button>
        <button class="secondary-btn" ${canPickup ? "" : "disabled"} onclick="pickupTrainTicket(${order.id})">取票</button>
        <button class="secondary-btn" ${canSplit ? "" : "disabled"} onclick="splitTrainTicket(${order.id})">分票</button>
        <button class="secondary-btn" ${canChange ? "" : "disabled"} onclick="changeTrainTicket(${order.id})">改票</button>
        <button class="danger-btn" ${canRefund ? "" : "disabled"} onclick="refundTrainTicket(${order.id})">退票</button>
        <button class="secondary-btn" onclick="simulateTrainAbnormal(${order.id}, 'delay')">模擬延誤</button>
        <button class="secondary-btn" onclick="simulateTrainAbnormal(${order.id}, 'stop')">模擬停駛</button>
      </div>
    </article>
  `;
}

function payTrainOrder(orderId) {
  if (!requireCustomer()) return;
  const order = findTrainOrder(orderId);
  if (!canOperateTrainOrder(order)) return;

  if (order.paymentStatus !== "未付款") {
    alert("此訂單不是未付款狀態。");
    return;
  }

  if (!isBeforeTrainDeadline(order, 20)) {
    order.status = "付款逾期";
    order.paymentStatus = "未付款";
    saveAppData();
    renderAll();
    alert("付款期限已過，需重新訂票。");
    return;
  }

  if (Number(order.usedBonus || 0) > 0) {
    // 从当前登录用户的红利点数中扣除
    const deducted = typeof deductBonusPoints === "function"
      ? deductBonusPoints(order.usedBonus, `購票扣抵 ${order.bookingNo}`, "train-payment", currentUser.id)
      : false;
    if (!deducted) {
      alert("紅利點數不足，請重新建立訂單或取消勾選紅利扣抵。");
      return;
    }
    refreshTrainBonusDisplay();
  }

  order.paymentStatus = "已付款";
  order.bookingStatus = "已確認";
  order.ticketStatus = "未取票";
  order.status = "已付款 / 未取票";
  order.paidAt = new Date().toLocaleString("zh-TW");

  const bonusNotice = awardPlatformConsumptionBonus();
  integrateTrainOrderToItinerary(order);
  saveAppData();
  renderAll();
  alert(`付款成功，可至 ${order.pickupMethod} 取票。${bonusNotice ? `\n${bonusNotice}` : ""}`);
}

function pickupTrainTicket(orderId) {
  if (!requireCustomer()) return;
  const order = findTrainOrder(orderId);
  if (!canOperateTrainOrder(order)) return;

  if (order.paymentStatus !== "已付款" || order.ticketStatus !== "未取票") {
    alert("只有已付款且尚未取票的票券可以取票。");
    return;
  }

  if (!isBeforeTrainDeadline(order, 20)) {
    alert("取票期限已過，請洽客服協助。");
    return;
  }

  order.ticketStatus = "已取票";
  order.status = "已取票";
  order.pickedAt = new Date().toLocaleString("zh-TW");
  saveAppData();
  renderAll();
  alert("取票成功。");
}

function splitTrainTicket(orderId) {
  if (!requireCustomer()) return;
  const order = findTrainOrder(orderId);
  if (!canOperateTrainOrder(order)) return;

  if (order.paymentStatus !== "已付款" || order.ticketStatus !== "未取票") {
    alert("只有已付款但尚未取票的票券可以分票。");
    return;
  }

  const account = prompt("請輸入分票對象的手機或 Email 帳號：");
  if (account === null) return;
  const target = findUser(account);

  if (!target || target.role !== "customer" || !target.account) {
    alert("分票對象必須是已綁定手機或信箱的有效平台帳號。");
    return;
  }

  if (String(target.id) === String(currentUser.id)) {
    alert("不可分票給自己。");
    return;
  }

  order.holderUserId = target.id;
  order.transferTo = target.account;
  order.ticketFolder = "分票夾";
  order.status = "已分票 / 未取票";
  order.splitAt = new Date().toLocaleString("zh-TW");
  saveAppData();
  renderAll();
  alert(`分票成功，票券已轉移到 ${target.displayName || target.account} 的分票夾。`);
}

function changeTrainTicket(orderId) {
  if (!requireCustomer()) return;
  const order = findTrainOrder(orderId);
  if (!canOperateTrainOrder(order)) return;

  if (order.paymentStatus !== "已付款" || order.ticketStatus !== "未取票") {
    alert("改票限已付款且未取票訂單。");
    return;
  }

  if (order.changedOnce) {
    alert("每筆訂單限改一次。");
    return;
  }

  if (!isBeforeTrainDeadline(order, 60)) {
    alert("改票須於發車前 1 小時且未取票前操作。");
    return;
  }

  const sourceResult = getTrainResultFromOrder(order);
  const candidates = buildTrainSearchResults({
    fromStation: order.fromStation,
    toStation: order.toStation,
    travelDate: order.travelDate,
    period: "all",
    cabin: order.cabin,
    allowTransfer: true
  }).filter(result =>
    result.id !== sourceResult.id &&
    result.reservable &&
    getRemainingTrainSeats(result) >= Number(order.quantity || 1) &&
    compareTime(result.departTime, order.departTime) > 0
  );

  if (candidates.length === 0) {
    alert("目前沒有可改票的替代班次。");
    return;
  }

  const next = candidates[0];
  const seat = assignTrainSeats(next, order.seatPreference, Number(order.quantity || 1));
  order.trainType = next.trainType;
  order.trainNo = next.trainNo;
  order.departTime = next.departTime;
  order.arriveTime = next.arriveTime;
  order.durationMinutes = next.durationMinutes;
  order.delayMinutes = next.delayMinutes;
  order.statusText = next.status;
  order.seats = seat.seats;
  order.seatNo = seat.seats.join("、");
  order.seatWarning = seat.warning || "改票後不保證保留原座位偏好。";
  order.changedOnce = true;
  order.changedAt = new Date().toLocaleString("zh-TW");
  order.status = "已改票 / 未取票";

  if (order.paymentMethod === "線上刷卡") {
    order.changeNotice = "線上改票須使用同張原信用卡。";
  }

  integrateTrainOrderToItinerary(order);
  saveAppData();
  renderAll();
  alert(`改票成功，新班次為 ${order.trainType} ${order.trainNo}。${order.changeNotice ? `\n${order.changeNotice}` : ""}`);
}

function refundTrainTicket(orderId) {
  if (!requireCustomer()) return;
  const order = findTrainOrder(orderId);
  if (!canOperateTrainOrder(order)) return;

  if (order.paymentStatus !== "已付款") {
    alert("退票限已付款訂單。");
    return;
  }

  if (order.bookingStatus === "已退票") {
    alert("此訂單已退票。");
    return;
  }

  const refund = calculateTrainRefund(order);
  if (!refund.refundable) {
    alert("此票券已超過可退票時間。");
    return;
  }

  const confirmed = confirm(
    `${refund.ruleText}\n` +
    `手續費：NT$ ${refund.fee.toLocaleString()}\n` +
    `退款金額：NT$ ${refund.amount.toLocaleString()}\n` +
    `確認退票並釋回座位？`
  );

  if (!confirmed) return;

  order.bookingStatus = "已退票";
  order.ticketStatus = "已退票";
  order.paymentStatus = "已退款";
  order.status = "已退票";
  order.refundFee = refund.fee;
  order.refundAmount = refund.amount;
  order.refundStatus = `${refund.ruleText}，座位已釋回票倉。`;
  order.refundedAt = new Date().toLocaleString("zh-TW");
  notifyTrainWaitingList(order);
  saveAppData();
  renderAll();
  alert("退票完成，系統已釋回座位並通知候補乘客。");
}

function simulateTrainAbnormal(orderId, type) {
  if (!requireCustomer()) return;
  const order = findTrainOrder(orderId);
  if (!canOperateTrainOrder(order)) return;

  const isStop = type === "stop";
  order.statusText = isStop ? "停駛" : "延誤";
  order.abnormalNotice = isStop
    ? "列車停駛，系統已透過簡訊或信箱主動通知，並補償 20 點紅利。"
    : "列車延誤，系統已透過簡訊或信箱主動通知，並補償 10 點紅利。";
  order.status = isStop ? "列車停駛" : "列車延誤";
  if (typeof addBonusPoints === "function") {
    addBonusPoints(isStop ? 20 : 10, order.abnormalNotice, "train-abnormal", order.holderUserId || order.userId);
  } else {
    trainBonusPoints += isStop ? 20 : 10;
  }
  refreshTrainBonusDisplay();
  saveAppData();
  renderAll();
  alert(order.abnormalNotice);
}

function joinTrainWaitingList(resultId) {
  if (!requireCustomer()) return;
  const result = lastTrainSearchResults.find(item => item.id === resultId);
  if (!result) return;

  const exists = trainWaitingList.some(item =>
    item.resultId === resultId && String(item.userId) === String(currentUser.id)
  );
  if (exists) {
    alert("你已在此班次候補名單中。");
    return;
  }

  trainWaitingList.push({
    id: createTrainBookingNo("WL"),
    resultId,
    userId: currentUser.id,
    userAccount: currentUser.account,
    trainNo: result.trainNo,
    travelDate: result.travelDate,
    createdAt: new Date().toLocaleString("zh-TW")
  });
  saveAppData();
  alert("已加入候補名單，座位釋出時依先訂先贏通知。");
}

function integrateTrainOrderToItinerary(order) {
  if (!order || typeof addSystemItemToItinerary !== "function") return null;
  return addSystemItemToItinerary({
    name: `${order.trainType} ${order.trainNo} ${order.fromStation}→${order.toStation}`,
    type: "交通",
    date: order.travelDate,
    time: order.departTime,
    endTime: order.arriveTime,
    estimatedCost: Number(order.payableAmount ?? order.finalPrice ?? 0),
    sourceModule: "C",
    sourceId: `train-${order.id}`,
    trainOrderId: order.id,
    notes: `訂票編號 ${order.bookingNo}；${Number(order.quantity || 1)} 張；票種 ${order.ticketTypeLabel}；座位 ${order.seatNo}；取票 ${order.pickupMethod}`
  });
}

function calculateTrainPrice(result, ticketType = "general", useLodgingDiscount = false) {
  const rate = TRAIN_RATE_BY_TYPE[result.trainType] || 2.8;
  const cabinMultiplier = result.cabin === "business" ? 1.3 : 1;
  const basePrice = Math.max(15, Math.round(Number(result.distance || 0) * rate * cabinMultiplier));
  const candidates = [
    { label: "無折扣", factor: 1 },
    {
      label: TRAIN_TICKET_TYPES[ticketType]?.label || "一般票",
      factor: TRAIN_TICKET_TYPES[ticketType]?.factor || 1
    }
  ];

  const earlyBird = getTrainEarlyBirdDiscount(result);
  if (earlyBird.factor < 1) candidates.push(earlyBird);

  const lodgingDiscount = getTrainLodgingDiscountInfo();
  if (useLodgingDiscount && lodgingDiscount.eligible) {
    candidates.push({ label: lodgingDiscount.label, factor: lodgingDiscount.factor });
  }

  const best = candidates.reduce((winner, item) => item.factor < winner.factor ? item : winner, candidates[0]);
  return {
    basePrice,
    finalPrice: Math.ceil(basePrice * best.factor),
    discountLabel: best.factor < 1 ? `${best.label}（${Math.round(best.factor * 100)} 折）` : "無折扣",
    discountFactor: best.factor
  };
}

function getTrainEarlyBirdDiscount(result) {
  if (!result.reservedTrain) return { label: "早鳥折扣", factor: 1 };
  const travel = new Date(`${result.travelDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((travel - today) / (1000 * 60 * 60 * 24));
  if (days >= 14) return { label: "早鳥優惠", factor: 0.7 };
  if (days >= 7) return { label: "早鳥優惠", factor: 0.8 };
  if (days >= 3) return { label: "早鳥優惠", factor: 0.9 };
  return { label: "早鳥折扣", factor: 1 };
}

function getTrainLodgingDiscountInfo() {
  if (!isLoggedIn || !currentUser) {
    return { eligible: false, factor: 1, label: "訂房折扣" };
  }

  const eligibleOrders = orders.filter(order =>
    String(order.userId) === String(currentUser.id) &&
    order.bookingStatus !== "已取消" &&
    Number(order.nights || 0) >= 2
  );

  if (eligibleOrders.length === 0) {
    return { eligible: false, factor: 1, label: "訂房折扣" };
  }

  const maxNights = Math.max(...eligibleOrders.map(order => Number(order.nights || 0)));
  const factor = maxNights >= 3 ? 0.8 : 0.85;
  return {
    eligible: true,
    factor,
    label: `B 模組訂房 ${maxNights} 晚優惠`
  };
}

function getTrainTicketQuantity() {
  const quantity = Number(getValue("trainTicketQuantity") || 1);
  if (!Number.isFinite(quantity)) return 1;
  return Math.max(1, Math.floor(quantity));
}

function assignTrainSeats(result, preference, quantity = 1) {
  const count = Math.max(1, Number(quantity) || 1);
  const remaining = getRemainingTrainSeats(result);
  if (remaining < count) {
    return {
      seats: [],
      warning: `偏好無法分配，目前剩餘 ${remaining} 席，不足 ${count} 張。`
    };
  }

  const carNo = result.cabin === "business" ? "B1" : "S" + ((Number(result.trainNo) % 4) + 1);
  const firstRow = Math.max(1, 20 - remaining);
  const seatLetters = preference === "window"
    ? ["A", "B", "E", "F", "C", "D"]
    : preference === "aisle"
      ? ["C", "D", "B", "E", "A", "F"]
      : ["B", "C", "D", "E", "A", "F"];
  const seats = Array.from({ length: count }, (_, index) => {
    const row = firstRow + Math.floor(index / seatLetters.length);
    const letter = seatLetters[index % seatLetters.length];
    return `${carNo}-${row}${letter}`;
  });

  if (preference === "window" && remaining < 5) {
    return { seats, warning: "靠窗座位不足，部分座位已改配相鄰或走道座位。" };
  }

  if (preference === "quiet" && result.trainType === "區間車") {
    return { seats, warning: "區間車無安靜車廂，系統已自動分配一般座位。" };
  }

  return { seats, warning: "" };
}

function assignTrainSeat(result, preference) {
  const assigned = assignTrainSeats(result, preference, 1);
  return {
    seatNo: assigned.seats[0] || "",
    warning: assigned.warning
  };
}

function getTrainAvailability(result) {
  if (result.status === "停駛") {
    return { reservable: false, unavailableReason: "停駛不可訂" };
  }
  if (!result.reservedTrain) {
    return { reservable: false, unavailableReason: "非對號列車不可訂" };
  }
  if (Number(result.availableSeats || 0) <= 0) {
    return { reservable: false, unavailableReason: "座位已售完" };
  }
  if (!isBeforeTrainDeadline(result, 30)) {
    return { reservable: false, unavailableReason: "已過訂票期限" };
  }
  return { reservable: true, unavailableReason: "" };
}

function getRemainingTrainSeats(result) {
  if (!result || !result.reservedTrain) return 0;
  const used = trainOrders.filter(order =>
    order.bookingStatus !== "已退票" &&
    order.bookingStatus !== "已取消" &&
    order.travelDate === result.travelDate &&
    order.trainNo === result.trainNo &&
    order.fromStation === result.fromStation &&
    order.toStation === result.toStation
  ).reduce((sum, order) => sum + Number(order.quantity || 1), 0);
  return Math.max(0, Number(result.availableSeats || 0) - used);
}

function getTrainDistance(fromStation, toStation) {
  const from = TRAIN_STATIONS.find(station => station.name === fromStation);
  const to = TRAIN_STATIONS.find(station => station.name === toStation);
  if (!from || !to) return 120;
  return Math.max(20, Math.abs(to.km - from.km));
}

function calculateTrainDuration(trainType, distance, transfer) {
  const speed = TRAIN_SPEED_BY_TYPE[trainType] || 80;
  return Math.round((Number(distance || 0) / speed) * 60) + (transfer ? 25 : 0);
}

function matchTrainPeriod(time, period) {
  if (!period || period === "all") return true;
  const hour = Number(String(time).split(":")[0]);
  if (period === "morning") return hour >= 5 && hour < 12;
  if (period === "afternoon") return hour >= 12 && hour < 18;
  if (period === "night") return hour >= 18 || hour < 5;
  return true;
}

function addMinutesToTime(time, minutes) {
  const [hour, minute] = String(time).split(":").map(Number);
  const total = hour * 60 + minute + Number(minutes || 0);
  const nextHour = Math.floor(total / 60) % 24;
  const nextMinute = total % 60;
  return `${String(nextHour).padStart(2, "0")}:${String(nextMinute).padStart(2, "0")}`;
}

function formatTrainDuration(minutes) {
  const hour = Math.floor(Number(minutes || 0) / 60);
  const minute = Number(minutes || 0) % 60;
  return `${hour} 小時 ${minute} 分`;
}

function getSelectedTrainResult() {
  return lastTrainSearchResults.find(result => result.id === selectedTrainResultId) || null;
}

function findTrainOrder(orderId) {
  return trainOrders.find(order => Number(order.id) === Number(orderId)) || null;
}

function canOperateTrainOrder(order) {
  if (!order) {
    alert("找不到票券訂單。");
    return false;
  }
  if (!isAdmin() &&
    String(order.userId) !== String(currentUser.id) &&
    String(order.holderUserId) !== String(currentUser.id)) {
    alert("無權操作此票券。");
    return false;
  }
  return true;
}

function isBeforeTrainDeadline(target, minutesBefore) {
  const departAt = getTrainDateTime(target.travelDate, target.departTime);
  if (Number.isNaN(departAt.getTime())) return false;
  return Date.now() <= departAt.getTime() - Number(minutesBefore || 0) * 60 * 1000;
}

function getTrainDateTime(dateText, timeText) {
  return new Date(`${dateText}T${timeText || "00:00"}:00`);
}

function createTrainBookingNo(prefix = "TR") {
  return `${prefix}${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 90 + 10)}`;
}

function getTrainResultFromOrder(order) {
  return {
    id: `order-${order.id}`,
    fromStation: order.fromStation,
    toStation: order.toStation,
    travelDate: order.travelDate,
    cabin: order.cabin,
    trainType: order.trainType,
    trainNo: order.trainNo,
    departTime: order.departTime,
    arriveTime: order.arriveTime,
    durationMinutes: order.durationMinutes,
    distance: order.distance,
    reservedTrain: true,
    transfer: order.transfer,
    delayMinutes: order.delayMinutes,
    status: order.statusText,
    availableSeats: 1,
    reservable: true
  };
}

function calculateTrainRefund(order) {
  const travel = new Date(`${order.travelDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysBefore = Math.ceil((travel - today) / (1000 * 60 * 60 * 24));
  const amount = Number(order.payableAmount ?? order.finalPrice ?? 0);

  if (daysBefore < 0) {
    return { refundable: false, fee: 0, amount: 0, ruleText: "乘車日已過" };
  }

  let feeRate = 0.1;
  let ruleText = "乘車當日扣 10% 手續費";
  if (daysBefore >= 25) {
    feeRate = 0.01;
    ruleText = "乘車 25 日前扣 1% 手續費";
  } else if (daysBefore >= 3) {
    feeRate = 0.03;
    ruleText = "乘車 3-24 日前扣 3% 手續費";
  } else if (daysBefore >= 1) {
    feeRate = 0.05;
    ruleText = "乘車 1-2 日前扣 5% 手續費";
  }

  const fee = Math.ceil(amount * feeRate);
  return {
    refundable: true,
    fee,
    amount: Math.max(0, amount - fee),
    ruleText
  };
}

function notifyTrainWaitingList(order) {
  const target = trainWaitingList.find(item =>
    item.travelDate === order.travelDate && item.trainNo === order.trainNo
  );
  if (!target) return;
  order.waitingListNotice = `已通知候補帳號 ${target.userAccount}，依先訂先贏原則開放購買。`;
  trainWaitingList = trainWaitingList.filter(item => item.id !== target.id);
}

function awardPlatformConsumptionBonus() {
  if (!currentUser) return "";
  const userId = String(currentUser.id);
  const lodgingPaidCount = orders.filter(order =>
    String(order.userId) === userId && order.paymentStatus === "已付款"
  ).length;
  const trainPaidCount = trainOrders.filter(order =>
    String(order.userId) === userId && order.paymentStatus === "已付款"
  ).length;
  const milestones = Math.floor((lodgingPaidCount + trainPaidCount) / 5);
  const awardedMilestones = Number(userBonusAwardedMilestones[userId] || 0);

  if (milestones <= awardedMilestones) return "";

  const diff = milestones - awardedMilestones;
  const points = diff * 30;
  if (typeof addBonusPoints === "function") {
    addBonusPoints(points, `平台累積 ${milestones * 5} 次消費獎勵`, "consumption-milestone", userId);
  } else {
    trainBonusPoints += points;
  }
  refreshTrainBonusDisplay();
  userBonusAwardedMilestones[userId] = milestones;
  trainBonusAwardedMilestones = milestones;
  return `已達平台 ${milestones * 5} 次消費，自動核發 ${points} 點無期限紅利。`;
}
function refreshTrainBonusDisplay() {
  const bonusPoints = typeof getCurrentBonusPoints === "function"
    ? Number(getCurrentBonusPoints() || 0)
    : Number(trainBonusPoints || 0);

  const trainBonusText = document.getElementById("trainBonusPointsText");
  if (trainBonusText) {
    trainBonusText.textContent = bonusPoints.toLocaleString();
  }

  const summaryBonusText = document.getElementById("summaryBonusPointsText");
  if (summaryBonusText) {
    summaryBonusText.textContent = `${bonusPoints.toLocaleString()} 點`;
  }

  const bonusBarPointsText = document.getElementById("bonusBarPointsText");
  if (bonusBarPointsText) {
    bonusBarPointsText.textContent = `${bonusPoints.toLocaleString()} 點`;
  }

  const bonusCheckbox = document.getElementById("trainUseBonus");
  if (bonusCheckbox) {
    bonusCheckbox.disabled = bonusPoints <= 0;

    if (bonusPoints <= 0) {
      bonusCheckbox.checked = false;
    }
  }

  if (typeof previewTrainPrice === "function") {
    previewTrainPrice();
  }
}

function createTrainOrder() {
  if (!requireCustomer()) return;

  const result = getSelectedTrainResult();
  if (!result) {
    alert("請先選定班次。");
    return;
  }

  const availability = getTrainAvailability(result);
  if (!availability.reservable || getRemainingTrainSeats(result) <= 0) {
    alert(`此班次目前不可訂票：${availability.unavailableReason || "座位不足"}`);
    renderTrainModule();
    return;
  }

  if (!isBeforeTrainDeadline(result, 30)) {
    alert("訂票必須於發車 30 分鐘前完成。");
    return;
  }

  const passengerId = getValue("trainPassengerId").trim().toUpperCase();
  const phone = getValue("trainPhone").trim();
  const ticketType = getValue("trainTicketType") || "general";
  const quantity = getTrainTicketQuantity();
  const seatPreference = getValue("trainSeatPreference") || "none";
  const paymentMethod = getValue("trainPaymentMethod") || "線上刷卡";
  const pickupMethod = getValue("trainPickupMethod") || "App 取票";
  const useLodgingDiscount = Boolean(document.getElementById("trainUseLodgingDiscount")?.checked);
  const useBonus = Boolean(document.getElementById("trainUseBonus")?.checked);

  if (!passengerId || passengerId.length < 8 || !phone) {
    alert("請輸入身分證字號與電話。");
    return;
  }

  if (!/^09\d{8}$/.test(phone)) {
    alert("電話需為 09 開頭的 10 碼手機號碼。");
    return;
  }

  const remainingSeats = getRemainingTrainSeats(result);

  if (quantity < 1 || quantity > 6) {
    alert("每筆訂單購票張數需為 1 到 6 張。");
    return;
  }

  if (quantity > remainingSeats) {
    alert(`此班次目前僅剩 ${remainingSeats} 席，請調整購票張數。`);
    return;
  }

  const price = calculateTrainPrice(result, ticketType, useLodgingDiscount);
  const totalBasePrice = price.basePrice * quantity;
  const totalFinalPrice = price.finalPrice * quantity;

  const availableBonus = typeof getCurrentBonusPoints === "function"
    ? Number(getCurrentBonusPoints() || 0)
    : Number(trainBonusPoints || 0);

  const usedBonus = useBonus ? Math.min(availableBonus, totalFinalPrice) : 0;
  const payableAmount = Math.max(0, totalFinalPrice - usedBonus);

  if (usedBonus > 0) {
    const deducted = typeof deductBonusPoints === "function"
      ? deductBonusPoints(
          usedBonus,
          "建立車票訂單扣抵",
          "train-payment",
          currentUser.id
        )
      : false;

    if (!deducted) {
      alert("紅利點數不足，請取消勾選紅利扣抵後再試。");
      return;
    }
  }

  const seat = assignTrainSeats(result, seatPreference, quantity);
  const departAt = getTrainDateTime(result.travelDate, result.departTime);
  const paymentDueAt = new Date(departAt.getTime() - 20 * 60 * 1000);

  const order = {
    id: Date.now(),
    bookingNo: createTrainBookingNo(),
    userId: currentUser.id,
    holderUserId: currentUser.id,
    userName: currentUser.displayName || currentUser.account,
    userAccount: currentUser.account,
    passengerId,
    phone,
    fromStation: result.fromStation,
    toStation: result.toStation,
    travelDate: result.travelDate,
    trainType: result.trainType,
    trainNo: result.trainNo,
    departTime: result.departTime,
    arriveTime: result.arriveTime,
    durationMinutes: result.durationMinutes,
    delayMinutes: result.delayMinutes,
    statusText: result.status,
    distance: result.distance,
    cabin: result.cabin,
    transfer: result.transfer,
    ticketType,
    ticketTypeLabel: TRAIN_TICKET_TYPES[ticketType]?.label || "一般票",
    quantity,
    seatPreference,
    seats: seat.seats,
    seatNo: seat.seats.join("、"),
    seatWarning: seat.warning,
    paymentMethod,
    pickupMethod,
    unitBasePrice: price.basePrice,
    unitFinalPrice: price.finalPrice,
    basePrice: totalBasePrice,
    finalPrice: totalFinalPrice,
    discountLabel: price.discountLabel,
    discountFactor: price.discountFactor,
    usedBonus,
    payableAmount,
    paymentStatus: "未付款",
    bookingStatus: "已訂票",
    ticketStatus: "未取票",
    status: "已訂票 / 未付款",
    changedOnce: false,
    transferTo: "",
    ticketFolder: "我的票夾",
    paymentDueAt: paymentDueAt.toLocaleString("zh-TW"),
    pickupDueAt: paymentDueAt.toLocaleString("zh-TW"),
    createdAt: new Date().toLocaleString("zh-TW"),
    createdAtTimestamp: Date.now()
  };

  trainOrders.unshift(order);

  saveAppData();

  if (typeof renderAll === "function") {
    renderAll();
  }

  if (typeof renderBonusPointBar === "function") {
    renderBonusPointBar();
  }

  if (typeof refreshTrainBonusDisplay === "function") {
    refreshTrainBonusDisplay();
  }

  alert(
    `訂票成功，訂票編號：${order.bookingNo}\n` +
    `請於發車 20 分鐘前完成付款與取票。\n` +
    `張數：${order.quantity} 張\n` +
    `${order.seatWarning ? `座位提醒：${order.seatWarning}` : `座位：${order.seatNo}`}`
  );
}

function payTrainOrder(orderId) {
  if (!requireCustomer()) return;

  const order = findTrainOrder(orderId);
  if (!canOperateTrainOrder(order)) return;

  if (order.paymentStatus !== "未付款") {
    alert("此訂單不是未付款狀態。");
    return;
  }

  if (!isBeforeTrainDeadline(order, 20)) {
    order.status = "付款逾期";
    order.paymentStatus = "未付款";
    saveAppData();

    if (typeof renderAll === "function") {
      renderAll();
    }

    alert("付款期限已過，需重新訂票。");
    return;
  }

  order.paymentStatus = "已付款";
  order.bookingStatus = "已確認";
  order.ticketStatus = "未取票";
  order.status = "已付款 / 未取票";
  order.paidAt = new Date().toLocaleString("zh-TW");

  const bonusNotice = awardPlatformConsumptionBonus();

  integrateTrainOrderToItinerary(order);
  saveAppData();

  if (typeof renderAll === "function") {
    renderAll();
  }

  if (typeof renderBonusPointBar === "function") {
    renderBonusPointBar();
  }

  if (typeof refreshTrainBonusDisplay === "function") {
    refreshTrainBonusDisplay();
  }

  alert(`付款成功，可至 ${order.pickupMethod} 取票。${bonusNotice ? `\n${bonusNotice}` : ""}`);
}