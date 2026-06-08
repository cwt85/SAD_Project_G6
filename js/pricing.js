/* =========================================================
   定價與歷史查詢功能 (pricing.js)
========================================================= */

// ===== 定價管理 =====
function savePricingSettings() {
  if (!requireAdmin()) return;

  try {
  const selectedRoomId = Number(getValue("pricingRoomSelect"));
  const selectedTypeId = getValue("pricingTypeSelect");
  const weekdayPrice = Number(getValue("pricingWeekdayPrice"));
  const holidayPrice = Number(getValue("pricingHolidayPrice"));
  const specialPrice = Number(getValue("pricingSpecialPrice")) || 0;
  const specialStart = getValue("pricingSpecialStart");
  const specialEnd = getValue("pricingSpecialEnd");
  const discountType = getValue("pricingDiscountType") || "none";
  const discountValue = Number(getValue("pricingDiscountValue")) || 0;
  const discountStart = getValue("pricingDiscountStart");
  const discountEnd = getValue("pricingDiscountEnd");
  const reason = getValue("pricingChangeReason").trim();
  const notice = document.getElementById("pricingResult");

  const room = findRoom(selectedRoomId);
  const roomType = getPricingRoomType(room, selectedTypeId);

  if (!room || !roomType || weekdayPrice <= 0 || holidayPrice <= 0) {
    showNotice(notice, "error", "請選擇房源和房型，並填寫大於 0 的平日價與假日價。");
    return;
  }

  if (specialPrice > 0 && (!specialStart || !specialEnd)) {
    showNotice(notice, "error", "若填寫特殊價格，特殊期間起迄日期不可空白。");
    return;
  }

  if (specialStart && specialEnd && new Date(specialEnd) < new Date(specialStart)) {
    showNotice(notice, "error", "特殊期間結束日期不可早於起始日期。");
    return;
  }

  if (discountType !== "none" && discountValue <= 0) {
    showNotice(notice, "error", "若選擇折扣類型，折扣數值必須大於 0。");
    return;
  }

  if (discountType !== "none" && (!discountStart || !discountEnd)) {
    showNotice(notice, "error", "若選擇折扣類型，請完整設定折扣適用期間。");
    return;
  }

  if (discountType === "percentage" && discountValue > 100) {
    showNotice(notice, "error", "百分比折扣不可大於 100%。");
    return;
  }

  if (discountType !== "none" && discountType !== "percentage") {
    const comparablePrices = [weekdayPrice, holidayPrice, specialPrice].filter(price => price > 0);
    if (discountValue >= Math.min(...comparablePrices)) {
      showNotice(notice, "error", "折扣金額不可大於或等於原始價格。");
      return;
    }
  }

  if (discountStart && discountEnd && new Date(discountEnd) < new Date(discountStart)) {
    showNotice(notice, "error", "折扣結束日期不可早於起始日期。");
    return;
  }

  const beforePrice = Number(roomType.price) || Number(room.price) || 0;

  if (!reason) {
    showNotice(notice, "error", "請填寫修改原因，方便日後查詢歷史定價紀錄。");
    return;
  }

  roomType.price = weekdayPrice;
  room.price = Math.min(...room.roomTypes.map(type => Number(type.price) || weekdayPrice));

  const record = {
    id: Date.now(),
    roomId: selectedRoomId,
    roomName: room.name,
    typeId: selectedTypeId,
    typeName: roomType.name,
    beforePrice,
    afterPrice: weekdayPrice,
    weekdayPrice,
    holidayPrice,
    specialPrice,
    specialStart,
    specialEnd,
    discountType,
    discountValue,
    discountStart,
    discountEnd,
    modifiedBy: currentUser.account,
    reason,
    createdAt: new Date().toLocaleString("zh-TW"),
    createdAtTimestamp: Date.now()
  };

  pricingRecords.unshift(record);
  setValue("pricingChangeReason", "");

  showNotice(notice, "success", "定價設定已保存，房型平日價格已同步更新。");
  saveAppData();
  renderAll();
  } catch (error) {
    console.error("定價設定失敗：", error);
    showNotice(document.getElementById("pricingResult"), "error", "價格計算或儲存失敗，請重新操作。");
  }
}

// ===== 定價預覽 =====
function calculatePricingPreview() {
  try {
  const weekdayPrice = Number(getValue("pricingWeekdayPrice")) || 0;
  const holidayPrice = Number(getValue("pricingHolidayPrice")) || 0;
  const specialPrice = Number(getValue("pricingSpecialPrice")) || 0;
  const discountType = getValue("pricingDiscountType") || "none";
  const discountValue = Number(getValue("pricingDiscountValue")) || 0;
  const previewElement = document.getElementById("pricingResult");

  if (!previewElement) return;

  const weekdayFinal = applyPricingDiscount(weekdayPrice, discountType, discountValue);
  const holidayFinal = applyPricingDiscount(holidayPrice, discountType, discountValue);
  const specialFinal = specialPrice
    ? applyPricingDiscount(specialPrice, discountType, discountValue)
    : 0;

  previewElement.innerHTML = `
    <div class="pricing-preview">
      <p><strong>平日價：</strong><span>NT$ ${weekdayFinal.toLocaleString()}</span>${renderPriceDiff(weekdayPrice, weekdayFinal)}</p>
      <p><strong>假日價：</strong><span>NT$ ${holidayFinal.toLocaleString()}</span>${renderPriceDiff(holidayPrice, holidayFinal)}</p>
      ${specialPrice ? `<p><strong>特殊期間價：</strong><span>NT$ ${specialFinal.toLocaleString()}</span>${renderPriceDiff(specialPrice, specialFinal)}</p>` : ""}
    </div>
  `;
  } catch (error) {
    console.error("價格預覽計算失敗：", error);
    showNotice(document.getElementById("pricingResult"), "error", "價格計算失敗，請重新操作。");
  }
}

function applyPricingDiscount(price, discountType, discountValue) {
  if (!price || discountType === "none" || !discountValue) return price;

  if (discountType === "percentage") {
    return Math.max(0, Math.round(price * (1 - discountValue / 100)));
  }

  return Math.max(0, price - discountValue);
}

function renderPriceDiff(originalPrice, finalPrice) {
  if (!originalPrice || finalPrice >= originalPrice) return "";
  return `<span class="price-diff">省 NT$ ${(originalPrice - finalPrice).toLocaleString()}</span>`;
}

// ===== 查詢定價歷史 =====
function queryPricingHistory() {
  try {
  const selectedRoomId = Number(getValue("historyRoomSelect"));
  const selectedTypeId = getValue("historyTypeSelect");
  const dateStart = getValue("historyStartDate");
  const dateEnd = getValue("historyEndDate");
  const resultContainer = document.getElementById("pricingHistoryResult");

  if (!resultContainer) return;

  if ((dateStart && Number.isNaN(new Date(dateStart).getTime())) ||
      (dateEnd && Number.isNaN(new Date(dateEnd).getTime()))) {
    resultContainer.innerHTML = `
      <div class="notice error">
        日期格式錯誤，請重新選擇查詢條件。
      </div>
    `;
    return;
  }

  if (dateStart && dateEnd && new Date(dateEnd) < new Date(dateStart)) {
    resultContainer.innerHTML = `
      <div class="notice error">
        查詢結束日期不可早於起始日期。
      </div>
    `;
    return;
  }

  const criteria = [];

  if (selectedRoomId > 0) criteria.push(record => Number(record.roomId) === selectedRoomId);
  if (selectedTypeId) criteria.push(record => record.typeId === selectedTypeId);

  if (dateStart) {
    const startTime = new Date(dateStart).getTime();
    criteria.push(record => record.createdAtTimestamp >= startTime);
  }

  if (dateEnd) {
    const endTime = new Date(dateEnd).getTime() + 86400000;
    criteria.push(record => record.createdAtTimestamp < endTime);
  }

  const results = pricingRecords.filter(record =>
    criteria.every(check => check(record))
  );

  if (results.length === 0) {
    resultContainer.innerHTML = `
      <div class="notice warning">
        查無符合條件的定價紀錄。
      </div>
    `;
    return;
  }

  renderPricingHistoryResult(results);
  } catch (error) {
    console.error("歷史定價查詢失敗：", error);
    const resultContainer = document.getElementById("pricingHistoryResult");
    if (resultContainer) {
      resultContainer.innerHTML = `
        <div class="notice error">
          歷史定價查詢失敗，請重新操作。
        </div>
      `;
    }
  }
}

// ===== 渲染查詢結果 =====
function renderPricingHistoryResult(results) {
  const resultContainer = document.getElementById("pricingHistoryResult");

  if (!resultContainer) return;

  resultContainer.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>房源</th>
          <th>房型</th>
          <th>平日價</th>
          <th>假日價</th>
          <th>修改前 / 後</th>
          <th>特殊價 / 期間</th>
          <th>折扣</th>
          <th>修改人 / 原因</th>
          <th>建立時間</th>
        </tr>
      </thead>

      <tbody>
        ${results.map(record => `
          <tr>
            <td>${escapeHtml(record.roomName || String(record.roomId))}</td>
            <td>${escapeHtml(record.typeName || record.typeId)}</td>
            <td>NT$ ${Number(record.weekdayPrice).toLocaleString()}</td>
            <td>NT$ ${Number(record.holidayPrice).toLocaleString()}</td>
            <td>NT$ ${Number(record.beforePrice || 0).toLocaleString()} → NT$ ${Number(record.afterPrice || record.weekdayPrice).toLocaleString()}</td>
            <td>${renderSpecialPriceRecord(record)}</td>
            <td>${renderDiscountRecord(record)}</td>
            <td>${escapeHtml(record.modifiedBy || "系統")}<br><small>${escapeHtml(record.reason || "未記錄")}</small></td>
            <td>${escapeHtml(record.createdAt)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderSpecialPriceRecord(record) {
  if (!record.specialPrice) return "無";
  return `NT$ ${Number(record.specialPrice).toLocaleString()}<br><small>${escapeHtml(record.specialStart || "-")} ~ ${escapeHtml(record.specialEnd || "-")}</small>`;
}

function renderDiscountRecord(record) {
  if (!record.discountType || record.discountType === "none") return "無";

  const labelMap = {
    early_bird: "早鳥",
    package: "套裝",
    percentage: "百分比"
  };

  const value = record.discountType === "percentage"
    ? `${record.discountValue}%`
    : `減 NT$ ${Number(record.discountValue).toLocaleString()}`;

  return `${labelMap[record.discountType] || record.discountType}｜${value}`;
}

// ===== 動態更新房源和房型選單 =====
function renderAdminManagementSelects() {
  syncRoomSelect("pricingRoomSelect", "-- 選擇房源 --");
  updatePricingTypeSelect();
  syncRoomSelect("historyRoomSelect", "-- 所有房源 --");
  updateHistoryTypeSelect();
}

function syncRoomSelect(selectId, placeholder) {
  const select = document.getElementById(selectId);
  if (!select || !Array.isArray(rooms)) return;

  const currentValue = select.value;
  select.innerHTML = `
    <option value="">${placeholder}</option>
    ${rooms.map(room => `<option value="${room.id}">${escapeHtml(room.name)}</option>`).join("")}
  `;

  if (currentValue && rooms.some(room => String(room.id) === String(currentValue))) {
    select.value = currentValue;
  }
}

function updatePricingTypeSelect() {
  syncTypeSelect("pricingRoomSelect", "pricingTypeSelect", "-- 選擇房型 --");
}

function updateHistoryTypeSelect() {
  syncTypeSelect("historyRoomSelect", "historyTypeSelect", "-- 所有房型 --");
}

function syncTypeSelect(roomSelectId, typeSelectId, placeholder) {
  const typeSelect = document.getElementById(typeSelectId);
  if (!typeSelect) return;

  const currentValue = typeSelect.value;
  const room = findRoom(Number(getValue(roomSelectId)));

  typeSelect.innerHTML = `<option value="">${placeholder}</option>`;

  if (!room || !Array.isArray(room.roomTypes)) return;

  typeSelect.innerHTML += room.roomTypes
    .map(type => `<option value="${type.id}">${escapeHtml(type.name)}</option>`)
    .join("");

  if (currentValue && room.roomTypes.some(type => String(type.id) === String(currentValue))) {
    typeSelect.value = currentValue;
  }
}

function syncPricingTypeForm() {
  const room = findRoom(Number(getValue("pricingRoomSelect")));
  const roomType = getPricingRoomType(room, getValue("pricingTypeSelect"));

  if (!roomType) return;

  setValue("pricingWeekdayPrice", roomType.price || room.price || "");
  setValue("pricingHolidayPrice", Math.round((Number(roomType.price || room.price) || 0) * 1.2) || "");
  calculatePricingPreview();
}

function getPricingRoomType(room, typeId) {
  if (!room || !Array.isArray(room.roomTypes)) return null;
  return room.roomTypes.find(type => String(type.id) === String(typeId)) || null;
}
