/**
 * BookingService — B 模組商業邏輯
 *
 * 設計模式：
 * - Strategy Pattern：取消退款策略（依入住前天數決定退款比例）
 * - Strategy Pattern：定價策略（平日 / 假日 / 特殊節日）
 */
class BookingService {

  /* ─── 退款策略（Strategy Pattern） ─── */
  static REFUND_STRATEGIES = [
    { name: '全額退款', condition: days => days >= 10, rate: 1.0 },
    { name: '退 70%',  condition: days => days >= 4,  rate: 0.7 },
    { name: '不退款',  condition: () => true,          rate: 0.0 }
  ];

  /* ─── 房源搜尋 ─── */

  searchAccommodations({ keyword = '', maxDistance = 999, minRating = 0 } = {}) {
    const list = accommodationRepo.search({ keyword, maxDistance });
    return list.map(acc => {
      const reviews = reviewRepo.findByAccommodationId(acc.id);
      const avgRating = reviews.length
        ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
        : null;
      return { ...acc, avgRating, reviewCount: reviews.length };
    }).filter(a => !minRating || (a.avgRating && parseFloat(a.avgRating) >= minRating));
  }

  getAccommodationDetail(accommodationId) {
    const acc = accommodationRepo.getById(accommodationId);
    if (!acc) return null;
    const roomTypes = roomTypeRepo.findByAccommodationId(accommodationId);
    const reviews = reviewRepo.findByAccommodationId(accommodationId);
    const pricingRules = roomTypes.flatMap(rt => pricingRuleRepo.findByRoomTypeId(rt.id));
    return { ...acc, roomTypes, reviews, pricingRules };
  }

  /* ─── 定價策略（Strategy Pattern） ─── */

  calculatePrice(roomTypeId, checkInDate, checkOutDate) {
    const nights = Math.round((new Date(checkOutDate) - new Date(checkInDate)) / 86400000);
    const rules = pricingRuleRepo.findByRoomTypeId(roomTypeId);

    let total = 0;
    const cursor = new Date(checkInDate);
    for (let i = 0; i < nights; i++) {
      const dayOfWeek = cursor.getDay(); // 0=Sun,6=Sat
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const rule = rules.find(r => r.priceType === 'special' && r.startDate <= cursor.toISOString().split('T')[0] && r.endDate >= cursor.toISOString().split('T')[0])
                || rules.find(r => r.priceType === (isWeekend ? 'weekend' : 'weekday'))
                || rules.find(r => r.priceType === 'weekday');
      total += rule ? rule.pricePerNight : 0;
      cursor.setDate(cursor.getDate() + 1);
    }
    return { total, nights, perNight: nights ? (total / nights).toFixed(0) : 0 };
  }

  /* ─── 訂房限制檢核 ─── */

  validateBookingDates(checkInDate, checkOutDate) {
    const now = new Date();
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const errors = [];

    if (checkOut <= checkIn) errors.push('退房日期必須晚於入住日期');
    const hoursUntilCheckIn = (checkIn - now) / 3600000;
    if (hoursUntilCheckIn < 24) errors.push('需提前 24 小時預約');
    const nights = (checkOut - checkIn) / 86400000;
    if (nights > 30) errors.push('超出可預訂範圍（最多 30 天）');

    return { valid: errors.length === 0, errors };
  }

  /* ─── 建立訂單 ─── */

  createBooking({ roomTypeId, accommodationId, checkInDate, checkOutDate, guestCount }) {
    const user = Store.getUser();
    if (!user) return { success: false, errors: ['請先登入'] };

    const validation = this.validateBookingDates(checkInDate, checkOutDate);
    if (!validation.valid) return { success: false, errors: validation.errors };

    // 防止重疊
    const overlapping = bookingRepo.findActive(roomTypeId, checkInDate, checkOutDate);
    const roomType = roomTypeRepo.getById(roomTypeId);
    if (overlapping.length >= roomType.totalRooms) {
      // 系統補償：記錄並通知
      EventBus.emit('booking:overlap', { roomTypeId, checkInDate, checkOutDate });
      return { success: false, errors: ['該日期已無可用房間'] };
    }

    const { total } = this.calculatePrice(roomTypeId, checkInDate, checkOutDate);
    const bookingData = BookingModel.create({
      customerId: user.id, roomTypeId, accommodationId, checkInDate, checkOutDate,
      guestCount, originalPrice: total, discountAmount: 0, finalPrice: total
    });
    const booking = bookingRepo.create(bookingData);
    EventBus.emit('booking:created', booking);
    return { success: true, booking };
  }

  confirmPayment(bookingId) {
    const booking = bookingRepo.update(bookingId, { status: 'confirmed' });
    EventBus.emit('booking:confirmed', booking);
    return booking;
  }

  /* ─── 取消訂單（Strategy Pattern） ─── */

  cancelBooking(bookingId, reason = '') {
    const booking = bookingRepo.getById(bookingId);
    if (!booking) return { success: false, errors: ['訂單不存在'] };
    if (['cancelled', 'completed'].includes(booking.status)) {
      return { success: false, errors: ['此訂單無法取消'] };
    }

    const daysUntilCheckIn = Math.floor((new Date(booking.checkInDate) - new Date()) / 86400000);
    const strategy = BookingService.REFUND_STRATEGIES.find(s => s.condition(daysUntilCheckIn));
    const refundAmount = parseFloat((booking.finalPrice * strategy.rate).toFixed(2));

    const updated = bookingRepo.update(bookingId, {
      status: 'cancelled', refundAmount, cancellationReason: reason
    });
    EventBus.emit('booking:cancelled', { booking: updated, strategy, refundAmount });
    return { success: true, booking: updated, refundAmount, strategyName: strategy.name };
  }

  /* ─── 收藏與購物車 ─── */

  toggleFavorite(accommodationId) {
    const user = Store.getUser();
    if (!user) return { success: false, errors: ['請先登入'] };
    const existing = favoriteRepo.findOne(user.id, accommodationId);
    if (existing) {
      favoriteRepo.delete(existing.id);
      return { success: true, isFavorited: false };
    }
    favoriteRepo.create({ userId: user.id, accommodationId });
    return { success: true, isFavorited: true };
  }

  addToCart({ userId, accommodationId, roomTypeId, checkInDate, checkOutDate, guestCount }) {
    const existing = cartRepo.findCartItem(userId, roomTypeId);
    if (existing) return { success: false, errors: ['已在購物車中'] };
    const item = cartRepo.create({ userId, accommodationId, roomTypeId, checkInDate, checkOutDate, guestCount });
    return { success: true, item };
  }

  /* ─── 評價 ─── */

  submitReview(bookingId, { rating, content }) {
    const user = Store.getUser();
    const booking = bookingRepo.getById(bookingId);
    if (!booking || booking.customerId !== user.id) return { success: false, errors: ['無法提交評價'] };
    if (booking.status !== 'confirmed' && booking.status !== 'completed') {
      return { success: false, errors: ['訂單尚未完成，無法評價'] };
    }
    if (reviewRepo.findByBookingId(bookingId)) return { success: false, errors: ['已評價過此訂單'] };
    const review = reviewRepo.create(ReviewModel.create({
      bookingId, customerId: user.id, accommodationId: booking.accommodationId, rating, content
    }));
    EventBus.emit('review:submitted', review);
    return { success: true, review };
  }

  /* ─── 聊天 ─── */

  sendMessage(receiverId, content, accommodationId = null) {
    const user = Store.getUser();
    if (!user) return null;
    const msg = chatMessageRepo.create({ senderId: user.id, receiverId, content, accommodationId, isRead: false });
    EventBus.emit('chat:message', msg);
    return msg;
  }
}

window.bookingService = new BookingService();
