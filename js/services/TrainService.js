/**
 * TrainService — C 模組商業邏輯
 *
 * 設計模式：
 * - Strategy Pattern：票種折扣策略（全票 / 學生票 / 敬老票 / 兒童票）
 */
class TrainService {

  /* ─── 查詢班次 ─── */

  searchSchedules({ departureStationId, arrivalStationId, date, trainType = null }) {
    let results = scheduleRepo.search({ departureStationId, arrivalStationId, date });
    if (trainType) results = results.filter(s => s.trainType === trainType);
    return results.map(s => ({
      ...s,
      departureStation: stationRepo.getById(s.departureStationId),
      arrivalStation: stationRepo.getById(s.arrivalStationId),
      bookedCount: ticketOrderRepo.findByScheduleId(s.id).length
    }));
  }

  /* ─── 折扣策略（Strategy Pattern） ─── */

  calculateFare(scheduleId, ticketTypeId) {
    const schedule = scheduleRepo.getById(scheduleId);
    const ticketType = ticketTypeRepo.getById(ticketTypeId);
    if (!schedule || !ticketType) return { original: 0, discounted: 0 };

    // 基本票價依車種
    const baseFares = { high_speed: 800, express: 400, local: 200 };
    const base = baseFares[schedule.trainType] || 200;
    const discounted = Math.round(base * ticketType.discountRate);
    return { original: base, discounted, ticketTypeName: ticketType.name, discountRate: ticketType.discountRate };
  }

  /* ─── 訂票限制 ─── */

  validateBooking(scheduleId, idNumber, phone) {
    const errors = [];
    const schedule = scheduleRepo.getById(scheduleId);
    if (!schedule) { errors.push('班次不存在'); return { valid: false, errors }; }

    const depTime = new Date(schedule.departureTime);
    const hoursUntilDep = (depTime - new Date()) / 3600000;
    if (hoursUntilDep < 1) errors.push('開車前 1 小時內無法訂票');
    if (schedule.availableSeats <= 0) errors.push('座位已售完');
    if (!idNumber || idNumber.length < 6) errors.push('請輸入有效身分證號碼');
    if (!phone || phone.length < 8) errors.push('請輸入有效電話');

    return { valid: errors.length === 0, errors };
  }

  /* ─── 建立訂單 ─── */

  createOrder({ scheduleId, ticketTypeId, seatPreference, idNumber, phone }) {
    const user = Store.getUser();
    if (!user) return { success: false, errors: ['請先登入'] };

    const validation = this.validateBooking(scheduleId, idNumber, phone);
    if (!validation.valid) return { success: false, errors: validation.errors };

    const { original, discounted } = this.calculateFare(scheduleId, ticketTypeId);
    const orderData = TicketOrderModel.create({
      passengerId: user.id, scheduleId, seatPreference, ticketTypeId,
      idNumber, phone, originalPrice: original, discountedPrice: discounted
    });
    const order = ticketOrderRepo.create(orderData);

    // 減少可用座位
    const schedule = scheduleRepo.getById(scheduleId);
    scheduleRepo.update(scheduleId, { availableSeats: schedule.availableSeats - 1 });

    EventBus.emit('ticket:ordered', order);
    return { success: true, order };
  }

  /* ─── 付款 ─── */

  payOrder(orderId, paymentMethod) {
    const order = ticketOrderRepo.getById(orderId);
    if (!order || order.status !== 'pending') return { success: false, errors: ['訂單狀態錯誤'] };
    const updated = ticketOrderRepo.update(orderId, { status: 'paid', paymentMethod });
    EventBus.emit('ticket:paid', updated);
    return { success: true, order: updated };
  }

  /* ─── 分票 ─── */

  transferTicket(orderId, toUserEmail) {
    const user = Store.getUser();
    const order = ticketOrderRepo.getById(orderId);
    if (!order || order.passengerId !== user.id) return { success: false, errors: ['無法轉移此票券'] };
    if (order.status !== 'paid') return { success: false, errors: ['只有已付款且未取票的票券可分票'] };

    const toUser = userRepo.findByEmail(toUserEmail);
    if (!toUser) return { success: false, errors: ['找不到此 Email 的使用者'] };

    // 建立新訂單給接收者
    const newOrder = ticketOrderRepo.create({ ...order, id: undefined, passengerId: toUser.id,
      status: 'paid', createdAt: new Date().toISOString() });
    ticketOrderRepo.update(orderId, { status: 'transferred' });
    ticketTransferRepo.create(TicketTransferModel.create({
      originalOrderId: orderId, fromUserId: user.id, toUserId: toUser.id
    }));

    EventBus.emit('ticket:transferred', { orderId, newOrderId: newOrder.id });
    return { success: true, newOrder };
  }

  /* ─── 退改票 ─── */

  refundTicket(orderId) {
    const order = ticketOrderRepo.getById(orderId);
    if (!order || !['paid', 'collected'].includes(order.status)) {
      return { success: false, errors: ['此訂單無法退票'] };
    }
    const schedule = scheduleRepo.getById(order.scheduleId);
    const hoursUntilDep = (new Date(schedule.departureTime) - new Date()) / 3600000;
    if (hoursUntilDep < 1) return { success: false, errors: ['開車前 1 小時內無法退票'] };

    ticketOrderRepo.update(orderId, { status: 'refunded' });
    scheduleRepo.update(order.scheduleId, { availableSeats: schedule.availableSeats + 1 });
    refundChangeRepo.create({ orderId, recordType: 'refund', originalScheduleId: order.scheduleId,
      newScheduleId: null, refundAmount: order.discountedPrice, status: 'completed' });

    EventBus.emit('ticket:refunded', orderId);
    return { success: true, refundAmount: order.discountedPrice };
  }

  changeTicket(orderId, newScheduleId) {
    const order = ticketOrderRepo.getById(orderId);
    if (!order || order.status !== 'paid') return { success: false, errors: ['此訂單無法改票'] };

    // 改票只能一次
    const prevChanges = refundChangeRepo.findByOrderId(orderId).filter(r => r.recordType === 'change');
    if (prevChanges.length >= 1) return { success: false, errors: ['改票限一次'] };

    const oldSchedule = scheduleRepo.getById(order.scheduleId);
    const hoursUntilDep = (new Date(oldSchedule.departureTime) - new Date()) / 3600000;
    if (hoursUntilDep < 1) return { success: false, errors: ['開車前 1 小時內無法改票'] };

    ticketOrderRepo.update(orderId, { scheduleId: newScheduleId });
    scheduleRepo.update(order.scheduleId, { availableSeats: oldSchedule.availableSeats + 1 });
    const newSchedule = scheduleRepo.getById(newScheduleId);
    scheduleRepo.update(newScheduleId, { availableSeats: newSchedule.availableSeats - 1 });
    refundChangeRepo.create({ orderId, recordType: 'change', originalScheduleId: order.scheduleId,
      newScheduleId, refundAmount: 0, status: 'completed' });

    EventBus.emit('ticket:changed', { orderId, newScheduleId });
    return { success: true };
  }

  /* ─── 管理員：發送異常通知 ─── */

  sendNotification(scheduleId, { type, message, compensationType, compensationAmount }) {
    const user = Store.getUser();
    scheduleRepo.update(scheduleId, { status: type === 'cancellation' ? 'cancelled' : 'delayed' });
    const notif = trainNotifRepo.create({
      scheduleId, notificationType: type, message,
      compensationType: compensationType || null,
      compensationAmount: compensationAmount || 0,
      sentBy: user.id
    });
    EventBus.emit('train:notification', notif);
    return notif;
  }
}

window.trainService = new TrainService();
