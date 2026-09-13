using InnJourney.Domain.Entities.Common;

namespace InnJourney.Domain.Entities;

/// <summary>Shared catalogue entry, administered centrally rather than per hotel.</summary>
public class RoomType : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public int DefaultCapacity { get; set; } = 2;

    public ICollection<Room> Rooms { get; set; } = [];
}
