/**
 * Unit Tests — TripService (Module A)
 * 測試行程建立、景點操作、費用分帳、投票
 */

// 測試用假使用者
const _mockUser = () => ({ id: 'test-user-trip', name: '測試用戶', email: 'trip@test.com', role: 'customer' });

describe('TripModel.create()', () => {
  it('totalDays 應依日期自動計算', () => {
    const trip = TripModel.create({ hostId: 'u1', title: '測試', destination: '台北',
      startDate: '2026-07-01', endDate: '2026-07-03' });
    expect(trip.totalDays).toBe(3);
  });

  it('預設 status 應為 planning', () => {
    const trip = TripModel.create({ hostId: 'u1', title: '測試', destination: '台北',
      startDate: '2026-07-01', endDate: '2026-07-01' });
    expect(trip.status).toBe('planning');
  });

  it('shareToken 不應為空', () => {
    const trip = TripModel.create({ hostId: 'u1', title: '測試', destination: '台北',
      startDate: '2026-07-01', endDate: '2026-07-01' });
    expect(trip.shareToken).toBeTruthy();
  });
});

describe('TripService — createTrip()', () => {
  beforeEach_hack = () => {
    // 注入假的 Store user
    Store.setState({ currentUser: _mockUser() });
  };

  it('建立行程後應自動建立對應天數的 trip_day', () => {
    Store.setState({ currentUser: _mockUser() });
    const trip = tripService.createTrip({
      title: '單元測試行程', destination: '測試地', startDate: '2026-08-01', endDate: '2026-08-03'
    });
    const days = tripDayRepo.findByTripId(trip.id);
    expect(days.length).toBe(3);
    // 清理
    tripRepo.delete(trip.id);
    days.forEach(d => tripDayRepo.delete(d.id));
  });

  it('建立行程後 host 應自動加入成員', () => {
    Store.setState({ currentUser: _mockUser() });
    const trip = tripService.createTrip({
      title: '成員測試', destination: '測試地', startDate: '2026-08-10', endDate: '2026-08-10'
    });
    const members = tripMemberRepo.findByTripId(trip.id);
    const hostMember = members.find(m => m.role === 'host');
    expect(hostMember).toBeTruthy();
    // 清理
    tripRepo.delete(trip.id);
    members.forEach(m => tripMemberRepo.delete(m.id));
    tripDayRepo.findByTripId(trip.id).forEach(d => tripDayRepo.delete(d.id));
  });
});

describe('TripService — addSpotToDay() & deleteSpotItem()', () => {
  it('新增景點後 edit_log 應記錄一筆 add_spot', () => {
    Store.setState({ currentUser: _mockUser() });
    const trip = tripService.createTrip({ title: '景點測試', destination: '台東',
      startDate: '2026-08-20', endDate: '2026-08-20' });
    const days = tripDayRepo.findByTripId(trip.id);
    const logsBefore = editLogRepo.findByTripId(trip.id).length;

    tripService.addSpotToDay(days[0].id, { customName: '測試景點A', addedBy: _mockUser().id });
    const logsAfter = editLogRepo.findByTripId(trip.id).length;
    expect(logsAfter).toBeGreaterThan(logsBefore);

    // 清理
    tripSpotItemRepo.findByDayId(days[0].id).forEach(i => tripSpotItemRepo.delete(i.id));
    days.forEach(d => tripDayRepo.delete(d.id));
    tripRepo.delete(trip.id);
  });

  it('toggleMustGo 應切換 isMustGoCandidate 狀態', () => {
    Store.setState({ currentUser: _mockUser() });
    const trip = tripService.createTrip({ title: '必去測試', destination: '台東',
      startDate: '2026-09-01', endDate: '2026-09-01' });
    const days = tripDayRepo.findByTripId(trip.id);
    const item = tripService.addSpotToDay(days[0].id, { customName: '測試', addedBy: _mockUser().id });
    expect(item.isMustGoCandidate).toBeFalsy();
    const toggled = tripService.toggleMustGo(item.id);
    expect(toggled.isMustGoCandidate).toBeTruthy();
    // 清理
    tripSpotItemRepo.delete(item.id);
    days.forEach(d => tripDayRepo.delete(d.id));
    tripRepo.delete(trip.id);
  });
});

describe('TripService — addExpense() 分帳策略', () => {
  it('新增費用後 expense_splits 應均分給所有成員', () => {
    Store.setState({ currentUser: _mockUser() });
    // 建立有 2 個成員的行程
    const trip = tripService.createTrip({ title: '費用測試', destination: '台東',
      startDate: '2026-09-10', endDate: '2026-09-10' });
    // 加入第二個成員
    tripMemberRepo.create(TripMemberModel.create({ tripId: trip.id, userId: 'member2', role: 'collaborator' }));

    const expense = tripService.addExpense(trip.id, {
      amount: 1000, category: 'food', description: '測試費用',
      expenseDate: '2026-09-10', paidBy: _mockUser().id
    });

    const splits = expenseSplitRepo.findByExpenseId(expense.id);
    expect(splits.length).toBe(2);
    expect(splits[0].amountOwed).toBe(500);
    expect(splits[1].amountOwed).toBe(500);

    // 清理
    splits.forEach(s => expenseSplitRepo.delete(s.id));
    expenseRepo.delete(expense.id);
    tripMemberRepo.findByTripId(trip.id).forEach(m => tripMemberRepo.delete(m.id));
    tripDayRepo.findByTripId(trip.id).forEach(d => tripDayRepo.delete(d.id));
    tripRepo.delete(trip.id);
  });

  it('費用超過預算上限應觸發 budget:warning 事件', () => {
    Store.setState({ currentUser: _mockUser() });
    let warned = false;
    const unsub = EventBus.on('budget:warning', () => { warned = true; });

    const trip = tripService.createTrip({ title: '預算測試', destination: '台東',
      startDate: '2026-09-20', endDate: '2026-09-20', budgetLimit: 100 });
    tripService.addExpense(trip.id, { amount: 200, category: 'other', description: '超支',
      expenseDate: '2026-09-20', paidBy: _mockUser().id });

    expect(warned).toBeTruthy();
    unsub();
    // 清理
    expenseRepo.findByTripId(trip.id).forEach(e => expenseRepo.delete(e.id));
    tripMemberRepo.findByTripId(trip.id).forEach(m => tripMemberRepo.delete(m.id));
    tripDayRepo.findByTripId(trip.id).forEach(d => tripDayRepo.delete(d.id));
    tripRepo.delete(trip.id);
  });
});

describe('TripService — vote()', () => {
  it('同一人對同一選項投票兩次應取消投票（toggle）', () => {
    Store.setState({ currentUser: _mockUser() });
    const trip = tripService.createTrip({ title: '投票測試', destination: '台東',
      startDate: '2026-10-01', endDate: '2026-10-01' });
    const poll = tripService.createPoll(trip.id, '測試投票');
    const option = tripService.addPollOption(poll.id, '選項A');

    tripService.vote(option.id);
    expect(pollVoteRepo.countByOptionId(option.id)).toBe(1);

    tripService.vote(option.id); // toggle off
    expect(pollVoteRepo.countByOptionId(option.id)).toBe(0);

    // 清理
    pollOptionRepo.delete(option.id);
    pollRepo.delete(poll.id);
    tripMemberRepo.findByTripId(trip.id).forEach(m => tripMemberRepo.delete(m.id));
    tripDayRepo.findByTripId(trip.id).forEach(d => tripDayRepo.delete(d.id));
    tripRepo.delete(trip.id);
  });
});
