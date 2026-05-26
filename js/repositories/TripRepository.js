/** Singleton Repositories — A 模組 */

class TripRepository extends BaseRepository {
  constructor() { super('agenttt_trips'); }
  findByHostId(hostId) { return this.find(t => t.hostId === hostId); }
  findByStatus(status) { return this.find(t => t.status === status); }
  findByShareToken(token) { return this.find(t => t.shareToken === token)[0] || null; }
}

class TripDayRepository extends BaseRepository {
  constructor() { super('agenttt_trip_days'); }
  findByTripId(tripId) {
    return this.find(d => d.tripId === tripId).sort((a, b) => a.dayNumber - b.dayNumber);
  }
}

class SpotRepository extends BaseRepository {
  constructor() { super('agenttt_spots'); }
  findRecommended() { return this.find(s => s.isSystemRecommended); }
  search(keyword) {
    const kw = keyword.toLowerCase();
    return this.find(s => s.name.toLowerCase().includes(kw) || s.address.toLowerCase().includes(kw));
  }
}

class TripSpotItemRepository extends BaseRepository {
  constructor() { super('agenttt_trip_spot_items'); }
  findByDayId(dayId) {
    return this.find(i => i.dayId === dayId).sort((a, b) => a.orderIndex - b.orderIndex);
  }
  findByTripDayIds(dayIds) { return this.find(i => dayIds.includes(i.dayId)); }
}

class TripMemberRepository extends BaseRepository {
  constructor() { super('agenttt_trip_members'); }
  findByTripId(tripId) { return this.find(m => m.tripId === tripId && m.status === 'active'); }
  findByUserId(userId) { return this.find(m => m.userId === userId && m.status === 'active'); }
  findMembership(tripId, userId) {
    return this.find(m => m.tripId === tripId && m.userId === userId)[0] || null;
  }
}

class TripCommentRepository extends BaseRepository {
  constructor() { super('agenttt_trip_comments'); }
  findByTripId(tripId) {
    return this.find(c => c.tripId === tripId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }
}

class PollRepository extends BaseRepository {
  constructor() { super('agenttt_polls'); }
  findByTripId(tripId) { return this.find(p => p.tripId === tripId); }
}

class PollOptionRepository extends BaseRepository {
  constructor() { super('agenttt_poll_options'); }
  findByPollId(pollId) { return this.find(o => o.pollId === pollId && !o.isDeleted); }
}

class PollVoteRepository extends BaseRepository {
  constructor() { super('agenttt_poll_votes'); }
  findByOptionId(optionId) { return this.find(v => v.optionId === optionId); }
  findByUserAndOption(userId, optionId) {
    return this.find(v => v.userId === userId && v.optionId === optionId)[0] || null;
  }
  countByOptionId(optionId) { return this.findByOptionId(optionId).length; }
}

class ExpenseRepository extends BaseRepository {
  constructor() { super('agenttt_expenses'); }
  findByTripId(tripId) { return this.find(e => e.tripId === tripId); }
}

class ExpenseSplitRepository extends BaseRepository {
  constructor() { super('agenttt_expense_splits'); }
  findByExpenseId(expenseId) { return this.find(s => s.expenseId === expenseId); }
  findByUserId(userId) { return this.find(s => s.userId === userId); }
}

class EditLogRepository extends BaseRepository {
  constructor() { super('agenttt_edit_logs'); }
  findByTripId(tripId) {
    return this.find(l => l.tripId === tripId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

class TripInvitationRepository extends BaseRepository {
  constructor() { super('agenttt_trip_invitations'); }
  findByTripId(tripId) { return this.find(i => i.tripId === tripId); }
  findByEmail(email) { return this.find(i => i.inviteeEmail === email && i.status === 'pending'); }
}

// 匯出所有 Singleton
window.tripRepo         = new TripRepository();
window.tripDayRepo      = new TripDayRepository();
window.spotRepo         = new SpotRepository();
window.tripSpotItemRepo = new TripSpotItemRepository();
window.tripMemberRepo   = new TripMemberRepository();
window.tripCommentRepo  = new TripCommentRepository();
window.pollRepo         = new PollRepository();
window.pollOptionRepo   = new PollOptionRepository();
window.pollVoteRepo     = new PollVoteRepository();
window.expenseRepo      = new ExpenseRepository();
window.expenseSplitRepo = new ExpenseSplitRepository();
window.editLogRepo      = new EditLogRepository();
window.tripInvitationRepo = new TripInvitationRepository();
