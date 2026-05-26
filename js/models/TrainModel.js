/** Factory Pattern — C 模組資料模型 */

class TrainScheduleModel {
  static create({ trainId, trainNumber, trainType, departureStationId, arrivalStationId,
                  departureTime, arrivalTime, operatingDate, availableSeats = 50 }) {
    return { trainId, trainNumber, trainType, departureStationId, arrivalStationId,
             departureTime, arrivalTime, operatingDate, availableSeats,
             status: 'on_time', delayMinutes: 0 };
  }
}

class TicketOrderModel {
  static create({ passengerId, scheduleId, seatPreference = 'any', ticketTypeId,
                  idNumber, phone, originalPrice, discountedPrice }) {
    return {
      passengerId, scheduleId, seatPreference, ticketTypeId,
      idNumber, phone,
      originalPrice: parseFloat(originalPrice),
      discountedPrice: parseFloat(discountedPrice),
      status: 'pending' // pending | paid | collected | transferred | refunded | cancelled
    };
  }
}

class TicketTransferModel {
  static create({ originalOrderId, fromUserId, toUserId }) {
    return { originalOrderId, fromUserId, toUserId, newOrderId: null, status: 'pending' };
  }
}

window.TrainScheduleModel = TrainScheduleModel;
window.TicketOrderModel = TicketOrderModel;
window.TicketTransferModel = TicketTransferModel;
