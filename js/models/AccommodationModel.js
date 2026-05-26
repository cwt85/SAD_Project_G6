/** Factory Pattern — B 模組資料模型 */

class AccommodationModel {
  static create({ adminId, name, description = '', address, latitude = 0, longitude = 0,
                  distanceFromStation = 0, checkInTime = '15:00', checkOutTime = '11:00',
                  maxGuests = 2, policyNoSmoking = true, policyNoPets = false, policyOthers = '' }) {
    return { adminId, name, description, address, latitude, longitude, distanceFromStation,
             checkInTime, checkOutTime, maxGuests, policyNoSmoking, policyNoPets, policyOthers,
             status: 'active' };
  }
}

class RoomTypeModel {
  static create({ accommodationId, name, description = '', capacity = 2, totalRooms = 1, amenities = [] }) {
    return { accommodationId, name, description, capacity, totalRooms, amenities };
  }
}

class PricingRuleModel {
  static create({ roomTypeId, priceType, pricePerNight, startDate = null, endDate = null }) {
    return { roomTypeId, priceType, pricePerNight: parseFloat(pricePerNight), startDate, endDate };
  }
}

class BookingModel {
  static create({ customerId, roomTypeId, accommodationId, checkInDate, checkOutDate,
                  guestCount, originalPrice, discountAmount = 0, finalPrice }) {
    const nights = Math.round((new Date(checkOutDate) - new Date(checkInDate)) / 86400000);
    return {
      customerId, roomTypeId, accommodationId, checkInDate, checkOutDate,
      totalNights: nights, guestCount,
      originalPrice: parseFloat(originalPrice),
      discountAmount: parseFloat(discountAmount),
      finalPrice: parseFloat(finalPrice),
      status: 'pending', // pending | confirmed | cancelled | completed
      refundAmount: 0, cancellationReason: ''
    };
  }
}

class ReviewModel {
  static create({ bookingId, customerId, accommodationId, rating, content }) {
    return { bookingId, customerId, accommodationId, rating: parseInt(rating), content, isPublic: true };
  }
}

window.AccommodationModel = AccommodationModel;
window.RoomTypeModel = RoomTypeModel;
window.PricingRuleModel = PricingRuleModel;
window.BookingModel = BookingModel;
window.ReviewModel = ReviewModel;
