namespace InnJourney.Domain.Enums;

/// <summary>Whether a room can be sold at all, independent of its bookings.</summary>
public enum RoomStatus
{
    Available = 0,
    OutOfService = 1
}

public enum PaymentStatus
{
    Pending = 0,
    Succeeded = 1,
    Failed = 2,
    Refunded = 3
}

public enum PaymentMethod
{
    Card = 0
}

/// <summary>Whether an amenity describes a whole property or a single room.</summary>
public enum AmenityScope
{
    Hotel = 0,
    Room = 1
}
