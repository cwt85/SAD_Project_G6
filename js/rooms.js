/* =========================================================
   房源相關功能 (rooms.js)
========================================================= */

let currentRoomResults = [];
let currentRoomPage = 1;
let roomPageSize = 10;

// 載入房源 JSON 資料
async function loadRooms() {
  try {
    const response = await fetch("./index.json");

    if (!response.ok) {
      throw new Error("index.json 載入失敗");
    }

    const data = await response.json();

    rooms = Array.isArray(data) ? data : data.rooms;
    rooms = rooms.map((room, index) => ({
      ...room,
      image: room.image || defaultRoomImages[index % defaultRoomImages.length],
      images: Array.isArray(room.images) && room.images.length > 0
        ? room.images
        : [
            defaultRoomImages[index % defaultRoomImages.length],
            defaultRoomImages[(index + 1) % defaultRoomImages.length],
            defaultRoomImages[(index + 2) % defaultRoomImages.length]
          ],
      policies: normalizeRoomTextList(room.policies),
      checkInTime: room.checkInTime || "15:00",
      checkOutTime: room.checkOutTime || "11:00",
      roomTypes: Array.isArray(room.roomTypes) && room.roomTypes.length > 0
        ? room.roomTypes
        : generateDefaultRoomTypes(room)
    }));
    
    if (!Array.isArray(rooms)) {
      throw new Error("index.json 格式錯誤，最外層必須是陣列或包含 rooms 陣列。");
    }

    renderAll();
  } catch (error) {
    console.error(error);

    const roomList = document.getElementById("roomList");

    if (roomList) {
      roomList.innerHTML = `
        <div class="notice error">
          房源資料載入失敗，請確認 index.json 是否與 index.html 放在同一層，
          並確認 JSON 格式正確。
        </div>
      `;
    }
  }
}

// 搜尋與篩選房源
function searchRooms() {
  const notice = document.getElementById("searchNotice");

  try {
    const booking = validateBookingInputs(notice);
    if (!booking.valid) return;

    const maxPriceValue = getValue("maxPrice");
    const maxPrice = maxPriceValue ? Number(maxPriceValue) : Infinity;
    const roomTypePreference = getValue("roomTypePreference");
    const stationDistanceLimit = Number(getValue("stationDistanceFilter")) || Infinity;
    const location = getValue("locationFilter");
    const minRating = Number(getValue("ratingFilter")) || 0;

    if (maxPriceValue && maxPrice <= 0) {
      showNotice(notice, "error", "最高價格需大於 0。");
      return;
    }

    if (minRating < 0 || minRating > 5) {
      showNotice(notice, "error", "評價篩選條件不合理，請重新選擇。");
      return;
    }

    const result = rooms.filter(room => {
      const matchingTypes = getSearchMatchingRoomTypes(room, booking, {
        maxPrice,
        roomTypePreference
      });
      const stationMinutes = parseStationDistanceMinutes(room.stationDistance);
      const matched = (
        isRoomAvailableForBooking(room, booking.checkIn, booking.checkOut) &&
        matchingTypes.length > 0 &&
        stationMinutes <= stationDistanceLimit &&
        Number(room.rating || 0) >= minRating &&
        (!location || room.location === location)
      );

      if (matched && roomTypePreference && matchingTypes[0]) {
        selectedRoomTypes[room.id] = matchingTypes[0].id;
      }

      return matched;
    });

    if (result.length === 0) {
      showNotice(notice, "warning", "查無符合條件房源。");
    } else {
      showNotice(notice, "success", `找到 ${result.length} 筆符合條件的房源。`);
    }

    renderRooms(result);
  } catch (error) {
    console.error("搜尋房源失敗：", error);
    showNotice(notice, "error", "系統查詢或篩選失敗，請重新操作。");
  }
}

// 重設搜尋條件
function resetSearch() {
  setValue("checkIn", "");
  setValue("checkInTime", "15:00");
  setValue("checkOut", "");
  setValue("checkOutTime", "11:00");
  setValue("guests", "2");
  setValue("maxPrice", "");
  setValue("roomTypePreference", "");
  setValue("stationDistanceFilter", "");
  setValue("locationFilter", "");
  setValue("ratingFilter", "0");

  const notice = document.getElementById("searchNotice");

  if (notice) {
    notice.innerHTML = "";
  }

  syncBookingDateConstraints();
  updateBookingDateSummary();

  currentRoomPage = 1;
  renderRooms(rooms);
}

function initializeBookingDatePicker() {
  ["checkIn", "checkInTime", "checkOut", "checkOutTime", "guests"].forEach(id => {
    const element = document.getElementById(id);
    if (!element) return;

    element.addEventListener("change", () => {
      syncBookingDateConstraints(id);
      updateBookingDateSummary();
    });

    element.addEventListener("input", updateBookingDateSummary);
  });

  syncBookingDateConstraints();
  updateBookingDateSummary();
}

function syncBookingDateConstraints(changedField = "") {
  const checkInInput = document.getElementById("checkIn");
  const checkOutInput = document.getElementById("checkOut");
  if (!checkInInput || !checkOutInput) return;

  checkInInput.min = getLocalDateInputValue(addLocalDays(new Date(), 1));

  if (checkInInput.value) {
    const minimumCheckOut = getDateInputOffset(checkInInput.value, 1);
    checkOutInput.min = minimumCheckOut;

    if (changedField === "checkIn" && (!checkOutInput.value || checkOutInput.value <= checkInInput.value)) {
      checkOutInput.value = minimumCheckOut;
    }
  } else {
    checkOutInput.min = "";
  }
}

function updateBookingDateSummary() {
  const summary = document.getElementById("bookingDateSummary");
  if (!summary) return;

  const checkIn = getValue("checkIn");
  const checkInTime = getValue("checkInTime") || "15:00";
  const checkOut = getValue("checkOut");
  const checkOutTime = getValue("checkOutTime") || "11:00";
  const guests = Number(getValue("guests")) || 0;

  summary.classList.remove("is-warning");

  if (!checkIn && !checkOut) {
    summary.textContent = "請選擇入住與退房日期";
    return;
  }

  if (!checkIn || !checkOut) {
    summary.textContent = "請完整選擇入住與退房日期";
    summary.classList.add("is-warning");
    return;
  }

  const nights = getBookingNights(checkIn, checkOut);

  if (nights <= 0) {
    summary.textContent = "退房日期需晚於入住日期";
    summary.classList.add("is-warning");
    return;
  }

  const guestText = guests > 0 ? `，${guests} 人` : "";
  summary.textContent = `${formatBookingDateLabel(checkIn)} ${checkInTime} 入住，${formatBookingDateLabel(checkOut)} ${checkOutTime} 退房，共 ${nights} 晚${guestText}`;
}

function formatBookingDateLabel(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  });
}

function getDateInputOffset(value, offset) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return getLocalDateInputValue(addLocalDays(date, offset));
}

function addLocalDays(date, days) {
  const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  nextDate.setDate(nextDate.getDate() + Number(days || 0));
  return nextDate;
}

function getLocalDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getSearchMatchingRoomTypes(room, booking, filters = {}) {
  if (!room || !Array.isArray(room.roomTypes)) return [];

  const maxPrice = Number.isFinite(filters.maxPrice) ? filters.maxPrice : Infinity;
  const preference = String(filters.roomTypePreference || "").trim();

  return room.roomTypes.filter(type => {
    const availableStock = typeof getAvailableRoomTypeStock === "function"
      ? getAvailableRoomTypeStock(room.id, type.id, booking.checkIn, booking.checkOut)
      : Number(type.stock || 0);

    return (
      availableStock > 0 &&
      Number(type.capacity || 0) >= Number(booking.guests || 1) &&
      Number(type.price || room.price || 0) <= maxPrice &&
      (!preference || String(type.name || "").includes(preference) || String(type.id || "").includes(preference))
    );
  });
}

function parseStationDistanceMinutes(stationDistance) {
  const text = String(stationDistance || "");
  const match = text.match(/(\d+(?:\.\d+)?)\s*分鐘/);
  if (!match) return Infinity;
  return Number(match[1]);
}

function normalizeRoomTextList(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,，、\n]/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getRoomPolicyList(room) {
  return normalizeRoomTextList(room ? room.policies : []);
}

function getRoomCheckInTime(room) {
  return room && room.checkInTime ? room.checkInTime : "15:00";
}

function getRoomCheckOutTime(room) {
  return room && room.checkOutTime ? room.checkOutTime : "11:00";
}

// 渲染房源卡片
function renderRooms(roomArray, preservePage = false) {
  const roomList = document.getElementById("roomList");

  if (!roomList) return;

  if (Array.isArray(roomArray)) {
    currentRoomResults = roomArray;
    if (!preservePage) {
      currentRoomPage = 1;
    }
  }

  const results = Array.isArray(currentRoomResults) ? currentRoomResults : [];
  const pageSize = getCurrentRoomPageSize();
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  currentRoomPage = Math.min(Math.max(1, Number(currentRoomPage) || 1), totalPages);
  renderRoomListControls(results.length, pageSize, totalPages);

  if (results.length === 0) {
    roomList.innerHTML = `
      <div class="notice warning">
        目前沒有可顯示的房源。
      </div>
    `;
    renderRoomPagination(0, 1);
    return;
  }

  const startIndex = (currentRoomPage - 1) * pageSize;
  const pageRooms = results.slice(startIndex, startIndex + pageSize);

  roomList.innerHTML = pageRooms.map(room => `
    <div class="room-card" onclick="showRoomDetail(${room.id})" style="cursor: pointer;">
      <div class="room-image">
        <img 
          src="${escapeHtml(room.image || getRoomCoverImage(room.id))}" 
          alt="${escapeHtml(room.name)}"
          onerror="this.src='https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80'"
        >
      </div>

      <div class="room-body">
        <h3>${escapeHtml(room.name)}</h3>

        <p>${escapeHtml(room.location)}｜${escapeHtml(room.address || "未提供地址")}</p>
        <p>最多 ${getMaxRoomTypeCapacity(room)} 人｜評價 ${room.rating} ⭐</p>
        <p>距離車站：${escapeHtml(room.stationDistance || "未提供")}</p>
        <p>入住 ${escapeHtml(getRoomCheckInTime(room))}｜退房 ${escapeHtml(getRoomCheckOutTime(room))}</p>

        <p>${escapeHtml(room.desc || "")}</p>

        <div class="price">
          NT$ ${Number(getLowestRoomTypePrice(room)).toLocaleString()} 起 / 晚
        </div>

        <div class="actions">
          <button class="secondary-btn" onclick="event.stopPropagation(); addFavorite(${room.id})">
            收藏
          </button>
          <button class="secondary-btn" onclick="event.stopPropagation(); addCart(${room.id})">
            加入購物車
          </button>
          <button class="primary-btn" onclick="event.stopPropagation(); createOrder(${room.id})">
            建立訂單
          </button>
        </div>
      </div>
    </div>
  `).join("");

  renderRoomPagination(results.length, totalPages);
}

function getCurrentRoomPageSize() {
  const select = document.getElementById("roomPageSizeSelect");
  const nextSize = Number(select ? select.value : roomPageSize);
  roomPageSize = [5, 10, 20, 50].includes(nextSize) ? nextSize : 10;
  if (select && String(select.value) !== String(roomPageSize)) {
    select.value = String(roomPageSize);
  }
  return roomPageSize;
}

function updateRoomPageSize(value) {
  const nextSize = Number(value);
  roomPageSize = [5, 10, 20, 50].includes(nextSize) ? nextSize : 10;
  currentRoomPage = 1;
  renderRoomsAndScrollToList();
}

function changeRoomPage(page, event) {
  if (event && typeof event.preventDefault === "function") {
    event.preventDefault();
  }

  if (event && typeof event.stopPropagation === "function") {
    event.stopPropagation();
  }

  if (event && event.currentTarget && typeof event.currentTarget.blur === "function") {
    event.currentTarget.blur();
  }

  currentRoomPage = Number(page) || 1;
  renderRoomsAndScrollToList();
}

function renderRoomsAndScrollToList() {
  renderRooms(currentRoomResults, true);
  scrollToRoomListTop();
}

function scrollToRoomListTop() {
  if (typeof window === "undefined") return;

  const listContainer = document.getElementById("roomList") ||
    document.getElementById("productList") ||
    document.querySelector(".room-list, .product-list, .card-list");

  if (!listContainer) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const headerOffset = getFixedHeaderOffset();
  const targetTop = Math.max(0, listContainer.getBoundingClientRect().top + window.scrollY - headerOffset - 16);
  window.scrollTo({ top: targetTop, behavior: "smooth" });

  if (typeof updateBackToTopButton === "function") {
    window.setTimeout(updateBackToTopButton, 350);
  }
}

function getFixedHeaderOffset() {
  const stickyCandidates = Array.from(document.querySelectorAll("nav, header"));
  return stickyCandidates.reduce((offset, element) => {
    const style = window.getComputedStyle(element);
    if (style.position !== "fixed" && style.position !== "sticky") return offset;
    const rect = element.getBoundingClientRect();
    if (rect.top > 1) return offset;
    return Math.max(offset, rect.height);
  }, 0);
}

function renderRoomListControls(total, pageSize, totalPages) {
  const summary = document.getElementById("roomResultSummary");
  if (!summary) return;

  if (total === 0) {
    summary.textContent = "目前沒有符合條件的房源";
    return;
  }

  const start = (currentRoomPage - 1) * pageSize + 1;
  const end = Math.min(total, currentRoomPage * pageSize);
  summary.textContent = `共 ${total} 筆房源，顯示第 ${start}-${end} 筆，共 ${totalPages} 頁`;
}

function renderRoomPagination(total, totalPages) {
  const pagination = document.getElementById("roomPagination");
  if (!pagination) return;

  if (total === 0 || totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);
  pagination.innerHTML = `
    <button type="button" class="secondary-btn" ${currentRoomPage <= 1 ? "disabled" : ""} onclick="changeRoomPage(${currentRoomPage - 1}, event)">上一頁</button>
    <div class="room-page-buttons">
      ${pages.map(page => `
        <button type="button" class="${page === currentRoomPage ? "primary-btn" : "secondary-btn"}" onclick="changeRoomPage(${page}, event)">${page}</button>
      `).join("")}
    </div>
    <button type="button" class="secondary-btn" ${currentRoomPage >= totalPages ? "disabled" : ""} onclick="changeRoomPage(${currentRoomPage + 1}, event)">下一頁</button>
  `;
}

// 如果 HTML 沒有 roomDetail section，JS 自動建立
function ensureRoomDetailSection() {
  if (document.getElementById("roomDetail")) return;

  const section = document.createElement("section");
  section.id = "roomDetail";
  section.innerHTML = `
    <div id="roomDetailContent"></div>
  `;

  document.body.appendChild(section);
}

// 顯示房源詳細頁
function showRoomDetail(roomId) {
  let room = null;

  try {
    room = findRoom(roomId);
  } catch (error) {
    console.error("載入房源失敗：", error);
    alert("系統載入失敗，請重新操作。");
    return;
  }

  if (!room) {
    alert("房源已下架或不存在，無法查看。");
    return;
  }

  if (room.status === "inactive") {
    alert("此房源目前已下架，無法查看。");
    return;
  }

  document.querySelectorAll("section").forEach(section => {
    section.classList.remove("active");
  });

  const detailSection = document.getElementById("roomDetail");

  if (detailSection) {
    detailSection.classList.add("active");
  }

  document.querySelectorAll("nav button").forEach(button => {
    button.classList.remove("active");
  });
  
  currentRoomImageIndex = 0;
  renderRoomDetail(room);
}

// 渲染房源詳細內容
function renderRoomDetail(room) {
  const detailContent = document.getElementById("roomDetailContent");

  if (!detailContent) return;

  const incompleteMessages = getRoomDataIssues(room);
  const reviews = Array.isArray(room.reviews) ? room.reviews : [];

  detailContent.innerHTML = `
    <div class="room-card detail-card">
      <div class="detail-slider">
        <button class="slider-btn slider-prev" onclick="event.stopPropagation(); slideRoomImages(-1)">
          ‹
        </button>

        <div class="slider-track" id="roomImageSlider">
          ${(room.images || [room.image || getRoomCoverImage(room.id)]).map((imageUrl, index) => `
            <div class="slider-item">
              <img 
                src="${escapeHtml(imageUrl)}" 
                alt="${escapeHtml(room.name)} 圖片 ${index + 1}"
                onerror="this.src='https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80'"
              >
            </div>
          `).join("")}
        </div>

        <button class="slider-btn slider-next" onclick="event.stopPropagation(); slideRoomImages(1)">
          ›
        </button>
      </div>

      <div class="slider-dots" id="roomImageDots">
        ${(room.images || [room.image || getRoomCoverImage(room.id)]).map((_, index) => `
          <button 
            class="slider-dot ${index === 0 ? "active" : ""}" 
            onclick="goToRoomImage(${index})"
            aria-label="切換到第 ${index + 1} 張圖片"
          ></button>
        `).join("")}
      </div>

      <div class="room-body">
        <button class="secondary-btn" onclick="backToRoomList()">
          ← 返回房源列表
        </button>

        <h2>${escapeHtml(room.name)}</h2>

        ${incompleteMessages.length > 0 ? `
          <div class="notice warning">
            房源資料尚有部分資訊不完整：${incompleteMessages.map(item => escapeHtml(item)).join("、")}。
          </div>
        ` : ""}

        <p><strong>地點：</strong>${escapeHtml(room.location)}</p>
        <p><strong>地址：</strong>${escapeHtml(room.address || "未提供地址")}</p>
        <p><strong>價格：</strong>NT$ ${Number(getLowestRoomTypePrice(room)).toLocaleString()} 起 / 晚</p>
        <p><strong>評價：</strong>${Number(room.rating || 0).toFixed(1)} ⭐（${reviews.length} 則評價）</p>
        <p><strong>交通距離：</strong>${escapeHtml(room.stationDistance || "未提供")}</p>
        <p><strong>入住 / 退房時間：</strong>${escapeHtml(getRoomCheckInTime(room))} / ${escapeHtml(getRoomCheckOutTime(room))}</p>
        <p><strong>可訂期間：</strong>${escapeHtml(room.bookingStart || "未設定")} ~ ${escapeHtml(room.bookingEnd || "未設定")}</p>

        <h3>選擇房型</h3>

        <div class="room-type-list">
          ${(room.roomTypes || []).map(type => {
            const selectedType = getSelectedRoomType(room);
            const isActive = selectedType && selectedType.id === type.id;

            return `
              <div 
                class="room-type-card ${isActive ? "active" : ""}"
                onclick="selectRoomType(${room.id}, '${type.id}')"
              >
                <div>
                  <h4>${escapeHtml(type.name)}</h4>
                  <p>${escapeHtml(type.desc || "")}</p>
                  <p>最多 ${type.capacity} 人｜${escapeHtml(type.bedType || "床型未提供")}</p>
                  <p>${type.breakfast ? "含早餐" : "不含早餐"}｜剩餘 ${type.stock} 間</p>
                </div>

                <div class="room-type-price">
                  NT$ ${Number(type.price).toLocaleString()} / 晚
                </div>
              </div>
            `;
          }).join("")}
        </div>

        <h3>房源設備</h3>
        <div class="tag-row">
          ${(room.facilities || []).map(item => `
            <span class="tag">${escapeHtml(item)}</span>
          `).join("")}
        </div>

        <h3>住房政策</h3>
        ${getRoomPolicyList(room).length > 0 ? `
          <div class="tag-row policy-tag-row">
            ${getRoomPolicyList(room).map(item => `
              <span class="tag policy-tag">${escapeHtml(item)}</span>
            `).join("")}
          </div>
        ` : `
          <div class="notice info">此房源尚未提供住房政策。</div>
        `}

        <h3>房源介紹</h3>
        <p>${escapeHtml(room.desc || "尚未提供詳細介紹。")}</p>

        <h3>顧客評價</h3>
        <div class="room-reviews">
          ${reviews.length > 0 ? reviews.map(review => `
            <div class="review-item">
              <strong>${escapeHtml(review.rating)} ⭐｜${escapeHtml(review.userName || "顧客")}</strong>
              <span>${escapeHtml(review.createdAt || "")}</span>
              <p>${escapeHtml(review.comment)}</p>
            </div>
          `).join("") : `<div class="notice info">目前尚無評價。</div>`}
        </div>

        <div class="actions">
          <button class="secondary-btn" onclick="addFavorite(${room.id})">
            收藏
          </button>
          <button class="secondary-btn" onclick="addCart(${room.id})">
            加入購物車
          </button>
          <button class="primary-btn" onclick="event.stopPropagation(); createOrder(${room.id})">
            建立訂單
          </button>
        </div>
      </div>
    </div>
  `;
}

function validateBookingInputs(notice) {
  const checkIn = getValue("checkIn");
  const checkInTime = getValue("checkInTime") || "15:00";
  const checkOut = getValue("checkOut");
  const checkOutTime = getValue("checkOutTime") || "11:00";
  const guests = Number(getValue("guests"));

  if (!checkIn || !checkOut || !guests) {
    showNotice(notice, "error", "請補齊入住日期、退房日期與人數。");
    return { valid: false };
  }

  if (!Number.isInteger(guests) || guests <= 0) {
    showNotice(notice, "error", "人數需為大於 0 的整數。");
    return { valid: false };
  }

  const start = new Date(`${checkIn}T${checkInTime}`);
  const end = new Date(`${checkOut}T${checkOutTime}`);
  const startDateOnly = new Date(checkIn);
  const endDateOnly = new Date(checkOut);

  if (Number.isNaN(startDateOnly.getTime()) || Number.isNaN(endDateOnly.getTime()) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    showNotice(notice, "error", "日期或時間格式錯誤，請重新選擇。");
    return { valid: false };
  }

  const now = new Date();
  const hoursBeforeCheckIn = (start - now) / (1000 * 60 * 60);
  const nights = getBookingNights(checkIn, checkOut);

  if (nights <= 0) {
    showNotice(notice, "error", "退房日期不可早於或等於入住日期。");
    return { valid: false };
  }

  if (hoursBeforeCheckIn < 24) {
    showNotice(notice, "error", "需至少提前 24 小時預約。");
    return { valid: false };
  }

  if (nights > 30) {
    showNotice(notice, "error", "預訂期間不可超過 30 天。");
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

function getBookingNights(checkIn, checkOut) {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}

function isRoomAvailableForBooking(room, checkIn, checkOut) {
  if (!room || room.status === "inactive") return false;

  if (room.bookingStart && new Date(checkIn) < new Date(room.bookingStart)) {
    return false;
  }

  if (room.bookingEnd && new Date(checkOut) > new Date(room.bookingEnd)) {
    return false;
  }

  return Array.isArray(room.roomTypes) && room.roomTypes.some(type => {
    if (typeof getAvailableRoomTypeStock === "function" && checkIn && checkOut) {
      return getAvailableRoomTypeStock(room.id, type.id, checkIn, checkOut) > 0;
    }

    return Number(type.stock) > 0;
  });
}

function getRoomDataIssues(room) {
  const issues = [];

  if (!room.address) issues.push("地址");
  if (!room.desc) issues.push("描述");
  if (!Array.isArray(room.facilities) || room.facilities.length === 0) issues.push("設備");
  if (getRoomPolicyList(room).length === 0) issues.push("住房政策");
  if (!Array.isArray(room.roomTypes) || room.roomTypes.length === 0) issues.push("房型");
  if (!Array.isArray(room.images) || room.images.length === 0) issues.push("圖片");

  return issues;
}

// 詳細頁圖片左右滑動
function slideRoomImages(direction) {
  const slider = document.getElementById("roomImageSlider");

  if (!slider) return;

  const total = slider.children.length;

  if (total === 0) return;

  currentRoomImageIndex += direction;

  if (currentRoomImageIndex < 0) {
    currentRoomImageIndex = total - 1;
  }

  if (currentRoomImageIndex >= total) {
    currentRoomImageIndex = 0;
  }

  updateRoomImageSlider();
}

function goToRoomImage(index) {
  currentRoomImageIndex = index;
  updateRoomImageSlider();
}

function updateRoomImageSlider() {
  const slider = document.getElementById("roomImageSlider");
  const dots = document.querySelectorAll(".slider-dot");

  if (!slider) return;

  slider.style.transform = `translateX(-${currentRoomImageIndex * 100}%)`;

  dots.forEach((dot, index) => {
    dot.classList.toggle("active", index === currentRoomImageIndex);
  });
}

// 返回房源列表
function backToRoomList() {
  document.querySelectorAll("section").forEach(section => {
    section.classList.remove("active");
  });

  const homeSection =
    document.getElementById("search") ||
    document.getElementById("home") ||
    document.getElementById("rooms") ||
    document.querySelector("section");

  if (homeSection) {
    homeSection.classList.add("active");
  }

  renderRooms(rooms);
}

document.addEventListener("DOMContentLoaded", initializeBookingDatePicker);
