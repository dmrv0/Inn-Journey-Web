namespace InnJourney.Domain.Entities.Common;

/// <summary>
/// Base for every persisted aggregate. Timestamps are stamped by the DbContext
/// on save; <see cref="Deleted"/> drives the global soft-delete query filter.
/// </summary>
public abstract class BaseEntity
{
    public Guid Id { get; set; }
    public DateTime? CreatedDate { get; set; }
    public DateTime? UpdatedDate { get; set; }
    public DateTime? DeletedDate { get; set; }
    public bool Deleted { get; set; }
}
