/**
 * App 主程式
 * 負責：1) 路由設定  2) 導覽列事件  3) Seed 示範資料
 */

/* ─── 路由設定 ─── */
function setupRoutes() {
  Router
    .register('/',              () => AuthView.renderLogin())
    .register('/register',      () => AuthView.renderRegister())
    .register('/trips',         () => ModuleAView.renderTripList())
    .register('/trip/:id',      ({ id }) => ModuleAView.renderTripDetail(id))
    .register('/accommodations',() => ModuleBView.renderSearch())
    .register('/accommodation/:id', ({ id }) => ModuleBView.renderAccommodationDetail(id))
    .register('/bookings',      () => ModuleBView.renderBookings())
    .register('/admin/b',       () => ModuleBView.renderAdminPanel())
    .register('/admin/pricing/:id', ({ id }) => ModuleBView.renderPricingHistory(id))
    .register('/trains',        () => ModuleCView.renderSearch())
    .register('/my-tickets',    () => ModuleCView.renderMyTickets())
    .register('/manager/c',     () => ModuleCView.renderManagerPanel())
    .register('/share/:token',  ({ token }) => ModuleAView.renderSharedTrip(token));
}

/* ─── 導覽列點擊事件 ─── */
function setupNavbar() {
  document.getElementById('nav-a').addEventListener('click', () => {
    if (!Store.isLoggedIn()) { Router.navigate('/'); return; }
    Router.navigate('/trips');
  });
  document.getElementById('nav-b').addEventListener('click', () => {
    if (!Store.isLoggedIn()) { Router.navigate('/'); return; }
    if (Store.isAdmin()) { Router.navigate('/admin/b'); return; }
    Router.navigate('/accommodations');
  });
  document.getElementById('nav-c').addEventListener('click', () => {
    if (!Store.isLoggedIn()) { Router.navigate('/'); return; }
    const user = Store.getUser();
    if (user.role === 'manager') { Router.navigate('/manager/c'); return; }
    Router.navigate('/trains');
  });
  document.getElementById('nav-logout-btn').addEventListener('click', () => {
    authService.logout();
    UI.updateNavbar();
    UI.toast('已登出');
  });

  // 預算警告 Toast
  EventBus.on('budget:warning', ({ total, limit }) => {
    UI.toast(`⚠️ 預算警告！已花費 $${total.toLocaleString()}，超過上限 $${limit.toLocaleString()}`, 'warning');
  });
}

/* ─── Seed 示範資料（首次載入時建立） ─── */
function seedDemoData() {
  // 已有資料就跳過
  if (localStorage.getItem('agenttt_seeded')) return;

  // 使用者
  const admin = userRepo.create(UserModel.create({ name: '管理員', email: 'admin@demo.com', phone: '0911000001', password: '123456', role: 'admin' }));
  const manager = userRepo.create(UserModel.create({ name: '平台經理', email: 'manager@demo.com', phone: '0911000002', password: '123456', role: 'manager' }));
  const user1 = userRepo.create(UserModel.create({ name: '王小明', email: 'user@demo.com', phone: '0912345678', password: '123456', role: 'customer' }));
  const user2 = userRepo.create(UserModel.create({ name: '李美華', email: 'user2@demo.com', phone: '0987654321', password: '123456', role: 'customer' }));

  // ── A 模組 Seed ──
  const spots = [
    spotRepo.create(SpotModel.create({ name: '台東市區', address: '台東縣台東市', category: 'attraction', distanceFromStation: 0.5, isSystemRecommended: true, description: '台東市區觀光' })),
    spotRepo.create(SpotModel.create({ name: '知本溫泉', address: '台東縣卑南鄉', category: 'activity', distanceFromStation: 12, isSystemRecommended: true, description: '著名溫泉景區' })),
    spotRepo.create(SpotModel.create({ name: '台東森林公園', address: '台東縣台東市', category: 'attraction', distanceFromStation: 3, isSystemRecommended: true, description: '珊瑚礁海岸公園' })),
    spotRepo.create(SpotModel.create({ name: '都蘭糖廠', address: '台東縣東河鄉', category: 'attraction', distanceFromStation: 20, isSystemRecommended: false, description: '文創聚落' })),
    spotRepo.create(SpotModel.create({ name: '池上鄉', address: '台東縣池上鄉', category: 'attraction', distanceFromStation: 45, isSystemRecommended: true, description: '池上便當發源地' })),
    spotRepo.create(SpotModel.create({ name: '鹿野高台', address: '台東縣鹿野鄉', category: 'activity', distanceFromStation: 18, isSystemRecommended: true, description: '熱氣球嘉年華' })),
    spotRepo.create(SpotModel.create({ name: '台東美食街', address: '台東縣台東市正氣路', category: 'restaurant', distanceFromStation: 1, isSystemRecommended: true, description: '夜市美食聚集地' })),
    spotRepo.create(SpotModel.create({ name: '富岡漁港', address: '台東縣卑南鄉', category: 'attraction', distanceFromStation: 8, isSystemRecommended: false, description: '新鮮漁獲直銷' }))
  ];

  const trip1 = tripRepo.create({ ...TripModel.create({ hostId: user1.id, title: '台東三日遊', destination: '台東縣', startDate: '2026-07-01', endDate: '2026-07-03', budgetLimit: 8000 }), id: 'trip-demo-1' });
  tripMemberRepo.create(TripMemberModel.create({ tripId: trip1.id, userId: user1.id, role: 'host' }));
  tripMemberRepo.create(TripMemberModel.create({ tripId: trip1.id, userId: user2.id, role: 'collaborator' }));

  const days = [
    tripDayRepo.create(TripDayModel.create({ tripId: trip1.id, dayNumber: 1, date: '2026-07-01' })),
    tripDayRepo.create(TripDayModel.create({ tripId: trip1.id, dayNumber: 2, date: '2026-07-02' })),
    tripDayRepo.create(TripDayModel.create({ tripId: trip1.id, dayNumber: 3, date: '2026-07-03' }))
  ];
  tripSpotItemRepo.create(TripSpotItemModel.create({ dayId: days[0].id, spotId: spots[0].id, customName: spots[0].name, orderIndex: 0, departureTime: '10:00', durationMinutes: 120, addedBy: user1.id }));
  tripSpotItemRepo.create(TripSpotItemModel.create({ dayId: days[0].id, spotId: spots[6].id, customName: spots[6].name, orderIndex: 1, departureTime: '18:00', durationMinutes: 90, addedBy: user1.id }));
  tripSpotItemRepo.create(TripSpotItemModel.create({ dayId: days[1].id, spotId: spots[1].id, customName: spots[1].name, orderIndex: 0, departureTime: '09:00', durationMinutes: 180, addedBy: user1.id, isMustGoCandidate: true }));
  tripSpotItemRepo.create(TripSpotItemModel.create({ dayId: days[1].id, spotId: spots[5].id, customName: spots[5].name, orderIndex: 1, departureTime: '14:00', durationMinutes: 120, addedBy: user2.id }));
  tripSpotItemRepo.create(TripSpotItemModel.create({ dayId: days[2].id, spotId: spots[4].id, customName: spots[4].name, orderIndex: 0, departureTime: '08:00', durationMinutes: 180, addedBy: user1.id }));

  expenseRepo.create(ExpenseModel.create({ tripId: trip1.id, paidBy: user1.id, amount: 1200, category: 'transport', description: '租車費', expenseDate: '2026-07-01' }));
  expenseRepo.create(ExpenseModel.create({ tripId: trip1.id, paidBy: user2.id, amount: 800, category: 'food', description: '晚餐', expenseDate: '2026-07-01' }));
  expenseSplitRepo.create({ expenseId: 'exp1', userId: user1.id, amountOwed: 600, isSettled: false });
  expenseSplitRepo.create({ expenseId: 'exp1', userId: user2.id, amountOwed: 600, isSettled: false });

  const poll = pollRepo.create(PollModel.create({ tripId: trip1.id, title: '第二天下午去哪裡？', createdBy: user1.id }));
  const opt1 = pollOptionRepo.create(PollOptionModel.create({ pollId: poll.id, label: '知本溫泉' }));
  const opt2 = pollOptionRepo.create(PollOptionModel.create({ pollId: poll.id, label: '鹿野高台' }));
  pollVoteRepo.create({ optionId: opt1.id, userId: user1.id });
  pollVoteRepo.create({ optionId: opt2.id, userId: user2.id });

  tripCommentRepo.create({ tripId: trip1.id, userId: user1.id, content: '大家覺得要帶傘嗎？台東七月天氣不穩定' });
  tripCommentRepo.create({ tripId: trip1.id, userId: user2.id, content: '要的！我查了天氣，有時會下午陣雨' });

  // ── B 模組 Seed ──
  const acc1 = accommodationRepo.create(AccommodationModel.create({
    adminId: admin.id, name: '台東海景民宿', description: '坐擁太平洋海景，距台東火車站僅 2 公里，步行可達夜市',
    address: '台東縣台東市海濱路 12 號', distanceFromStation: 2, checkInTime: '15:00',
    checkOutTime: '11:00', maxGuests: 4, policyNoSmoking: true, policyNoPets: false
  }));
  const acc2 = accommodationRepo.create(AccommodationModel.create({
    adminId: admin.id, name: '知本溫泉度假村', description: '擁有私人溫泉湯屋，環境清幽，距台東市 12 公里',
    address: '台東縣卑南鄉溫泉路 88 號', distanceFromStation: 12, checkInTime: '14:00',
    checkOutTime: '12:00', maxGuests: 6, policyNoSmoking: true, policyNoPets: true
  }));

  const rt1 = roomTypeRepo.create(RoomTypeModel.create({ accommodationId: acc1.id, name: '海景雙人房', description: '面海景觀', capacity: 2, totalRooms: 5, amenities: ['冷氣','WiFi','熱水壺','電視'] }));
  const rt2 = roomTypeRepo.create(RoomTypeModel.create({ accommodationId: acc1.id, name: '家庭四人房', description: '寬敞家庭房', capacity: 4, totalRooms: 3, amenities: ['冷氣','WiFi','迷你廚房'] }));
  const rt3 = roomTypeRepo.create(RoomTypeModel.create({ accommodationId: acc2.id, name: '溫泉套房', description: '私人湯屋', capacity: 2, totalRooms: 8, amenities: ['私人溫泉','冷氣','WiFi','早餐'] }));

  pricingRuleRepo.create(PricingRuleModel.create({ roomTypeId: rt1.id, priceType: 'weekday', pricePerNight: 2800 }));
  pricingRuleRepo.create(PricingRuleModel.create({ roomTypeId: rt1.id, priceType: 'weekend', pricePerNight: 3500 }));
  pricingRuleRepo.create(PricingRuleModel.create({ roomTypeId: rt2.id, priceType: 'weekday', pricePerNight: 4500 }));
  pricingRuleRepo.create(PricingRuleModel.create({ roomTypeId: rt2.id, priceType: 'weekend', pricePerNight: 5500 }));
  pricingRuleRepo.create(PricingRuleModel.create({ roomTypeId: rt3.id, priceType: 'weekday', pricePerNight: 6000 }));
  pricingRuleRepo.create(PricingRuleModel.create({ roomTypeId: rt3.id, priceType: 'weekend', pricePerNight: 7500 }));

  const booking1 = bookingRepo.create(BookingModel.create({ customerId: user1.id, roomTypeId: rt1.id, accommodationId: acc1.id, checkInDate: '2026-07-01', checkOutDate: '2026-07-03', guestCount: 2, originalPrice: 5600, discountAmount: 0, finalPrice: 5600 }));
  bookingRepo.update(booking1.id, { status: 'confirmed' });

  reviewRepo.create(ReviewModel.create({ bookingId: booking1.id, customerId: user1.id, accommodationId: acc1.id, rating: 5, content: '房間乾淨舒適，海景超美，老闆很親切，強烈推薦！' }));

  // ── C 模組 Seed ──
  const s1 = stationRepo.create({ name: '台北', code: 'TPE', city: '台北市', address: '台北市中正區' });
  const s2 = stationRepo.create({ name: '台中', code: 'TXG', city: '台中市', address: '台中市南區' });
  const s3 = stationRepo.create({ name: '台南', code: 'TNN', city: '台南市', address: '台南市東區' });
  const s4 = stationRepo.create({ name: '高雄', code: 'KHH', city: '高雄市', address: '高雄市三民區' });
  const s5 = stationRepo.create({ name: '台東', code: 'TTT', city: '台東縣', address: '台東縣台東市' });
  const s6 = stationRepo.create({ name: '花蓮', code: 'HLN', city: '花蓮縣', address: '花蓮縣花蓮市' });

  const tt_adult  = ticketTypeRepo.create({ name: '全票', discountRate: 1.0, description: '18歲以上成人' });
  const tt_stu    = ticketTypeRepo.create({ name: '學生票', discountRate: 0.8, description: '學生憑證' });
  const tt_senior = ticketTypeRepo.create({ name: '敬老票', discountRate: 0.5, description: '65歲以上' });
  const tt_child  = ticketTypeRepo.create({ name: '兒童票', discountRate: 0.5, description: '6~12歲' });

  const today = new Date().toISOString().split('T')[0];
  const mkTime = (h, m) => `${today}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;

  scheduleRepo.create(TrainScheduleModel.create({ trainId: 't1', trainNumber: '0201', trainType: 'high_speed', departureStationId: s1.id, arrivalStationId: s4.id, departureTime: mkTime(7,30), arrivalTime: mkTime(9,45), operatingDate: today, availableSeats: 38 }));
  scheduleRepo.create(TrainScheduleModel.create({ trainId: 't2', trainNumber: '0301', trainType: 'high_speed', departureStationId: s1.id, arrivalStationId: s4.id, departureTime: mkTime(9,0), arrivalTime: mkTime(11,15), operatingDate: today, availableSeats: 50 }));
  scheduleRepo.create(TrainScheduleModel.create({ trainId: 't3', trainNumber: '1001', trainType: 'express', departureStationId: s1.id, arrivalStationId: s5.id, departureTime: mkTime(8,0), arrivalTime: mkTime(13,30), operatingDate: today, availableSeats: 25 }));
  scheduleRepo.create(TrainScheduleModel.create({ trainId: 't4', trainNumber: '2001', trainType: 'express', departureStationId: s1.id, arrivalStationId: s6.id, departureTime: mkTime(10,30), arrivalTime: mkTime(13,0), operatingDate: today, availableSeats: 42 }));
  scheduleRepo.create(TrainScheduleModel.create({ trainId: 't5', trainNumber: '4001', trainType: 'local', departureStationId: s2.id, arrivalStationId: s3.id, departureTime: mkTime(11,0), arrivalTime: mkTime(12,30), operatingDate: today, availableSeats: 80 }));
  scheduleRepo.create(TrainScheduleModel.create({ trainId: 't6', trainNumber: '0501', trainType: 'high_speed', departureStationId: s4.id, arrivalStationId: s1.id, departureTime: mkTime(14,0), arrivalTime: mkTime(16,15), operatingDate: today, availableSeats: 30 }));

  localStorage.setItem('agenttt_seeded', '1');
  console.log('✅ Demo data seeded');
}

/* ─── App 啟動 ─── */
document.addEventListener('DOMContentLoaded', () => {
  seedDemoData();
  setupRoutes();
  setupNavbar();
  UI.updateNavbar();
  Router.init();
});
