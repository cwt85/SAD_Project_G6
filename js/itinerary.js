/* =========================================================
   行程規劃、協作、投票與預算管理 (itinerary.js)
========================================================= */

const ItineraryEventBus = window.ItineraryEventBus || {
  listeners: {},
  on(eventName, handler) {
    this.listeners[eventName] = this.listeners[eventName] || [];
    this.listeners[eventName].push(handler);
  },
  emit(eventName, payload = {}) {
    (this.listeners[eventName] || []).forEach(handler => handler(payload));
  }
};

window.ItineraryEventBus = ItineraryEventBus;

const TAITUNG_STATION_PLACES = [
  { id: "station-main", name: "台東車站", type: "車站", distance: 0, img: "https://picsum.photos/seed/trainstation/400/200", desc: "集合、轉乘與租車最方便的起點。" },
  { id: "forest-park", name: "台東森林公園", type: "景點", distance: 5.4, img: "https://picsum.photos/seed/forestpark/400/200", desc: "湖景、自行車道與大片綠地，適合上午慢遊。" },
  { id: "tiehua", name: "鐵花村音樂聚落", type: "活動", distance: 5.8, img: "https://picsum.photos/seed/village/400/200", desc: "市區夜間表演、市集與文創店鋪。" },
  { id: "railway-art", name: "台東舊鐵道藝術村", type: "景點", distance: 5.6, img: "https://picsum.photos/seed/railwayart/400/200", desc: "散步、拍照與文創展覽都很方便。" },
  { id: "seashore-park", name: "台東海濱公園", type: "景點", distance: 7.2, img: "https://picsum.photos/seed/seashore/400/200", desc: "海景步道與國際地標，適合傍晚安排。" },
  { id: "beinan", name: "卑南遺址公園", type: "景點", distance: 2.1, img: "https://picsum.photos/seed/ruins/400/200", desc: "距離車站近，適合第一站文化行程。" },
  { id: "peinandazun", name: "卑南豬血湯", type: "餐廳", distance: 2.9, img: "https://picsum.photos/seed/localfood/400/200", desc: "在地小吃，適合早餐或午餐。" },
  { id: "blue-dragonfly", name: "藍蜻蜓速食專賣店", type: "餐廳", distance: 5.9, img: "https://picsum.photos/seed/fastfood/400/200", desc: "台東經典炸雞小吃，市區補給方便。" },
  { id: "brown-avenue", name: "伯朗大道", type: "景點", distance: 38, img: "https://picsum.photos/seed/ricefield/400/200", desc: "池上經典田園景觀，適合安排半日行程。" },
  { id: "chulu", name: "初鹿牧場", type: "活動", distance: 17, img: "https://picsum.photos/seed/pasture/400/200", desc: "親子活動、草地與乳製品體驗。" },
  { id: "luming", name: "鹿鳴溫泉酒店", type: "住宿", distance: 22, img: "https://picsum.photos/seed/hotspring/400/200", desc: "適合作為台東縱谷行程的住宿備選。" },
  { id: "duoliang", name: "多良車站", type: "交通", distance: 44, img: "https://picsum.photos/seed/coastalrail/400/200", desc: "海景鐵道景點，適合搭配南迴路線。" }
];

let lastItinerarySearchResults = [];
let expandedItineraryItemIds = {};
let draggedItineraryItemId = null;
let draggedItineraryDay = null;

// 將公里數轉換為從台東車站出發的預估車程時間（市區 ~35 km/h）
function formatTravelTime(km) {
  const min = Math.round(Number(km || 0) / 35 * 60);
  if (min === 0) return "起點";
  if (min < 60) return `約 ${min} 分`;
  return `約 ${Math.floor(min / 60)} 時 ${min % 60} 分`;
}

// 拖曳後依 day.startTime 為基準，每項間隔 1 小時重新分配時間
function redistributeDayTimes(day) {
  if (!day || !day.items.length) return;
  const [startH, startM] = (day.startTime || "09:00").split(":").map(Number);
  const startTotal = startH * 60 + startM;
  day.items.forEach((item, index) => {
    const total = startTotal + index * 60;
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    item.time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    item.updatedAt = nowText();
  });
}

// 右下角 Toast 提示（type: "success" | "error"）
function showToast(message, type = "success", duration = 2500) {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add("toast-show")));

  setTimeout(() => {
    toast.classList.remove("toast-show");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, duration);
}

// 點擊導航列「行程規劃」時呼叫：重設選取並顯示列表頁
function enterItinerarySection(btn) {
  activeItineraryId = null;
  activeItineraryDay = 1;
  saveAppData();
  if (typeof showSection === "function") showSection("itinerary", btn);
  showItineraryListView();
}

// 顯示列表頁，隱藏編輯頁
function showItineraryListView() {
  activeItineraryId = null;
  activeItineraryDay = 1;
  saveAppData();
  const listView = document.querySelector(".itinerary-list-view");
  const detailView = document.querySelector(".itinerary-detail-view");
  if (listView) listView.style.display = "";
  if (detailView) detailView.style.display = "none";
  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// 顯示編輯頁，隱藏列表頁
function showItineraryDetailView() {
  const listView = document.querySelector(".itinerary-list-view");
  const detailView = document.querySelector(".itinerary-detail-view");
  if (listView) listView.style.display = "none";
  if (detailView) detailView.style.display = "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// 舊函式保留相容（現已由 view 切換取代）
function updateWorkspaceVisibility() {}

// 切換「建立新行程」抽屜的展開／收合狀態
function toggleItineraryCreateDrawer() {
  const drawer = document.querySelector(".itinerary-create-drawer");
  if (drawer) drawer.open = !drawer.open;
}

// 行程已取消時，將快速加入面板所有輸入框 disable
function updateQuickAddPanelState() {
  const panel = document.querySelector(".itinerary-quick-add");
  if (!panel) return;
  const itinerary = getActiveItinerary();
  const cancelled = itinerary && itinerary.status === "已取消";
  panel.classList.toggle("is-cancelled", cancelled);
}

// 行程結束日期已過且狀態為「規劃中」→ 自動更新為「已完成」
function autoUpdateItineraryStatus() {
  if (!Array.isArray(itineraries)) return;
  const today = new Date().toISOString().slice(0, 10);
  let changed = false;
  itineraries.forEach(itinerary => {
    if (itinerary.status === "規劃中" && itinerary.endDate && itinerary.endDate < today) {
      itinerary.status = "已完成";
      addItineraryLog(itinerary, "自動完成", `行程結束日期 ${itinerary.endDate} 已過，由系統自動更新為已完成。`);
      changed = true;
    }
  });
  if (changed) saveAppData();
}

ItineraryEventBus.on("budget:warning", payload => {
  const notice = document.getElementById("itineraryNotice");
  const tripName = payload?.itinerary?.name || "目前行程";
  showNotice(notice, "warning", `${tripName} 已超過預算上限，請檢查費用或調整預算。`);
});

window.addEventListener("hashchange", () => {
  if (location.hash.includes("itineraryShare=")) {
    showSection("itinerary");
  }
  renderItineraryModule();
});

function renderItineraryModule() {
  const section = document.getElementById("itinerary");
  if (!section) return;

  const readonlyItinerary = getReadonlyItineraryFromHash();
  // 只要 URL 帶有分享 token，不論是否登入都進入唯讀模式
  const isReadonlyMode = Boolean(readonlyItinerary);
  section.classList.toggle("readonly-mode", isReadonlyMode);
  renderReadonlyItineraryShare(readonlyItinerary);

  // 唯讀分享模式：不渲染任何編輯介面，直接結束
  if (isReadonlyMode) return;

  if (!isLoggedIn || !currentUser) {
    renderLoggedOutItineraryState(null);
    return;
  }

  autoUpdateItineraryStatus();
  ensureActiveItinerary();
  renderItinerarySelects();
  renderAttractionDayOptions();
  renderItineraryLodgingOptions();
  renderItineraryOverview();
  renderItineraryCandidatePanel();
  renderItineraryDetail();
  updateQuickAddPanelState();
  updateWorkspaceVisibility();
}

function renderLoggedOutItineraryState(readonlyItinerary) {
  const notice = document.getElementById("itineraryNotice");
  const overview = document.getElementById("itineraryOverview");
  const detail = document.getElementById("itineraryDetailPanel");
  const results = document.getElementById("attractionResults");
  const lodging = document.getElementById("itineraryLodgingPanel");

  if (!readonlyItinerary && notice) {
    showNotice(notice, "warning", "請先登入後建立、編輯或協作行程。若你有分享連結，也可以直接用連結唯讀查看。");
  }

  const candidate = document.getElementById("itineraryCandidatePanel");
  if (overview) overview.innerHTML = "";
  if (detail) detail.innerHTML = "";
  if (results) results.innerHTML = "";
  if (lodging) lodging.innerHTML = "";
  if (candidate) candidate.innerHTML = "";
}

function renderReadonlyItineraryShare(itinerary) {
  const panel = document.getElementById("readonlyItineraryPanel");
  if (!panel) return;

  if (!itinerary) {
    panel.style.display = "none";
    panel.innerHTML = "";
    return;
  }

  panel.style.display = "block";
  const days = normalizeItineraryDays(itinerary);
  const totalCost = getItineraryTotalCost(itinerary);

  panel.innerHTML = `
    <div class="itinerary-detail-header">
      <div>
        <span class="status-pill">${escapeHtml(itinerary.status)}</span>
        <h2>${escapeHtml(itinerary.name)}</h2>
        <p>${escapeHtml(itinerary.destination)}｜${escapeHtml(itinerary.startDate)} ~ ${escapeHtml(itinerary.endDate)}</p>
      </div>
      <div class="itinerary-cost-box">
        <span>公開唯讀行程</span>
        <strong>NT$ ${totalCost.toLocaleString()}</strong>
        <small>累積預估與費用</small>
      </div>
    </div>
    ${days.map(day => `
      <div class="readonly-day">
        <h3>第 ${day.day} 天</h3>
        ${(day.items || []).length === 0
          ? `<div class="notice warning">此日尚未安排項目。</div>`
          : (day.items || []).map(item => `
            <div class="readonly-item">
              <strong>${escapeHtml(item.time || "--:--")}｜${escapeHtml(item.name)}</strong>
              <span>${escapeHtml(item.type || "景點")}｜預估 NT$ ${Number(item.estimatedCost || 0).toLocaleString()}</span>
              <p>${escapeHtml(item.notes || "")}</p>
            </div>
          `).join("")}
      </div>
    `).join("")}
  `;
}

function prefillItineraryToday() {
  const today = new Date().toISOString().slice(0, 10);
  setValue("itineraryStartDate", today);
}

function createItinerary() {
  if (!requireLogin()) return;

  const notice = document.getElementById("itineraryNotice");
  const name = getValue("itineraryName").trim();
  const destination = getValue("itineraryDestination").trim() || "台東車站周邊";
  const people = Number(getValue("itineraryPeople"));
  const days = Number(getValue("itineraryDays"));
  const startDate = getValue("itineraryStartDate");
  const budgetLimit = Number(getValue("itineraryBudgetLimit")) || 0;

  if (!name || !startDate || !Number.isInteger(days) || days < 1 || !Number.isInteger(people) || people < 1) {
    showNotice(notice, "error", "請完整填寫行程名稱、出發日期、人數與天數。");
    return;
  }

  const itinerary = {
    id: createItineraryId("trip"),
    ownerId: currentUser.id,
    ownerAccount: currentUser.account,
    ownerName: currentUser.displayName || currentUser.account,
    name,
    destination,
    people,
    days,
    startDate,
    endDate: addDays(startDate, days - 1),
    budgetLimit,
    status: "規劃中",
    memberIds: [],
    invitedAccounts: [],
    dayPlans: createEmptyDayPlans(days),
    votes: [],
    comments: [],
    expenses: [],
    logs: [],
    conflicts: [],
    shareToken: "",
    createdAt: nowText(),
    updatedAt: nowText()
  };

  addItineraryLog(itinerary, "建立行程", `${name}，${days} 天，目的地：${destination}`);
  itineraries.unshift(itinerary);
  activeItineraryId = itinerary.id;
  activeItineraryDay = 1;

  saveAppData();
  clearItineraryCreateForm();
  renderAll();
  ItineraryEventBus.emit("trip:created", { itinerary });
  showNotice(notice, "success", "行程已建立，可開始新增景點與邀請旅伴。");
  showItineraryDetailView();
}

function clearItineraryCreateForm() {
  setValue("itineraryName", "");
  setValue("itineraryDestination", "台東車站周邊");
  setValue("itineraryPeople", "2");
  setValue("itineraryDays", "2");
  setValue("itineraryStartDate", "");
  setValue("itineraryBudgetLimit", "");
}

function copyItinerary() {
  if (!requireLogin()) return;

  const notice = document.getElementById("itineraryNotice");
  const sourceId = getValue("itineraryCopySelect");
  const source = findItinerary(sourceId);

  if (!source || !canAccessItinerary(source)) {
    showNotice(notice, "error", "請選擇可存取的行程再複製（自己建立或受邀的行程皆可）。");
    return;
  }

  const copy = JSON.parse(JSON.stringify(source));
  copy.id = createItineraryId("trip");
  copy.name = `${source.name} 複製`;
  copy.ownerId = currentUser.id;
  copy.ownerAccount = currentUser.account;
  copy.ownerName = currentUser.displayName || currentUser.account;
  copy.status = "規劃中";
  copy.createdAt = nowText();
  copy.updatedAt = nowText();
  copy.memberIds = [];
  copy.invitedAccounts = [];
  copy.comments = [];
  copy.conflicts = [];
  copy.shareToken = "";
  copy.votes = Array.isArray(copy.votes) ? copy.votes.map(vote => ({
    ...vote,
    id: createItineraryId("vote"),
    options: (vote.options || []).map(option => ({ ...option, id: createItineraryId("opt"), voterIds: [] }))
  })) : [];
  copy.expenses = [];
  copy.logs = [];

  copy.dayPlans = normalizeItineraryDays(copy);
  copy.dayPlans.forEach(day => {
    day.items = day.items.map(item => ({
      ...item,
      id: createItineraryId("item"),
      addedById: currentUser.id,
      addedByName: currentUser.displayName || currentUser.account,
      updatedAt: nowText()
    }));
  });

  addItineraryLog(copy, "複製行程", `沿用「${source.name}」的每日規劃架構。`);
  itineraries.unshift(copy);
  activeItineraryId = copy.id;
  activeItineraryDay = 1;

  saveAppData();
  renderAll();
  ItineraryEventBus.emit("trip:created", { itinerary: copy, source });
  showNotice(notice, "success", "行程已複製，可繼續編輯。");
  showItineraryDetailView();
}

function searchItineraryAttractions() {
  const itinerary = getActiveItinerary();
  if (!canEditItinerary(itinerary)) return;

  const keyword = getValue("attractionSearchInput").trim().toLowerCase();
  const category = getValue("attractionCategoryFilter");

  lastItinerarySearchResults = TAITUNG_STATION_PLACES
    .filter(place => !category || place.type === category)
    .filter(place => {
      if (!keyword) return true;
      return `${place.name} ${place.type} ${place.desc}`.toLowerCase().includes(keyword);
    })
    .sort((a, b) => Number(a.distance) - Number(b.distance));

  renderAttractionResults();
}

function renderAttractionResults() {
  const container = document.getElementById("attractionResults");
  if (!container) return;

  if (!getActiveItinerary()) {
    container.innerHTML = `<div class="notice warning">請先建立或選擇行程。</div>`;
    return;
  }

  if (lastItinerarySearchResults.length === 0) {
    container.innerHTML = `<div class="notice warning">查無符合條件的推薦景點，可改用手動新增。</div>`;
    return;
  }

  container.innerHTML = `
    <div class="attraction-grid">
      ${lastItinerarySearchResults.map(place => `
        <article class="attraction-card">
          <div class="attraction-card-info">
            <img class="attraction-thumb" src="${escapeAttribute(place.img || "")}" alt="${escapeAttribute(place.name)}"
              onerror="this.src='https://picsum.photos/seed/taitung/400/200'" />
            <div>
              <strong>${escapeHtml(place.name)}</strong>
              <span>${escapeHtml(place.type)}｜車站車程 ${formatTravelTime(place.distance)}</span>
              <p>${escapeHtml(place.desc)}</p>
            </div>
          </div>
          <button class="secondary-btn" onclick="addRecommendedPlaceToItinerary('${place.id}')">加入</button>
        </article>
      `).join("")}
    </div>
  `;
}

function addRecommendedPlaceToItinerary(placeId) {
  const place = TAITUNG_STATION_PLACES.find(item => item.id === placeId);
  if (!place) return;

  addPlaceToItinerary({
    name: place.name,
    type: place.type,
    distance: place.distance,
    desc: place.desc,
    estimatedCost: Number(getValue("manualAttractionCost")) || 0
  });

  const dayNumber = Number(getValue("attractionTargetDay")) || activeItineraryDay;
  showToast(`「${place.name}」已加入第 ${dayNumber} 天`);
}

function addManualItineraryPlace() {
  const name = getValue("manualAttractionName").trim();
  const type = getValue("manualAttractionType") || "景點";
  const distance = Number(getValue("manualAttractionDistance")) || 0;
  const estimatedCost = Number(getValue("manualAttractionCost")) || 0;

  if (!name) {
    alert("請輸入手動景點、住宿、交通或活動名稱。");
    return;
  }

  addPlaceToItinerary({
    name,
    type,
    distance,
    desc: "手動新增項目",
    estimatedCost
  });

  const dayNumber = Number(getValue("attractionTargetDay")) || activeItineraryDay;
  showToast(`「${name}」已加入第 ${dayNumber} 天`);

  setValue("manualAttractionName", "");
  setValue("manualAttractionDistance", "0");
  setValue("manualAttractionCost", "0");
}

function quickAddItineraryPlace(name, type, distance = 0, estimatedCost = 0) {
  setValue("manualAttractionName", name);
  setValue("manualAttractionType", type);
  setValue("manualAttractionDistance", String(distance));
  setValue("manualAttractionCost", String(estimatedCost));
  addManualItineraryPlace();
}

function handleItineraryTypeChange() {
  renderItineraryLodgingOptions();
}

function showItineraryLodgingPicker() {
  setValue("manualAttractionType", "住宿");
  renderItineraryLodgingOptions(true);
}

function renderItineraryLodgingOptions(forceOpen = false) {
  const panel = document.getElementById("itineraryLodgingPanel");
  if (!panel) return;

  const selectedType = getValue("manualAttractionType");
  if (selectedType !== "住宿" && !forceOpen) {
    panel.innerHTML = "";
    return;
  }

  const activeRooms = Array.isArray(rooms)
    ? rooms.filter(room => room && room.status !== "inactive").slice(0, 8)
    : [];

  if (!getActiveItinerary()) {
    panel.innerHTML = `<div class="notice warning">請先建立或選擇行程，再從 B 模組住宿清單加入住宿。</div>`;
    return;
  }

  if (activeRooms.length === 0) {
    panel.innerHTML = `<div class="notice warning">目前 B 模組尚無可顯示住宿。</div>`;
    return;
  }

  panel.innerHTML = `
    <div class="lodging-picker">
      <div class="lodging-picker-header">
        <div>
          <strong>B 模組住宿</strong>
          <span>從住宿房源直接加入當天行程</span>
        </div>
        <button class="secondary-btn" onclick="hideItineraryLodgingPicker()">收合</button>
      </div>
      <div class="lodging-grid">
        ${activeRooms.map(room => renderItineraryLodgingCard(room)).join("")}
      </div>
    </div>
  `;
}

function hideItineraryLodgingPicker() {
  const panel = document.getElementById("itineraryLodgingPanel");
  if (panel) panel.innerHTML = "";
}

function renderItineraryLodgingCard(room) {
  const lowestPrice = Number(getLowestRoomTypePrice(room) || room.price || 0);
  const cover = room.image || getRoomCoverImage(room.id);
  const roomTypes = Array.isArray(room.roomTypes) ? room.roomTypes : [];
  const roomTypeSummary = roomTypes.length > 0
    ? `${roomTypes.length} 種房型｜最多 ${getMaxRoomTypeCapacity(room)} 人`
    : `最多 ${room.capacity || 2} 人`;

  return `
    <article class="lodging-card">
      <img src="${escapeAttribute(cover)}" alt="${escapeAttribute(room.name)}" onerror="this.src='https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80'" />
      <div>
        <h4>${escapeHtml(room.name)}</h4>
        <p>${escapeHtml(room.address || room.location || "台東住宿")}</p>
        <span>${escapeHtml(roomTypeSummary)}｜評價 ${Number(room.rating || 0).toFixed(1)}</span>
        <strong>NT$ ${lowestPrice.toLocaleString()} 起 / 晚</strong>
        <div class="actions">
          <button class="primary-btn" onclick="addRoomToItinerary(${Number(room.id)})">加入行程</button>
          <button class="secondary-btn" onclick="showSection('search')">看全部住宿</button>
        </div>
      </div>
    </article>
  `;
}

function addRoomToItinerary(roomId) {
  const room = findRoom(roomId);
  if (!room) {
    alert("找不到此住宿，請重新選擇。");
    return;
  }

  const lowestPrice = Number(getLowestRoomTypePrice(room) || room.price || 0);
  const notes = [
    room.address ? `地址：${room.address}` : "",
    room.stationDistance ? `交通：${room.stationDistance}` : "",
    Array.isArray(room.facilities) && room.facilities.length ? `設備：${room.facilities.slice(0, 4).join("、")}` : "",
    room.desc || ""
  ].filter(Boolean).join("\n");

  addPlaceToItinerary({
    name: room.name,
    type: "住宿",
    distance: 0,
    estimatedCost: lowestPrice,
    desc: notes,
    sourceModule: "B",
    roomId: room.id,
    address: room.address || ""
  });

  setValue("manualAttractionName", "");
  setValue("manualAttractionType", "住宿");
  setValue("manualAttractionCost", "0");
  renderItineraryLodgingOptions(true);

  // 加入後自動捲動到行程詳情，讓使用者看到新增的項目
  setTimeout(() => {
    const detail = document.getElementById("itineraryDetailPanel");
    if (detail) detail.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 150);
}

function addPlaceToItinerary(place) {
  const itinerary = getActiveItinerary();
  if (!canEditItinerary(itinerary)) return;

  const dayNumber = clampDayNumber(Number(getValue("attractionTargetDay")) || activeItineraryDay, itinerary);
  const day = getItineraryDay(itinerary, dayNumber);
  const item = {
    id: createItineraryId("item"),
    name: place.name,
    type: place.type || "景點",
    distance: Number(place.distance) || 0,
    time: (() => {
      const requested = getValue("attractionTargetTime") || "09:00";
      const startTime = day ? (day.startTime || "00:00") : "00:00";
      if (compareTime(requested, startTime) < 0) {
        showToast(`時間早於集合出發時間，已自動調整為 ${startTime}`, "error");
        return startTime;
      }
      return requested;
    })(),
    estimatedCost: Number(place.estimatedCost) || 0,
    notes: place.desc || "",
    mustGo: false,
    sourceModule: place.sourceModule || "",
    roomId: place.roomId || "",
    address: place.address || "",
    addedById: currentUser.id,
    addedByName: currentUser.displayName || currentUser.account,
    updatedAt: nowText()
  };

  day.items.push(item);
  sortDayItemsByTime(day);
  activeItineraryDay = dayNumber;

  const conflict = recordCompanionUpdate(itinerary, {
    type: "add-item",
    action: "新增行程項目",
    dayNumber,
    itemId: item.id,
    itemSnapshot: item,
    details: `新增「${item.name}」至第 ${dayNumber} 天。`
  });

  addItineraryLog(itinerary, "新增行程項目", `第 ${dayNumber} 天加入「${item.name}」。`, conflict?.id);
  touchItinerary(itinerary);
  saveAppData();
  renderAll();
  ItineraryEventBus.emit("spot:added", { itinerary, day, item });
}

function renderItinerarySelects() {
  const activeSelect = document.getElementById("itineraryActiveSelect");
  const copySelect = document.getElementById("itineraryCopySelect");
  const visible = getVisibleItineraries();

  if (activeSelect) {
    activeSelect.innerHTML = visible.length === 0
      ? `<option value="">尚無行程</option>`
      : visible.map(itinerary => `
        <option value="${escapeAttribute(itinerary.id)}" ${itinerary.id === activeItineraryId ? "selected" : ""}>
          ${escapeHtml(itinerary.name)}｜${escapeHtml(itinerary.status)}
        </option>
      `).join("");
  }

  if (copySelect) {
    copySelect.innerHTML = visible.length === 0
      ? `<option value="">尚無可複製行程</option>`
      : visible.map(itinerary => {
          const label = isItineraryOwner(itinerary) ? itinerary.name : `${itinerary.name}（受邀）`;
          return `<option value="${escapeAttribute(itinerary.id)}">${escapeHtml(label)}</option>`;
        }).join("");
  }

  const statusSelect = document.getElementById("itineraryStatusSelect");
  if (statusSelect) statusSelect.value = itineraryStatusFilter || "";

  const createDrawer = document.querySelector(".itinerary-create-drawer");
  if (createDrawer) {
    createDrawer.open = visible.length === 0;
  }
}

function renderAttractionDayOptions() {
  const select = document.getElementById("attractionTargetDay");
  const itinerary = getActiveItinerary();
  if (!select) return;

  if (!itinerary) {
    select.innerHTML = `<option value="1">第 1 天</option>`;
    return;
  }

  select.innerHTML = normalizeItineraryDays(itinerary).map(day => `
    <option value="${day.day}" ${Number(day.day) === Number(activeItineraryDay) ? "selected" : ""}>第 ${day.day} 天</option>
  `).join("");
}

function renderItineraryOverview() {
  const container = document.getElementById("itineraryOverview");
  if (!container) return;

  const allVisible = getVisibleItineraries();
  const filtered = allVisible.filter(itinerary =>
    !itineraryStatusFilter || itinerary.status === itineraryStatusFilter
  );

  const tabs = [
    { label: "全部", value: "" },
    { label: "規劃中", value: "規劃中" },
    { label: "已完成", value: "已完成" },
    { label: "已取消", value: "已取消" }
  ];

  const tabsHtml = `
    <div class="itinerary-tab-row">
      ${tabs.map(tab => `
        <button class="itinerary-tab-btn ${(itineraryStatusFilter || "") === tab.value ? "active" : ""}"
          onclick="setItineraryStatusFilter('${tab.value}')">
          ${escapeHtml(tab.label)}
        </button>
      `).join("")}
    </div>
  `;

  if (filtered.length === 0) {
    container.innerHTML = tabsHtml + `<div class="notice warning">目前沒有符合條件的行程。</div>`;
    return;
  }

  container.innerHTML = tabsHtml + `
    <div class="itinerary-card-grid">
      ${filtered.map(itinerary => renderItineraryCard(itinerary)).join("")}
    </div>
  `;
}

function renderItineraryCard(itinerary) {
  const owned = isItineraryOwner(itinerary);
  const members = getItineraryMembers(itinerary);
  const expense = getItineraryExpenseCost(itinerary);
  const spotCount = normalizeItineraryDays(itinerary)
    .reduce((sum, day) => sum + day.items.length, 0);
  const dateShort = formatDateShort(itinerary.startDate);
  const statusClass = { "規劃中": "planning", "已完成": "done", "已取消": "cancelled" }[itinerary.status] || "planning";
  const active = itinerary.id === activeItineraryId;

  return `
    <article class="itinerary-card ${active ? "active" : ""}" onclick="selectItinerary('${itinerary.id}')">
      <div class="itinerary-card-head">
        <h3>${escapeHtml(itinerary.name)}</h3>
        <span class="itinerary-card-status ${statusClass}">${escapeHtml(itinerary.status)}</span>
      </div>
      <div class="itinerary-card-meta">
        <span>📍 ${escapeHtml(itinerary.destination)}</span>
        <span>📅 ${escapeHtml(dateShort)}</span>
        <span>🕐 ${Number(itinerary.days)} 天</span>
        <span>🗺️ ${spotCount} 個景點</span>
      </div>
      <div class="itinerary-card-foot">
        <span>👥 ${members.length} 人協作</span>
        <span class="itinerary-card-expense">NT$${expense.toLocaleString()} 已記錄</span>
      </div>
      ${owned ? `
        <div class="itinerary-card-actions" onclick="event.stopPropagation()">
          ${itinerary.status === "已完成"
            ? `<span class="itinerary-card-status done">已完成</span>`
            : `<select onchange="updateItineraryStatus('${itinerary.id}', this.value)">
                <option value="規劃中" ${itinerary.status === "規劃中" ? "selected" : ""}>規劃中</option>
                <option value="已取消" ${itinerary.status === "已取消" ? "selected" : ""}>已取消</option>
              </select>`
          }
          <button class="danger-btn" onclick="deleteItinerary('${itinerary.id}')">刪除</button>
        </div>
      ` : `
        <div class="itinerary-card-actions">
          <span class="member-badge">受邀旅伴</span>
        </div>
      `}
    </article>
  `;
}

function formatDateShort(dateText) {
  if (!dateText) return "";
  const parts = dateText.split("-").map(Number);
  if (parts.length !== 3) return dateText;
  return `${parts[1]}月${parts[2]}日`;
}

function renderItineraryDetail() {
  const container = document.getElementById("itineraryDetailPanel");
  if (!container) return;

  const itinerary = getActiveItinerary();
  if (!itinerary) {
    container.innerHTML = `<div class="panel"><div class="notice warning">請先建立或選擇行程。</div></div>`;
    return;
  }

  normalizeItineraryDays(itinerary);
  const day = getItineraryDay(itinerary, activeItineraryDay);
  const totalCost = getItineraryTotalCost(itinerary);
  const overBudget = Number(itinerary.budgetLimit) > 0 && totalCost > Number(itinerary.budgetLimit);

  container.innerHTML = `
    <div class="panel">
      <div class="itinerary-detail-header">
        <div>
          <span class="status-pill">${escapeHtml(itinerary.status)}</span>
          <h2>${escapeHtml(itinerary.name)}</h2>
          <p>${escapeHtml(itinerary.destination)}｜${escapeHtml(itinerary.startDate)} ~ ${escapeHtml(itinerary.endDate)}</p>
        </div>
        <div class="itinerary-cost-box ${overBudget ? "warning" : ""}">
          <span>累積花費</span>
          <strong>NT$ ${totalCost.toLocaleString()}</strong>
          <small>預算上限：${Number(itinerary.budgetLimit || 0) > 0 ? `NT$ ${Number(itinerary.budgetLimit).toLocaleString()}` : "未設定"}</small>
        </div>
      </div>

      ${overBudget ? `<div class="notice warning">花費已超過預算上限，請檢查費用或調整預算。</div>` : ""}

      <details class="itinerary-subsection">
        <summary>基本資訊</summary>
        ${renderItineraryBasicEditor(itinerary)}
      </details>

      <details class="itinerary-subsection" open>
        <summary>每日行程編排</summary>
        ${renderDayTabs(itinerary)}
        ${renderDayPlan(itinerary, day)}
      </details>

      <details class="itinerary-subsection">
        <summary>協作與共享</summary>
        ${renderCollaborationPanel(itinerary)}
      </details>

      <details class="itinerary-subsection">
        <summary>協作討論與投票</summary>
        <div class="notice info">行程留言與投票已移至協作聊天室，可依「行程討論」與「投票決策」分類操作。</div>
        <div class="actions">
          <button class="primary-btn" onclick="openChatCategory('itinerary')">前往行程討論</button>
          <button class="secondary-btn" onclick="openChatCategory('polls')">前往投票決策</button>
        </div>
      </details>

      <details class="itinerary-subsection">
        <summary>預算與費用管理</summary>
        ${renderBudgetPanel(itinerary)}
      </details>

      <details class="itinerary-subsection">
        <summary>編輯紀錄與衝突處理</summary>
        ${renderConflictPanel(itinerary)}
        ${renderItineraryLogs(itinerary)}
      </details>
    </div>
  `;
}

function renderItineraryBasicEditor(itinerary) {
  const d = itinerary.status === "已取消" ? " disabled" : "";
  return `
    <div class="grid">
      <div>
        <label>行程名稱</label>
        <input${d} value="${escapeAttribute(itinerary.name)}" onchange="updateItineraryBasic('${itinerary.id}', 'name', this.value)" />
      </div>
      <div>
        <label>目的地</label>
        <input${d} value="${escapeAttribute(itinerary.destination)}" onchange="updateItineraryBasic('${itinerary.id}', 'destination', this.value)" />
      </div>
      <div>
        <label>人數</label>
        <input${d} type="number" min="1" value="${Number(itinerary.people || 1)}" onchange="updateItineraryBasic('${itinerary.id}', 'people', this.value)" />
      </div>
      <div>
        <label>天數</label>
        <input${d} type="number" min="1" max="30" value="${Number(itinerary.days || 1)}" onchange="updateItineraryBasic('${itinerary.id}', 'days', this.value)" />
      </div>
      <div>
        <label>出發日期</label>
        <input${d} type="date" value="${escapeAttribute(itinerary.startDate)}" onchange="updateItineraryBasic('${itinerary.id}', 'startDate', this.value)" />
      </div>
      <div>
        <label>預算上限</label>
        <input${d} type="number" min="0" value="${Number(itinerary.budgetLimit || 0)}" onchange="updateItineraryBasic('${itinerary.id}', 'budgetLimit', this.value)" />
      </div>
    </div>
  `;
}

function renderDayTabs(itinerary) {
  return `
    <div class="day-tabs">
      ${itinerary.dayPlans.map(day => `
        <button class="${Number(day.day) === Number(activeItineraryDay) ? "active" : ""}" onclick="selectItineraryDay(${day.day})">
          第 ${day.day} 天
        </button>
      `).join("")}
    </div>
  `;
}

function renderDayPlan(itinerary, day) {
  if (!day) return `<div class="notice warning">找不到此日行程。</div>`;

  const d = itinerary.status === "已取消" ? " disabled" : "";
  return `
    <div class="day-plan-toolbar">
      <div>
        <label>集合出發時間</label>
        <input${d} type="time" value="${escapeAttribute(day.startTime || "09:00")}" onchange="updateItineraryDayStart('${itinerary.id}', ${day.day}, this.value)" />
      </div>
      <div class="actions">
        <button${d} class="secondary-btn" onclick="sortItineraryDayByTime('${itinerary.id}', ${day.day})">依時間排序</button>
      </div>
    </div>
    <div class="itinerary-item-list">
      ${day.items.length === 0 ? `<div class="notice warning">此日尚未新增景點、餐廳、住宿或交通安排。</div>` : day.items.map(item => renderItineraryItemCard(itinerary, day, item)).join("")}
    </div>
  `;
}

function renderItineraryItemCard(itinerary, day, item) {
  const expanded = Boolean(expandedItineraryItemIds[item.id]);
  const cancelled = itinerary.status === "已取消";
  const d = cancelled ? " disabled" : "";

  return `
    <article class="itinerary-item-card ${item.mustGo ? "must-go" : ""}"
      data-item-id="${escapeAttribute(item.id)}"
      draggable="${cancelled ? "false" : "true"}"
      onclick="toggleItineraryItemNotesFromCard(event, '${item.id}')"
      ondragstart="${cancelled ? "" : `startItineraryDrag(${day.day}, '${item.id}', this, event)`}"
      ondragover="${cancelled ? "event.preventDefault()" : `event.preventDefault(); dragOverItineraryItem('${item.id}')`}"
      ondragleave="${cancelled ? "" : `dragLeaveItineraryItem('${item.id}')`}"
      ondragend="${cancelled ? "" : "endItineraryDrag(this)"}"
      ondrop="${cancelled ? "" : `dropItineraryItem(${day.day}, '${item.id}')`}">
      <div class="itinerary-item-main">
        <div>
          <span class="type-pill">${escapeHtml(item.type)}</span>
          ${item.mustGo ? `<span class="must-pill">必去候選</span>` : ""}
          <h4>${escapeHtml(item.name)}</h4>
          <p>車站車程 ${formatTravelTime(item.distance)}｜預估 NT$ ${Number(item.estimatedCost || 0).toLocaleString()}</p>
        </div>
        <div class="itinerary-item-controls">
          <input${d} type="time" value="${escapeAttribute(item.time || "09:00")}" onchange="updateItineraryItemField(${day.day}, '${item.id}', 'time', this.value)" />
          <button${d} class="secondary-btn" onclick="toggleItineraryItemNotes('${item.id}')">${expanded ? "收合" : "備註"}</button>
          <button${d} class="danger-btn" onclick="removeItineraryItem(${day.day}, '${item.id}')">刪除</button>
        </div>
      </div>
      <div class="itinerary-note-panel ${expanded ? "open" : ""}">
        <button${d} class="must-go-toggle ${item.mustGo ? "is-must-go" : ""}"
          onclick="updateItineraryItemField(${day.day}, '${item.id}', 'mustGo', ${!item.mustGo})">
          ${item.mustGo ? "★ 已標記為必去候選" : "☆ 標記為必去候選"}
        </button>
        <label>預估費用</label>
        <input${d} type="number" min="0" value="${Number(item.estimatedCost || 0)}" onchange="updateItineraryItemField(${day.day}, '${item.id}', 'estimatedCost', this.value)" />
        <label>備註</label>
        <textarea${d} onchange="updateItineraryItemField(${day.day}, '${item.id}', 'notes', this.value)">${escapeHtml(item.notes || "")}</textarea>
      </div>
    </article>
  `;
}

function renderCollaborationPanel(itinerary) {
  const members = getItineraryMembers(itinerary);
  const shareLink = getReadonlyShareLink(itinerary);
  const inviteControl = isItineraryOwner(itinerary)
    ? `
      <div class="inline-control">
        <input id="inviteMemberAccount" placeholder="輸入已註冊旅伴 Email 或手機" />
        <button class="primary-btn" onclick="inviteItineraryMember('${itinerary.id}')">邀請</button>
      </div>
    `
    : `<div class="notice info">只有主邀約人可以邀請旅伴與產生分享連結。</div>`;

  return `
    <h3>行程成員</h3>
    <div class="member-list">
      ${members.map(member => `
        <span>${escapeHtml(member.displayName || member.account)}${String(member.id) === String(itinerary.ownerId) ? "｜主邀約人" : "｜旅伴"}</span>
      `).join("")}
    </div>
    ${inviteControl}

    <h3>唯讀分享連結</h3>
    <div class="readonly-share-box">
      <input readonly value="${escapeAttribute(shareLink || "尚未產生分享連結")}" />
      <div class="actions">
        <button class="primary-btn" onclick="generateReadonlyShareLink('${itinerary.id}')">
          ${shareLink ? "重新產生並複製" : "產生並複製連結"}
        </button>
      </div>
    </div>

    ${(itinerary.invitedAccounts || []).length > 0 ? `
      <h3>邀請紀錄</h3>
      <div class="log-list">
        ${(itinerary.invitedAccounts || []).map(invite => `
          <div class="log-item">
            <strong>${escapeHtml(invite.account)}</strong>
            <small>${escapeHtml(invite.invitedAt)}｜由 ${escapeHtml(invite.invitedBy)} 邀請</small>
          </div>
        `).join("")}
      </div>
    ` : ""}
  `;
}

function renderVotingPanel(itinerary) {
  return `
    <div class="grid">
      <div>
        <label for="voteTitleInput">投票主題</label>
        <input id="voteTitleInput" placeholder="例如 晚餐要吃哪一家？" />
      </div>
      <div>
        <label for="voteOptionInput">第一個選項</label>
        <input id="voteOptionInput" placeholder="例如 藍蜻蜓" />
      </div>
    </div>
    <div class="actions">
      <button class="primary-btn" onclick="createItineraryVote('${itinerary.id}')">建立投票</button>
    </div>

    <div class="vote-list">
      ${(itinerary.votes || []).length === 0 ? `<div class="notice warning">尚未建立投票。</div>` : (itinerary.votes || []).map(vote => `
        <article class="vote-card">
          <div class="vote-header">
            <div>
              <h3>${escapeHtml(vote.title)}</h3>
              <small>${escapeHtml(vote.createdAt || "")}</small>
            </div>
            <div class="inline-control compact">
              <input id="voteNewOption-${vote.id}" placeholder="新增選項" />
              <button class="secondary-btn" onclick="addVoteOption('${itinerary.id}', '${vote.id}')">加入</button>
            </div>
          </div>
          ${(vote.options || []).length === 0 ? `<div class="notice warning">此投票尚無選項。</div>` : (vote.options || []).map(option => {
            const voters = getVoterNames(option.voterIds || []);
            const hasVoted = (option.voterIds || []).some(id => String(id) === String(currentUser.id));
            return `
              <div class="vote-option">
                <div>
                  <strong>${escapeHtml(option.name)}</strong>
                  <span>${(option.voterIds || []).length} 票${voters.length ? `｜${escapeHtml(voters.join("、"))}` : ""}</span>
                </div>
                <div class="actions">
                  <button class="${hasVoted ? "danger-btn" : "secondary-btn"}" onclick="toggleVoteOption('${itinerary.id}', '${vote.id}', '${option.id}')">${hasVoted ? "取消" : "投票"}</button>
                  ${isItineraryOwner(itinerary) ? `<button class="danger-btn" onclick="deleteVoteOption('${itinerary.id}', '${vote.id}', '${option.id}')">刪除</button>` : ""}
                </div>
              </div>
            `;
          }).join("")}
        </article>
      `).join("")}
    </div>
  `;
}

function renderCommentPanel(itinerary) {
  const comments = [...(itinerary.comments || [])].reverse();
  return `
    <div class="itinerary-chat-shell">
      <div id="itineraryCommentThread" class="chat-box itinerary-discussion-thread">
        ${comments.length === 0 ? `
          <div class="chat-empty-state">
            <div class="chat-empty-icon">💬</div>
            <p>尚無行程討論，輸入集合提醒、分工事項或住宿交通想法。</p>
          </div>
        ` : comments.map(comment => {
          const isMine = String(comment.userId) === String(currentUser.id);
          return `
            <div class="message ${isMine ? "message-customer" : "message-admin"} itinerary-discussion-message">
              <div class="message-header">
                <strong>${escapeHtml(comment.userName)}</strong>
                <span class="message-time">${escapeHtml(comment.time)}</span>
              </div>
              <div class="message-body">${escapeHtml(comment.text)}</div>
            </div>
          `;
        }).join("")}
      </div>
      <div class="chat-input-row itinerary-chat-input-row">
        <textarea id="itineraryCommentInput" rows="1" placeholder="輸入行程討論、集合提醒或分工事項..." onkeydown="handleItineraryCommentKeydown(event, '${itinerary.id}')"></textarea>
        <button class="primary-btn chat-send-btn" onclick="sendItineraryComment('${itinerary.id}')">送出</button>
      </div>
    </div>
  `;
}

function renderBudgetPanel(itinerary) {
  const totalCost = getItineraryTotalCost(itinerary);
  const planCost = getItineraryPlanCost(itinerary);
  const expenseCost = getItineraryExpenseCost(itinerary);
  const members = getItineraryMembers(itinerary);
  const splitMap = getExpenseSplitMap(itinerary);
  const paidMap = getExpensePaidMap(itinerary);

  return `
    <div class="budget-summary">
      <div>
        <span>預估景點與安排</span>
        <strong>NT$ ${planCost.toLocaleString()}</strong>
      </div>
      <div>
        <span>已記錄費用</span>
        <strong>NT$ ${expenseCost.toLocaleString()}</strong>
      </div>
      <div>
        <span>總花費</span>
        <strong>NT$ ${totalCost.toLocaleString()}</strong>
      </div>
    </div>

    <div class="grid">
      <div>
        <label for="expenseAmount">費用金額</label>
        <input id="expenseAmount" type="number" min="0" placeholder="例如 1200" />
      </div>
      <div>
        <label for="expenseType">費用類型</label>
        <select id="expenseType">
          <option value="餐飲">餐飲</option>
          <option value="交通">交通</option>
          <option value="住宿">住宿</option>
          <option value="門票">門票</option>
          <option value="其他">其他</option>
        </select>
      </div>
      <div>
        <label for="expensePayer">付款人</label>
        <select id="expensePayer">
          ${members.map(member => `<option value="${escapeAttribute(member.id)}">${escapeHtml(member.displayName || member.account)}</option>`).join("")}
        </select>
      </div>
      <div>
        <label for="expenseNote">費用備註</label>
        <input id="expenseNote" placeholder="例如 午餐、包車訂金" />
      </div>
    </div>
    <div class="actions">
      <button class="primary-btn" onclick="addItineraryExpense('${itinerary.id}')">新增費用並均分</button>
    </div>

    <h3>分帳摘要</h3>
    <div class="expense-split-list">
      ${members.map(member => {
        const key = String(member.id);
        return `
          <div>
            <strong>${escapeHtml(member.displayName || member.account)}</strong>
            <span>已付 NT$ ${Number(paidMap[key] || 0).toLocaleString()}</span>
            <span>應分攤 NT$ ${Number(splitMap[key] || 0).toLocaleString()}</span>
          </div>
        `;
      }).join("")}
    </div>

    <h3>費用紀錄</h3>
    <div class="expense-list">
      ${(itinerary.expenses || []).length === 0 ? `<div class="notice warning">尚無費用紀錄。</div>` : (itinerary.expenses || []).map(expense => `
        <div class="expense-item">
          <strong>${escapeHtml(expense.type)}｜NT$ ${Number(expense.amount || 0).toLocaleString()}</strong>
          <span>付款人：${escapeHtml(getUserNameById(expense.payerId))}｜${escapeHtml(expense.time || "")}</span>
          <p>${escapeHtml(expense.note || "")}</p>
        </div>
      `).join("")}
    </div>
  `;
}

function renderConflictPanel(itinerary) {
  const conflicts = (itinerary.conflicts || []).filter(conflict => !conflict.resolved);

  if (conflicts.length === 0) {
    return `<div class="notice info">目前沒有待處理的旅伴修改紀錄。</div>`;
  }

  return `
    <h3>待處理旅伴修改</h3>
    <div class="conflict-list">
      ${conflicts.map(conflict => `
        <div class="conflict-card">
          <div>
            <strong>${escapeHtml(conflict.action || "旅伴修改")}</strong>
            <small>${escapeHtml(conflict.userName || "")}｜${escapeHtml(conflict.time || "")}</small>
            <p>${escapeHtml(conflict.details || "")}</p>
          </div>
          ${isItineraryOwner(itinerary) ? `<button class="danger-btn" onclick="revokeItineraryConflict('${itinerary.id}', '${conflict.id}')">撤銷修改</button>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function renderItineraryCandidatePanel() {
  const container = document.getElementById("itineraryCandidatePanel");
  if (!container) return;

  const itinerary = getActiveItinerary();
  if (!itinerary) {
    container.innerHTML = "";
    return;
  }

  // 收集所有天中 mustGo=true 的景點
  const candidates = normalizeItineraryDays(itinerary).flatMap(day =>
    day.items.filter(item => item.mustGo).map(item => ({ ...item, dayNumber: day.day }))
  );

  if (candidates.length === 0) {
    container.innerHTML = `
      <div class="panel candidate-panel">
        <div class="itinerary-panel-title compact">
          <div><h2>必去候選</h2><p>尚未標記任何必去景點。</p></div>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="panel candidate-panel">
      <div class="itinerary-panel-title compact">
        <div>
          <h2>必去候選</h2>
          <p>共 ${candidates.length} 個景點已標記為必去。</p>
        </div>
      </div>
      <div class="candidate-list">
        ${candidates.map(item => `
          <div class="candidate-item">
            <div class="candidate-item-info">
              <span class="must-pill">必去</span>
              <div>
                <strong>${escapeHtml(item.name)}</strong>
                <small>第 ${item.dayNumber} 天｜${escapeHtml(item.time || "--:--")}｜${escapeHtml(item.type)}</small>
              </div>
            </div>
            <button class="secondary-btn" onclick="unmarkMustGo(${item.dayNumber}, '${item.id}')">取消候選</button>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function unmarkMustGo(dayNumber, itemId) {
  updateItineraryItemField(dayNumber, itemId, "mustGo", false);
}

function renderItineraryLogs(itinerary) {
  return `
    <h3>操作紀錄</h3>
    <div class="log-list">
      ${(itinerary.logs || []).length === 0 ? `<div class="notice warning">尚無操作紀錄。</div>` : (itinerary.logs || []).map(log => `
        <div class="log-item">
          <strong>${escapeHtml(log.action)}</strong>
          <p>${escapeHtml(log.details || "")}</p>
          <small>${escapeHtml(log.userName || "系統")}｜${escapeHtml(log.time || "")}</small>
        </div>
      `).join("")}
    </div>
  `;
}

function updateItineraryBasic(itineraryId, field, value) {
  const itinerary = findItinerary(itineraryId);
  if (!canEditItinerary(itinerary)) return;

  const oldValue = itinerary[field];
  let nextValue = value;

  if (["people", "days", "budgetLimit"].includes(field)) {
    nextValue = Math.max(field === "budgetLimit" ? 0 : 1, Number(value) || 0);
  }

  itinerary[field] = nextValue;

  if (field === "days") {
    itinerary.days = Math.min(30, Math.max(1, Number(nextValue) || 1));
    itinerary.dayPlans = resizeDayPlans(itinerary.dayPlans, itinerary.days);
    activeItineraryDay = clampDayNumber(activeItineraryDay, itinerary);
  }

  if (field === "startDate" || field === "days") {
    itinerary.endDate = addDays(itinerary.startDate, Number(itinerary.days || 1) - 1);
  }

  const conflict = recordCompanionUpdate(itinerary, {
    type: "update-basic",
    action: "更新基本資訊",
    field,
    oldValue,
    newValue: nextValue,
    details: `更新 ${getItineraryFieldLabel(field)}。`
  });

  addItineraryLog(itinerary, "更新基本資訊", `${getItineraryFieldLabel(field)}：${oldValue ?? ""} → ${nextValue}`, conflict?.id);
  touchItinerary(itinerary);
  saveAppData();
  renderAll();
  ItineraryEventBus.emit("trip:updated", { itinerary, field });
}

function updateItineraryDayStart(itineraryId, dayNumber, value) {
  const itinerary = findItinerary(itineraryId);
  if (!canEditItinerary(itinerary)) return;

  const day = getItineraryDay(itinerary, dayNumber);
  if (!day) return;

  const oldValue = day.startTime;
  day.startTime = value || "09:00";

  // 將早於新集合時間的項目自動推後到集合時間
  let adjustedCount = 0;
  day.items.forEach(item => {
    if (compareTime(item.time || "00:00", day.startTime) < 0) {
      item.time = day.startTime;
      item.updatedAt = nowText();
      adjustedCount++;
    }
  });
  if (adjustedCount > 0) {
    sortDayItemsByTime(day);
    showToast(`已自動調整 ${adjustedCount} 個項目至集合時間（${day.startTime}）`);
  }

  const conflict = recordCompanionUpdate(itinerary, {
    type: "update-day",
    action: "更新集合時間",
    dayNumber,
    oldValue,
    newValue: day.startTime,
    details: `第 ${dayNumber} 天集合時間更新為 ${day.startTime}。`
  });

  addItineraryLog(itinerary, "更新集合時間", `第 ${dayNumber} 天：${oldValue || ""} → ${day.startTime}`, conflict?.id);
  touchItinerary(itinerary);
  saveAppData();
  renderAll();
  ItineraryEventBus.emit("spot:updated", { itinerary, day });
}

function updateItineraryItemField(dayNumber, itemId, field, value) {
  const itinerary = getActiveItinerary();
  if (!canEditItinerary(itinerary)) return;

  const item = findItineraryItem(itinerary, dayNumber, itemId);
  if (!item) return;

  const oldValue = item[field];
  let nextValue = value;
  if (field === "estimatedCost") nextValue = Number(value) || 0;
  if (field === "mustGo") nextValue = Boolean(value);

  if (field === "time") {
    const day = getItineraryDay(itinerary, dayNumber);
    const startTime = day ? (day.startTime || "00:00") : "00:00";
    if (compareTime(String(nextValue), startTime) < 0) {
      showToast(`⚠ 項目時間不能早於集合出發時間（${startTime}）`, "error");
      renderItineraryDetail(); // 還原 UI 輸入框
      return;
    }
    item[field] = nextValue;
    item.updatedAt = nowText();
    sortDayItemsByTime(day);
  } else {
    item[field] = nextValue;
    item.updatedAt = nowText();
  }

  const conflict = recordCompanionUpdate(itinerary, {
    type: "update-item",
    action: "更新景點內容",
    dayNumber,
    itemId,
    field,
    oldValue,
    newValue: nextValue,
    details: `更新第 ${dayNumber} 天「${item.name}」的 ${getItineraryFieldLabel(field)}。`
  });

  addItineraryLog(itinerary, "更新景點內容", `${item.name}：${getItineraryFieldLabel(field)} 已更新。`, conflict?.id);
  touchItinerary(itinerary);
  saveAppData();
  renderAll();
  ItineraryEventBus.emit("spot:updated", { itinerary, item, field });
}

function removeItineraryItem(dayNumber, itemId) {
  const itinerary = getActiveItinerary();
  if (!canEditItinerary(itinerary)) return;

  const day = getItineraryDay(itinerary, dayNumber);
  if (!day) return;

  const index = day.items.findIndex(item => item.id === itemId);
  if (index < 0) return;

  const [removed] = day.items.splice(index, 1);
  const conflict = recordCompanionUpdate(itinerary, {
    type: "delete-item",
    action: "刪除行程項目",
    dayNumber,
    itemSnapshot: removed,
    details: `刪除第 ${dayNumber} 天「${removed.name}」。`
  });

  addItineraryLog(itinerary, "刪除行程項目", `刪除第 ${dayNumber} 天「${removed.name}」。`, conflict?.id);
  touchItinerary(itinerary);
  saveAppData();
  renderAll();
  ItineraryEventBus.emit("spot:deleted", { itinerary, day, item: removed });
}

function toggleItineraryItemNotes(itemId) {
  expandedItineraryItemIds[itemId] = !expandedItineraryItemIds[itemId];
  renderItineraryDetail();
}

function toggleItineraryItemNotesFromCard(event, itemId) {
  const interactiveSelector = "button,input,select,textarea,label";
  if (event.target.closest(interactiveSelector)) return;
  toggleItineraryItemNotes(itemId);
}

function startItineraryDrag(dayNumber, itemId, el, event) {
  draggedItineraryDay = dayNumber;
  draggedItineraryItemId = itemId;

  if (!el) return;
  // 立即套用「被拿起」樣式 → 瀏覽器以此截圖作為 ghost image
  el.classList.add("is-lifting");
  // ghost 截圖後，讓實際卡片變半透明
  requestAnimationFrame(() => {
    el.classList.remove("is-lifting");
    el.classList.add("is-dragging");
  });
}

function dragOverItineraryItem(targetItemId) {
  if (!draggedItineraryItemId || targetItemId === draggedItineraryItemId) return;
  document.querySelectorAll(".itinerary-item-card.drag-target").forEach(card => {
    card.classList.remove("drag-target");
  });
  const card = document.querySelector(`.itinerary-item-card[data-item-id="${targetItemId}"]`);
  if (card) card.classList.add("drag-target");
}

function dragLeaveItineraryItem(targetItemId) {
  const card = document.querySelector(`.itinerary-item-card[data-item-id="${targetItemId}"]`);
  if (card) card.classList.remove("drag-target");
}

function endItineraryDrag(el) {
  if (el) el.classList.remove("is-dragging", "is-lifting");
  document.querySelectorAll(".itinerary-item-card.drag-target, .itinerary-item-card.is-dragging").forEach(card => {
    card.classList.remove("drag-target", "is-dragging");
  });
}

function dropItineraryItem(dayNumber, targetItemId) {
  const itinerary = getActiveItinerary();
  if (!canEditItinerary(itinerary)) return;
  if (Number(dayNumber) !== Number(draggedItineraryDay) || !draggedItineraryItemId) return;

  const day = getItineraryDay(itinerary, dayNumber);
  if (!day) return;

  const fromIndex = day.items.findIndex(item => item.id === draggedItineraryItemId);
  const toIndex = day.items.findIndex(item => item.id === targetItemId);

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

  // 交換兩個項目的時間槽（A↔B 時間互換，排序後位置自然跟著調整）
  const fromItem = day.items[fromIndex];
  const toItem = day.items[toIndex];
  const tempTime = fromItem.time;
  fromItem.time = toItem.time;
  toItem.time = tempTime;
  fromItem.updatedAt = nowText();
  toItem.updatedAt = nowText();

  sortDayItemsByTime(day);

  draggedItineraryDay = null;
  draggedItineraryItemId = null;

  recordCompanionUpdate(itinerary, {
    type: "reorder-day",
    action: "調整行程排序",
    dayNumber,
    details: `調整第 ${dayNumber} 天景點順序（時間互換）。`
  });

  addItineraryLog(itinerary, "調整行程排序", `拖曳交換第 ${dayNumber} 天「${fromItem.name}」與「${toItem.name}」的時間。`);
  touchItinerary(itinerary);
  saveAppData();
  renderAll();
  ItineraryEventBus.emit("spot:reordered", { itinerary, day });
}

function sortItineraryDayByTime(itineraryId, dayNumber) {
  const itinerary = findItinerary(itineraryId);
  if (!canEditItinerary(itinerary)) return;

  const day = getItineraryDay(itinerary, dayNumber);
  if (!day) return;

  sortDayItemsByTime(day);
  addItineraryLog(itinerary, "依時間排序", `第 ${dayNumber} 天已依集合出發時間排序。`);
  touchItinerary(itinerary);
  saveAppData();
  renderAll();
  ItineraryEventBus.emit("spot:reordered", { itinerary, day });
}

function selectItinerary(id) {
  activeItineraryId = id || null;
  activeItineraryDay = 1;
  saveAppData();
  renderAll();
  // 有選取行程時進入編輯頁
  if (id) showItineraryDetailView();
}

function selectItineraryDay(dayNumber) {
  activeItineraryDay = Number(dayNumber) || 1;
  saveAppData();
  renderAttractionDayOptions();
  renderItineraryDetail();
}

function setItineraryStatusFilter(status) {
  itineraryStatusFilter = status || "";
  saveAppData();
  renderAll();
}

function updateItineraryStatus(itineraryId, status) {
  const itinerary = findItinerary(itineraryId);
  if (!itinerary || !requireLogin()) return;

  if (!canAccessItinerary(itinerary)) {
    alert("你不是此行程成員，無法更新狀態。");
    return;
  }

  itinerary.status = status;
  addItineraryLog(itinerary, "更新行程狀態", `狀態更新為「${status}」。`);
  touchItinerary(itinerary);
  saveAppData();
  renderAll();
  ItineraryEventBus.emit("trip:updated", { itinerary, status });
}

function deleteItinerary(itineraryId) {
  const itinerary = findItinerary(itineraryId);
  if (!itinerary || !isItineraryOwner(itinerary)) {
    alert("只有主邀約人可以刪除行程。");
    return;
  }

  const confirmed = confirm(`確定要刪除「${itinerary.name}」嗎？此操作無法復原。`);
  if (!confirmed) return;

  itineraries = itineraries.filter(item => item.id !== itineraryId);
  activeItineraryId = getVisibleItineraries()[0]?.id || null;
  activeItineraryDay = 1;
  saveAppData();
  renderAll();
  ItineraryEventBus.emit("trip:deleted", { itinerary });
}

function inviteItineraryMember(itineraryId) {
  const itinerary = findItinerary(itineraryId);
  if (!itinerary || !isItineraryOwner(itinerary)) {
    alert("只有主邀約人可以邀請旅伴。");
    return;
  }

  const account = normalizeItineraryAccount(getValue("inviteMemberAccount"));
  const user = findUser(account);

  if (!account || !user) {
    alert("請輸入已註冊的旅伴 Email 或帳號。");
    return;
  }

  if (String(user.id) === String(itinerary.ownerId) || itinerary.memberIds.some(id => String(id) === String(user.id))) {
    alert("此使用者已在行程成員中。");
    return;
  }

  itinerary.memberIds.push(user.id);
  itinerary.invitedAccounts.push({
    account: user.account,
    invitedBy: currentUser.account,
    invitedAt: nowText()
  });

  addItineraryLog(itinerary, "邀請旅伴", `邀請 ${user.displayName || user.account} 加入協作。`);
  touchItinerary(itinerary);
  saveAppData();
  setValue("inviteMemberAccount", "");
  renderAll();
  ItineraryEventBus.emit("trip:memberInvited", { itinerary, user });
}

function createItineraryVote(itineraryId) {
  const itinerary = findItinerary(itineraryId);
  if (!canEditItinerary(itinerary)) return;

  const title = getValue("voteTitleInput").trim();
  const optionName = getValue("voteOptionInput").trim();

  if (!title || !optionName) {
    alert("請輸入投票主題與至少一個選項。");
    return;
  }

  const vote = {
    id: createItineraryId("vote"),
    title,
    options: [{ id: createItineraryId("opt"), name: optionName, voterIds: [] }],
    createdById: currentUser.id,
    createdAt: nowText()
  };

  itinerary.votes.unshift(vote);
  addItineraryLog(itinerary, "發起投票", title);
  touchItinerary(itinerary);
  saveAppData();
  renderAll();
  ItineraryEventBus.emit("poll:created", { itinerary, vote });
}

function addVoteOption(itineraryId, voteId) {
  const itinerary = findItinerary(itineraryId);
  if (!canEditItinerary(itinerary)) return;

  const vote = findVote(itinerary, voteId);
  const input = document.getElementById(`voteNewOption-${voteId}`);
  const name = input ? input.value.trim() : "";

  if (!vote || !name) {
    alert("請輸入投票選項。");
    return;
  }

  const option = { id: createItineraryId("opt"), name, voterIds: [] };
  vote.options.push(option);

  const conflict = recordCompanionUpdate(itinerary, {
    type: "vote-option-add",
    action: "新增投票選項",
    voteId,
    optionId: option.id,
    details: `新增投票選項「${name}」。`
  });

  addItineraryLog(itinerary, "新增投票選項", `新增「${name}」。`, conflict?.id);
  touchItinerary(itinerary);
  saveAppData();
  renderAll();
  ItineraryEventBus.emit("poll:optionAdded", { itinerary, vote, option });
}

function toggleVoteOption(itineraryId, voteId, optionId) {
  const itinerary = findItinerary(itineraryId);
  if (!canEditItinerary(itinerary)) return;

  const option = findVoteOption(itinerary, voteId, optionId);
  if (!option) return;

  const voterId = String(currentUser.id);
  option.voterIds = option.voterIds || [];
  const existingIndex = option.voterIds.findIndex(id => String(id) === voterId);

  if (existingIndex >= 0) {
    option.voterIds.splice(existingIndex, 1);
  } else {
    option.voterIds.push(currentUser.id);
  }

  addItineraryLog(itinerary, "更新投票", `${currentUser.displayName || currentUser.account} 更新了「${option.name}」投票。`);
  touchItinerary(itinerary);
  saveAppData();
  renderAll();
  ItineraryEventBus.emit("poll:voted", { itinerary, voteId, option });
}

function deleteVoteOption(itineraryId, voteId, optionId) {
  const itinerary = findItinerary(itineraryId);
  if (!itinerary || !isItineraryOwner(itinerary)) {
    alert("只有主邀約人可以刪除投票選項。");
    return;
  }

  const vote = findVote(itinerary, voteId);
  if (!vote) return;

  const option = vote.options.find(item => item.id === optionId);
  vote.options = vote.options.filter(item => item.id !== optionId);
  addItineraryLog(itinerary, "刪除投票選項", `刪除「${option?.name || "未知選項"}」。`);
  touchItinerary(itinerary);
  saveAppData();
  renderAll();
  ItineraryEventBus.emit("poll:optionDeleted", { itinerary, vote, option });
}

function sendItineraryComment(itineraryId) {
  const itinerary = findItinerary(itineraryId);
  if (!canEditItinerary(itinerary)) return;

  const input = document.getElementById("itineraryCommentInput");
  const text = input ? input.value.trim() : "";

  if (!text) {
    alert("請輸入留言內容。");
    return;
  }

  const comment = {
    id: createItineraryId("comment"),
    userId: currentUser.id,
    userName: currentUser.displayName || currentUser.account,
    text,
    time: nowText()
  };

  itinerary.comments.unshift(comment);
  addItineraryLog(itinerary, "新增留言", text.slice(0, 40));
  touchItinerary(itinerary);
  saveAppData();
  renderAll();
  setTimeout(scrollItineraryDiscussionToBottom, 0);
  ItineraryEventBus.emit("comment:added", { itinerary, comment });
}

function handleItineraryCommentKeydown(event, itineraryId) {
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  sendItineraryComment(itineraryId);
}

function scrollItineraryDiscussionToBottom() {
  const thread = document.getElementById("itineraryCommentThread");
  if (thread) {
    thread.scrollTop = thread.scrollHeight;
  }
}

function addItineraryExpense(itineraryId) {
  const itinerary = findItinerary(itineraryId);
  if (!canEditItinerary(itinerary)) return;

  const amount = Number(getValue("expenseAmount"));
  const type = getValue("expenseType") || "其他";
  const payerId = getValue("expensePayer");
  const note = getValue("expenseNote").trim();

  if (!amount || amount <= 0 || !payerId) {
    alert("請完整填寫費用金額與付款人。");
    return;
  }

  const members = getItineraryMembers(itinerary);
  const expense = {
    id: createItineraryId("expense"),
    amount,
    type,
    payerId,
    note,
    splits: splitExpenseEqually(amount, members.map(member => member.id)),
    createdById: currentUser.id,
    time: nowText()
  };

  itinerary.expenses.unshift(expense);

  const conflict = recordCompanionUpdate(itinerary, {
    type: "expense-add",
    action: "新增旅遊費用",
    expenseId: expense.id,
    details: `新增 ${type} 費用 NT$ ${amount.toLocaleString()}。`
  });

  addItineraryLog(itinerary, "新增旅遊費用", `${type} NT$ ${amount.toLocaleString()}。`, conflict?.id);

  touchItinerary(itinerary);
  saveAppData();

  const overBudget = Number(itinerary.budgetLimit || 0) > 0 && getItineraryTotalCost(itinerary) > Number(itinerary.budgetLimit);
  if (overBudget) {
    addItineraryLog(itinerary, "預算警告", "累積花費已超過預算上限，已提醒所有成員。");
    saveAppData();
    ItineraryEventBus.emit("budget:warning", { itinerary });
  }

  renderAll();
  ItineraryEventBus.emit("expense:added", { itinerary, expense });
}

// 產生唯讀連結並直接複製（不觸發 renderAll 避免頁面跳動）
function generateReadonlyShareLink(itineraryId) {
  const itinerary = findItinerary(itineraryId);
  if (!itinerary || !isItineraryOwner(itinerary)) {
    alert("只有主邀約人可以產生唯讀分享連結。");
    return;
  }

  if (!itinerary.shareToken) {
    itinerary.shareToken = createItineraryId("share");
  }

  addItineraryLog(itinerary, "產生唯讀連結", "已產生外部唯讀分享連結。");
  touchItinerary(itinerary);
  saveAppData();

  const link = getReadonlyShareLink(itinerary);

  // 直接更新頁面上的 input 欄位，不觸發 renderAll
  const shareInput = document.querySelector(".readonly-share-box input");
  if (shareInput) shareInput.value = link;

  // 同時複製到剪貼簿
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(link)
      .then(() => showToast("唯讀連結已產生並複製"))
      .catch(() => prompt("請複製唯讀連結：", link));
  } else {
    prompt("請複製唯讀連結：", link);
  }
}

// 保留舊函式供其他地方呼叫
function copyReadonlyShareLink(itineraryId) {
  generateReadonlyShareLink(itineraryId);
}

function revokeItineraryConflict(itineraryId, conflictId) {
  const itinerary = findItinerary(itineraryId);
  if (!itinerary || !isItineraryOwner(itinerary)) {
    alert("只有主邀約人可以撤銷旅伴修改。");
    return;
  }

  const conflict = (itinerary.conflicts || []).find(item => item.id === conflictId);
  if (!conflict || conflict.resolved) return;

  if (conflict.type === "add-item") {
    const day = getItineraryDay(itinerary, conflict.dayNumber);
    if (day) day.items = day.items.filter(item => item.id !== conflict.itemId);
  }

  if (conflict.type === "delete-item") {
    const day = getItineraryDay(itinerary, conflict.dayNumber);
    if (day && conflict.itemSnapshot && !day.items.some(item => item.id === conflict.itemSnapshot.id)) {
      day.items.push(conflict.itemSnapshot);
      sortDayItemsByTime(day);
    }
  }

  if (conflict.type === "update-item") {
    const item = findItineraryItem(itinerary, conflict.dayNumber, conflict.itemId);
    if (item && conflict.field) item[conflict.field] = conflict.oldValue;
  }

  if (conflict.type === "update-basic" && conflict.field) {
    itinerary[conflict.field] = conflict.oldValue;
    if (conflict.field === "days") itinerary.dayPlans = resizeDayPlans(itinerary.dayPlans, Number(itinerary.days || 1));
    if (conflict.field === "startDate" || conflict.field === "days") {
      itinerary.endDate = addDays(itinerary.startDate, Number(itinerary.days || 1) - 1);
    }
  }

  if (conflict.type === "expense-add") {
    itinerary.expenses = (itinerary.expenses || []).filter(expense => expense.id !== conflict.expenseId);
  }

  if (conflict.type === "vote-option-add") {
    const vote = findVote(itinerary, conflict.voteId);
    if (vote) vote.options = (vote.options || []).filter(option => option.id !== conflict.optionId);
  }

  conflict.resolved = true;
  conflict.resolvedBy = currentUser.account;
  conflict.resolvedAt = nowText();

  addItineraryLog(itinerary, "撤銷旅伴修改", conflict.details || conflict.action);
  touchItinerary(itinerary);
  saveAppData();
  renderAll();
  ItineraryEventBus.emit("trip:undone", { itinerary, conflict });
}

function recordCompanionUpdate(itinerary, detail) {
  return createItineraryConflict(itinerary, detail);
}

function createItineraryConflict(itinerary, detail) {
  if (!itinerary || isItineraryOwner(itinerary)) return null;

  const conflict = {
    id: createItineraryId("conflict"),
    ...detail,
    userId: currentUser.id,
    userName: currentUser.displayName || currentUser.account,
    time: nowText(),
    resolved: false
  };

  itinerary.conflicts = itinerary.conflicts || [];
  itinerary.conflicts.unshift(conflict);
  return conflict;
}

function addItineraryLog(itinerary, action, details = "", conflictId = "") {
  itinerary.logs = itinerary.logs || [];
  itinerary.logs.unshift({
    id: createItineraryId("log"),
    action,
    details,
    conflictId,
    userId: currentUser ? currentUser.id : "system",
    userName: currentUser ? currentUser.displayName || currentUser.account : "系統",
    time: nowText()
  });
}

function addSystemItemToItinerary(data = {}) {
  const itinerary = getActiveItinerary();
  if (!itinerary || !currentUser || !canAccessItinerary(itinerary)) return null;

  normalizeItineraryDays(itinerary);
  const dayNumber = data.date ? getDayNumberByDate(itinerary, data.date) : activeItineraryDay;
  const day = getItineraryDay(itinerary, dayNumber);
  if (!day) return null;

  if (data.sourceId) {
    for (const existingDay of itinerary.dayPlans) {
      const existingItem = (existingDay.items || []).find(item => item.sourceId === data.sourceId);
      if (existingItem) {
        Object.assign(existingItem, {
          name: data.name || existingItem.name,
          type: data.type || existingItem.type,
          distance: Number(data.distance ?? existingItem.distance ?? 0),
          time: data.time || existingItem.time || "09:00",
          endTime: data.endTime || existingItem.endTime || "",
          estimatedCost: Number(data.estimatedCost ?? existingItem.estimatedCost ?? 0),
          notes: data.notes || existingItem.notes || "",
          sourceModule: data.sourceModule || existingItem.sourceModule || "",
          roomId: data.roomId || existingItem.roomId || "",
          trainOrderId: data.trainOrderId || existingItem.trainOrderId || "",
          address: data.address || existingItem.address || "",
          updatedAt: nowText()
        });
        sortDayItemsByTime(existingDay);
        addItineraryLog(itinerary, "更新整合資料", `${data.sourceModule || "系統"} 已更新第 ${existingDay.day} 天：${existingItem.name}`);
        runItineraryConflictCheck(itinerary);
        touchItinerary(itinerary);
        saveAppData();
        renderAll();
        return existingItem;
      }
    }
  }

  const item = {
    id: createItineraryId("item"),
    name: data.name || "整合項目",
    type: data.type || "交通",
    distance: Number(data.distance || 0),
    time: data.time || "09:00",
    endTime: data.endTime || "",
    estimatedCost: Number(data.estimatedCost || 0),
    notes: data.notes || "",
    mustGo: false,
    sourceModule: data.sourceModule || "",
    sourceId: data.sourceId || "",
    roomId: data.roomId || "",
    trainOrderId: data.trainOrderId || "",
    address: data.address || "",
    addedById: currentUser.id,
    addedByName: currentUser.displayName || currentUser.account,
    updatedAt: nowText()
  };

  day.items.push(item);
  sortDayItemsByTime(day);
  addItineraryLog(itinerary, "整合模組資料", `${data.sourceModule || "系統"} 已加入第 ${day.day} 天：${item.name}`);
  runItineraryConflictCheck(itinerary);
  touchItinerary(itinerary);
  saveAppData();
  renderAll();
  return item;
}

function integrateLodgingOrderToItinerary(order) {
  if (!order || typeof addSystemItemToItinerary !== "function") return null;
  const room = typeof findRoom === "function" ? findRoom(order.roomId) : null;
  const checkInTime = room?.checkInTime || "15:00";

  return addSystemItemToItinerary({
    name: `${order.roomName}（${order.roomTypeName || "住宿"}）`,
    type: "住宿",
    date: order.checkIn,
    time: checkInTime,
    endTime: "11:00",
    estimatedCost: Number(order.amount || 0),
    sourceModule: "B",
    sourceId: `lodging-${order.id}`,
    roomId: order.roomId,
    address: order.address || room?.address || "",
    notes: `住宿日期 ${order.checkIn} ~ ${order.checkOut}；${Number(order.nights || 1)} 晚；訂單狀態 ${order.status || ""}`
  });
}

function getDayNumberByDate(itinerary, dateText) {
  if (!itinerary || !dateText || !itinerary.startDate) return activeItineraryDay || 1;
  const start = new Date(`${itinerary.startDate}T00:00:00`);
  const target = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(target.getTime())) return activeItineraryDay || 1;
  const diff = Math.floor((target - start) / (1000 * 60 * 60 * 24)) + 1;
  return clampDayNumber(diff, itinerary);
}

function runItineraryConflictCheck(itinerary) {
  if (!itinerary) return [];

  itinerary.conflicts = itinerary.conflicts || [];
  const existingKeys = new Set(itinerary.conflicts.map(conflict => conflict.conflictKey).filter(Boolean));
  const newConflicts = [];

  normalizeItineraryDays(itinerary).forEach(day => {
    const trainItems = day.items.filter(item => item.sourceModule === "C" && item.endTime);
    const lodgingItems = day.items.filter(item => item.sourceModule === "B" || item.type === "住宿");

    trainItems.forEach(trainItem => {
      lodgingItems.forEach(lodgingItem => {
        const checkInTime = lodgingItem.time || "15:00";
        if (compareTime(trainItem.endTime, checkInTime) > 0) {
          const conflictKey = `train-lodging-${day.day}-${trainItem.id}-${lodgingItem.id}`;
          if (!existingKeys.has(conflictKey)) {
            newConflicts.push({
              id: createItineraryId("conflict"),
              conflictKey,
              type: "schedule-conflict",
              action: "車票與住宿時間衝突",
              dayNumber: day.day,
              details: `列車 ${trainItem.name} 抵達 ${trainItem.endTime}，晚於住宿 ${lodgingItem.name} 的 Check-in ${checkInTime}。`,
              userId: "system",
              userName: "系統",
              time: nowText(),
              resolved: false
            });
          }
        }
      });
    });
  });

  if (newConflicts.length > 0) {
    itinerary.conflicts.unshift(...newConflicts);
  }

  return newConflicts;
}

function compareTime(a, b) {
  const [aHour, aMinute] = String(a || "00:00").split(":").map(Number);
  const [bHour, bMinute] = String(b || "00:00").split(":").map(Number);
  return (aHour * 60 + aMinute) - (bHour * 60 + bMinute);
}

function ensureActiveItinerary() {
  const visible = getVisibleItineraries();
  if (visible.length === 0) {
    activeItineraryId = null;
    activeItineraryDay = 1;
    return;
  }

  // 只驗證現有選取是否仍有效，不自動選取第一個
  // （讓使用者透過點擊卡片來明確選取行程）
  if (activeItineraryId && !visible.some(itinerary => itinerary.id === activeItineraryId)) {
    activeItineraryId = null;
    activeItineraryDay = 1;
  }

  const itinerary = getActiveItinerary();
  if (itinerary) {
    normalizeItineraryDays(itinerary);
    activeItineraryDay = clampDayNumber(activeItineraryDay, itinerary);
  }
}

function getVisibleItineraries() {
  if (!isLoggedIn || !currentUser) return [];
  return itineraries.filter(canAccessItinerary);
}

function canAccessItinerary(itinerary) {
  if (!itinerary || !currentUser) return false;
  return String(itinerary.ownerId) === String(currentUser.id) ||
    (itinerary.memberIds || []).some(id => String(id) === String(currentUser.id));
}

function canEditItinerary(itinerary) {
  if (!itinerary) {
    alert("請先建立或選擇行程。");
    return false;
  }

  if (!requireLogin()) return false;

  if (!canAccessItinerary(itinerary)) {
    alert("你不是此行程成員，無法編輯。");
    return false;
  }

  if (itinerary.status === "已取消") {
    alert("已取消行程不可再編輯。");
    return false;
  }

  return true;
}

function isItineraryOwner(itinerary) {
  return Boolean(itinerary && currentUser && String(itinerary.ownerId) === String(currentUser.id));
}

function getActiveItinerary() {
  return findItinerary(activeItineraryId);
}

function findItinerary(id) {
  return itineraries.find(itinerary => itinerary.id === id) || null;
}

function getItineraryDay(itinerary, dayNumber) {
  if (!itinerary) return null;
  normalizeItineraryDays(itinerary);
  return itinerary.dayPlans.find(day => Number(day.day) === Number(dayNumber)) || itinerary.dayPlans[0] || null;
}

function findItineraryItem(itinerary, dayNumber, itemId) {
  const day = getItineraryDay(itinerary, dayNumber);
  if (!day) return null;
  return day.items.find(item => item.id === itemId) || null;
}

function normalizeItineraryDays(itinerary) {
  if (!itinerary) return [];
  itinerary.days = Math.max(1, Number(itinerary.days) || 1);
  itinerary.dayPlans = resizeDayPlans(Array.isArray(itinerary.dayPlans) ? itinerary.dayPlans : [], itinerary.days);
  return itinerary.dayPlans;
}

function resizeDayPlans(dayPlans, days) {
  const next = Array.from({ length: days }, (_, index) => {
    const dayNumber = index + 1;
    const existing = dayPlans.find(day => Number(day.day) === dayNumber);
    return existing || { day: dayNumber, startTime: "09:00", items: [] };
  });

  next.forEach(day => {
    day.items = Array.isArray(day.items) ? day.items : [];
    day.startTime = day.startTime || "09:00";
  });

  return next;
}

function createEmptyDayPlans(days) {
  return resizeDayPlans([], days);
}

function clampDayNumber(dayNumber, itinerary) {
  const max = Math.max(1, Number(itinerary?.days) || 1);
  return Math.min(Math.max(1, Number(dayNumber) || 1), max);
}

function sortDayItemsByTime(day) {
  day.items.sort((a, b) => String(a.time || "99:99").localeCompare(String(b.time || "99:99")));
}

function getItineraryMembers(itinerary) {
  if (!itinerary) return [];

  const ids = [itinerary.ownerId, ...(itinerary.memberIds || [])].map(id => String(id));
  return ids.map(id => {
    const user = users.find(item => String(item.id) === id);
    if (user) return user;
    if (String(itinerary.ownerId) === id) {
      return { id, account: itinerary.ownerAccount, displayName: itinerary.ownerName };
    }
    return { id, account: `member-${id}`, displayName: `成員 ${id}` };
  });
}

function getItineraryPlanCost(itinerary) {
  return normalizeItineraryDays(itinerary).reduce((sum, day) =>
    sum + day.items.reduce((daySum, item) => daySum + Number(item.estimatedCost || 0), 0), 0);
}

function getItineraryExpenseCost(itinerary) {
  return (itinerary.expenses || []).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
}

function getItineraryTotalCost(itinerary) {
  return getItineraryPlanCost(itinerary) + getItineraryExpenseCost(itinerary);
}

function getExpensePaidMap(itinerary) {
  return (itinerary.expenses || []).reduce((map, expense) => {
    const key = String(expense.payerId);
    map[key] = (map[key] || 0) + Number(expense.amount || 0);
    return map;
  }, {});
}

function getExpenseSplitMap(itinerary) {
  return (itinerary.expenses || []).reduce((map, expense) => {
    const splits = Array.isArray(expense.splits) && expense.splits.length > 0
      ? expense.splits
      : splitExpenseEqually(Number(expense.amount || 0), getItineraryMembers(itinerary).map(member => member.id));

    splits.forEach(split => {
      const key = String(split.userId);
      map[key] = (map[key] || 0) + Number(split.amountOwed || 0);
    });
    return map;
  }, {});
}

function splitExpenseEqually(amount, userIds) {
  const ids = Array.isArray(userIds) ? userIds : [];
  if (ids.length === 0) return [];

  const share = Math.floor(Number(amount || 0) / ids.length);
  let remainder = Number(amount || 0) - share * ids.length;

  return ids.map(userId => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return {
      id: createItineraryId("split"),
      userId,
      amountOwed: share + extra,
      isSettled: false
    };
  });
}

function findVote(itinerary, voteId) {
  return (itinerary.votes || []).find(vote => vote.id === voteId) || null;
}

function findVoteOption(itinerary, voteId, optionId) {
  const vote = findVote(itinerary, voteId);
  return vote ? (vote.options || []).find(option => option.id === optionId) : null;
}

function getVoterNames(voterIds = []) {
  return voterIds.map(getUserNameById);
}

function getUserNameById(userId) {
  const user = users.find(item => String(item.id) === String(userId));
  return user ? user.displayName || user.account : `成員 ${userId}`;
}

function getReadonlyShareLink(itinerary) {
  if (!itinerary || !itinerary.shareToken) return "";
  const base = location.href.split("#")[0];
  return `${base}#itineraryShare=${encodeURIComponent(itinerary.shareToken)}`;
}

function getReadonlyItineraryFromHash() {
  const match = location.hash.match(/itineraryShare=([^&]+)/);
  if (!match) return null;
  const token = decodeURIComponent(match[1]);
  return itineraries.find(itinerary => itinerary.shareToken === token) || null;
}

function createItineraryId(prefix) {
  if (window.crypto && window.crypto.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function addDays(dateText, offset) {
  if (!dateText) return "";
  const parts = dateText.split("-").map(Number);
  if (parts.length !== 3) return "";
  // 使用本地時間建構子避免 UTC 時區偏移造成日期誤差
  const date = new Date(parts[0], parts[1] - 1, parts[2] + Number(offset || 0));
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function nowText() {
  return new Date().toLocaleString("zh-TW");
}

function touchItinerary(itinerary) {
  itinerary.updatedAt = nowText();
}

function normalizeItineraryAccount(account) {
  if (typeof normalizeAccount === "function") {
    return normalizeAccount(account);
  }
  return String(account || "").trim().toLowerCase();
}

function escapeAttribute(value) {
  return escapeHtml(String(value ?? "")).replace(/"/g, "&quot;");
}

function getItineraryFieldLabel(field) {
  const labels = {
    name: "行程名稱",
    destination: "目的地",
    people: "人數",
    days: "天數",
    startDate: "出發日期",
    budgetLimit: "預算上限",
    startTime: "集合時間",
    time: "出發時間",
    estimatedCost: "預估費用",
    notes: "備註",
    mustGo: "必去候選"
  };

  return labels[field] || field;
}
