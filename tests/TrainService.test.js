/**
 * Unit Tests — TrainService (Module C)
 * 測試票價計算、訂票限制、退改票
 */

describe('TrainService — calculateFare()', () => {
  it('全票票價應等於基本票價 × 1.0', () => {
    const schedule = scheduleRepo.getAll()[0];
    const adultType = ticketTypeRepo.find(t => t.discountRate === 1.0)[0];
    if (!schedule || !adultType) return;

    const { original, discounted } = trainService.calculateFare(schedule.id, adultType.id);
    expect(discounted).toBe(original);
  });

  it('學生票票價應等於基本票價 × 0.8', () => {
    const schedule = scheduleRepo.find(s => s.trainType === 'high_speed')[0];
    const stuType = ticketTypeRepo.find(t => t.discountRate === 0.8)[0];
    if (!schedule || !stuType) return;

    const { original, discounted } = trainService.calculateFare(schedule.id, stuType.id);
    expect(discounted).toBe(Math.round(original * 0.8));
  });

  it('高鐵基本票價應為 800', () => {
    const schedule = scheduleRepo.find(s => s.trainType === 'high_speed')[0];
    const adultType = ticketTypeRepo.find(t => t.discountRate === 1.0)[0];
    if (!schedule || !adultType) return;

    const { original } = trainService.calculateFare(schedule.id, adultType.id);
    expect(original).toBe(800);
  });

  it('自強號基本票價應為 400', () => {
    const schedule = scheduleRepo.find(s => s.trainType === 'express')[0];
    const adultType = ticketTypeRepo.find(t => t.discountRate === 1.0)[0];
    if (!schedule || !adultType) return;

    const { original } = trainService.calculateFare(schedule.id, adultType.id);
    expect(original).toBe(400);
  });

  it('不存在的班次或票種應回傳 0', () => {
    const result = trainService.calculateFare('bad-id', 'bad-type');
    expect(result.original).toBe(0);
  });
});

describe('TrainService — validateBooking()', () => {
  it('不存在的班次應回傳 valid:false', () => {
    const result = trainService.validateBooking('non-existent', 'A123456789', '0912345678');
    expect(result.valid).toBeFalsy();
  });

  it('身分證號碼過短應回傳 valid:false', () => {
    const schedule = scheduleRepo.getAll()[0];
    if (!schedule) return;
    const result = trainService.validateBooking(schedule.id, 'ABC', '0912345678');
    expect(result.valid).toBeFalsy();
    expect(result.errors.some(e => e.includes('身分證'))).toBeTruthy();
  });

  it('電話號碼過短應回傳 valid:false', () => {
    const schedule = scheduleRepo.getAll()[0];
    if (!schedule) return;
    const result = trainService.validateBooking(schedule.id, 'A123456789', '123');
    expect(result.valid).toBeFalsy();
    expect(result.errors.some(e => e.includes('電話'))).toBeTruthy();
  });
});

describe('TrainService — createOrder() & payOrder()', () => {
  it('未登入時不應允許訂票', () => {
    Store.setState({ currentUser: null });
    const schedule = scheduleRepo.getAll()[0];
    const ticketType = ticketTypeRepo.getAll()[0];
    const result = trainService.createOrder({
      scheduleId: schedule?.id, ticketTypeId: ticketType?.id,
      idNumber: 'A123456789', phone: '0912345678', seatPreference: 'any'
    });
    expect(result.success).toBeFalsy();
    authService.login({ email: 'user@demo.com', password: '123456' });
  });

  it('成功訂票後應減少可用座位', () => {
    authService.login({ email: 'user@demo.com', password: '123456' });
    // 建立明天出發的班次，確保通過「至少提前 1 小時」驗證
    const dep = stationRepo.getAll()[0];
    const arr = stationRepo.getAll()[3] || stationRepo.getAll()[1];
    const futureTime = new Date();
    futureTime.setDate(futureTime.getDate() + 1);
    futureTime.setHours(10, 0, 0, 0);
    const testSchedule = scheduleRepo.create(TrainScheduleModel.create({
      trainId: 'test-train-tmp', trainNumber: 'TEST001', trainType: 'high_speed',
      departureStationId: dep?.id || 'st1', arrivalStationId: arr?.id || 'st4',
      departureTime: futureTime.toISOString(),
      arrivalTime: new Date(futureTime.getTime() + 7200000).toISOString(),
      operatingDate: futureTime.toISOString().split('T')[0],
      availableSeats: 10, status: 'scheduled'
    }));
    const ticketType = ticketTypeRepo.find(t => t.discountRate === 1.0)[0];
    if (!ticketType) { scheduleRepo.delete(testSchedule.id); return; }

    const seatsBefore = testSchedule.availableSeats;
    const result = trainService.createOrder({
      scheduleId: testSchedule.id, ticketTypeId: ticketType.id,
      idNumber: 'B234567890', phone: '0987654321', seatPreference: 'any'
    });
    expect(result.success).toBeTruthy();
    const updatedSchedule = scheduleRepo.getById(testSchedule.id);
    expect(updatedSchedule.availableSeats).toBe(seatsBefore - 1);

    // 清理
    if (result.order) ticketOrderRepo.delete(result.order.id);
    scheduleRepo.delete(testSchedule.id);
  });

  it('付款後訂單狀態應更新為 paid', () => {
    authService.login({ email: 'user@demo.com', password: '123456' });
    const dep = stationRepo.getAll()[0];
    const arr = stationRepo.getAll()[3] || stationRepo.getAll()[1];
    const ft = new Date(); ft.setDate(ft.getDate() + 1); ft.setHours(12, 0, 0, 0);
    const testSchedule2 = scheduleRepo.create(TrainScheduleModel.create({
      trainId: 'test-train-tmp2', trainNumber: 'TEST002', trainType: 'high_speed',
      departureStationId: dep?.id || 'st1', arrivalStationId: arr?.id || 'st4',
      departureTime: ft.toISOString(),
      arrivalTime: new Date(ft.getTime() + 7200000).toISOString(),
      operatingDate: ft.toISOString().split('T')[0],
      availableSeats: 10, status: 'scheduled'
    }));
    const ticketType = ticketTypeRepo.getAll()[0];
    if (!ticketType) { scheduleRepo.delete(testSchedule2.id); return; }

    const seatsBefore = testSchedule2.availableSeats;
    const orderResult = trainService.createOrder({
      scheduleId: testSchedule2.id, ticketTypeId: ticketType.id,
      idNumber: 'C345678901', phone: '0912000001', seatPreference: 'any'
    });
    if (!orderResult.success) { scheduleRepo.delete(testSchedule2.id); return; }

    const payResult = trainService.payOrder(orderResult.order.id, 'credit_card');
    expect(payResult.success).toBeTruthy();
    expect(payResult.order.status).toBe('paid');

    // 清理
    ticketOrderRepo.delete(orderResult.order.id);
    scheduleRepo.delete(testSchedule2.id);
  });
});

describe('TrainService — refundTicket()', () => {
  it('未付款的訂單不應允許退票', () => {
    authService.login({ email: 'user@demo.com', password: '123456' });
    const user = Store.getUser();
    // 建立一個 pending 訂單
    const schedule = scheduleRepo.find(s => s.availableSeats > 0)[0];
    const ticketType = ticketTypeRepo.getAll()[0];
    if (!schedule || !ticketType) return;

    const order = ticketOrderRepo.create(TicketOrderModel.create({
      passengerId: user.id, scheduleId: schedule.id, ticketTypeId: ticketType.id,
      idNumber: 'D456789012', phone: '0912000002', originalPrice: 800, discountedPrice: 800
    }));
    // status 預設是 pending，不是 paid
    const result = trainService.refundTicket(order.id);
    expect(result.success).toBeFalsy();
    ticketOrderRepo.delete(order.id);
  });
});

describe('TrainService — transferTicket()', () => {
  it('轉移給不存在的 email 應失敗', () => {
    authService.login({ email: 'user@demo.com', password: '123456' });
    const user = Store.getUser();
    const schedule = scheduleRepo.find(s => s.availableSeats > 0)[0];
    const ticketType = ticketTypeRepo.getAll()[0];
    if (!schedule || !ticketType) return;

    const order = ticketOrderRepo.create({
      ...TicketOrderModel.create({ passengerId: user.id, scheduleId: schedule.id,
        ticketTypeId: ticketType.id, idNumber: 'E567890123', phone: '0912000003',
        originalPrice: 800, discountedPrice: 800 }),
      status: 'paid'
    });
    const result = trainService.transferTicket(order.id, 'nobody@noexist.xyz');
    expect(result.success).toBeFalsy();
    ticketOrderRepo.delete(order.id);
  });
});
