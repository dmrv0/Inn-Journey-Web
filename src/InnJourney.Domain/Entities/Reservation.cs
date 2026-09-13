using InnJourney.Domain.Entities.Common;
using InnJourney.Domain.Entities.Identity;
using InnJourney.Domain.Enums;

namespace InnJourney.Domain.Entities;

public class Reservation : BaseEntity
{
    /// <summary>Human-quotable booking reference, e.g. "INN-7F3K2A". Unique.</summary>
    public string Reference { get; set; } = string.Empty;

    public string UserId { get; set; } = string.Empty;
    public AppUser? User { get; set; }

    public Guid RoomId { get; set; }
    public Room? Room { get; set; }

    public Guid HotelId { get; set; }
    public Hotel? Hotel { get; set; }

    /// <summary>Arrival date. Stored as a date; a stay has no time-of-day component.</summary>
    public DateOnly CheckIn { get; set; }

    /// <summary>Departure date, exclusive. Equal to <see cref="CheckIn"/> means zero nights and is rejected.</summary>
    public DateOnly CheckOut { get; set; }

    public int Adults { get; set; }
    public int Children { get; set; }

    public decimal TotalPrice { get; set; }

    public ReservationStatus Status { get; set; } = ReservationStatus.Pending;

    public Payment? Payment { get; set; }
    public Review? Review { get; set; }

    public int Nights => CheckOut.DayNumber - CheckIn.DayNumber;

    public int Guests => Adults + Children;

    /// <summary>
    /// Half-open overlap: a stay ending on the day another begins is not a clash,
    /// so a room can be re-let on its turnover day.
    /// </summary>
    public bool Overlaps(DateOnly from, DateOnly to) => CheckIn < to && CheckOut > from;

    /// <summary>Statuses that still hold the room against other bookings.</summary>
    public static readonly ReservationStatus[] BlockingStatuses =
    [
        ReservationStatus.Pending,
        ReservationStatus.Confirmed,
        ReservationStatus.CheckedIn
    ];
}
