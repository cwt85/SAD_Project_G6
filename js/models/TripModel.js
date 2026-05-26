/** Factory Pattern — A 模組資料模型 */

class TripModel {
  static create({ hostId, title, destination, startDate, endDate, budgetLimit = null, sourceTripId = null }) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.max(1, Math.round((end - start) / 86400000) + 1);
    return {
      hostId, title, destination, startDate, endDate, totalDays,
      budgetLimit, totalBudgetUsed: 0, sourceTripId,
      shareToken: Math.random().toString(36).substr(2, 10),
      status: 'planning' // planning | completed | cancelled
    };
  }
}

class TripDayModel {
  static create({ tripId, dayNumber, date }) {
    return { tripId, dayNumber, date, notes: '' };
  }
}

class SpotModel {
  static create({ name, address = '', latitude = 0, longitude = 0,
                  category = 'attraction', distanceFromStation = 0,
                  isSystemRecommended = false, description = '' }) {
    return { name, address, latitude, longitude, category, distanceFromStation, isSystemRecommended, description };
  }
}

class TripSpotItemModel {
  static create({ dayId, spotId = null, customName = '', orderIndex = 0,
                  departureTime = '', durationMinutes = 60,
                  notes = '', isMustGoCandidate = false, addedBy }) {
    return { dayId, spotId, customName, orderIndex, departureTime, durationMinutes, notes, isMustGoCandidate, addedBy };
  }
}

class TripMemberModel {
  static create({ tripId, userId, role = 'collaborator' }) {
    return { tripId, userId, role, status: 'active' };
  }
}

class ExpenseModel {
  static create({ tripId, paidBy, amount, category = 'other', description = '', expenseDate }) {
    return { tripId, paidBy, amount: parseFloat(amount), category, description, expenseDate };
  }
}

class PollModel {
  static create({ tripId, title, createdBy }) {
    return { tripId, title, createdBy, status: 'active' };
  }
}

class PollOptionModel {
  static create({ pollId, label, spotItemId = null }) {
    return { pollId, label, spotItemId, isDeleted: false };
  }
}

class EditLogModel {
  static create({ tripId, userId, actionType, targetTable, targetId, beforeData, afterData }) {
    return { tripId, userId, actionType, targetTable, targetId, beforeData, afterData, isReverted: false };
  }
}

window.TripModel = TripModel;
window.TripDayModel = TripDayModel;
window.SpotModel = SpotModel;
window.TripSpotItemModel = TripSpotItemModel;
window.TripMemberModel = TripMemberModel;
window.ExpenseModel = ExpenseModel;
window.PollModel = PollModel;
window.PollOptionModel = PollOptionModel;
window.EditLogModel = EditLogModel;
