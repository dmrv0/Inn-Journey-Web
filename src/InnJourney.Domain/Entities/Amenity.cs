using InnJourney.Domain.Entities.Common;
using InnJourney.Domain.Enums;

namespace InnJourney.Domain.Entities;

/// <summary>
/// A single shared catalogue of facilities. Replaces the old per-hotel and
/// per-room extension rows, which duplicated "Wi-Fi" once per property and
/// made filtering by amenity impossible.
/// </summary>
public class Amenity : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? IconUrl { get; set; }
    public AmenityScope Scope { get; set; }

    public ICollection<HotelAmenity> Hotels { get; set; } = [];
    public ICollection<RoomAmenity> Rooms { get; set; } = [];
}

public class HotelAmenity
{
    public Guid HotelId { get; set; }
    public Hotel? Hotel { get; set; }

    public Guid AmenityId { get; set; }
    public Amenity? Amenity { get; set; }
}

public class RoomAmenity
{
    public Guid RoomId { get; set; }
    public Room? Room { get; set; }

    public Guid AmenityId { get; set; }
    public Amenity? Amenity { get; set; }
}
