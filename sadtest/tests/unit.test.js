/**
 * SAD Project G6 - Unit Tests
 *
 * 測試策略：
 * 使用 Node.js 的 vm 模組建立沙盒環境，模擬瀏覽器全域環境，
 * 將所有 JS 原始碼合併後在沙盒中執行，再對各函式進行單元測試。
 *
 * 涵蓋模組：auth.js, utils.js, orders.js, rooms.js, trains.js, pricing.js, bonus.js
 */

'use strict';

const vm = require('vm');
const fs = require('fs');
const path = require('path');

// ============================================================
// 沙盒環境建立
// ============================================================

const JS_DIR = path.resolve(__dirname, '../js');

// 依照瀏覽器載入順序合併原始碼（一次執行共享 let/const 作用域）
const SOURCE_FILES = [
  'state.js',
  'utils.js',
  'auth.js',
  'rooms.js',
  'orders.js',
  'pricing.js',
  'trains.js',
  'bonus.js'
];

const combinedSource = SOURCE_FILES
  .map(f => `// ===== ${f} =====\n` + fs.readFileSync(path.join(JS_DIR, f), 'utf8'))
  .join('\n\n');

/**
 * 測試輔助函式（注入到沙盒同一作用域）
 * 因為 let/const 宣告的全域狀態無法直接從外部存取，
 * 透過這些函式在沙盒內部操作共用狀態變數。
 */
const TEST_HELPERS = `
// ==== Test-only state accessors (injected by test framework) ====
function __pushUser(user)             { users.push(user); }
function __setUsers(arr)              { users = arr; }
function __pushRoom(room)             { rooms.push(room); }
function __setRooms(arr)              { rooms = arr; }
function __pushOrder(order)           { orders.push(order); }
function __setOrders(arr)             { orders = arr; }
function __pushTrainOrder(o)          { trainOrders.push(o); }
function __setTrainOrders(arr)        { trainOrders = arr; }
function __setUserBonusPoint(k, v)    { userBonusPoints[String(k)] = v; }
function __getUserBonusPointsMap()    { return userBonusPoints; }
function __getBonusRecords()          { return bonusPointRecords; }
`;

// 預先編譯，避免每次建立 Context 時重複解析
const compiledScript = new vm.Script(combinedSource + '\n\n' + TEST_HELPERS, { filename: 'app-bundle.js' });

/**
 * 建立一個帶有瀏覽器 API mock 的全新沙盒 Context
 * 每個測試使用獨立 Context，避免狀態汙染
 */
function createContext() {
  // localStorage mock
  const store = {};
  const mockLocalStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };

  // DOM Element mock（支援 escapeHtml 使用的 textContent/innerHTML 模式）
  const createMockElement = () => {
    const el = {
      _text: '',
      style: {},
      classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn() },
      innerHTML: '',
      get textContent() { return this._text; },
      set textContent(v) {
        this._text = String(v);
        // 模擬瀏覽器 HTML 跳脫行為
        this.innerHTML = String(v)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      }
    };
    return el;
  };

  const ctx = {
    // JavaScript 原生物件
    Date, Math, Number, String, Boolean, Array, Object, RegExp, Error,
    JSON, parseInt, parseFloat, isNaN, isFinite, Symbol, Promise,
    NaN, Infinity, undefined,

    // Console（靜音，避免測試輸出雜訊）
    console: { log() {}, warn() {}, error() {}, info() {} },

    // localStorage
    localStorage: mockLocalStorage,

    // 瀏覽器對話框 mock
    alert: jest.fn(),
    confirm: jest.fn(() => false),
    prompt: jest.fn(() => null),

    // DOM mock
    document: {
      createElement: jest.fn(() => createMockElement()),
      getElementById: jest.fn(() => null),
      querySelectorAll: jest.fn(() => []),
      querySelector: jest.fn(() => null),
      body: {
        classList: { toggle: jest.fn(), add: jest.fn(), remove: jest.fn() },
        appendChild: jest.fn()
      },
      addEventListener: jest.fn()
    },

    // 其他瀏覽器 API
    window: null,   // 稍後指向自身
    location: { hash: '' },
    fetch: jest.fn(() => Promise.reject(new Error('fetch not mocked in tests')))
  };

  ctx.window = ctx;
  vm.createContext(ctx);

  // 執行合併後的原始碼
  try {
    compiledScript.runInContext(ctx);
  } catch (e) {
    // 忽略初始化錯誤（部分 DOM-only 程式碼可能拋錯）
  }

  // 覆蓋有副作用的函式，防止測試污染
  ctx.saveAppData = jest.fn();
  ctx.renderAll = jest.fn();
  ctx.renderRoomDetail = jest.fn();
  ctx.renderBonusPointBar = jest.fn();
  ctx.refreshTrainBonusDisplay = jest.fn();
  ctx.showSection = jest.fn();
  ctx.showNotice = jest.fn();
  ctx.addSystemItemToItinerary = jest.fn(() => null);
  ctx.integrateLodgingOrderToItinerary = jest.fn();
  ctx.integrateTrainOrderToItinerary = jest.fn();

  return ctx;
}

// ============================================================
// 測試輔助工具
// ============================================================

/** 以今天為基準，返回 N 天後的日期字串 YYYY-MM-DD */
function daysFromToday(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 建立一間有完整資料的測試房源 */
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

/** 建立一筆測試訂單 */
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

// ============================================================
// 一、auth.js 測試
// ============================================================
describe('auth.js — 帳號驗證與使用者管理', () => {
  let ctx;
  beforeEach(() => { ctx = createContext(); });

  // --- isValidEmail ---
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

  // --- isValidPhone ---
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
      expect(ctx.isValidPhone('091234567')).toBe(false);  // 9 碼
    });

    test('超過 10 碼應回傳 false', () => {
      expect(ctx.isValidPhone('09123456789')).toBe(false);  // 11 碼
    });

    test('含英文字母應回傳 false', () => {
      expect(ctx.isValidPhone('0912abc678')).toBe(false);
    });

    test('空字串應回傳 false', () => {
      expect(ctx.isValidPhone('')).toBe(false);
    });
  });

  // --- normalizeAccount ---
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

  // --- getAccountType ---
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

  // --- getRoleName ---
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

  // --- getNextUserId ---
  describe('getNextUserId()', () => {
    test('只有一位使用者時回傳 2', () => {
      // 預設 context 有 id=1 的 admin
      expect(ctx.getNextUserId()).toBe(2);
    });

    test('多位使用者時回傳最大 id + 1', () => {
      ctx.__pushUser({ id: 5, account: 'x@x.com', role: 'customer' });
      expect(ctx.getNextUserId()).toBe(6);
    });
  });

  // --- isAdmin / isCustomer ---
  describe('isAdmin() / isCustomer()', () => {
    test('未登入時兩者都是 false', () => {
      expect(ctx.isAdmin()).toBe(false);
      expect(ctx.isCustomer()).toBe(false);
    });

    test('以管理員登入後 isAdmin() 為 true', () => {
      const adminUser = { id: 1, account: 'admin@example.com', role: 'admin' };
      ctx.setLoginState(adminUser);
      expect(ctx.isAdmin()).toBe(true);
      expect(ctx.isCustomer()).toBe(false);
    });

    test('以顧客登入後 isCustomer() 為 true', () => {
      const customerUser = { id: 2, account: 'user@example.com', role: 'customer' };
      ctx.setLoginState(customerUser);
      expect(ctx.isCustomer()).toBe(true);
      expect(ctx.isAdmin()).toBe(false);
    });
  });
});

// ============================================================
// 二、utils.js 測試
// ============================================================
describe('utils.js — 共用工具函式', () => {
  let ctx;
  beforeEach(() => { ctx = createContext(); });

  // --- formatPrice ---
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

    test('小數回傳正確格式', () => {
      expect(ctx.formatPrice(3000)).toBe('3,000');
    });
  });

  // --- formatDate ---
  describe('formatDate()', () => {
    test('空值回傳空字串', () => {
      expect(ctx.formatDate('')).toBe('');
      expect(ctx.formatDate(null)).toBe('');
    });

    test('有效日期字串回傳中文格式', () => {
      const result = ctx.formatDate('2025-01-15');
      // 只檢查包含年份與月份數字（跨系統 locale 可能略有差異）
      expect(result).toContain('2025');
    });
  });

  // --- getMaxRoomTypeCapacity ---
  describe('getMaxRoomTypeCapacity()', () => {
    test('有多個房型時回傳最大容納人數', () => {
      const room = makeRoom();  // roomTypes capacity: 2, 3
      expect(ctx.getMaxRoomTypeCapacity(room)).toBe(3);
    });

    test('沒有房型時回退到 room.capacity', () => {
      const room = makeRoom({ roomTypes: [], capacity: 4 });
      expect(ctx.getMaxRoomTypeCapacity(room)).toBe(4);
    });

    test('roomTypes 未定義時回退到 room.capacity', () => {
      const room = { id: 1, capacity: 5 };
      expect(ctx.getMaxRoomTypeCapacity(room)).toBe(5);
    });
  });

  // --- getLowestRoomTypePrice ---
  describe('getLowestRoomTypePrice()', () => {
    test('有多個房型時回傳最低價格', () => {
      const room = makeRoom();  // prices: 3000, 4000
      expect(ctx.getLowestRoomTypePrice(room)).toBe(3000);
    });

    test('沒有房型時回退到 room.price', () => {
      const room = makeRoom({ roomTypes: [], price: 2500 });
      expect(ctx.getLowestRoomTypePrice(room)).toBe(2500);
    });

    test('roomTypes 未定義時回退到 room.price', () => {
      const room = { id: 1, price: 1800 };
      expect(ctx.getLowestRoomTypePrice(room)).toBe(1800);
    });
  });

  // --- generateDefaultRoomTypes ---
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

  // --- getNextRoomId ---
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

  // --- getRoomImages ---
  describe('getRoomImages()', () => {
    test('應回傳長度為 3 的陣列', () => {
      const images = ctx.getRoomImages(1);
      expect(images).toHaveLength(3);
    });

    test('不同 roomId 回傳不同起始圖片', () => {
      const imgs0 = ctx.getRoomImages(0);
      const imgs1 = ctx.getRoomImages(1);
      // 起始圖不同（因為 index 不同）
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

  // --- isDateRangeOverlap ---
  describe('isDateRangeOverlap()', () => {
    test('完全重疊', () => {
      expect(ctx.isDateRangeOverlap('2025-01-01', '2025-01-10', '2025-01-01', '2025-01-10')).toBe(true);
    });

    test('部分重疊（前段）', () => {
      expect(ctx.isDateRangeOverlap('2025-01-01', '2025-01-05', '2025-01-03', '2025-01-08')).toBe(true);
    });

    test('部分重疊（後段）', () => {
      expect(ctx.isDateRangeOverlap('2025-01-05', '2025-01-10', '2025-01-01', '2025-01-07')).toBe(true);
    });

    test('完全不重疊（A 在 B 之前）', () => {
      expect(ctx.isDateRangeOverlap('2025-01-01', '2025-01-05', '2025-01-06', '2025-01-10')).toBe(false);
    });

    test('完全不重疊（A 在 B 之後）', () => {
      expect(ctx.isDateRangeOverlap('2025-01-10', '2025-01-15', '2025-01-01', '2025-01-09')).toBe(false);
    });

    test('缺少任何日期回傳 false', () => {
      expect(ctx.isDateRangeOverlap('', '2025-01-05', '2025-01-01', '2025-01-10')).toBe(false);
      expect(ctx.isDateRangeOverlap(null, null, null, null)).toBe(false);
    });
  });

  // --- isRoomSelectable ---
  describe('isRoomSelectable()', () => {
    test('正常房源（有庫存）回傳 true', () => {
      const room = makeRoom();
      expect(ctx.isRoomSelectable(room)).toBe(true);
    });

    test('已下架房源回傳 false', () => {
      const room = makeRoom({ status: 'inactive' });
      expect(ctx.isRoomSelectable(room)).toBe(false);
    });

    test('所有房型庫存為 0 回傳 false', () => {
      const room = makeRoom({
        roomTypes: [
          { id: 'a', name: '標準', price: 3000, capacity: 2, stock: 0 }
        ]
      });
      expect(ctx.isRoomSelectable(room)).toBe(false);
    });

    test('null 回傳 false', () => {
      expect(ctx.isRoomSelectable(null)).toBe(false);
    });
  });

  // --- getOrderStatusText ---
  describe('getOrderStatusText()', () => {
    test('有 status 欄位時直接回傳', () => {
      const order = makeOrder({ status: '已付款' });
      expect(ctx.getOrderStatusText(order)).toBe('已付款');
    });

    test('無 status 欄位時組合 bookingStatus 與 paymentStatus', () => {
      const order = makeOrder({ status: undefined, bookingStatus: '已確認', paymentStatus: '未付款' });
      expect(ctx.getOrderStatusText(order)).toBe('已確認 / 未付款');
    });

    test('兩者都缺失時使用預設值', () => {
      const order = { id: 1 };
      expect(ctx.getOrderStatusText(order)).toBe('已確認 / 未付款');
    });
  });

  // --- calculateRoomRating ---
  describe('calculateRoomRating()', () => {
    test('無評價時回傳原始評分', () => {
      const room = makeRoom({ rating: 4.2, reviews: [] });
      expect(ctx.calculateRoomRating(room)).toBe(4.2);
    });

    test('有評價時計算平均並四捨五入到一位小數', () => {
      const room = makeRoom({
        reviews: [
          { rating: 4 },
          { rating: 5 },
          { rating: 3 }
        ]
      });
      // 平均 = 4.0
      expect(ctx.calculateRoomRating(room)).toBe(4);
    });

    test('單一評價直接等於那個分數', () => {
      const room = makeRoom({ reviews: [{ rating: 5 }] });
      expect(ctx.calculateRoomRating(room)).toBe(5);
    });
  });

  // --- getRoomTypeById ---
  describe('getRoomTypeById()', () => {
    test('找得到的 typeId 回傳對應房型', () => {
      const room = makeRoom();
      const result = ctx.getRoomTypeById(room, 'type-std-1');
      expect(result).not.toBeNull();
      expect(result.name).toBe('標準房');
    });

    test('找不到的 typeId 回傳 null', () => {
      const room = makeRoom();
      expect(ctx.getRoomTypeById(room, 'non-exist')).toBeNull();
    });

    test('room 為 null 時回傳 null', () => {
      expect(ctx.getRoomTypeById(null, 'type-std-1')).toBeNull();
    });
  });

  // --- calculateRefund ---
  describe('calculateRefund()', () => {
    test('未付款的訂單取消時退款為 0', () => {
      const order = makeOrder({
        checkIn: daysFromToday(20),
        paymentStatus: '未付款'
      });
      const result = ctx.calculateRefund(order);
      expect(result.cancelable).toBe(true);
      expect(result.amount).toBe(0);
    });

    test('入住前 10 天以上全額退款', () => {
      const order = makeOrder({
        checkIn: daysFromToday(15),
        paymentStatus: '已付款',
        amount: 6000
      });
      const result = ctx.calculateRefund(order);
      expect(result.cancelable).toBe(true);
      expect(result.amount).toBe(6000);
    });

    test('入住前 4-9 天退款 70%', () => {
      const order = makeOrder({
        checkIn: daysFromToday(6),
        paymentStatus: '已付款',
        amount: 6000
      });
      const result = ctx.calculateRefund(order);
      expect(result.cancelable).toBe(true);
      expect(result.amount).toBe(Math.round(6000 * 0.7));
    });

    test('入住前 3 天內不予退款', () => {
      const order = makeOrder({
        checkIn: daysFromToday(2),
        paymentStatus: '已付款',
        amount: 6000
      });
      const result = ctx.calculateRefund(order);
      expect(result.cancelable).toBe(true);
      expect(result.amount).toBe(0);
    });

    test('入住日期已過不可取消', () => {
      const order = makeOrder({
        checkIn: daysFromToday(-2),
        paymentStatus: '已付款'
      });
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

  // --- getBookingNights ---
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

  // --- getRoomDataIssues ---
  describe('getRoomDataIssues()', () => {
    test('完整房源資料回傳空陣列', () => {
      const room = makeRoom();
      expect(ctx.getRoomDataIssues(room)).toHaveLength(0);
    });

    test('缺少地址、描述時回傳對應問題', () => {
      const room = makeRoom({ address: '', desc: '' });
      const issues = ctx.getRoomDataIssues(room);
      expect(issues).toContain('地址');
      expect(issues).toContain('描述');
    });

    test('缺少 facilities、policies、roomTypes 時全部列出', () => {
      const room = makeRoom({ facilities: [], policies: [], roomTypes: [] });
      const issues = ctx.getRoomDataIssues(room);
      expect(issues).toContain('設備');
      expect(issues).toContain('住房政策');
      expect(issues).toContain('房型');
    });
  });

  // --- isRoomAvailableForBooking ---
  describe('isRoomAvailableForBooking()', () => {
    test('正常房源在可訂期間內回傳 true', () => {
      const room = makeRoom();
      // isRoomAvailableForBooking 內部呼叫 findRoom()，需先將房源加入全域 rooms
      ctx.__pushRoom(room);
      const checkIn = daysFromToday(5);
      const checkOut = daysFromToday(7);
      expect(ctx.isRoomAvailableForBooking(room, checkIn, checkOut)).toBe(true);
    });

    test('已下架房源回傳 false', () => {
      const room = makeRoom({ status: 'inactive' });
      expect(ctx.isRoomAvailableForBooking(room, daysFromToday(5), daysFromToday(7))).toBe(false);
    });

    test('null 房源回傳 false', () => {
      expect(ctx.isRoomAvailableForBooking(null, daysFromToday(5), daysFromToday(7))).toBe(false);
    });

    test('訂房日期超出可訂期間回傳 false', () => {
      const room = makeRoom({
        bookingEnd: daysFromToday(3)  // 可訂期只到 3 天後
      });
      // 退房日在 10 天後，超出期間
      expect(ctx.isRoomAvailableForBooking(room, daysFromToday(2), daysFromToday(10))).toBe(false);
    });
  });
});

// ============================================================
// 五、trains.js 測試
// ============================================================
describe('trains.js — 火車票務邏輯', () => {
  let ctx;
  beforeEach(() => { ctx = createContext(); });

  // --- getTrainDistance ---
  describe('getTrainDistance()', () => {
    test('台北到台東的距離', () => {
      // 台北 km=0, 台東 km=610
      expect(ctx.getTrainDistance('台北', '台東')).toBe(610);
    });

    test('台東到台北（反向）距離相同', () => {
      expect(ctx.getTrainDistance('台東', '台北')).toBe(610);
    });

    test('未知站名回傳預設值 120', () => {
      expect(ctx.getTrainDistance('未知站', '另一站')).toBe(120);
    });

    test('相同站名距離不低於 20', () => {
      // 有 Math.max(20, ...) 保護
      expect(ctx.getTrainDistance('台北', '台北')).toBeGreaterThanOrEqual(20);
    });
  });

  // --- calculateTrainDuration ---
  describe('calculateTrainDuration()', () => {
    test('自強號 170km 約 110 分鐘', () => {
      // 速度 92km/h, 170km → ~111min
      const mins = ctx.calculateTrainDuration('自強號', 170, false);
      expect(mins).toBeCloseTo(111, -1);  // 精確到十位
    });

    test('有轉乘加 25 分鐘', () => {
      const withoutTransfer = ctx.calculateTrainDuration('自強號', 100, false);
      const withTransfer = ctx.calculateTrainDuration('自強號', 100, true);
      expect(withTransfer - withoutTransfer).toBe(25);
    });

    test('區間車最慢', () => {
      const localDuration = ctx.calculateTrainDuration('區間車', 100, false);
      const expressDuration = ctx.calculateTrainDuration('自強號', 100, false);
      expect(localDuration).toBeGreaterThan(expressDuration);
    });
  });

  // --- matchTrainPeriod ---
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

    test('"afternoon" 不符合 18:00 以後', () => {
      expect(ctx.matchTrainPeriod('18:00', 'afternoon')).toBe(false);
    });

    test('"night" 符合 18:00 以後與 05:00 以前', () => {
      expect(ctx.matchTrainPeriod('20:00', 'night')).toBe(true);
      expect(ctx.matchTrainPeriod('03:00', 'night')).toBe(true);
    });
  });

  // --- addMinutesToTime ---
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

    test('加 0 分鐘不變', () => {
      expect(ctx.addMinutesToTime('10:00', 0)).toBe('10:00');
    });
  });

  // --- formatTrainDuration ---
  describe('formatTrainDuration()', () => {
    test('90 分鐘 → "1 小時 30 分"', () => {
      expect(ctx.formatTrainDuration(90)).toBe('1 小時 30 分');
    });

    test('60 分鐘 → "1 小時 0 分"', () => {
      expect(ctx.formatTrainDuration(60)).toBe('1 小時 0 分');
    });

    test('45 分鐘 → "0 小時 45 分"', () => {
      expect(ctx.formatTrainDuration(45)).toBe('0 小時 45 分');
    });
  });

  // --- calculateTrainRefund ---
  describe('calculateTrainRefund()', () => {
    const makeTrainOrder = (daysAhead) => ({
      id: 999,
      travelDate: daysFromToday(daysAhead),
      payableAmount: 1000,
      finalPrice: 1000
    });

    test('乘車 25 天前扣 1% 手續費', () => {
      const order = makeTrainOrder(30);
      const result = ctx.calculateTrainRefund(order);
      expect(result.refundable).toBe(true);
      expect(result.fee).toBe(Math.ceil(1000 * 0.01));
      expect(result.amount).toBe(1000 - result.fee);
    });

    test('乘車 3-24 天前扣 3% 手續費', () => {
      const order = makeTrainOrder(10);
      const result = ctx.calculateTrainRefund(order);
      expect(result.refundable).toBe(true);
      expect(result.fee).toBe(Math.ceil(1000 * 0.03));
    });

    test('乘車 1-2 天前扣 5% 手續費', () => {
      const order = makeTrainOrder(1);
      const result = ctx.calculateTrainRefund(order);
      expect(result.refundable).toBe(true);
      expect(result.fee).toBe(Math.ceil(1000 * 0.05));
    });

    test('乘車當日扣 10% 手續費', () => {
      const order = makeTrainOrder(0);
      const result = ctx.calculateTrainRefund(order);
      expect(result.refundable).toBe(true);
      expect(result.fee).toBe(Math.ceil(1000 * 0.1));
    });

    test('乘車日已過不可退票', () => {
      const order = makeTrainOrder(-1);
      const result = ctx.calculateTrainRefund(order);
      expect(result.refundable).toBe(false);
    });
  });

  // --- getTrainEarlyBirdDiscount ---
  describe('getTrainEarlyBirdDiscount()', () => {
    const makeResult = (daysAhead) => ({
      travelDate: daysFromToday(daysAhead),
      reservedTrain: true
    });

    test('14 天以上享 0.7 折', () => {
      const result = ctx.getTrainEarlyBirdDiscount(makeResult(20));
      expect(result.factor).toBe(0.7);
    });

    test('7-13 天享 0.8 折', () => {
      const result = ctx.getTrainEarlyBirdDiscount(makeResult(10));
      expect(result.factor).toBe(0.8);
    });

    test('3-6 天享 0.9 折', () => {
      const result = ctx.getTrainEarlyBirdDiscount(makeResult(4));
      expect(result.factor).toBe(0.9);
    });

    test('3 天內無早鳥折扣（factor = 1）', () => {
      const result = ctx.getTrainEarlyBirdDiscount(makeResult(1));
      expect(result.factor).toBe(1);
    });

    test('非對號列車（reservedTrain=false）無早鳥折扣', () => {
      const result = ctx.getTrainEarlyBirdDiscount({
        travelDate: daysFromToday(30),
        reservedTrain: false
      });
      expect(result.factor).toBe(1);
    });
  });

  // --- getRemainingTrainSeats ---
  describe('getRemainingTrainSeats()', () => {
    test('無訂單時剩餘座位等於 availableSeats', () => {
      const result = {
        travelDate: '2025-08-01',
        trainNo: '308',
        fromStation: '台北',
        toStation: '台東',
        reservedTrain: true,
        availableSeats: 10
      };
      expect(ctx.getRemainingTrainSeats(result)).toBe(10);
    });

    test('有 2 張訂單後剩餘減少', () => {
      const travelDate = '2025-08-01';
      ctx.__setTrainOrders([
        { id: 1, bookingStatus: '已訂票', travelDate, trainNo: '308', fromStation: '台北', toStation: '台東', quantity: 2 }
      ]);
      const result = {
        travelDate, trainNo: '308', fromStation: '台北', toStation: '台東',
        reservedTrain: true, availableSeats: 10
      };
      expect(ctx.getRemainingTrainSeats(result)).toBe(8);
    });

    test('非對號列車（reservedTrain=false）回傳 0', () => {
      const result = { travelDate: '2025-08-01', trainNo: '4152', reservedTrain: false, availableSeats: 0 };
      expect(ctx.getRemainingTrainSeats(result)).toBe(0);
    });
  });

  // --- assignTrainSeats ---
  describe('assignTrainSeats()', () => {
    const makeTrainResult = (seats) => ({
      travelDate: '2025-08-01',
      trainNo: '308',
      fromStation: '台北',
      toStation: '台東',
      reservedTrain: true,
      availableSeats: seats,
      cabin: 'standard'
    });

    test('座位充足時正確分配 N 張', () => {
      const result = ctx.assignTrainSeats(makeTrainResult(20), 'none', 2);
      expect(result.seats).toHaveLength(2);
      expect(result.warning).toBe('');
    });

    test('座位不足時回傳警告', () => {
      const result = ctx.assignTrainSeats(makeTrainResult(1), 'none', 3);
      expect(result.warning).toBeTruthy();
      expect(result.seats).toHaveLength(0);
    });

    test('區間車要求安靜車廂時給出警告', () => {
      const localResult = {
        ...makeTrainResult(20),
        trainType: '區間車'
      };
      const result = ctx.assignTrainSeats(localResult, 'quiet', 1);
      expect(result.warning).toBeTruthy();
    });
  });
});

// ============================================================
// 六、pricing.js 測試
// ============================================================
describe('pricing.js — 定價計算', () => {
  let ctx;
  beforeEach(() => { ctx = createContext(); });

  // --- applyPricingDiscount ---
  describe('applyPricingDiscount()', () => {
    test('discountType 為 "none" 時回傳原價', () => {
      expect(ctx.applyPricingDiscount(3000, 'none', 0)).toBe(3000);
      expect(ctx.applyPricingDiscount(3000, 'none', 100)).toBe(3000);
    });

    test('百分比折扣 20% 時正確計算', () => {
      // 3000 * (1 - 0.20) = 2400
      expect(ctx.applyPricingDiscount(3000, 'percentage', 20)).toBe(2400);
    });

    test('百分比折扣 10% 四捨五入', () => {
      // 3001 * 0.9 = 2700.9 → 2701
      expect(ctx.applyPricingDiscount(3001, 'percentage', 10)).toBe(Math.round(3001 * 0.9));
    });

    test('固定折扣金額 500 元', () => {
      expect(ctx.applyPricingDiscount(3000, 'early_bird', 500)).toBe(2500);
    });

    test('折扣後不低於 0', () => {
      expect(ctx.applyPricingDiscount(100, 'early_bird', 200)).toBe(0);
    });

    test('折扣百分比為 0 時回傳原價', () => {
      expect(ctx.applyPricingDiscount(3000, 'percentage', 0)).toBe(3000);
    });
  });

  // --- getPricingRoomType ---
  describe('getPricingRoomType()', () => {
    test('找到對應房型', () => {
      const room = makeRoom();
      const type = ctx.getPricingRoomType(room, 'type-std-1');
      expect(type).not.toBeNull();
      expect(type.name).toBe('標準房');
    });

    test('找不到的房型回傳 null', () => {
      const room = makeRoom();
      expect(ctx.getPricingRoomType(room, 'no-such-type')).toBeNull();
    });

    test('room 為 null 時回傳 null', () => {
      expect(ctx.getPricingRoomType(null, 'type-std-1')).toBeNull();
    });
  });
});

// ============================================================
// 七、bonus.js 測試
// ============================================================
describe('bonus.js — 紅利點數管理', () => {
  let ctx;

  beforeEach(() => {
    ctx = createContext();
    // 模擬顧客登入狀態（用輔助函式操作 let 變數 users）
    const customer = { id: 2, account: 'customer@test.com', role: 'customer' };
    ctx.__pushUser(customer);
    ctx.setLoginState(customer);
  });

  // --- getUserBonusPoints ---
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

  // --- addBonusPoints ---
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

  // --- deductBonusPoints ---
  describe('deductBonusPoints()', () => {
    beforeEach(() => {
      // 先給用戶 200 點（用輔助函式操作 let 變數 userBonusPoints）
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
      expect(ctx.getUserBonusPoints(2)).toBe(200);  // 維持原值
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
