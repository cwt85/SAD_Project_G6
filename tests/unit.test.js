/**
 * SAD Project G6 - Unit Tests
 *
 * 測試策略：
 * 使用 Node.js 的 vm 模組建立沙盒環境，模擬瀏覽器全域環境，
 * 將所有 JS 原始碼合併後在沙盒中執行，再對各函式進行單元測試。
 *
 * 涵蓋模組：auth.js, utils.js, orders.js, rooms.js, trains.js, pricing.js, bonus.js
 * B 模組功能：登入/註冊、搜尋篩選、房源展示、收藏、購物車、訂房、支付、退款、評價、聊天
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

// ============================================================
// 沙盒環境建立
// ============================================================

const JS_DIR = path.resolve(__dirname, '../js');

const SOURCE_FILES = [
  'state.js',
  'utils.js',
  'auth.js',
  'rooms.js',
  'orders.js',
  'pricing.js',
  'trains.js',
  'bonus.js',
  'chat.js'
];

const combinedSource = SOURCE_FILES
  .map(f => `// ===== ${f} =====\n` + fs.readFileSync(path.join(JS_DIR, f), 'utf8'))
  .join('\n\n');

const TEST_HELPERS = `
// ==== Test-only state accessors ====
function __pushUser(user)             { users.push(user); }
function __setUsers(arr)              { users = arr; }
function __pushRoom(room)             { rooms.push(room); }
function __setRooms(arr)              { rooms = arr; }
function __pushOrder(order)           { orders.push(order); }
function __setOrders(arr)             { orders = arr; }
function __pushFavorite(item)         { favorites.push(item); }
function __setFavorites(arr)          { favorites = arr; }
function __pushCart(item)             { cart.push(item); }
function __setCart(arr)               { cart = arr; }
function __pushTrainOrder(o)          { trainOrders.push(o); }
function __setTrainOrders(arr)        { trainOrders = arr; }
function __setUserBonusPoint(k, v)    { userBonusPoints[String(k)] = v; }
function __getUserBonusPointsMap()    { return userBonusPoints; }
function __getBonusRecords()          { return bonusPointRecords; }
function __getOrders()                { return orders; }
function __getFavorites()             { return favorites; }
function __getCart()                  { return cart; }
function __setSelectedRoomType(rid, tid) { selectedRoomTypes[rid] = tid; }
// 直接設定腳本內部 let 變數（讓 isAdmin/isCustomer/requireCustomer 等函式讀到正確狀態）
function __setLoginState(loggedIn, user) { isLoggedIn = loggedIn; currentUser = user ? Object.assign({}, user) : null; }
// 讓測試存取腳本內部 chatConversations（let 變數，不在 ctx 屬性上）
function __getChatConversations()     { return chatConversations; }
// 讓測試讀取腳本內部 rooms 陣列（let 變數，不在 ctx 屬性上）
function __getRooms()                 { return rooms; }
// 火車訂單存取
function __getTrainOrders()           { return trainOrders; }
// 設定已核發里程碑紀錄（用於點數不重複核發測試）
function __setUserBonusAwardedMilestone(k, v) { userBonusAwardedMilestones[String(k)] = v; }
`;

const compiledScript = new vm.Script(combinedSource + '\n\n' + TEST_HELPERS, { filename: 'app-bundle.js' });

/**
 * 建立一個完整的 Mock DOM Element，包含 addEventListener 等方法。
 * 缺少這些方法會導致 utils.js 初始化失敗，讓後續所有 const 停在 TDZ。
 */
function createMockElement() {
  const el = {
    _text: '',
    _open: false,
    style: {},
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      toggle: jest.fn(),
      contains: jest.fn(() => false)
    },
    innerHTML: '',
    value: '',
    // 支援 dialog.open 讀取
    get open() { return this._open; },
    set open(v) { this._open = Boolean(v); },
    // 支援 escapeHtml 使用的 textContent/innerHTML 模式
    get textContent() { return this._text; },
    set textContent(v) {
      this._text = String(v);
      this.innerHTML = String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },
    // DOM 方法
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    setAttribute: jest.fn(),
    getAttribute: jest.fn(() => null),
    removeAttribute: jest.fn(),
    focus: jest.fn(),
    blur: jest.fn(),
    click: jest.fn(),
    showModal: jest.fn(function() { this._open = true; }),
    close: jest.fn(function() { this._open = false; }),
    remove: jest.fn(),
    // querySelector / querySelectorAll 回傳 mock element
    querySelector: jest.fn(() => createMockLeafElement()),
    querySelectorAll: jest.fn(() => []),
    appendChild: jest.fn(),
    // 子元素集合
    children: { length: 0 },
    scrollTop: 0,
    scrollHeight: 0,
    dataset: {},
  };
  return el;
}

/** 葉節點 element（不需要遞迴 querySelector） */
function createMockLeafElement() {
  return {
    _text: '',
    style: {},
    classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn(), contains: jest.fn(() => false) },
    innerHTML: '',
    value: '',
    _open: false,
    get open() { return this._open; },
    set open(v) { this._open = Boolean(v); },
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); this.innerHTML = String(v); },
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    setAttribute: jest.fn(),
    getAttribute: jest.fn(() => null),
    removeAttribute: jest.fn(),
    focus: jest.fn(),
    blur: jest.fn(),
    showModal: jest.fn(function() { this._open = true; }),
    close: jest.fn(function() { this._open = false; }),
    remove: jest.fn(),
    querySelector: jest.fn(() => null),
    querySelectorAll: jest.fn(() => []),
    appendChild: jest.fn(),
    scrollTop: 0,
    scrollHeight: 0,
    dataset: {},
  };
}

function createContext() {
  const store = {};
  const mockLocalStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };

  const ctx = {
    Date, Math, Number, String, Boolean, Array, Object, RegExp, Error,
    JSON, parseInt, parseFloat, isNaN, isFinite, Symbol, Promise,
    NaN, Infinity, undefined,

    console: { log() {}, warn() {}, error() {}, info() {} },
    localStorage: mockLocalStorage,

    alert: jest.fn(),
    confirm: jest.fn(() => false),
    prompt: jest.fn(() => null),

    document: {
      createElement: jest.fn(() => createMockElement()),
      getElementById: jest.fn(() => null),
      querySelectorAll: jest.fn(() => []),
      querySelector: jest.fn(() => null),
      addEventListener: jest.fn(),
      readyState: 'complete',  // 避免加入 DOMContentLoaded 監聽
      body: {
        classList: { toggle: jest.fn(), add: jest.fn(), remove: jest.fn() },
        appendChild: jest.fn()
      }
    },

    window: null,
    location: { hash: '' },
    fetch: jest.fn(() => Promise.reject(new Error('fetch not mocked'))),
    setTimeout: jest.fn((fn) => { /* 不實際執行，避免副作用 */ }),
  };

  ctx.window = ctx;
  vm.createContext(ctx);

  try {
    compiledScript.runInContext(ctx);
  } catch (e) {
    // 忽略 DOM-only 初始化錯誤
  }

  // 覆蓋有副作用的函式（必須在 script 執行後才能覆蓋）
  ctx.saveAppData   = jest.fn();
  ctx.saveAuthState = jest.fn();          // 避免 AUTH_STORAGE_KEY TDZ 問題
  ctx.saveChatData  = jest.fn();
  ctx.renderAll     = jest.fn();
  ctx.renderRoomDetail  = jest.fn();
  ctx.renderFavorites   = jest.fn();
  ctx.renderCart        = jest.fn();
  ctx.renderOrders      = jest.fn();
  ctx.renderUserChat    = jest.fn();      // chat.js DOM 渲染，測試環境跳過
  ctx.renderAdminChat   = jest.fn();
  ctx.renderChat        = jest.fn();
  ctx.renderBonusPointBar = jest.fn();
  ctx.refreshTrainBonusDisplay = jest.fn();
  ctx.showSection   = jest.fn();
  ctx.showNotice    = jest.fn();
  ctx.showDialogNotice = jest.fn();
  ctx.addSystemItemToItinerary = jest.fn(() => null);
  ctx.integrateLodgingOrderToItinerary = jest.fn();
  ctx.integrateTrainOrderToItinerary   = jest.fn();

  return ctx;
}

// ============================================================
// 測試輔助工具
// ============================================================

function daysFromToday(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function makeRoom(overrides = {}) {
  return {
    id: 1,
    name: '測試民宿',
    location: '台東市',
    address: '台東縣台東市中山路 1 號',
    price: 3000,
    capacity: 2,
    rating: 4.5,
    status: 'active',
    stationDistance: '5 分鐘',
    desc: '很棒的民宿',
    facilities: ['WiFi', '停車場'],
    policies: ['禁煙'],
    bookingStart: daysFromToday(-30),
    bookingEnd: daysFromToday(60),
    images: ['img1.jpg', 'img2.jpg'],
    roomTypes: [
      { id: 'type-std-1', name: '標準房', price: 3000, capacity: 2, stock: 5, bedType: '雙人床' },
      { id: 'type-dlx-1', name: '豪華房', price: 4000, capacity: 3, stock: 3, bedType: '大床' }
    ],
    reviews: [],
    ...overrides
  };
}

function makeOrder(overrides = {}) {
  return {
    id: 1001,
    userId: 2,
    roomId: 1,
    roomName: '測試民宿',
    roomTypeId: 'type-std-1',
    roomTypeName: '標準房',
    checkIn: daysFromToday(15),
    checkOut: daysFromToday(17),
    nights: 2,
    people: 2,
    pricePerNight: 3000,
    amount: 6000,
    bookingStatus: '已確認',
    paymentStatus: '未付款',
    status: '已確認 / 未付款',
    refundAmount: 0,
    ...overrides
  };
}

/**
 * 以顧客身分登入。
 * 必須用 __setLoginState 寫入腳本內部的 let 變數，
 * 直接設定 ctx.isLoggedIn 只改 context 屬性，isCustomer() 讀不到。
 */
function loginAsCustomer(ctx, userId = 2) {
  const customer = { id: userId, account: `customer${userId}@test.com`, role: 'customer', displayName: `顧客${userId}` };
  ctx.__pushUser(customer);
  ctx.__setLoginState(true, customer);
  return customer;
}

// ============================================================
// 一、auth.js 測試
// ============================================================
describe('auth.js — 帳號驗證與使用者管理', () => {
  let ctx;
  beforeEach(() => { ctx = createContext(); });

  describe('isValidEmail()', () => {
    test('標準 Email 格式應回傳 true', () => {
      expect(ctx.isValidEmail('test@example.com')).toBe(true);
      expect(ctx.isValidEmail('admin@example.com')).toBe(true);
      expect(ctx.isValidEmail('user.name+tag@mail.domain.org')).toBe(true);
    });

    test('缺少 @ 符號應回傳 false', () => {
      expect(ctx.isValidEmail('notanemail')).toBe(false);
    });

    test('@ 在開頭應回傳 false', () => {
      expect(ctx.isValidEmail('@example.com')).toBe(false);
    });

    test('@ 在結尾應回傳 false', () => {
      expect(ctx.isValidEmail('user@')).toBe(false);
    });

    test('空字串應回傳 false', () => {
      expect(ctx.isValidEmail('')).toBe(false);
    });

    test('含空白字元應回傳 false', () => {
      expect(ctx.isValidEmail('user @example.com')).toBe(false);
    });
  });

  describe('isValidPhone()', () => {
    test('有效台灣手機號碼應回傳 true', () => {
      expect(ctx.isValidPhone('0912345678')).toBe(true);
      expect(ctx.isValidPhone('0987654321')).toBe(true);
    });

    test('非 09 開頭應回傳 false', () => {
      expect(ctx.isValidPhone('0812345678')).toBe(false);
      expect(ctx.isValidPhone('1912345678')).toBe(false);
    });

    test('位數不足 10 碼應回傳 false', () => {
      expect(ctx.isValidPhone('091234567')).toBe(false);
    });

    test('超過 10 碼應回傳 false', () => {
      expect(ctx.isValidPhone('09123456789')).toBe(false);
    });

    test('含英文字母應回傳 false', () => {
      expect(ctx.isValidPhone('0912abc678')).toBe(false);
    });

    test('空字串應回傳 false', () => {
      expect(ctx.isValidPhone('')).toBe(false);
    });
  });

  describe('normalizeAccount()', () => {
    test('轉換為小寫', () => {
      expect(ctx.normalizeAccount('ADMIN@EXAMPLE.COM')).toBe('admin@example.com');
    });

    test('去除前後空白', () => {
      expect(ctx.normalizeAccount('  user@test.com  ')).toBe('user@test.com');
    });

    test('null / undefined 應回傳空字串', () => {
      expect(ctx.normalizeAccount(null)).toBe('');
      expect(ctx.normalizeAccount(undefined)).toBe('');
    });
  });

  describe('getAccountType()', () => {
    test('Email 帳號回傳 "email"', () => {
      expect(ctx.getAccountType('user@example.com')).toBe('email');
    });

    test('手機號碼回傳 "phone"', () => {
      expect(ctx.getAccountType('0912345678')).toBe('phone');
    });

    test('無效格式回傳空字串', () => {
      expect(ctx.getAccountType('invalid')).toBe('');
      expect(ctx.getAccountType('')).toBe('');
    });
  });

  describe('getRoleName()', () => {
    test('admin → "管理員"', () => {
      expect(ctx.getRoleName('admin')).toBe('管理員');
    });

    test('customer → "顧客"', () => {
      expect(ctx.getRoleName('customer')).toBe('顧客');
    });

    test('未知角色 → "訪客"', () => {
      expect(ctx.getRoleName('unknown')).toBe('訪客');
      expect(ctx.getRoleName('')).toBe('訪客');
    });
  });

  describe('getNextUserId()', () => {
    test('只有一位使用者時回傳 2', () => {
      expect(ctx.getNextUserId()).toBe(2);
    });

    test('多位使用者時回傳最大 id + 1', () => {
      ctx.__pushUser({ id: 5, account: 'x@x.com', role: 'customer' });
      expect(ctx.getNextUserId()).toBe(6);
    });
  });

  describe('isAdmin() / isCustomer()', () => {
    test('未登入時兩者都是 false', () => {
      // createContext 初始狀態：isLoggedIn=false, currentUser=null
      expect(ctx.isAdmin()).toBe(false);
      expect(ctx.isCustomer()).toBe(false);
    });

    test('以管理員登入後 isAdmin() 為 true', () => {
      // 必須寫腳本內部 let 變數，ctx.isLoggedIn 只是 context 屬性
      ctx.__setLoginState(true, { id: 1, account: 'admin@example.com', role: 'admin' });
      expect(ctx.isAdmin()).toBe(true);
      expect(ctx.isCustomer()).toBe(false);
    });

    test('以顧客登入後 isCustomer() 為 true', () => {
      ctx.__setLoginState(true, { id: 2, account: 'user@example.com', role: 'customer' });
      expect(ctx.isCustomer()).toBe(true);
      expect(ctx.isAdmin()).toBe(false);
    });
  });

  describe('validateRegisterPassword()', () => {
    test('密碼少於 8 碼應拒絕', () => {
      ctx.document.getElementById = jest.fn((id) => {
        if (id === 'regPassword') return { value: 'Ab1' };
        if (id === 'regConfirmPassword') return { value: 'Ab1' };
        return null;
      });
      const result = ctx.validateRegisterPassword(null);
      expect(result.ok).toBe(false);
    });

    test('密碼未包含數字應拒絕', () => {
      ctx.document.getElementById = jest.fn((id) => {
        if (id === 'regPassword') return { value: 'Abcdefgh' };
        if (id === 'regConfirmPassword') return { value: 'Abcdefgh' };
        return null;
      });
      const result = ctx.validateRegisterPassword(null);
      expect(result.ok).toBe(false);
    });

    test('兩次密碼不一致應拒絕', () => {
      ctx.document.getElementById = jest.fn((id) => {
        if (id === 'regPassword') return { value: 'Abc12345' };
        if (id === 'regConfirmPassword') return { value: 'Abc67890' };
        return null;
      });
      const result = ctx.validateRegisterPassword(null);
      expect(result.ok).toBe(false);
    });

    test('符合規則的密碼應通過', () => {
      ctx.document.getElementById = jest.fn((id) => {
        if (id === 'regPassword') return { value: 'Abc12345' };
        if (id === 'regConfirmPassword') return { value: 'Abc12345' };
        return null;
      });
      const result = ctx.validateRegisterPassword(null);
      expect(result.ok).toBe(true);
      expect(result.password).toBe('Abc12345');
    });
  });
});

// ============================================================
// 二、utils.js 測試
// ============================================================
describe('utils.js — 共用工具函式', () => {
  let ctx;
  beforeEach(() => { ctx = createContext(); });

  describe('formatPrice()', () => {
    test('千位數加逗號', () => {
      expect(ctx.formatPrice(1000)).toBe('1,000');
      expect(ctx.formatPrice(10000)).toBe('10,000');
    });

    test('0 回傳 "0"', () => {
      expect(ctx.formatPrice(0)).toBe('0');
    });

    test('null / undefined 回傳 "0"', () => {
      expect(ctx.formatPrice(null)).toBe('0');
      expect(ctx.formatPrice(undefined)).toBe('0');
    });
  });

  describe('formatDate()', () => {
    test('空值回傳空字串', () => {
      expect(ctx.formatDate('')).toBe('');
      expect(ctx.formatDate(null)).toBe('');
    });

    test('有效日期字串回傳中文格式（包含年份）', () => {
      const result = ctx.formatDate('2025-01-15');
      expect(result).toContain('2025');
    });
  });

  describe('getMaxRoomTypeCapacity()', () => {
    test('有多個房型時回傳最大容納人數', () => {
      const room = makeRoom();  // capacity: 2, 3
      expect(ctx.getMaxRoomTypeCapacity(room)).toBe(3);
    });

    test('沒有房型時回退到 room.capacity', () => {
      const room = makeRoom({ roomTypes: [], capacity: 4 });
      expect(ctx.getMaxRoomTypeCapacity(room)).toBe(4);
    });
  });

  describe('getLowestRoomTypePrice()', () => {
    test('有多個房型時回傳最低價格', () => {
      const room = makeRoom();  // prices: 3000, 4000
      expect(ctx.getLowestRoomTypePrice(room)).toBe(3000);
    });

    test('沒有房型時回退到 room.price', () => {
      const room = makeRoom({ roomTypes: [], price: 2500 });
      expect(ctx.getLowestRoomTypePrice(room)).toBe(2500);
    });
  });

  describe('generateDefaultRoomTypes()', () => {
    test('應產生兩個房型', () => {
      const room = { id: 10, price: 2000, capacity: 2 };
      const types = ctx.generateDefaultRoomTypes(room);
      expect(types).toHaveLength(2);
    });

    test('標準房價格等於基礎價', () => {
      const room = { id: 10, price: 2000, capacity: 2 };
      const types = ctx.generateDefaultRoomTypes(room);
      expect(types[0].price).toBe(2000);
    });

    test('豪華房價格為基礎價 × 1.3（四捨五入）', () => {
      const room = { id: 10, price: 2000, capacity: 2 };
      const types = ctx.generateDefaultRoomTypes(room);
      expect(types[1].price).toBe(Math.round(2000 * 1.3));
    });
  });

  describe('getNextRoomId()', () => {
    test('無房源時回傳 1', () => {
      ctx.rooms = [];
      expect(ctx.getNextRoomId()).toBe(1);
    });

    test('有房源時回傳最大 id + 1', () => {
      ctx.__setRooms([{ id: 1 }, { id: 3 }, { id: 2 }]);
      expect(ctx.getNextRoomId()).toBe(4);
    });
  });

  describe('getRoomImages()', () => {
    test('應回傳長度為 3 的陣列', () => {
      const images = ctx.getRoomImages(1);
      expect(images).toHaveLength(3);
    });

    test('不同 roomId 回傳不同起始圖片', () => {
      const imgs0 = ctx.getRoomImages(0);
      const imgs1 = ctx.getRoomImages(1);
      expect(imgs0[0]).not.toBe(imgs1[0]);
    });
  });
});

// ============================================================
// 三、orders.js 測試
// ============================================================
describe('orders.js — 訂單相關邏輯', () => {
  let ctx;
  beforeEach(() => { ctx = createContext(); });

  describe('isDateRangeOverlap()', () => {
    test('完全重疊', () => {
      expect(ctx.isDateRangeOverlap('2025-01-01', '2025-01-10', '2025-01-01', '2025-01-10')).toBe(true);
    });

    test('部分重疊（前段）', () => {
      expect(ctx.isDateRangeOverlap('2025-01-01', '2025-01-05', '2025-01-03', '2025-01-08')).toBe(true);
    });

    test('完全不重疊（A 在 B 之前）', () => {
      expect(ctx.isDateRangeOverlap('2025-01-01', '2025-01-05', '2025-01-06', '2025-01-10')).toBe(false);
    });

    test('缺少任何日期回傳 false', () => {
      expect(ctx.isDateRangeOverlap('', '2025-01-05', '2025-01-01', '2025-01-10')).toBe(false);
      expect(ctx.isDateRangeOverlap(null, null, null, null)).toBe(false);
    });
  });

  describe('isRoomSelectable()', () => {
    test('正常房源（有庫存）回傳 true', () => {
      expect(ctx.isRoomSelectable(makeRoom())).toBe(true);
    });

    test('已下架房源回傳 false', () => {
      expect(ctx.isRoomSelectable(makeRoom({ status: 'inactive' }))).toBe(false);
    });

    test('所有房型庫存為 0 回傳 false', () => {
      const room = makeRoom({ roomTypes: [{ id: 'a', name: '標準', price: 3000, capacity: 2, stock: 0 }] });
      expect(ctx.isRoomSelectable(room)).toBe(false);
    });

    test('null 回傳 false', () => {
      expect(ctx.isRoomSelectable(null)).toBe(false);
    });
  });

  describe('getOrderStatusText()', () => {
    test('有 status 欄位時直接回傳', () => {
      expect(ctx.getOrderStatusText(makeOrder({ status: '已付款' }))).toBe('已付款');
    });

    test('無 status 欄位時組合 bookingStatus 與 paymentStatus', () => {
      expect(ctx.getOrderStatusText(makeOrder({ status: undefined, bookingStatus: '已確認', paymentStatus: '未付款' }))).toBe('已確認 / 未付款');
    });

    test('兩者都缺失時使用預設值', () => {
      expect(ctx.getOrderStatusText({ id: 1 })).toBe('已確認 / 未付款');
    });
  });

  describe('getLodgingOrderPricing()', () => {
    test('訂房兩晚以上套用八折優惠', () => {
      const pricing = ctx.getLodgingOrderPricing(3000, 2);

      expect(pricing.originalAmount).toBe(6000);
      expect(pricing.amount).toBe(4800);
      expect(pricing.discountEligible).toBe(true);
      expect(pricing.discountAmount).toBe(1200);
      expect(pricing.discountRate).toBe(0.8);
    });

    test('訂房一晚不套用八折優惠', () => {
      const pricing = ctx.getLodgingOrderPricing(3000, 1);

      expect(pricing.originalAmount).toBe(3000);
      expect(pricing.amount).toBe(3000);
      expect(pricing.discountEligible).toBe(false);
      expect(pricing.discountAmount).toBe(0);
      expect(pricing.discountRate).toBe(1);
    });
  });

  describe('calculateRoomRating()', () => {
    test('無評價時回傳原始評分', () => {
      expect(ctx.calculateRoomRating(makeRoom({ rating: 4.2, reviews: [] }))).toBe(4.2);
    });

    test('有評價時計算平均', () => {
      const room = makeRoom({ reviews: [{ rating: 4 }, { rating: 5 }, { rating: 3 }] });
      expect(ctx.calculateRoomRating(room)).toBe(4);
    });
  });

  describe('getRoomTypeById()', () => {
    test('找得到的 typeId 回傳對應房型', () => {
      const result = ctx.getRoomTypeById(makeRoom(), 'type-std-1');
      expect(result).not.toBeNull();
      expect(result.name).toBe('標準房');
    });

    test('找不到的 typeId 回傳 null', () => {
      expect(ctx.getRoomTypeById(makeRoom(), 'non-exist')).toBeNull();
    });

    test('room 為 null 時回傳 null', () => {
      expect(ctx.getRoomTypeById(null, 'type-std-1')).toBeNull();
    });
  });

  describe('calculateRefund()', () => {
    test('未付款的訂單取消時退款為 0', () => {
      const order = makeOrder({ checkIn: daysFromToday(20), paymentStatus: '未付款' });
      const result = ctx.calculateRefund(order);
      expect(result.cancelable).toBe(true);
      expect(result.amount).toBe(0);
    });

    test('入住前 10 天以上全額退款', () => {
      const order = makeOrder({ checkIn: daysFromToday(15), paymentStatus: '已付款', amount: 6000 });
      const result = ctx.calculateRefund(order);
      expect(result.cancelable).toBe(true);
      expect(result.amount).toBe(6000);
    });

    test('入住前 4-9 天退款 70%', () => {
      const order = makeOrder({ checkIn: daysFromToday(6), paymentStatus: '已付款', amount: 6000 });
      const result = ctx.calculateRefund(order);
      expect(result.cancelable).toBe(true);
      expect(result.amount).toBe(Math.round(6000 * 0.7));
    });

    test('入住前 3 天內不予退款', () => {
      const order = makeOrder({ checkIn: daysFromToday(2), paymentStatus: '已付款', amount: 6000 });
      const result = ctx.calculateRefund(order);
      expect(result.cancelable).toBe(true);
      expect(result.amount).toBe(0);
    });

    test('入住日期已過不可取消', () => {
      const order = makeOrder({ checkIn: daysFromToday(-2), paymentStatus: '已付款' });
      const result = ctx.calculateRefund(order);
      expect(result.cancelable).toBe(false);
    });
  });
});

// ============================================================
// 四、rooms.js 測試
// ============================================================
describe('rooms.js — 房源相關邏輯', () => {
  let ctx;
  beforeEach(() => { ctx = createContext(); });

  describe('getBookingNights()', () => {
    test('計算相差天數', () => {
      expect(ctx.getBookingNights('2025-01-01', '2025-01-03')).toBe(2);
    });

    test('相差一天', () => {
      expect(ctx.getBookingNights('2025-06-01', '2025-06-02')).toBe(1);
    });

    test('跨月計算', () => {
      expect(ctx.getBookingNights('2025-01-30', '2025-02-02')).toBe(3);
    });
  });

  describe('getRoomDataIssues()', () => {
    test('完整房源資料回傳空陣列', () => {
      expect(ctx.getRoomDataIssues(makeRoom())).toHaveLength(0);
    });

    test('缺少地址、描述時回傳對應問題', () => {
      const issues = ctx.getRoomDataIssues(makeRoom({ address: '', desc: '' }));
      expect(issues).toContain('地址');
      expect(issues).toContain('描述');
    });

    test('缺少 facilities、policies、roomTypes 時全部列出', () => {
      const issues = ctx.getRoomDataIssues(makeRoom({ facilities: [], policies: [], roomTypes: [] }));
      expect(issues).toContain('設備');
      expect(issues).toContain('住房政策');
      expect(issues).toContain('房型');
    });
  });

  describe('isRoomAvailableForBooking()', () => {
    test('正常房源在可訂期間內回傳 true', () => {
      const room = makeRoom();
      ctx.__pushRoom(room);
      expect(ctx.isRoomAvailableForBooking(room, daysFromToday(5), daysFromToday(7))).toBe(true);
    });

    test('已下架房源回傳 false', () => {
      expect(ctx.isRoomAvailableForBooking(makeRoom({ status: 'inactive' }), daysFromToday(5), daysFromToday(7))).toBe(false);
    });

    test('null 房源回傳 false', () => {
      expect(ctx.isRoomAvailableForBooking(null, daysFromToday(5), daysFromToday(7))).toBe(false);
    });

    test('訂房日期超出可訂期間回傳 false', () => {
      const room = makeRoom({ bookingEnd: daysFromToday(3) });
      expect(ctx.isRoomAvailableForBooking(room, daysFromToday(2), daysFromToday(10))).toBe(false);
    });
  });

  describe('normalizeRoomTextList()', () => {
    test('陣列直接回傳', () => {
      expect(ctx.normalizeRoomTextList(['禁煙', '禁寵物'])).toEqual(['禁煙', '禁寵物']);
    });

    test('逗號分隔字串拆解', () => {
      const result = ctx.normalizeRoomTextList('禁煙,禁寵物,禁止吸菸');
      expect(result).toEqual(['禁煙', '禁寵物', '禁止吸菸']);
    });

    test('中文頓號分隔', () => {
      const result = ctx.normalizeRoomTextList('禁煙、禁寵物');
      expect(result).toEqual(['禁煙', '禁寵物']);
    });

    test('空值回傳空陣列', () => {
      expect(ctx.normalizeRoomTextList(null)).toEqual([]);
      expect(ctx.normalizeRoomTextList(undefined)).toEqual([]);
    });
  });

  describe('parseStationDistanceMinutes()', () => {
    test('解析 "5 分鐘" 為 5', () => {
      expect(ctx.parseStationDistanceMinutes('步行 5 分鐘')).toBe(5);
    });

    test('解析 "10分鐘" 為 10', () => {
      expect(ctx.parseStationDistanceMinutes('10分鐘')).toBe(10);
    });

    test('無法解析時回傳 Infinity', () => {
      expect(ctx.parseStationDistanceMinutes('未提供')).toBe(Infinity);
      expect(ctx.parseStationDistanceMinutes('')).toBe(Infinity);
    });
  });

  describe('getSearchMatchingRoomTypes()', () => {
    // getSearchMatchingRoomTypes 內部呼叫 getAvailableRoomTypeStock，後者用 findRoom(roomId)
    // 找內部 rooms 陣列，所以每個測試都要先 __pushRoom。

    test('有庫存且容量足夠的房型符合', () => {
      const room = makeRoom();
      ctx.__pushRoom(room);  // 加入內部 rooms，讓 getAvailableRoomTypeStock 可以找到
      const booking = { guests: 2, checkIn: daysFromToday(5), checkOut: daysFromToday(7) };
      const result = ctx.getSearchMatchingRoomTypes(room, booking, { maxPrice: Infinity });
      expect(result.length).toBeGreaterThan(0);
    });

    test('容量不足的房型不符合', () => {
      const room = makeRoom({
        roomTypes: [{ id: 'small', name: '小房', price: 2000, capacity: 1, stock: 5, bedType: '單人床' }]
      });
      ctx.__pushRoom(room);
      const booking = { guests: 3, checkIn: daysFromToday(5), checkOut: daysFromToday(7) };
      const result = ctx.getSearchMatchingRoomTypes(room, booking, { maxPrice: Infinity });
      expect(result).toHaveLength(0);
    });

    test('超出最高價格的房型不符合', () => {
      const room = makeRoom();  // 標準房 3000，豪華房 4000
      ctx.__pushRoom(room);
      const booking = { guests: 2, checkIn: daysFromToday(5), checkOut: daysFromToday(7) };
      const result = ctx.getSearchMatchingRoomTypes(room, booking, { maxPrice: 3500 });
      // 只有標準房符合
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('標準房');
    });

    test('庫存為 0 的房型不符合', () => {
      const room = makeRoom({
        roomTypes: [{ id: 'full', name: '客滿', price: 3000, capacity: 2, stock: 0, bedType: '雙人床' }]
      });
      ctx.__pushRoom(room);
      const booking = { guests: 2, checkIn: daysFromToday(5), checkOut: daysFromToday(7) };
      const result = ctx.getSearchMatchingRoomTypes(room, booking, { maxPrice: Infinity });
      expect(result).toHaveLength(0);
    });

    test('roomTypePreference 字串篩選', () => {
      const room = makeRoom();  // 標準房、豪華房
      ctx.__pushRoom(room);
      const booking = { guests: 2, checkIn: daysFromToday(5), checkOut: daysFromToday(7) };
      const result = ctx.getSearchMatchingRoomTypes(room, booking, {
        maxPrice: Infinity,
        roomTypePreference: '豪華'
      });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('豪華房');
    });
  });
});

// ============================================================
// 五、B 模組 — 訂房業務邏輯
// ============================================================
describe('B 模組 — 訂房業務邏輯', () => {
  let ctx;
  beforeEach(() => { ctx = createContext(); });

  // ---- 5-1 庫存計算（防重疊）----
  describe('getAvailableRoomTypeStock() — 庫存扣減與防重疊', () => {
    test('無訂單時剩餘庫存 = 原始庫存', () => {
      const room = makeRoom();
      ctx.__pushRoom(room);
      ctx.__setOrders([]);
      const stock = ctx.getAvailableRoomTypeStock(1, 'type-std-1', daysFromToday(5), daysFromToday(7));
      expect(stock).toBe(5);  // 標準房 stock=5
    });

    test('有 1 筆重疊訂單時庫存減 1', () => {
      const room = makeRoom();
      ctx.__pushRoom(room);
      ctx.__setOrders([
        makeOrder({
          roomId: 1,
          roomTypeId: 'type-std-1',
          bookingStatus: '已確認',
          checkIn: daysFromToday(5),
          checkOut: daysFromToday(7)
        })
      ]);
      const stock = ctx.getAvailableRoomTypeStock(1, 'type-std-1', daysFromToday(4), daysFromToday(6));
      expect(stock).toBe(4);  // 5 - 1
    });

    test('已取消訂單不扣庫存', () => {
      const room = makeRoom();
      ctx.__pushRoom(room);
      ctx.__setOrders([
        makeOrder({
          roomId: 1,
          roomTypeId: 'type-std-1',
          bookingStatus: '已取消',
          checkIn: daysFromToday(5),
          checkOut: daysFromToday(7)
        })
      ]);
      const stock = ctx.getAvailableRoomTypeStock(1, 'type-std-1', daysFromToday(4), daysFromToday(6));
      expect(stock).toBe(5);  // 取消的不算
    });

    test('不重疊訂單不扣庫存', () => {
      const room = makeRoom();
      ctx.__pushRoom(room);
      ctx.__setOrders([
        makeOrder({
          roomId: 1,
          roomTypeId: 'type-std-1',
          bookingStatus: '已確認',
          checkIn: daysFromToday(10),
          checkOut: daysFromToday(12)
        })
      ]);
      const stock = ctx.getAvailableRoomTypeStock(1, 'type-std-1', daysFromToday(4), daysFromToday(7));
      expect(stock).toBe(5);  // 不重疊
    });

    test('庫存不可低於 0', () => {
      const room = makeRoom({
        roomTypes: [{ id: 'rare', name: '稀缺房', price: 5000, capacity: 2, stock: 1, bedType: '雙人床' }]
      });
      ctx.__pushRoom(room);
      // 加入 2 筆重疊訂單（超過 stock=1）
      ctx.__setOrders([
        makeOrder({ roomId: 1, roomTypeId: 'rare', bookingStatus: '已確認', checkIn: daysFromToday(5), checkOut: daysFromToday(7) }),
        makeOrder({ id: 1002, roomId: 1, roomTypeId: 'rare', bookingStatus: '已確認', checkIn: daysFromToday(5), checkOut: daysFromToday(7) })
      ]);
      const stock = ctx.getAvailableRoomTypeStock(1, 'rare', daysFromToday(4), daysFromToday(6));
      expect(stock).toBe(0);  // Math.max(0, 1-2) = 0
    });
  });

  // ---- 5-2 訂房規則驗證 ----
  describe('validateBookingInputs() — 訂房規則', () => {
    function makeInputs(ctx, checkIn, checkOut, guests = '2') {
      ctx.document.getElementById = jest.fn((id) => {
        const map = {
          checkIn: { value: checkIn },
          checkOut: { value: checkOut },
          checkInTime: { value: '15:00' },
          checkOutTime: { value: '11:00' },
          guests: { value: guests }
        };
        return map[id] || null;
      });
    }

    test('最少需提前 24 小時預約：今天入住應拒絕', () => {
      makeInputs(ctx, daysFromToday(0), daysFromToday(2));
      const result = ctx.validateBookingInputs(null);
      expect(result.valid).toBe(false);
    });

    test('明天入住（剛好 24 小時前）應通過', () => {
      // 明天 = 24h，但因為日期是整天計算，daysFromToday(2) 確保超過 24h
      makeInputs(ctx, daysFromToday(2), daysFromToday(4));
      const result = ctx.validateBookingInputs(null);
      expect(result.valid).toBe(true);
    });

    test('預訂超過 30 天應拒絕', () => {
      makeInputs(ctx, daysFromToday(2), daysFromToday(35));
      const result = ctx.validateBookingInputs(null);
      expect(result.valid).toBe(false);
    });

    test('退房早於入住應拒絕', () => {
      makeInputs(ctx, daysFromToday(5), daysFromToday(3));
      const result = ctx.validateBookingInputs(null);
      expect(result.valid).toBe(false);
    });

    test('人數為 0 應拒絕', () => {
      makeInputs(ctx, daysFromToday(2), daysFromToday(4), '0');
      const result = ctx.validateBookingInputs(null);
      expect(result.valid).toBe(false);
    });

    test('正常訂房（2天後、2人、10天）應通過', () => {
      makeInputs(ctx, daysFromToday(2), daysFromToday(12));
      const result = ctx.validateBookingInputs(null);
      expect(result.valid).toBe(true);
      expect(result.nights).toBe(10);
      expect(result.guests).toBe(2);
    });
  });

  // ---- 5-3 收藏功能 ----
  describe('收藏功能 — addFavorite / removeSavedRoom', () => {
    test('未登入時 addFavorite 應拒絕', () => {
      // createContext 初始狀態就是未登入，不需要額外設定
      const room = makeRoom();
      ctx.__pushRoom(room);
      ctx.addFavorite(1);
      expect(ctx.__getFavorites()).toHaveLength(0);
    });

    test('管理員不能加入收藏', () => {
      ctx.__setLoginState(true, { id: 1, account: 'admin@example.com', role: 'admin' });
      const room = makeRoom();
      ctx.__pushRoom(room);
      ctx.addFavorite(1);
      expect(ctx.__getFavorites()).toHaveLength(0);
    });

    test('顧客可以加入收藏', () => {
      loginAsCustomer(ctx);
      const room = makeRoom();
      ctx.__pushRoom(room);
      ctx.addFavorite(1);
      expect(ctx.__getFavorites()).toHaveLength(1);
      expect(ctx.__getFavorites()[0].roomId).toBe(1);
    });

    test('同一房源不能重複加入收藏', () => {
      loginAsCustomer(ctx);
      const room = makeRoom();
      ctx.__pushRoom(room);
      ctx.addFavorite(1);
      ctx.addFavorite(1);  // 第二次
      expect(ctx.__getFavorites()).toHaveLength(1);
    });

    test('可以從收藏中移除房源', () => {
      loginAsCustomer(ctx, 2);
      ctx.__setFavorites([{ userId: 2, roomId: 1, addedAt: '2025-01-01' }]);
      ctx.removeSavedRoom('favorite', 1);
      expect(ctx.__getFavorites()).toHaveLength(0);
    });

    test('已下架房源不能加入收藏', () => {
      loginAsCustomer(ctx);
      const room = makeRoom({ status: 'inactive' });
      ctx.__pushRoom(room);
      ctx.addFavorite(1);
      expect(ctx.__getFavorites()).toHaveLength(0);
    });
  });

  // ---- 5-4 購物車功能 ----
  describe('購物車功能 — addCart / removeSavedRoom', () => {
    test('未登入時不能加入購物車', () => {
      // createContext 初始狀態就是未登入
      const room = makeRoom();
      ctx.__pushRoom(room);
      ctx.addCart(1);
      expect(ctx.__getCart()).toHaveLength(0);
    });

    test('顧客可以加入購物車', () => {
      loginAsCustomer(ctx);
      ctx.document.getElementById = jest.fn(() => null);  // 無搜尋日期
      const room = makeRoom();
      ctx.__pushRoom(room);
      ctx.addCart(1);
      expect(ctx.__getCart()).toHaveLength(1);
      expect(ctx.__getCart()[0].roomId).toBe(1);
    });

    test('同一房源不能重複加入購物車', () => {
      loginAsCustomer(ctx);
      ctx.document.getElementById = jest.fn(() => null);
      const room = makeRoom();
      ctx.__pushRoom(room);
      ctx.addCart(1);
      ctx.addCart(1);
      expect(ctx.__getCart()).toHaveLength(1);
    });

    test('可以從購物車移除房源', () => {
      loginAsCustomer(ctx, 2);
      ctx.__setCart([{ userId: 2, roomId: 1, addedAt: '2025-01-01' }]);
      ctx.removeSavedRoom('cart', 1);
      expect(ctx.__getCart()).toHaveLength(0);
    });

    test('updateCartRoomType 可以更新選擇的房型', () => {
      loginAsCustomer(ctx, 2);
      const room = makeRoom();
      ctx.__pushRoom(room);
      ctx.__setCart([{ userId: 2, roomId: 1, selectedTypeId: 'type-std-1', addedAt: '2025-01-01' }]);

      ctx.updateCartRoomType(1, 'type-dlx-1');

      const item = ctx.__getCart().find(c => c.roomId === 1 && c.userId === 2);
      expect(item.selectedTypeId).toBe('type-dlx-1');
    });
  });

  // ---- 5-5 取消退款政策 ----
  describe('取消退款政策 — cancelOrder', () => {
    test('入住前 10 天以上：全額退款', () => {
      loginAsCustomer(ctx, 2);
      const order = makeOrder({ checkIn: daysFromToday(12), paymentStatus: '已付款', amount: 9000 });
      ctx.__setOrders([order]);

      ctx.confirm = jest.fn(() => true);  // 模擬使用者確認
      ctx.cancelOrder(1001);

      const updated = ctx.__getOrders().find(o => o.id === 1001);
      expect(updated.bookingStatus).toBe('已取消');
      expect(updated.refundAmount).toBe(9000);
    });

    test('入住前 4-9 天：退款 70%', () => {
      loginAsCustomer(ctx, 2);
      const order = makeOrder({ checkIn: daysFromToday(7), paymentStatus: '已付款', amount: 6000 });
      ctx.__setOrders([order]);

      ctx.confirm = jest.fn(() => true);
      ctx.cancelOrder(1001);

      const updated = ctx.__getOrders().find(o => o.id === 1001);
      expect(updated.bookingStatus).toBe('已取消');
      expect(updated.refundAmount).toBe(Math.round(6000 * 0.7));
    });

    test('入住前 3 天內：不予退款', () => {
      loginAsCustomer(ctx, 2);
      const order = makeOrder({ checkIn: daysFromToday(2), paymentStatus: '已付款', amount: 6000 });
      ctx.__setOrders([order]);

      ctx.confirm = jest.fn(() => true);
      ctx.cancelOrder(1001);

      const updated = ctx.__getOrders().find(o => o.id === 1001);
      expect(updated.bookingStatus).toBe('已取消');
      expect(updated.refundAmount).toBe(0);
    });

    test('取消後訂單狀態更新為已取消', () => {
      loginAsCustomer(ctx, 2);
      const order = makeOrder({ checkIn: daysFromToday(15), paymentStatus: '未付款' });
      ctx.__setOrders([order]);

      ctx.confirm = jest.fn(() => true);
      ctx.cancelOrder(1001);

      const updated = ctx.__getOrders().find(o => o.id === 1001);
      expect(updated.bookingStatus).toBe('已取消');
    });

    test('使用者取消確認視窗時不取消訂單', () => {
      loginAsCustomer(ctx, 2);
      const order = makeOrder({ checkIn: daysFromToday(15), paymentStatus: '未付款' });
      ctx.__setOrders([order]);

      ctx.confirm = jest.fn(() => false);  // 使用者按取消
      ctx.cancelOrder(1001);

      const updated = ctx.__getOrders().find(o => o.id === 1001);
      expect(updated.bookingStatus).toBe('已確認');
    });
  });

  // ---- 5-6 評價系統 ----
  describe('評價系統 — getReviewEligibility / submitReview', () => {
    test('未付款訂單不可評價', () => {
      loginAsCustomer(ctx, 2);
      const order = makeOrder({ paymentStatus: '未付款' });
      const result = ctx.getReviewEligibility(order);
      expect(result.valid).toBe(false);
    });

    test('已取消訂單不可評價', () => {
      loginAsCustomer(ctx, 2);
      const order = makeOrder({ bookingStatus: '已取消', paymentStatus: '已付款' });
      const result = ctx.getReviewEligibility(order);
      expect(result.valid).toBe(false);
    });

    test('已退房（管理員標記）可以評價', () => {
      loginAsCustomer(ctx, 2);
      const order = makeOrder({ bookingStatus: '已退房', paymentStatus: '已付款' });
      const result = ctx.getReviewEligibility(order);
      expect(result.valid).toBe(true);
    });

    test('已評價過的訂單不可再評價', () => {
      loginAsCustomer(ctx, 2);
      const order = makeOrder({
        bookingStatus: '已完成',
        paymentStatus: '已付款',
        checkOut: daysFromToday(-5),
        review: { rating: 4, comment: '很棒' }
      });
      const result = ctx.getReviewEligibility(order);
      expect(result.valid).toBe(false);
    });

    test('提交評價後房源評分更新', () => {
      loginAsCustomer(ctx, 2);
      const room = makeRoom({ id: 1, rating: 4.0, reviews: [] });
      ctx.__pushRoom(room);
      const order = makeOrder({
        bookingStatus: '已退房',
        paymentStatus: '已付款',
        checkOut: daysFromToday(-3)
      });
      ctx.__setOrders([order]);

      ctx.submitReview(1001, '5', '非常好的住宿體驗！');

      const updatedOrder = ctx.__getOrders().find(o => o.id === 1001);
      expect(updatedOrder.review).toBeDefined();
      expect(updatedOrder.review.rating).toBe(5);
      expect(updatedOrder.review.comment).toBe('非常好的住宿體驗！');
      expect(updatedOrder.bookingStatus).toBe('已完成');
    });

    test('評分不在 1-5 範圍應拒絕', () => {
      loginAsCustomer(ctx, 2);
      const room = makeRoom();
      ctx.__pushRoom(room);
      const order = makeOrder({ bookingStatus: '已退房', paymentStatus: '已付款', checkOut: daysFromToday(-3) });
      ctx.__setOrders([order]);

      ctx.submitReview(1001, '6', '評分超範圍');

      const updatedOrder = ctx.__getOrders().find(o => o.id === 1001);
      expect(updatedOrder.review).toBeUndefined();
    });

    test('評價內容不可空白', () => {
      loginAsCustomer(ctx, 2);
      const room = makeRoom();
      ctx.__pushRoom(room);
      const order = makeOrder({ bookingStatus: '已退房', paymentStatus: '已付款', checkOut: daysFromToday(-3) });
      ctx.__setOrders([order]);

      ctx.submitReview(1001, '4', '   ');  // 空白

      const updatedOrder = ctx.__getOrders().find(o => o.id === 1001);
      expect(updatedOrder.review).toBeUndefined();
    });

    test('提交評價後房源評分重新計算', () => {
      loginAsCustomer(ctx, 2);
      const room = makeRoom({ id: 1, rating: 3.0, reviews: [{ rating: 3 }] });
      ctx.__pushRoom(room);
      const order = makeOrder({ bookingStatus: '已退房', paymentStatus: '已付款', checkOut: daysFromToday(-3) });
      ctx.__setOrders([order]);

      ctx.submitReview(1001, '5', '超棒！');

      // 新評分 = (3+5)/2 = 4。rooms 是腳本內部 let 變數，需用 __getRooms() 存取
      const updatedRoom = ctx.__getRooms().find(r => r.id === 1);
      expect(updatedRoom.rating).toBe(4);
    });
  });

  // ---- 5-7 訂單重疊補償 ----
  describe('訂單重疊補償 — createFailedOverlapOrder', () => {
    test('重疊訂單應產生補償點數並加入訂單', () => {
      loginAsCustomer(ctx, 2);  // 設定內部 currentUser.id = 2
      const room = makeRoom();
      ctx.__pushRoom(room);
      ctx.__setOrders([]);

      const selectedType = room.roomTypes[0];
      const booking = {
        checkIn: daysFromToday(5),
        checkInTime: '15:00',
        checkOut: daysFromToday(7),
        checkOutTime: '11:00',
        nights: 2,
        guests: 2
      };

      ctx.addBonusPoints = jest.fn(() => true);

      ctx.createFailedOverlapOrder(room, selectedType, booking);

      const orders = ctx.__getOrders();
      expect(orders).toHaveLength(1);
      expect(orders[0].bookingStatus).toBe('無法成立');
      expect(orders[0].compensationPoints).toBe(20);
      expect(ctx.addBonusPoints).toHaveBeenCalledWith(
        20,
        expect.stringContaining('補償'),
        'lodging-overlap-compensation',
        2
      );
    });
  });

  // ---- 5-8 歷史訂單資訊 ----
  describe('歷史訂單 — formatOrderStayPeriod', () => {
    test('格式化住宿期間含時間', () => {
      const order = makeOrder({
        checkIn: '2025-06-10',
        checkInTime: '15:00',
        checkOut: '2025-06-12',
        checkOutTime: '11:00'
      });
      const result = ctx.formatOrderStayPeriod(order);
      expect(result).toContain('2025-06-10');
      expect(result).toContain('2025-06-12');
      expect(result).toContain('15:00');
      expect(result).toContain('11:00');
    });

    test('缺少時間時仍可格式化', () => {
      const order = makeOrder({
        checkIn: '2025-06-10',
        checkInTime: '',
        checkOut: '2025-06-12',
        checkOutTime: ''
      });
      const result = ctx.formatOrderStayPeriod(order);
      expect(result).toContain('2025-06-10');
      expect(result).toContain('2025-06-12');
    });
  });

  // ---- 5-9 付款功能 ----
  describe('付款功能 — payOrder', () => {
    test('付款金額正確時更新為已付款', async () => {
      loginAsCustomer(ctx, 2);
      const order = makeOrder({
        paymentStatus: '未付款',
        amount: 6000,
        bankDueAtTimestamp: Date.now() + 24 * 60 * 60 * 1000  // 24hr 後到期
      });
      ctx.__setOrders([order]);

      // 模擬 showBankTransferDialog 回傳正確金額
      ctx.showBankTransferDialog = jest.fn(() => Promise.resolve('6000'));

      await ctx.payOrder(1001);

      const updated = ctx.__getOrders().find(o => o.id === 1001);
      expect(updated.paymentStatus).toBe('已付款');
    });

    test('兩晚以上訂單以折後金額付款成功後標記優惠已套用', async () => {
      loginAsCustomer(ctx, 2);
      const order = makeOrder({
        paymentStatus: '未付款',
        originalAmount: 6000,
        amount: 4800,
        discountEligible: true,
        discountRate: 0.8,
        discountAmount: 1200,
        discountLabel: '訂房兩晚以上八折優惠',
        discountStatus: '付款成功後套用',
        bankDueAtTimestamp: Date.now() + 24 * 60 * 60 * 1000
      });
      ctx.__setOrders([order]);

      ctx.showBankTransferDialog = jest.fn(() => Promise.resolve('4800'));

      await ctx.payOrder(1001);

      const updated = ctx.__getOrders().find(o => o.id === 1001);
      expect(updated.paymentStatus).toBe('已付款');
      expect(updated.discountStatus).toBe('已套用');
      expect(updated.discountAppliedAt).toBeTruthy();
    });

    test('付款金額錯誤時標記為異常', async () => {
      loginAsCustomer(ctx, 2);
      const order = makeOrder({
        paymentStatus: '未付款',
        amount: 6000,
        bankDueAtTimestamp: Date.now() + 24 * 60 * 60 * 1000
      });
      ctx.__setOrders([order]);

      ctx.showBankTransferDialog = jest.fn(() => Promise.resolve('5000'));  // 錯誤金額

      await ctx.payOrder(1001);

      const updated = ctx.__getOrders().find(o => o.id === 1001);
      expect(updated.paymentStatus).toBe('付款異常');
    });

    test('取消付款時訂單狀態不變', async () => {
      loginAsCustomer(ctx, 2);
      const order = makeOrder({
        paymentStatus: '未付款',
        amount: 6000,
        bankDueAtTimestamp: Date.now() + 24 * 60 * 60 * 1000
      });
      ctx.__setOrders([order]);

      ctx.showBankTransferDialog = jest.fn(() => Promise.resolve(null));  // 取消

      await ctx.payOrder(1001);

      const updated = ctx.__getOrders().find(o => o.id === 1001);
      expect(updated.paymentStatus).toBe('未付款');
    });
  });

  // ---- 5-10 聊天室功能 ----
  describe('聊天室功能 — sendMessage', () => {
    // chatConversations 是 chat.js 內部 let 變數，需透過 __getChatConversations() 存取

    test('未登入時不能傳送訊息', () => {
      // createContext 初始狀態 = 未登入
      ctx.document.getElementById = jest.fn((id) => {
        if (id === 'chatInput') return { value: '你好', style: {} };
        return null;
      });

      ctx.sendMessage();
      expect(Object.keys(ctx.__getChatConversations())).toHaveLength(0);
    });

    test('顧客可以傳送訊息', () => {
      loginAsCustomer(ctx, 2);
      ctx.document.getElementById = jest.fn((id) => {
        if (id === 'chatInput') return { value: '你好，我有問題想詢問', style: {} };
        return null;
      });

      ctx.sendMessage();

      const conversations = ctx.__getChatConversations();
      expect(conversations['2']).toBeDefined();
      expect(conversations['2']).toHaveLength(1);
      expect(conversations['2'][0].text).toBe('你好，我有問題想詢問');
      expect(conversations['2'][0].sender).toBe('customer');
    });

    test('空訊息不傳送', () => {
      loginAsCustomer(ctx, 2);
      ctx.document.getElementById = jest.fn((id) => {
        if (id === 'chatInput') return { value: '   ', style: {} };
        return null;
      });

      ctx.sendMessage();
      // 空白訊息 trim 後為空，不加入 chatConversations
      const conversations = ctx.__getChatConversations();
      expect(Object.keys(conversations)).toHaveLength(0);
    });

    test('管理員不能使用顧客聊天室', () => {
      ctx.__setLoginState(true, { id: 1, account: 'admin@example.com', role: 'admin' });
      ctx.document.getElementById = jest.fn((id) => {
        if (id === 'chatInput') return { value: '管理員訊息', style: {} };
        return null;
      });

      ctx.sendMessage();
      expect(Object.keys(ctx.__getChatConversations())).toHaveLength(0);
    });
  });
});

// ============================================================
// 六、C 模組 — 火車票務完整功能測試
// ============================================================

/** 建立標準測試車次結果 */
function makeTrainResult(overrides = {}) {
  return {
    id: 'test-result-1',
    fromStation: '台北',
    toStation: '台東',
    travelDate: daysFromToday(5),
    departTime: '09:00',
    arriveTime: '15:40',
    cabin: 'standard',
    trainType: '自強號',
    trainNo: '308',
    reservedTrain: true,
    transfer: false,
    distance: 610,
    availableSeats: 20,
    durationMinutes: 400,
    status: '準點',
    reservable: true,
    unavailableReason: '',
    ...overrides
  };
}

/**
 * 建立「N 小時後出發」的車次。
 * 使用本地時間格式讓 getTrainDateTime 與 Date.now() 計算一致。
 */
function makeTrainResultInHours(hours, overrides = {}) {
  const d = new Date(Date.now() + hours * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  const travelDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const departTime = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return makeTrainResult({ travelDate, departTime, ...overrides });
}

describe('C 模組 — 票價計算 (需求第六節)', () => {
  let ctx;
  beforeEach(() => { ctx = createContext(); });

  describe('基礎票價 = 距離 × 費率 × 車廂加成', () => {
    test('自強號標準車廂：610km × 2.8 = 1708, max(15,round) = 1708', () => {
      const result = makeTrainResult({ trainType: '自強號', distance: 610, cabin: 'standard' });
      const price = ctx.calculateTrainPrice(result, 'general', false);
      expect(price.basePrice).toBe(Math.max(15, Math.round(610 * 2.8 * 1)));
    });

    test('莒光號費率 2.3/km', () => {
      const result = makeTrainResult({ trainType: '莒光號', distance: 100, cabin: 'standard' });
      const price = ctx.calculateTrainPrice(result, 'general', false);
      expect(price.basePrice).toBe(Math.max(15, Math.round(100 * 2.3)));
    });

    test('太魯閣費率 3.0/km', () => {
      const result = makeTrainResult({ trainType: '太魯閣', distance: 100, cabin: 'standard' });
      const price = ctx.calculateTrainPrice(result, 'general', false);
      expect(price.basePrice).toBe(Math.max(15, Math.round(100 * 3.0)));
    });

    test('普悠瑪費率 3.0/km', () => {
      const result = makeTrainResult({ trainType: '普悠瑪', distance: 100, cabin: 'standard' });
      const price = ctx.calculateTrainPrice(result, 'general', false);
      expect(price.basePrice).toBe(Math.max(15, Math.round(100 * 3.0)));
    });

    test('區間車費率 1.8/km', () => {
      const result = makeTrainResult({ trainType: '區間車', distance: 100, cabin: 'standard', reservedTrain: false });
      const price = ctx.calculateTrainPrice(result, 'general', false);
      expect(price.basePrice).toBe(Math.max(15, Math.round(100 * 1.8)));
    });

    test('商務車廂基礎票價 × 1.3 倍', () => {
      const std = makeTrainResult({ trainType: '自強號', distance: 200, cabin: 'standard' });
      const biz = makeTrainResult({ trainType: '自強號', distance: 200, cabin: 'business' });
      const stdPrice = ctx.calculateTrainPrice(std, 'general', false);
      const bizPrice = ctx.calculateTrainPrice(biz, 'general', false);
      expect(bizPrice.basePrice).toBe(Math.max(15, Math.round(200 * 2.8 * 1.3)));
      expect(bizPrice.basePrice).toBeGreaterThan(stdPrice.basePrice);
    });

    test('最低票價不低於 15 元', () => {
      const result = makeTrainResult({ trainType: '區間車', distance: 1, cabin: 'standard', reservedTrain: false });
      const price = ctx.calculateTrainPrice(result, 'general', false);
      expect(price.basePrice).toBeGreaterThanOrEqual(15);
    });
  });

  describe('票種折扣（最終票價 = 基礎票價 × 折扣率）', () => {
    // 用非對號列車（區間車）測試：無早鳥、無時間折扣干擾，只有票種折扣生效
    // 這符合需求：時間折扣與早鳥折扣僅限對號列車
    const base = makeTrainResult({
      trainType: '區間車', distance: 100, cabin: 'standard', reservedTrain: false
    });

    test('一般票不打折 (factor = 1)', () => {
      const price = ctx.calculateTrainPrice(base, 'general', false);
      expect(price.discountFactor).toBe(1);
    });

    test('學生票 88 折', () => {
      const price = ctx.calculateTrainPrice(base, 'student', false);
      expect(price.discountFactor).toBe(0.88);
    });

    test('敬老票 6 折', () => {
      const price = ctx.calculateTrainPrice(base, 'senior', false);
      expect(price.discountFactor).toBe(0.6);
    });

    test('愛心票 6 折', () => {
      const price = ctx.calculateTrainPrice(base, 'accessibility', false);
      expect(price.discountFactor).toBe(0.6);
    });

    test('兒童票 7 折', () => {
      const price = ctx.calculateTrainPrice(base, 'child', false);
      expect(price.discountFactor).toBe(0.7);
    });

    test('最終票價 = ceil(基礎票價 × 折扣率)', () => {
      // 用非對號列車避免早鳥/時間折扣干擾：僅學生 0.88 折生效
      const result = makeTrainResult({ trainType: '區間車', distance: 100, cabin: 'standard', reservedTrain: false });
      const price = ctx.calculateTrainPrice(result, 'student', false);
      const expectedBase = Math.max(15, Math.round(100 * 1.8));  // 區間車費率 1.8
      expect(price.basePrice).toBe(expectedBase);
      expect(price.finalPrice).toBe(Math.ceil(expectedBase * 0.88));
    });
  });

  describe('最優惠折扣原則', () => {
    // 註：早鳥折扣（依「距出發還有幾天」打折）已被新版「時間折扣」
    // （依「距發車還有幾小時」打折，需求第六節）取代，getTrainEarlyBirdDiscount
    // 已不存在。20 天後出發時，時間折扣 factor 為 1（不生效），
    // 所以以下情境單純比較「票種折扣」之間的最優惠選擇。
    test('敬老 0.6 比一般票更優惠 → 選敬老 0.6', () => {
      const result = makeTrainResult({ travelDate: daysFromToday(20) });
      const price = ctx.calculateTrainPrice(result, 'senior', false);
      expect(price.discountFactor).toBe(0.6);
    });

    test('20 天後出發，時間折扣不生效 → 選學生票 0.88', () => {
      const result = makeTrainResult({ travelDate: daysFromToday(20) });
      const price = ctx.calculateTrainPrice(result, 'student', false);
      expect(price.discountFactor).toBe(0.88);
    });
  });

  describe('時間折扣 getTrainTimeDiscount()（需求第六節，新增功能）', () => {
    test('非對號列車（區間車）無時間折扣', () => {
      const result = makeTrainResultInHours(3, { reservedTrain: false });
      const d = ctx.getTrainTimeDiscount(result);
      expect(d.factor).toBe(1);
    });

    test('距發車超過 3 天：無時間折扣', () => {
      const result = makeTrainResultInHours(100);  // ~4 天後
      const d = ctx.getTrainTimeDiscount(result);
      expect(d.factor).toBe(1);
    });

    test('距發車 1-3 天（72 小時內）：95 折', () => {
      const result = makeTrainResultInHours(50);   // ~2 天後
      const d = ctx.getTrainTimeDiscount(result);
      expect(d.factor).toBe(0.95);
    });

    test('距發車 12-24 小時：88 折', () => {
      const result = makeTrainResultInHours(18);
      const d = ctx.getTrainTimeDiscount(result);
      expect(d.factor).toBe(0.88);
    });

    test('距發車 6-12 小時：85 折', () => {
      const result = makeTrainResultInHours(9);
      const d = ctx.getTrainTimeDiscount(result);
      expect(d.factor).toBe(0.85);
    });

    test('距發車 6 小時內：70 折', () => {
      const result = makeTrainResultInHours(3);
      const d = ctx.getTrainTimeDiscount(result);
      expect(d.factor).toBe(0.70);
    });

    test('已過發車時間：無時間折扣（factor=1）', () => {
      const result = makeTrainResultInHours(-1);   // 1 小時前已出發
      const d = ctx.getTrainTimeDiscount(result);
      expect(d.factor).toBe(1);
    });

    test('時間折扣納入 calculateTrainPrice 並取最優惠', () => {
      // 距發車 3 小時 → 時間折扣 0.7，一般票無折扣 → 最終選 0.7
      const result = makeTrainResultInHours(3, { travelDate: makeTrainResultInHours(3).travelDate });
      const price = ctx.calculateTrainPrice(result, 'general', false);
      expect(price.discountFactor).toBe(0.7);
    });

    test('時間折扣 vs 學生票：選最小 factor', () => {
      // 距發車 18 小時 → 時間折扣 0.88，學生票 0.88 → 相同，選 0.88
      const result = makeTrainResultInHours(18);
      const price = ctx.calculateTrainPrice(result, 'student', false);
      expect(price.discountFactor).toBe(0.88);
    });
  });
});

describe('C 模組 — 車次可訂性 (需求第四、八節)', () => {
  let ctx;
  beforeEach(() => { ctx = createContext(); });

  describe('getTrainAvailability()', () => {
    test('停駛班次不可訂', () => {
      const result = makeTrainResult({ status: '停駛' });
      const avail = ctx.getTrainAvailability(result);
      expect(avail.reservable).toBe(false);
      expect(avail.unavailableReason).toMatch(/停駛/);
    });

    test('非對號列車（區間車）不可訂號', () => {
      const result = makeTrainResult({ reservedTrain: false });
      const avail = ctx.getTrainAvailability(result);
      expect(avail.reservable).toBe(false);
      expect(avail.unavailableReason).toMatch(/非對號/);
    });

    test('座位已售完不可訂', () => {
      const result = makeTrainResult({ availableSeats: 0 });
      const avail = ctx.getTrainAvailability(result);
      expect(avail.reservable).toBe(false);
      expect(avail.unavailableReason).toMatch(/售完/);
    });

    test('正常對號班次可以訂票', () => {
      const result = makeTrainResult({ availableSeats: 10 });
      const avail = ctx.getTrainAvailability(result);
      expect(avail.reservable).toBe(true);
    });

    test('已過訂票期限（發車前 30 分鐘）不可訂', () => {
      // 設定為 10 分鐘後出發（< 30 分鐘期限）
      const result = makeTrainResultInHours(0.1, { availableSeats: 10 });
      const avail = ctx.getTrainAvailability(result);
      expect(avail.reservable).toBe(false);
      expect(avail.unavailableReason).toMatch(/期限/);
    });
  });

  describe('getRemainingTrainSeats()', () => {
    test('無訂單時剩餘座位 = availableSeats', () => {
      const result = makeTrainResult({ availableSeats: 15 });
      ctx.__setTrainOrders([]);
      expect(ctx.getRemainingTrainSeats(result)).toBe(15);
    });

    test('非對號列車回傳 0（不適用座位計算）', () => {
      const result = makeTrainResult({ reservedTrain: false, availableSeats: 0 });
      expect(ctx.getRemainingTrainSeats(result)).toBe(0);
    });

    test('有訂單時座位遞減', () => {
      const result = makeTrainResult({ availableSeats: 10 });
      ctx.__setTrainOrders([{
        id: 1,
        bookingStatus: '已訂票',
        travelDate: result.travelDate,
        trainNo: result.trainNo,
        fromStation: result.fromStation,
        toStation: result.toStation,
        quantity: 3
      }]);
      expect(ctx.getRemainingTrainSeats(result)).toBe(7);
    });

    test('已退票的訂單不扣座位', () => {
      const result = makeTrainResult({ availableSeats: 10 });
      ctx.__setTrainOrders([{
        id: 1,
        bookingStatus: '已退票',
        travelDate: result.travelDate,
        trainNo: result.trainNo,
        fromStation: result.fromStation,
        toStation: result.toStation,
        quantity: 5
      }]);
      expect(ctx.getRemainingTrainSeats(result)).toBe(10);
    });
  });
});

describe('C 模組 — 座位分配 (需求第七節)', () => {
  let ctx;
  beforeEach(() => { ctx = createContext(); });

  describe('assignTrainSeats()', () => {
    test('商務車廂座位號前綴為 B1', () => {
      const result = makeTrainResult({ cabin: 'business', availableSeats: 20 });
      const assigned = ctx.assignTrainSeats(result, 'none', 1);
      expect(assigned.seats[0]).toMatch(/^B1-/);
    });

    test('標準車廂座位號前綴為 S', () => {
      const result = makeTrainResult({ cabin: 'standard', availableSeats: 20 });
      const assigned = ctx.assignTrainSeats(result, 'none', 1);
      expect(assigned.seats[0]).toMatch(/^S\d+-/);
    });

    test('指定 2 張票分配 2 個座位', () => {
      const result = makeTrainResult({ availableSeats: 20 });
      const assigned = ctx.assignTrainSeats(result, 'none', 2);
      expect(assigned.seats).toHaveLength(2);
      expect(assigned.warning).toBe('');
    });

    test('座位不足時回傳警告訊息且 seats 為空', () => {
      const result = makeTrainResult({ availableSeats: 1, reservedTrain: true });
      const assigned = ctx.assignTrainSeats(result, 'none', 3);
      expect(assigned.seats).toHaveLength(0);
      expect(assigned.warning).toBeTruthy();
    });

    test('區間車指定安靜車廂應有警告', () => {
      const result = makeTrainResult({ trainType: '區間車', availableSeats: 20 });
      const assigned = ctx.assignTrainSeats(result, 'quiet', 1);
      expect(assigned.warning).toBeTruthy();
    });

    test('靠窗偏好：座位字母應為 A 或 B', () => {
      const result = makeTrainResult({ availableSeats: 20 });
      const assigned = ctx.assignTrainSeats(result, 'window', 1);
      const letter = assigned.seats[0].split('-')[1]?.slice(-1);
      expect(['A', 'B', 'E', 'F']).toContain(letter);
    });
  });
});

describe('C 模組 — 訂票期限 (需求第十四節)', () => {
  let ctx;
  beforeEach(() => { ctx = createContext(); });

  describe('isBeforeTrainDeadline()', () => {
    test('發車前 60 分鐘以上：30 分鐘期限內 → true', () => {
      const target = makeTrainResultInHours(2);
      expect(ctx.isBeforeTrainDeadline(target, 30)).toBe(true);
    });

    test('發車僅剩 10 分鐘：超過 30 分鐘期限 → false', () => {
      const target = makeTrainResultInHours(0.15);  // 9 分鐘後
      expect(ctx.isBeforeTrainDeadline(target, 30)).toBe(false);
    });

    test('發車前 30 分鐘以上：20 分鐘付款期限內 → true', () => {
      const target = makeTrainResultInHours(1);
      expect(ctx.isBeforeTrainDeadline(target, 20)).toBe(true);
    });

    test('改票期限：發車前 1 小時以上 → true', () => {
      const target = makeTrainResultInHours(2);
      expect(ctx.isBeforeTrainDeadline(target, 60)).toBe(true);
    });

    test('改票期限：發車前不足 1 小時 → false', () => {
      const target = makeTrainResultInHours(0.4);  // 24 分鐘後
      expect(ctx.isBeforeTrainDeadline(target, 60)).toBe(false);
    });
  });
});

describe('C 模組 — 退票手續費 (需求第十六節)', () => {
  let ctx;
  beforeEach(() => { ctx = createContext(); });

  const makeRefundOrder = (daysAhead) => ({
    id: 999,
    travelDate: daysFromToday(daysAhead),
    payableAmount: 1000,
    finalPrice: 1000
  });

  test('乘車 25 天以上：1% 手續費', () => {
    const result = ctx.calculateTrainRefund(makeRefundOrder(30));
    expect(result.refundable).toBe(true);
    expect(result.fee).toBe(Math.ceil(1000 * 0.01));
    expect(result.amount).toBe(1000 - result.fee);
  });

  test('乘車 3-24 天前：3% 手續費', () => {
    const result = ctx.calculateTrainRefund(makeRefundOrder(10));
    expect(result.refundable).toBe(true);
    expect(result.fee).toBe(Math.ceil(1000 * 0.03));
  });

  test('乘車 1-2 天前：5% 手續費', () => {
    const result = ctx.calculateTrainRefund(makeRefundOrder(1));
    expect(result.refundable).toBe(true);
    expect(result.fee).toBe(Math.ceil(1000 * 0.05));
  });

  test('乘車當日：10% 手續費', () => {
    const result = ctx.calculateTrainRefund(makeRefundOrder(0));
    expect(result.refundable).toBe(true);
    expect(result.fee).toBe(Math.ceil(1000 * 0.10));
  });

  test('乘車日已過不可退票', () => {
    const result = ctx.calculateTrainRefund(makeRefundOrder(-2));
    expect(result.refundable).toBe(false);
  });

  test('退款金額 = 票價 − 手續費', () => {
    const result = ctx.calculateTrainRefund(makeRefundOrder(30));
    expect(result.amount).toBe(1000 - result.fee);
  });
});

describe('C 模組 — 點數獎勵 (需求第十八節)', () => {
  let ctx;
  beforeEach(() => {
    ctx = createContext();
    loginAsCustomer(ctx, 2);
    ctx.addBonusPoints = jest.fn(() => true);  // 攔截 addBonusPoints 呼叫
  });

  test('消費未滿 5 次：不核發點數', () => {
    // 設定 4 筆已付款的火車訂單
    ctx.__setTrainOrders([
      { id: 1, userId: '2', holderUserId: '2', paymentStatus: '已付款' },
      { id: 2, userId: '2', holderUserId: '2', paymentStatus: '已付款' },
      { id: 3, userId: '2', holderUserId: '2', paymentStatus: '已付款' },
      { id: 4, userId: '2', holderUserId: '2', paymentStatus: '已付款' }
    ]);
    ctx.__setOrders([]);
    ctx.awardPlatformConsumptionBonus();
    expect(ctx.addBonusPoints).not.toHaveBeenCalled();
  });

  test('消費滿 5 次：核發 30 點紅利', () => {
    // 5 筆已付款的火車訂單
    ctx.__setTrainOrders([
      { id: 1, userId: '2', holderUserId: '2', paymentStatus: '已付款' },
      { id: 2, userId: '2', holderUserId: '2', paymentStatus: '已付款' },
      { id: 3, userId: '2', holderUserId: '2', paymentStatus: '已付款' },
      { id: 4, userId: '2', holderUserId: '2', paymentStatus: '已付款' },
      { id: 5, userId: '2', holderUserId: '2', paymentStatus: '已付款' }
    ]);
    ctx.__setOrders([]);
    ctx.awardPlatformConsumptionBonus();
    expect(ctx.addBonusPoints).toHaveBeenCalledWith(
      30,
      expect.stringContaining('5'),
      'consumption-milestone',
      expect.anything()
    );
  });

  test('消費滿 10 次：核發 60 點（每 5 次 30 點）', () => {
    const orders = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1, userId: '2', holderUserId: '2', paymentStatus: '已付款'
    }));
    ctx.__setTrainOrders(orders);
    ctx.__setOrders([]);
    ctx.awardPlatformConsumptionBonus();
    // 呼叫時 points = diff * 30 = 2 * 30 = 60
    expect(ctx.addBonusPoints).toHaveBeenCalledWith(
      60,
      expect.any(String),
      'consumption-milestone',
      expect.anything()
    );
  });

  test('已核發過點數（有 milestones 紀錄）不重複核發', () => {
    ctx.__setTrainOrders([
      { id: 1, userId: '2', holderUserId: '2', paymentStatus: '已付款' },
      { id: 2, userId: '2', holderUserId: '2', paymentStatus: '已付款' },
      { id: 3, userId: '2', holderUserId: '2', paymentStatus: '已付款' },
      { id: 4, userId: '2', holderUserId: '2', paymentStatus: '已付款' },
      { id: 5, userId: '2', holderUserId: '2', paymentStatus: '已付款' }
    ]);
    ctx.__setOrders([]);
    // 模擬已核發過 1 個里程碑
    ctx.__setUserBonusAwardedMilestone('2', 1);
    ctx.awardPlatformConsumptionBonus();
    // milestones = floor(5/5)=1, awardedMilestones=1 → diff=0 → 不核發
    expect(ctx.addBonusPoints).not.toHaveBeenCalled();
  });
});

describe('C 模組 — 異常補償 (需求第十七節)', () => {
  let ctx;
  beforeEach(() => {
    ctx = createContext();
    loginAsCustomer(ctx, 2);
    ctx.addBonusPoints = jest.fn(() => true);
  });

  test('模擬延誤：補償 10 點紅利並更新訂單狀態', () => {
    const order = {
      id: 999,
      userId: 2,
      holderUserId: 2,
      paymentStatus: '已付款',
      bookingStatus: '已確認',
      status: '已付款'
    };
    ctx.__setTrainOrders([order]);

    ctx.simulateTrainAbnormal(999, 'delay');

    const updatedOrder = ctx.__getTrainOrders().find(o => o.id === 999);
    expect(updatedOrder.status).toMatch(/延誤/);
    expect(ctx.addBonusPoints).toHaveBeenCalledWith(
      10, expect.any(String), 'train-abnormal', expect.anything()
    );
  });

  test('模擬停駛：補償 20 點紅利並更新訂單狀態', () => {
    const order = {
      id: 998,
      userId: 2,
      holderUserId: 2,
      paymentStatus: '已付款',
      bookingStatus: '已確認',
      status: '已付款'
    };
    ctx.__setTrainOrders([order]);

    ctx.simulateTrainAbnormal(998, 'stop');

    const updatedOrder = ctx.__getTrainOrders().find(o => o.id === 998);
    expect(updatedOrder.status).toMatch(/停駛/);
    expect(ctx.addBonusPoints).toHaveBeenCalledWith(
      20, expect.any(String), 'train-abnormal', expect.anything()
    );
  });
});

describe('C 模組 — 票券分票規則 (需求第十五節)', () => {
  let ctx;
  beforeEach(() => { ctx = createContext(); });

  describe('isTransferredTrainOrder()', () => {
    test('原始訂單（非分票）回傳 false', () => {
      const order = { id: 1, receivedTransfer: false, ticketFolder: '我的票夾', splitParentId: null };
      expect(ctx.isTransferredTrainOrder(order)).toBe(false);
    });

    test('分票轉入的訂單回傳 true', () => {
      const order = { id: 1, receivedTransfer: true, ticketFolder: '分票票夾', splitParentId: 100 };
      expect(ctx.isTransferredTrainOrder(order)).toBe(true);
    });

    test('null 訂單回傳 false', () => {
      expect(ctx.isTransferredTrainOrder(null)).toBe(false);
    });
  });
});

// ============================================================
// 七、trains.js 基礎工具測試（原有，保留）
// ============================================================
describe('trains.js — 火車票務邏輯', () => {
  let ctx;
  beforeEach(() => { ctx = createContext(); });

  describe('getTrainDistance()', () => {
    test('台北到台東的距離大於 0', () => {
      const dist = ctx.getTrainDistance('台北', '台東');
      expect(dist).toBeGreaterThan(0);
    });

    test('台東到台北（反向）距離相同', () => {
      expect(ctx.getTrainDistance('台東', '台北')).toBe(ctx.getTrainDistance('台北', '台東'));
    });

    test('相同站名距離不低於 20', () => {
      expect(ctx.getTrainDistance('台北', '台北')).toBeGreaterThanOrEqual(20);
    });
  });

  describe('calculateTrainDuration()', () => {
    test('有轉乘時行駛時間較長', () => {
      const withoutTransfer = ctx.calculateTrainDuration('自強號', 100, false);
      const withTransfer = ctx.calculateTrainDuration('自強號', 100, true);
      expect(withTransfer).toBeGreaterThan(withoutTransfer);
    });

    test('區間車比自強號慢', () => {
      const localDuration = ctx.calculateTrainDuration('區間車', 100, false);
      const expressDuration = ctx.calculateTrainDuration('自強號', 100, false);
      expect(localDuration).toBeGreaterThan(expressDuration);
    });
  });

  describe('matchTrainPeriod()', () => {
    test('"all" 任何時間都符合', () => {
      expect(ctx.matchTrainPeriod('05:00', 'all')).toBe(true);
      expect(ctx.matchTrainPeriod('23:00', 'all')).toBe(true);
    });

    test('"morning" 符合 05:00-11:59', () => {
      expect(ctx.matchTrainPeriod('05:00', 'morning')).toBe(true);
      expect(ctx.matchTrainPeriod('11:59', 'morning')).toBe(true);
    });

    test('"morning" 不符合 12:00 以後', () => {
      expect(ctx.matchTrainPeriod('12:00', 'morning')).toBe(false);
    });

    test('"afternoon" 符合 12:00-17:59', () => {
      expect(ctx.matchTrainPeriod('14:30', 'afternoon')).toBe(true);
    });

    test('"night" 符合 18:00 以後', () => {
      expect(ctx.matchTrainPeriod('20:00', 'night')).toBe(true);
    });
  });

  describe('addMinutesToTime()', () => {
    test('基本加法', () => {
      expect(ctx.addMinutesToTime('09:00', 30)).toBe('09:30');
    });

    test('跨小時', () => {
      expect(ctx.addMinutesToTime('09:45', 30)).toBe('10:15');
    });

    test('跨日（超過 24:00）', () => {
      expect(ctx.addMinutesToTime('23:50', 30)).toBe('00:20');
    });
  });

  describe('formatTrainDuration()', () => {
    test('90 分鐘 → "1 小時 30 分"', () => {
      expect(ctx.formatTrainDuration(90)).toBe('1 小時 30 分');
    });

    test('45 分鐘 → "0 小時 45 分"', () => {
      expect(ctx.formatTrainDuration(45)).toBe('0 小時 45 分');
    });
  });

  describe('calculateTrainRefund()', () => {
    const makeTrainOrder = (daysAhead) => ({
      id: 999,
      travelDate: daysFromToday(daysAhead),
      payableAmount: 1000,
      finalPrice: 1000
    });

    test('乘車 25 天前扣 1% 手續費', () => {
      const result = ctx.calculateTrainRefund(makeTrainOrder(30));
      expect(result.refundable).toBe(true);
      expect(result.fee).toBe(Math.ceil(1000 * 0.01));
    });

    test('乘車 3-24 天前扣 3% 手續費', () => {
      const result = ctx.calculateTrainRefund(makeTrainOrder(10));
      expect(result.refundable).toBe(true);
      expect(result.fee).toBe(Math.ceil(1000 * 0.03));
    });

    test('乘車當日扣 10% 手續費', () => {
      const result = ctx.calculateTrainRefund(makeTrainOrder(0));
      expect(result.refundable).toBe(true);
      expect(result.fee).toBe(Math.ceil(1000 * 0.1));
    });

    test('乘車日已過不可退票', () => {
      const result = ctx.calculateTrainRefund(makeTrainOrder(-1));
      expect(result.refundable).toBe(false);
    });
  });

  describe('getRemainingTrainSeats()', () => {
    test('無訂單時剩餘座位等於 availableSeats', () => {
      const result = {
        travelDate: '2025-08-01', trainNo: '308',
        fromStation: '台北', toStation: '台東',
        reservedTrain: true, availableSeats: 10
      };
      expect(ctx.getRemainingTrainSeats(result)).toBe(10);
    });

    test('非對號列車回傳 0', () => {
      const result = {
        travelDate: '2025-08-01', trainNo: '4152',
        reservedTrain: false, availableSeats: 0
      };
      expect(ctx.getRemainingTrainSeats(result)).toBe(0);
    });
  });
});

// ============================================================
// 七、pricing.js 測試
// ============================================================
describe('pricing.js — 定價計算', () => {
  let ctx;
  beforeEach(() => { ctx = createContext(); });

  describe('applyPricingDiscount()', () => {
    test('discountType 為 "none" 時回傳原價', () => {
      expect(ctx.applyPricingDiscount(3000, 'none', 0)).toBe(3000);
    });

    test('百分比折扣 20% 時正確計算', () => {
      expect(ctx.applyPricingDiscount(3000, 'percentage', 20)).toBe(2400);
    });

    test('固定折扣金額 500 元', () => {
      expect(ctx.applyPricingDiscount(3000, 'early_bird', 500)).toBe(2500);
    });

    test('折扣後不低於 0', () => {
      expect(ctx.applyPricingDiscount(100, 'early_bird', 200)).toBe(0);
    });
  });

  describe('getPricingRoomType()', () => {
    test('找到對應房型', () => {
      const type = ctx.getPricingRoomType(makeRoom(), 'type-std-1');
      expect(type).not.toBeNull();
      expect(type.name).toBe('標準房');
    });

    test('找不到的房型回傳 null', () => {
      expect(ctx.getPricingRoomType(makeRoom(), 'no-such-type')).toBeNull();
    });

    test('room 為 null 時回傳 null', () => {
      expect(ctx.getPricingRoomType(null, 'type-std-1')).toBeNull();
    });
  });
});

// ============================================================
// 八、bonus.js 測試
// ============================================================
describe('bonus.js — 紅利點數管理', () => {
  let ctx;

  beforeEach(() => {
    ctx = createContext();
    const customer = { id: 2, account: 'customer@test.com', role: 'customer', displayName: '測試顧客' };
    ctx.__pushUser(customer);
    ctx.__setLoginState(true, customer);  // 寫入腳本內部 let 變數
  });

  describe('getUserBonusPoints()', () => {
    test('新用戶點數為 0', () => {
      expect(ctx.getUserBonusPoints(2)).toBe(0);
    });

    test('已有點數的用戶回傳正確點數', () => {
      ctx.__setUserBonusPoint('2', 150);
      expect(ctx.getUserBonusPoints(2)).toBe(150);
    });

    test('userId 為空時回傳 0', () => {
      expect(ctx.getUserBonusPoints(null)).toBe(0);
      expect(ctx.getUserBonusPoints('')).toBe(0);
    });
  });

  describe('管理員紅利點數', () => {
    test('管理員登入時目前紅利點數固定為 0', () => {
      const admin = { id: 1, account: 'admin@example.com', role: 'admin', displayName: '系統管理員' };
      ctx.__setUserBonusPoint('1', 500);
      ctx.__setLoginState(true, admin);

      expect(ctx.getUserBonusPoints(1)).toBe(500);
      expect(ctx.getCurrentBonusPoints()).toBe(0);
    });

    test('管理員不顯示紅利紀錄', () => {
      ctx.addBonusPoints(100, '測試核發', 'system', 2);
      const admin = { id: 1, account: 'admin@example.com', role: 'admin', displayName: '系統管理員' };
      ctx.__setLoginState(true, admin);

      expect(ctx.getVisibleBonusRecords()).toEqual([]);
    });
  });

  describe('addBonusPoints()', () => {
    test('成功新增點數並回傳 true', () => {
      const result = ctx.addBonusPoints(100, '測試核發', 'system', 2);
      expect(result).toBe(true);
      expect(ctx.getUserBonusPoints(2)).toBe(100);
    });

    test('累積點數正確', () => {
      ctx.addBonusPoints(100, '第一次', 'system', 2);
      ctx.addBonusPoints(50, '第二次', 'system', 2);
      expect(ctx.getUserBonusPoints(2)).toBe(150);
    });

    test('金額為 0 或負數時回傳 false', () => {
      expect(ctx.addBonusPoints(0, '無效', 'system', 2)).toBe(false);
      expect(ctx.addBonusPoints(-10, '無效', 'system', 2)).toBe(false);
    });

    test('不允許的來源回傳 false', () => {
      expect(ctx.addBonusPoints(100, '測試', 'unauthorized-source', 2)).toBe(false);
    });
  });

  describe('deductBonusPoints()', () => {
    beforeEach(() => {
      ctx.__setUserBonusPoint('2', 200);
    });

    test('成功扣除點數並回傳 true', () => {
      const result = ctx.deductBonusPoints(50, '購票扣抵', 'train-payment', 2);
      expect(result).toBe(true);
      expect(ctx.getUserBonusPoints(2)).toBe(150);
    });

    test('餘額不足時回傳 false 且不扣除', () => {
      const result = ctx.deductBonusPoints(300, '超額扣抵', 'train-payment', 2);
      expect(result).toBe(false);
      expect(ctx.getUserBonusPoints(2)).toBe(200);
    });

    test('不允許的來源回傳 false', () => {
      const result = ctx.deductBonusPoints(50, '測試', 'invalid-source', 2);
      expect(result).toBe(false);
    });

    test('扣完後餘額為 0', () => {
      ctx.deductBonusPoints(200, '全部扣抵', 'system', 2);
      expect(ctx.getUserBonusPoints(2)).toBe(0);
    });
  });
});
