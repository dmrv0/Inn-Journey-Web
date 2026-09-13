using InnJourney.Domain.Entities.Common;
using InnJourney.Domain.Entities.Identity;

namespace InnJourney.Domain.Entities;

/// <summary>
/// A review is earned, not free: it requires a checked-out reservation belonging
/// to the author, and there can be exactly one per stay.
/// </summary>
public class Review : BaseEntity
{
    public Guid HotelId { get; set; }
    public Hotel? Hotel { get; set; }

    public string UserId { get; set; } = string.Empty;
    public AppUser? User { get; set; }

    /// <summary>The stay being reviewed. Unique, so a guest cannot review it twice.</summary>
    public Guid ReservationId { get; set; }
    public Reservation? Reservation { get; set; }

    /// <summary>Whole stars, 1-5.</summary>
    public int Rating { get; set; }

    public string? Comment { get; set; }

    /// <summary>The hotel owner may reply once.</summary>
    public string? OwnerResponse { get; set; }

    public DateTime? RespondedAt { get; set; }
}
