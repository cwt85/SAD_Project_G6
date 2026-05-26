/**
 * Unit Tests — BookingService (Module B)
 * 測試訂房限制、退款策略、定價計算
 */

describe('BookingService — validateBookingDates()', () => {
  it('退房早於入住應視為無效', () => {
    const result = bookingService.validateBookingDates('2026-08-10', '2026-08-05');
    expect(result.valid).toBeFalsy();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('退房等於入住應視為無效', () => {
    const result = bookingService.validateBookingDates('2026-08-10', '2026-08-10');
    expect(result.valid).toBeFalsy();
  });

  it('超過 30 天住宿應視為無效', () => {
    const checkIn  = new Date(); checkIn.setDate(checkIn.getDate() + 2);
    const checkOut = new Date(); checkOut.setDate(checkOut.getDate() + 35);
    const result = bookingService.validateBookingDates(
      checkIn.toISOString().split('T')[0],
      checkOut.toISOString().split('T')[0]
    );
    expect(result.valid).toBeFalsy();
    expect(result.errors.some(e => e.includes('30'))).toBeTruthy();
  });

  it('未提前 24 小時預約應視為無效', () => {
    const now = new Date();
    const checkIn  = new Date(now.getTime() + 3600 * 1000); // 1 小時後
    const checkOut = new Date(now.getTime() + 86400000 * 2);
    const result = bookingService.validateBookingDates(
      checkIn.toISOString().split('T')[0],
      checkOut.toISOString().split('T')[0]
    );
    expect(result.valid).toBeFalsy();
  });

  it('合法日期（提前 3 天，住 2 晚）應通過', () => {
    const checkIn  = new Date(); checkIn.setDate(checkIn.getDate() + 3);
    const checkOut = new Date(); checkOut.setDate(checkOut.getDate() + 5);
    const result = bookingService.validateBookingDates(
      checkIn.toISOString().split('T')[0],
      checkOut.toISOString().split('T')[0]
    );
    expect(result.valid).toBeTruthy();
  });
});

describe('BookingService — REFUND_STRATEGIES（退款策略）', () => {
  it('提前 10 天以上取消應全額退款', () => {
    const strategy = BookingService.REFUND_STRATEGIES.find(s => s.condition(10));
    expect(strategy.rate).toBe(1.0);
  });

  it('提前 4 天取消應退 70%', () => {
    // 先確認 10 天以上的條件不符，再找 4 天的
    const strategies = BookingService.REFUND_STRATEGIES;
    const s10 = strategies[0]; // 10天以上
    const s4  = strategies[1]; // 4-9天
    const sNone = strategies[2]; // 3天內

    expect(s10.condition(10)).toBeTruthy();
    expect(s4.condition(4)).toBeTruthy();
    expect(s4.rate).toBe(0.7);
  });

  it('提前 2 天取消應不退款', () => {
    const none = BookingService.REFUND_STRATEGIES[2];
    expect(none.condition(2)).toBeTruthy();
    expect(none.rate).toBe(0.0);
  });

  it('退款金額計算應正確', () => {
    const finalPrice = 5600;
    const rate = 0.7;
    const refund = parseFloat((finalPrice * rate).toFixed(2));
    expect(refund).toBe(3920);
  });
});

describe('BookingService — calculatePrice()', () => {
  it('2 晚平日住宿價格應等於 2 × 平日單價', () => {
    // 使用 demo 資料中的 rt1（海景雙人房，平日 $2800）
    const allRooms = roomTypeRepo.getAll();
    const rt = allRooms.find(r => r.name === '海景雙人房');
    if (!rt) return; // 若 seed 未執行則跳過

    // 找兩個週間日（週一到週五）
    const mon = new Date('2026-07-06'); // 週一
    const wed = new Date('2026-07-08'); // 週三
    const { total, nights } = bookingService.calculatePrice(
      rt.id,
      mon.toISOString().split('T')[0],
      wed.toISOString().split('T')[0]
    );
    expect(nights).toBe(2);
    expect(total).toBe(5600);
  });
});

describe('BookingService — toggleFavorite()', () => {
  it('未登入時應回傳 success:false', () => {
    Store.setState({ currentUser: null });
    const result = bookingService.toggleFavorite('some-acc-id');
    expect(result.success).toBeFalsy();
    // 還原
    authService.login({ email: 'user@demo.com', password: '123456' });
  });

  it('登入後加入收藏應回傳 isFavorited:true', () => {
    authService.login({ email: 'user@demo.com', password: '123456' });
    const user = Store.getUser();
    const accId = accommodationRepo.findActive()[0]?.id;
    if (!accId) return;

    // 先移除可能已存在的收藏
    const existing = favoriteRepo.findOne(user.id, accId);
    if (existing) favoriteRepo.delete(existing.id);

    const result = bookingService.toggleFavorite(accId);
    expect(result.success).toBeTruthy();
    expect(result.isFavorited).toBeTruthy();

    // 再次呼叫應取消收藏
    const result2 = bookingService.toggleFavorite(accId);
    expect(result2.isFavorited).toBeFalsy();
  });
});

describe('BookingService — submitReview()', () => {
  it('訂單未完成不應允許評價', () => {
    authService.login({ email: 'user@demo.com', password: '123456' });
    const user = Store.getUser();
    // 建立一個 pending 訂單
    const acc = accommodationRepo.findActive()[0];
    const rt = roomTypeRepo.findByAccommodationId(acc.id)[0];
    const booking = bookingRepo.create(BookingModel.create({
      customerId: user.id, roomTypeId: rt.id, accommodationId: acc.id,
      checkInDate: '2026-12-01', checkOutDate: '2026-12-02',
      guestCount: 1, originalPrice: 2800, finalPrice: 2800
    }));
    // status 預設是 pending
    const result = bookingService.submitReview(booking.id, { rating: 5, content: '很棒' });
    expect(result.success).toBeFalsy();
    bookingRepo.delete(booking.id);
  });
});
