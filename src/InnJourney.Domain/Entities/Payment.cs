using InnJourney.Domain.Entities.Common;
using InnJourney.Domain.Entities.Identity;
using InnJourney.Domain.Enums;

namespace InnJourney.Domain.Entities;

public class Payment : BaseEntity
{
    /// <summary>One payment per reservation, enforced by a unique index.</summary>
    public Guid ReservationId { get; set; }
    public Reservation? Reservation { get; set; }

    public string UserId { get; set; } = string.Empty;
    public AppUser? User { get; set; }

    public Guid HotelId { get; set; }
    public Hotel? Hotel { get; set; }

    public decimal Amount { get; set; }

    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;

    public PaymentMethod Method { get; set; } = PaymentMethod.Card;

    /// <summary>Reference issued by the gateway. No card data is ever persisted.</summary>
    public string? ProviderReference { get; set; }

    /// <summary>Last four digits only, for display on receipts.</summary>
    public string? CardLast4 { get; set; }

    public string? FailureReason { get; set; }

    /// <summary>Always UTC. Npgsql rejects Local-kind values on a timestamptz column.</summary>
    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;
}
