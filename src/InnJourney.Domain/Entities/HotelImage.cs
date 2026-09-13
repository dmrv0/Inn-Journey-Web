using InnJourney.Domain.Entities.Common;

namespace InnJourney.Domain.Entities;

public class HotelImage : BaseEntity
{
    public Guid HotelId { get; set; }
    public Hotel? Hotel { get; set; }

    /// <summary>Path returned by <c>IFileStorage</c>, served from the static files endpoint.</summary>
    public string Url { get; set; } = string.Empty;

    public string? AltText { get; set; }

    public int SortOrder { get; set; }

    /// <summary>At most one cover per hotel; enforced by a filtered unique index.</summary>
    public bool IsCover { get; set; }
}
