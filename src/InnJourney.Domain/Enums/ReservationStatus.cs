namespace InnJourney.Domain.Enums;

/// <summary>
/// Lifecycle of a booking. Legal transitions are defined by
/// <see cref="ReservationStatusTransitions"/>; no other path is permitted.
/// </summary>
public enum ReservationStatus
{
    /// <summary>Created, awaiting payment.</summary>
    Pending = 0,

    /// <summary>Payment succeeded; the room is held.</summary>
    Confirmed = 1,

    /// <summary>The guest has arrived.</summary>
    CheckedIn = 2,

    /// <summary>The stay is complete. Only now may the guest review it.</summary>
    CheckedOut = 3,

    /// <summary>Cancelled from <see cref="Pending"/> or <see cref="Confirmed"/>.</summary>
    Cancelled = 4
}

public static class ReservationStatusTransitions
{
    private static readonly Dictionary<ReservationStatus, ReservationStatus[]> Allowed = new()
    {
        [ReservationStatus.Pending] = [ReservationStatus.Confirmed, ReservationStatus.Cancelled],
        [ReservationStatus.Confirmed] = [ReservationStatus.CheckedIn, ReservationStatus.Cancelled],
        [ReservationStatus.CheckedIn] = [ReservationStatus.CheckedOut],
        [ReservationStatus.CheckedOut] = [],
        [ReservationStatus.Cancelled] = []
    };

    public static bool CanTransition(ReservationStatus from, ReservationStatus to) =>
        Allowed.TryGetValue(from, out var targets) && targets.Contains(to);

    public static IReadOnlyCollection<ReservationStatus> NextFrom(ReservationStatus from) =>
        Allowed.TryGetValue(from, out var targets) ? targets : [];
}
