/* =========================================================
   全域狀態資料 (state.js)
   這些變數會暫存在瀏覽器記憶體中。
========================================================= */

// 認證相關
let isLoggedIn = false;
let currentUser = null;
let users = [
  {
    id: 1,
    account: "admin@example.com",
    type: "email",
    role: "admin",
    password: "Admin1234"
  }
];
let verificationCodes = {};
let lastCodeSentAt = {};

// 用戶操作相關
let favorites = [];
let cart = [];
let orders = [];
let selectedRoomTypes = {};
let itineraries = [];
let activeItineraryId = null;
let activeItineraryDay = 1;
let itineraryStatusFilter = "";
let trainOrders = [];
let selectedTrainResultId = null;
let lastTrainSearchResults = [];
let trainBonusPoints = 0;
let trainBonusAwardedMilestones = 0;
let userBonusPoints = {};
let userBonusAwardedMilestones = {};
let bonusPointRecords = [];
let trainWaitingList = [];
let manualReviewQueue = [];

// 房源相關
let rooms = [];
let editingRoomId = null;
let currentRoomImageIndex = 0;

// 管理員相關
let adminRoomTypes = [];
let pricingRecords = [];

// 常數
const VERIFICATION_CODE_EXPIRE_MS = 5 * 60 * 1000;
const APP_STORAGE_KEY = "taitungBookingData";
const MAX_ROOM_DATASET_SIZE = 50;
const defaultRoomImages = [
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=1200&q=80"
];

function saveAppData() {
  try {
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify({
      favorites,
      cart,
      orders,
      rooms,
      pricingRecords,
      selectedRoomTypes,
      itineraries,
      activeItineraryId,
      activeItineraryDay,
      itineraryStatusFilter,
      trainOrders,
      selectedTrainResultId,
      lastTrainSearchResults,
      trainBonusPoints,
      trainBonusAwardedMilestones,
      userBonusPoints,
      userBonusAwardedMilestones,
      bonusPointRecords,
      trainWaitingList,
      manualReviewQueue
    }));
  } catch (error) {
    console.error("系統資料儲存失敗：", error);
  }
}

function loadAppData() {
  try {
    const savedData = localStorage.getItem(APP_STORAGE_KEY);
    if (!savedData) return;

    const data = JSON.parse(savedData);
    let shouldRefreshStoredRooms = false;

    favorites = Array.isArray(data.favorites) ? data.favorites : [];
    cart = Array.isArray(data.cart) ? data.cart : [];
    orders = Array.isArray(data.orders) ? data.orders : [];
    itineraries = Array.isArray(data.itineraries) ? data.itineraries : [];
    activeItineraryId = data.activeItineraryId || null;
    activeItineraryDay = Number(data.activeItineraryDay) || 1;
    itineraryStatusFilter = data.itineraryStatusFilter || "";
    trainOrders = Array.isArray(data.trainOrders) ? data.trainOrders : [];
    selectedTrainResultId = data.selectedTrainResultId || null;
    lastTrainSearchResults = Array.isArray(data.lastTrainSearchResults) ? data.lastTrainSearchResults : [];
    trainBonusPoints = Number(data.trainBonusPoints) || 0;
    trainBonusAwardedMilestones = Number(data.trainBonusAwardedMilestones) || 0;
    userBonusPoints = data.userBonusPoints && typeof data.userBonusPoints === "object"
      ? data.userBonusPoints
      : {};
    userBonusAwardedMilestones = data.userBonusAwardedMilestones && typeof data.userBonusAwardedMilestones === "object"
      ? data.userBonusAwardedMilestones
      : {};
    bonusPointRecords = Array.isArray(data.bonusPointRecords) ? data.bonusPointRecords : [];
    manualReviewQueue = Array.isArray(data.manualReviewQueue) ? data.manualReviewQueue : [];

    if (
      currentUser &&
      Object.keys(userBonusPoints).length === 0 &&
      Number(trainBonusPoints || 0) > 0
    ) {
      userBonusPoints[String(currentUser.id)] = Number(trainBonusPoints || 0);
      userBonusAwardedMilestones[String(currentUser.id)] = Number(trainBonusAwardedMilestones || 0);
    }

    trainWaitingList = Array.isArray(data.trainWaitingList) ? data.trainWaitingList : [];
    pricingRecords = Array.isArray(data.pricingRecords) ? data.pricingRecords : [];
    selectedRoomTypes = data.selectedRoomTypes && typeof data.selectedRoomTypes === "object"
      ? data.selectedRoomTypes
      : {};

    if (Array.isArray(data.rooms) && data.rooms.length > 0 && data.rooms.length <= MAX_ROOM_DATASET_SIZE) {
      rooms = data.rooms.map(room => ({
        ...room,
        checkInTime: room.checkInTime || "15:00",
        checkOutTime: room.checkOutTime || "11:00"
      }));
    } else if (Array.isArray(data.rooms) && data.rooms.length > MAX_ROOM_DATASET_SIZE) {
      shouldRefreshStoredRooms = true;
    }

    if (shouldRefreshStoredRooms) {
      saveAppData();
    }
  } catch (error) {
    console.error("系統資料讀取失敗：", error);
    localStorage.removeItem(APP_STORAGE_KEY);
  }
}
