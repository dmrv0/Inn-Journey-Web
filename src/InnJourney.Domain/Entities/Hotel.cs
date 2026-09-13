using InnJourney.Domain.Entities.Common;
using InnJourney.Domain.Entities.Identity;

namespace InnJourney.Domain.Entities;

public class Hotel : BaseEntity
{
    public string OwnerId { get; set; } = string.Empty;
    public AppUser? Owner { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? GoogleMapsUrl { get; set; }

    /// <summary>
    /// The property's official star classification (1-5), set by its owner.
    /// Distinct from <see cref="AverageRating"/>, which guests produce.
    /// </summary>
    public int Stars { get; set; }

    /// <summary>Mean of published review ratings. Recomputed on review write; never set by hand.</summary>
    public double AverageRating { get; set; }

    public int ReviewCount { get; set; }

    public Address Address { get; set; } = new();

    public ICollection<Room> Rooms { get; set; } = [];
    public ICollection<HotelImage> Images { get; set; } = [];
    public ICollection<HotelAmenity> Amenities { get; set; } = [];
    public ICollection<Review> Reviews { get; set; } = [];
    public ICollection<Reservation> Reservations { get; set; } = [];
}
