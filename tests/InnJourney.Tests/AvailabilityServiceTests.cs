using InnJourney.Application.Common;
using InnJourney.Domain.Enums;

namespace InnJourney.Tests;

/// <summary>
/// The rules that decide whether a room can be sold for a span: capacity,
/// same-day turnover, and which reservation statuses actually hold a room.
/// </summary>
public class AvailabilityServiceTests : IDisposable
{
    private readonly TestDatabase _db = new();
    private readonly AvailabilityService _availability;

    private static readonly DateOnly Monday = new(2026, 6, 1);

    public AvailabilityServiceTests() =>
        _availability = new AvailabilityService(_db.Rooms, _db.Reservations);

    [Fact]
    public async Task Returns_all_rooms_when_nothing_is_booked()
    {
        var (hotel, _) = await _db.SeedHotelAsync(roomCount: 3);

        var rooms = await _availability.GetAvailableRoomsAsync(
            hotel.Id, Monday, Monday.AddDays(2), guests: 1);

        rooms.Count.ShouldBe(3);
    }

    [Fact]
    public async Task Excludes_a_room_whose_dates_overlap()
    {
        var (hotel, owner) = await _db.SeedHotelAsync(roomCount: 2);
        var taken = hotel.Rooms.First();

        await _db.SeedReservationAsync(hotel, taken, owner.Id, Monday, Monday.AddDays(3));

        var rooms = await _availability.GetAvailableRoomsAsync(
            hotel.Id, Monday.AddDays(1), Monday.AddDays(2), guests: 1);

        rooms.ShouldNotContain(r => r.Id == taken.Id);
        rooms.Count.ShouldBe(1);
    }

    [Fact]
    public async Task Allows_a_new_stay_starting_the_day_the_previous_one_ends()
    {
        // Half-open comparison: a departure and an arrival on the same date do
        // not collide, so the room can be re-let on its turnover day.
        var (hotel, owner) = await _db.SeedHotelAsync(roomCount: 1);
        var room = hotel.Rooms.Single();

        await _db.SeedReservationAsync(hotel, room, owner.Id, Monday, Monday.AddDays(3));

        var available = await _availability.IsRoomAvailableAsync(
            room.Id, Monday.AddDays(3), Monday.AddDays(5));

        available.ShouldBeTrue();
    }

    [Fact]
    public async Task Allows_a_stay_ending_the_day_the_next_one_begins()
    {
        var (hotel, owner) = await _db.SeedHotelAsync(roomCount: 1);
        var room = hotel.Rooms.Single();

        await _db.SeedReservationAsync(hotel, room, owner.Id, Monday.AddDays(3), Monday.AddDays(5));

        var available = await _availability.IsRoomAvailableAsync(
            room.Id, Monday, Monday.AddDays(3));

        available.ShouldBeTrue();
    }

    [Fact]
    public async Task Respects_room_capacity()
    {
        // A four-person room must still be offered to a party of four. The old
        // implementation treated any single booking as consuming a whole room
        // and ignored capacity entirely.
        var (hotel, _) = await _db.SeedHotelAsync(roomCount: 1, capacity: 2);

        var forTwo = await _availability.GetAvailableRoomsAsync(hotel.Id, Monday, Monday.AddDays(1), guests: 2);
        var forThree = await _availability.GetAvailableRoomsAsync(hotel.Id, Monday, Monday.AddDays(1), guests: 3);

        forTwo.Count.ShouldBe(1);
        forThree.ShouldBeEmpty();
    }

    [Fact]
    public async Task Cancelled_reservations_do_not_hold_a_room()
    {
        var (hotel, owner) = await _db.SeedHotelAsync(roomCount: 1);
        var room = hotel.Rooms.Single();

        await _db.SeedReservationAsync(
            hotel, room, owner.Id, Monday, Monday.AddDays(3), ReservationStatus.Cancelled);

        var available = await _availability.IsRoomAvailableAsync(room.Id, Monday, Monday.AddDays(3));

        available.ShouldBeTrue();
    }

    [Fact]
    public async Task Rooms_out_of_service_are_never_offered()
    {
        var (hotel, _) = await _db.SeedHotelAsync(roomCount: 1);

        var room = _db.Context.Rooms.Single();
        room.Status = RoomStatus.OutOfService;
        await _db.Context.SaveChangesAsync();

        var rooms = await _availability.GetAvailableRoomsAsync(hotel.Id, Monday, Monday.AddDays(1), guests: 1);

        rooms.ShouldBeEmpty();
    }

    [Fact]
    public async Task Occupancy_expands_a_stay_into_nights_excluding_the_departure_day()
    {
        var (hotel, owner) = await _db.SeedHotelAsync(roomCount: 1);
        var room = hotel.Rooms.Single();

        await _db.SeedReservationAsync(hotel, room, owner.Id, Monday, Monday.AddDays(3));

        var nights = await _availability.GetOccupancyAsync(hotel.Id, Monday, Monday.AddDays(7));

        // Three nights: the 1st, 2nd and 3rd. The guest leaves on the 4th.
        nights.Count.ShouldBe(3);
        nights.Select(n => n.Date).ShouldBe([Monday, Monday.AddDays(1), Monday.AddDays(2)], ignoreOrder: true);
    }

    [Fact]
    public async Task Occupancy_clips_stays_to_the_requested_window()
    {
        var (hotel, owner) = await _db.SeedHotelAsync(roomCount: 1);
        var room = hotel.Rooms.Single();

        await _db.SeedReservationAsync(hotel, room, owner.Id, Monday, Monday.AddDays(10));

        var nights = await _availability.GetOccupancyAsync(hotel.Id, Monday.AddDays(2), Monday.AddDays(5));

        nights.Count.ShouldBe(3);
        nights.ShouldAllBe(n => n.Date >= Monday.AddDays(2) && n.Date < Monday.AddDays(5));
    }

    [Fact]
    public async Task A_zero_night_span_is_rejected()
    {
        var (hotel, _) = await _db.SeedHotelAsync();

        await Should.ThrowAsync<ValidationException>(() =>
            _availability.GetAvailableRoomsAsync(hotel.Id, Monday, Monday, guests: 1));
    }

    public void Dispose() => _db.Dispose();
}
