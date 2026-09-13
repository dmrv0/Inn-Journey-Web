using InnJourney.Domain.Entities.Common;
using InnJourney.Domain.Enums;

namespace InnJourney.Domain.Entities;

public class Room : BaseEntity
{
    public Guid HotelId { get; set; }
    public Hotel? Hotel { get; set; }

    public Guid RoomTypeId { get; set; }
    public RoomType? RoomType { get; set; }

    /// <summary>Door number as displayed to guests, e.g. "204". Unique within a hotel.</summary>
    public string Number { get; set; } = string.Empty;

    /// <summary>Maximum occupants. Availability arithmetic depends on this.</summary>
    public int Capacity { get; set; }

    public decimal AdultPrice { get; set; }
    public decimal ChildPrice { get; set; }

    public RoomStatus Status { get; set; } = RoomStatus.Available;

    public ICollection<RoomAmenity> Amenities { get; set; } = [];
    public ICollection<Reservation> Reservations { get; set; } = [];
}
