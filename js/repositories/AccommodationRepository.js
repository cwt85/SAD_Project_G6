/** Singleton Repositories — B 模組 */

class AccommodationRepository extends BaseRepository {
  constructor() { super('agenttt_accommodations'); }
  findByAdminId(adminId) { return this.find(a => a.adminId === adminId); }
  findActive() { return this.find(a => a.status === 'active'); }
  search({ keyword = '', maxDistance = 999 }) {
    return this.find(a =>
      a.status === 'active' &&
      a.distanceFromStation <= maxDistance &&
      (!keyword || a.name.toLowerCase().includes(keyword.toLowerCase()) ||
                   a.address.toLowerCase().includes(keyword.toLowerCase()))
    );
  }
}

class RoomTypeRepository extends BaseRepository {
  constructor() { super('agenttt_room_types'); }
  findByAccommodationId(accommodationId) { return this.find(r => r.accommodationId === accommodationId); }
}

class PricingRuleRepository extends BaseRepository {
  constructor() { super('agenttt_pricing_rules'); }
  findByRoomTypeId(roomTypeId) { return this.find(r => r.roomTypeId === roomTypeId); }
}

class PricingHistoryRepository extends BaseRepository {
  constructor() { super('agenttt_pricing_history'); }
  findByRoomTypeId(roomTypeId) { return this.find(h => h.roomTypeId === roomTypeId); }
}

class AccommodationBookingRepository extends BaseRepository {
  constructor() { super('agenttt_bookings'); }
  findByCustomerId(customerId) { return this.find(b => b.customerId === customerId); }
  findByRoomTypeId(roomTypeId) { return this.find(b => b.roomTypeId === roomTypeId); }
  findActive(roomTypeId, checkIn, checkOut) {
    return this.find(b =>
      b.roomTypeId === roomTypeId &&
      b.status !== 'cancelled' &&
      new Date(b.checkInDate) < new Date(checkOut) &&
      new Date(b.checkOutDate) > new Date(checkIn)
    );
  }
}

class ReviewRepository extends BaseRepository {
  constructor() { super('agenttt_reviews'); }
  findByAccommodationId(accommodationId) { return this.find(r => r.accommodationId === accommodationId && r.isPublic); }
  findByCustomerId(customerId) { return this.find(r => r.customerId === customerId); }
  findByBookingId(bookingId) { return this.find(r => r.bookingId === bookingId)[0] || null; }
}

class FavoriteRepository extends BaseRepository {
  constructor() { super('agenttt_favorites'); }
  findByUserId(userId) { return this.find(f => f.userId === userId); }
  findOne(userId, accommodationId) {
    return this.find(f => f.userId === userId && f.accommodationId === accommodationId)[0] || null;
  }
}

class CartRepository extends BaseRepository {
  constructor() { super('agenttt_cart'); }
  findByUserId(userId) { return this.find(c => c.userId === userId); }
  findCartItem(userId, roomTypeId) {
    return this.find(c => c.userId === userId && c.roomTypeId === roomTypeId)[0] || null;
  }
}

class ChatMessageRepository extends BaseRepository {
  constructor() { super('agenttt_chat_messages'); }
  findConversation(userId1, userId2) {
    return this.find(m =>
      (m.senderId === userId1 && m.receiverId === userId2) ||
      (m.senderId === userId2 && m.receiverId === userId1)
    ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }
}

window.accommodationRepo  = new AccommodationRepository();
window.roomTypeRepo       = new RoomTypeRepository();
window.pricingRuleRepo    = new PricingRuleRepository();
window.pricingHistoryRepo = new PricingHistoryRepository();
window.bookingRepo        = new AccommodationBookingRepository();
window.reviewRepo         = new ReviewRepository();
window.favoriteRepo       = new FavoriteRepository();
window.cartRepo           = new CartRepository();
window.chatMessageRepo    = new ChatMessageRepository();
