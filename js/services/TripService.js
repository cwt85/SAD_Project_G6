/**
 * TripService — A 模組商業邏輯
 *
 * 設計模式：
 * - Command Pattern：每個修改操作都記錄到 edit_logs，支援撤銷 (undo)
 * - Strategy Pattern：分帳策略（均分 / 依人頭）
 */
class TripService {

  /* ─── 行程 CRUD ─── */

  createTrip(data) {
    const user = Store.getUser();
    const tripData = TripModel.create({ ...data, hostId: user.id });
    const trip = tripRepo.create(tripData);

    // 自動建立每日子行程
    for (let i = 0; i < trip.totalDays; i++) {
      const date = new Date(trip.startDate);
      date.setDate(date.getDate() + i);
      tripDayRepo.create(TripDayModel.create({
        tripId: trip.id,
        dayNumber: i + 1,
        date: date.toISOString().split('T')[0]
      }));
    }

    // 將 host 加入成員
    tripMemberRepo.create(TripMemberModel.create({ tripId: trip.id, userId: user.id, role: 'host' }));

    EventBus.emit('trip:created', trip);
    return trip;
  }

  copyTrip(sourceTripId) {
    const source = tripRepo.getById(sourceTripId);
    if (!source) throw new Error('來源行程不存在');
    const user = Store.getUser();
    const newTrip = tripRepo.create({ ...source, id: undefined, hostId: user.id,
      title: source.title + '（複製）', sourceTripId, status: 'planning',
      shareToken: Math.random().toString(36).substr(2, 10),
      createdAt: new Date().toISOString() });

    const days = tripDayRepo.findByTripId(sourceTripId);
    days.forEach(day => {
      const newDay = tripDayRepo.create({ ...day, id: undefined, tripId: newTrip.id });
      const items = tripSpotItemRepo.findByDayId(day.id);
      items.forEach(item => tripSpotItemRepo.create({ ...item, id: undefined, dayId: newDay.id }));
    });
    tripMemberRepo.create(TripMemberModel.create({ tripId: newTrip.id, userId: user.id, role: 'host' }));
    EventBus.emit('trip:created', newTrip);
    return newTrip;
  }

  updateTripStatus(tripId, status) {
    const trip = tripRepo.update(tripId, { status });
    EventBus.emit('trip:updated', trip);
    return trip;
  }

  deleteTrip(tripId) {
    tripRepo.delete(tripId);
    EventBus.emit('trip:deleted', tripId);
  }

  /* ─── 景點操作（Command Pattern：每次操作記 log） ─── */

  addSpotToDay(dayId, spotData) {
    const user = Store.getUser();
    const items = tripSpotItemRepo.findByDayId(dayId);
    const item = tripSpotItemRepo.create(TripSpotItemModel.create({
      ...spotData, dayId, orderIndex: items.length, addedBy: user.id
    }));
    this._log({ dayId, userId: user.id, actionType: 'add_spot', targetTable: 'trip_spot_items',
                targetId: item.id, beforeData: null, afterData: item });
    EventBus.emit('spot:added', item);
    return item;
  }

  deleteSpotItem(itemId) {
    const user = Store.getUser();
    const item = tripSpotItemRepo.getById(itemId);
    if (!item) return;
    const day = tripDayRepo.getById(item.dayId);
    if (!day) return;
    const trip = tripRepo.getById(day.tripId);
    tripSpotItemRepo.delete(itemId);
    this._log({ tripId: trip.id, userId: user.id, actionType: 'delete_spot',
                targetTable: 'trip_spot_items', targetId: itemId,
                beforeData: item, afterData: null });
    EventBus.emit('spot:deleted', itemId);
  }

  reorderSpotItems(dayId, orderedIds) {
    orderedIds.forEach((id, idx) => tripSpotItemRepo.update(id, { orderIndex: idx }));
    EventBus.emit('spot:reordered', dayId);
  }

  updateSpotNote(itemId, notes) {
    const item = tripSpotItemRepo.update(itemId, { notes });
    EventBus.emit('spot:updated', item);
    return item;
  }

  toggleMustGo(itemId) {
    const item = tripSpotItemRepo.getById(itemId);
    const updated = tripSpotItemRepo.update(itemId, { isMustGoCandidate: !item.isMustGoCandidate });
    EventBus.emit('spot:updated', updated);
    return updated;
  }

  /* ─── 撤銷操作（Command Pattern Undo） ─── */

  undoLastEdit(tripId) {
    const user = Store.getUser();
    const logs = editLogRepo.findByTripId(tripId).filter(l => !l.isReverted && l.userId !== Store.getUser().id || true);
    if (!logs.length) return false;
    const log = logs[0]; // 最新的一筆
    if (log.actionType === 'delete_spot' && log.beforeData) {
      tripSpotItemRepo.create({ ...log.beforeData });
    } else if (log.actionType === 'add_spot') {
      tripSpotItemRepo.delete(log.targetId);
    }
    editLogRepo.update(log.id, { isReverted: true });
    EventBus.emit('trip:undone', tripId);
    return true;
  }

  /* ─── 協作 ─── */

  inviteMember(tripId, inviteeEmail) {
    const user = Store.getUser();
    const existing = tripInvitationRepo.find(i => i.tripId === tripId && i.inviteeEmail === inviteeEmail && i.status === 'pending');
    if (existing.length) return { success: false, error: '已發送過邀請' };
    const inv = tripInvitationRepo.create({ tripId, inviterId: user.id, inviteeEmail, status: 'pending' });

    // 如果被邀請者已有帳號，直接加入
    const invitee = userRepo.findByEmail(inviteeEmail);
    if (invitee) {
      const membership = tripMemberRepo.findMembership(tripId, invitee.id);
      if (!membership) {
        tripMemberRepo.create(TripMemberModel.create({ tripId, userId: invitee.id, role: 'collaborator' }));
        tripInvitationRepo.update(inv.id, { status: 'accepted' });
      }
    }
    EventBus.emit('trip:memberInvited', { tripId, inviteeEmail });
    return { success: true };
  }

  addComment(tripId, content) {
    const user = Store.getUser();
    const comment = tripCommentRepo.create({ tripId, userId: user.id, content });
    EventBus.emit('comment:added', comment);
    return comment;
  }

  /* ─── 投票 ─── */

  createPoll(tripId, title) {
    const user = Store.getUser();
    const poll = pollRepo.create(PollModel.create({ tripId, title, createdBy: user.id }));
    EventBus.emit('poll:created', poll);
    return poll;
  }

  addPollOption(pollId, label) {
    const option = pollOptionRepo.create(PollOptionModel.create({ pollId, label }));
    EventBus.emit('poll:optionAdded', option);
    return option;
  }

  vote(optionId) {
    const user = Store.getUser();
    const existing = pollVoteRepo.findByUserAndOption(user.id, optionId);
    if (existing) { pollVoteRepo.delete(existing.id); return false; } // toggle
    const vote = pollVoteRepo.create({ optionId, userId: user.id });
    EventBus.emit('poll:voted', vote);
    return true;
  }

  deletePollOption(optionId) {
    pollOptionRepo.update(optionId, { isDeleted: true });
    EventBus.emit('poll:optionDeleted', optionId);
  }

  /* ─── 預算與費用（Strategy Pattern：均分策略） ─── */

  addExpense(tripId, { amount, category, description, expenseDate, paidBy }) {
    const expense = expenseRepo.create(ExpenseModel.create({ tripId, paidBy, amount, category, description, expenseDate }));
    const members = tripMemberRepo.findByTripId(tripId);
    this._splitExpenseEqually(expense, members.map(m => m.userId));
    this._updateTripBudget(tripId);
    EventBus.emit('expense:added', expense);
    return expense;
  }

  /** 均分策略（Strategy Pattern） */
  _splitExpenseEqually(expense, userIds) {
    if (!userIds.length) return;
    const perPerson = parseFloat((expense.amount / userIds.length).toFixed(2));
    userIds.forEach(userId => {
      expenseSplitRepo.create({ expenseId: expense.id, userId, amountOwed: perPerson, isSettled: false });
    });
  }

  _updateTripBudget(tripId) {
    const expenses = expenseRepo.findByTripId(tripId);
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);
    const trip = tripRepo.update(tripId, { totalBudgetUsed: total });
    if (trip.budgetLimit && total > trip.budgetLimit) {
      EventBus.emit('budget:warning', { tripId, total, limit: trip.budgetLimit });
    }
  }

  /* ─── 分享連結 ─── */

  getShareLink(tripId) {
    const trip = tripRepo.getById(tripId);
    return `${window.location.origin}${window.location.pathname}#/share/${trip.shareToken}`;
  }

  /* ─── 內部：記錄操作 log ─── */
  _log({ tripId, dayId, userId, actionType, targetTable, targetId, beforeData, afterData }) {
    if (!tripId && dayId) {
      const day = tripDayRepo.getById(dayId);
      tripId = day ? day.tripId : null;
    }
    if (!tripId) return;
    editLogRepo.create(EditLogModel.create({ tripId, userId, actionType, targetTable, targetId, beforeData, afterData }));
  }
}

window.tripService = new TripService();
