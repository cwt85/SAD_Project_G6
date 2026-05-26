/** Singleton Repositories — C 模組 */

class StationRepository extends BaseRepository {
  constructor() { super('agenttt_stations'); }
  findByName(name) { return this.find(s => s.name.includes(name)); }
}

class TrainScheduleRepository extends BaseRepository {
  constructor() { super('agenttt_schedules'); }
  search({ departureStationId, arrivalStationId, date }) {
    return this.find(s =>
      s.departureStationId === departureStationId &&
      s.arrivalStationId === arrivalStationId &&
      s.operatingDate === date &&
      s.status !== 'cancelled'
    );
  }
  findByDate(date) { return this.find(s => s.operatingDate === date); }
}

class TicketTypeRepository extends BaseRepository {
  constructor() { super('agenttt_ticket_types'); }
}

class TicketOrderRepository extends BaseRepository {
  constructor() { super('agenttt_ticket_orders'); }
  findByPassengerId(passengerId) { return this.find(o => o.passengerId === passengerId); }
  findByScheduleId(scheduleId) { return this.find(o => o.scheduleId === scheduleId && o.status !== 'cancelled'); }
}

class TicketTransferRepository extends BaseRepository {
  constructor() { super('agenttt_ticket_transfers'); }
  findByOrderId(orderId) { return this.find(t => t.originalOrderId === orderId)[0] || null; }
}

class RefundChangeRepository extends BaseRepository {
  constructor() { super('agenttt_refund_changes'); }
  findByOrderId(orderId) { return this.find(r => r.orderId === orderId); }
}

class TrainNotificationRepository extends BaseRepository {
  constructor() { super('agenttt_train_notifications'); }
  findByScheduleId(scheduleId) { return this.find(n => n.scheduleId === scheduleId); }
}

window.stationRepo          = new StationRepository();
window.scheduleRepo         = new TrainScheduleRepository();
window.ticketTypeRepo       = new TicketTypeRepository();
window.ticketOrderRepo      = new TicketOrderRepository();
window.ticketTransferRepo   = new TicketTransferRepository();
window.refundChangeRepo     = new RefundChangeRepository();
window.trainNotifRepo       = new TrainNotificationRepository();
