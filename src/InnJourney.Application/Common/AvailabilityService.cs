using Microsoft.EntityFrameworkCore;
using InnJourney.Application.Repositories;
using InnJourney.Domain.Entities;
using InnJourney.Domain.Enums;

namespace InnJourney.Application.Common;

public record OccupiedNight(Guid RoomId, DateOnly Date, string Reference);

public record RoomAvailability(Room Room, bool IsAvailable, IReadOnlyList<DateOnly> OccupiedDates);

/// <summary>
/// Answers availability questions with a single query rather than a loop per
/// room, and treats a room as free for a span when no blocking reservation
/// overlaps it — capacity governs how many guests it holds, not how many
/// bookings it has.
/// </summary>
public interface IAvailabilityService
{
    Task<IReadOnlyList<Room>> GetAvailableRoomsAsync(Guid hotelId, DateOnly from, DateOnly to,
        int guests, CancellationToken cancellationToken = default);

    Task<bool> IsRoomAvailableAsync(Guid roomId, DateOnly from, DateOnly to,
        Guid? ignoreReservationId = null, CancellationToken cancellationToken = default);

    /// <summary>Per-room occupied nights across a window, for the occupancy ribbon.</summary>
    Task<IReadOnlyList<OccupiedNight>> GetOccupancyAsync(Guid hotelId, DateOnly from, DateOnly to,
        CancellationToken cancellationToken = default);

    /// <summary>Ids of hotels with at least one room free for the whole span.</summary>
    Task<IReadOnlyList<Guid>> GetHotelIdsWithAvailabilityAsync(DateOnly from, DateOnly to, int guests,
        CancellationToken cancellationToken = default);
}

public class AvailabilityService(
    IRoomReadRepository rooms,
    IReservationReadRepository reservations) : IAvailabilityService
{
    public async Task<IReadOnlyList<Room>> GetAvailableRoomsAsync(Guid hotelId, DateOnly from, DateOnly to,
        int guests, CancellationToken cancellationToken = default)
    {
        EnsureValidSpan(from, to);

        // Rooms that can physically hold the party and are in service.
        var candidates = rooms.GetWhere(r =>
                r.HotelId == hotelId &&
                r.Status == RoomStatus.Available &&
                r.Capacity >= guests)
            .Include(r => r.RoomType);

        var takenRoomIds = reservations.GetWhere(res =>
                res.HotelId == hotelId &&
                Reservation.BlockingStatuses.Contains(res.Status) &&
                res.CheckIn < to && res.CheckOut > from)
            .Select(res => res.RoomId);

        var free = await candidates
            .Where(r => !takenRoomIds.Contains(r.Id))
            .ToListAsync(cancellationToken);

        // Ordered after materialising: the set is one hotel's rooms, and not
        // every provider can sort by a decimal column.
        return free.OrderBy(r => r.AdultPrice).ThenBy(r => r.Number).ToList();
    }

    public async Task<bool> IsRoomAvailableAsync(Guid roomId, DateOnly from, DateOnly to,
        Guid? ignoreReservationId = null, CancellationToken cancellationToken = default)
    {
        EnsureValidSpan(from, to);

        var clashes = reservations.GetWhere(res =>
            res.RoomId == roomId &&
            Reservation.BlockingStatuses.Contains(res.Status) &&
            res.CheckIn < to && res.CheckOut > from);

        if (ignoreReservationId is { } ignore)
            clashes = clashes.Where(res => res.Id != ignore);

        return !await clashes.AnyAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<OccupiedNight>> GetOccupancyAsync(Guid hotelId, DateOnly from, DateOnly to,
        CancellationToken cancellationToken = default)
    {
        EnsureValidSpan(from, to);

        var booked = await reservations.GetWhere(res =>
                res.HotelId == hotelId &&
                Reservation.BlockingStatuses.Contains(res.Status) &&
                res.CheckIn < to && res.CheckOut > from)
            .Select(res => new { res.RoomId, res.CheckIn, res.CheckOut, res.Reference })
            .ToListAsync(cancellationToken);

        // Expand each stay into its nights, clipped to the requested window.
        // The night of check-out is not occupied, so the room can turn over that day.
        var nights = new List<OccupiedNight>();

        foreach (var stay in booked)
        {
            var start = stay.CheckIn > from ? stay.CheckIn : from;
            var end = stay.CheckOut < to ? stay.CheckOut : to;

            for (var date = start; date < end; date = date.AddDays(1))
                nights.Add(new OccupiedNight(stay.RoomId, date, stay.Reference));
        }

        return nights;
    }

    public async Task<IReadOnlyList<Guid>> GetHotelIdsWithAvailabilityAsync(DateOnly from, DateOnly to, int guests,
        CancellationToken cancellationToken = default)
    {
        EnsureValidSpan(from, to);

        var takenRoomIds = reservations.GetWhere(res =>
                Reservation.BlockingStatuses.Contains(res.Status) &&
                res.CheckIn < to && res.CheckOut > from)
            .Select(res => res.RoomId);

        return await rooms.GetWhere(r =>
                r.Status == RoomStatus.Available &&
                r.Capacity >= guests &&
                !takenRoomIds.Contains(r.Id))
            .Select(r => r.HotelId)
            .Distinct()
            .ToListAsync(cancellationToken);
    }

    /// <summary>
    /// A stay must span at least one night. Comparisons elsewhere are half-open
    /// (<c>CheckIn &lt; to &amp;&amp; CheckOut &gt; from</c>) so a departure and an
    /// arrival on the same date do not collide.
    /// </summary>
    private static void EnsureValidSpan(DateOnly from, DateOnly to)
    {
        if (to <= from)
            throw new ValidationException(nameof(to), "Check-out must be later than check-in.");
    }
}
