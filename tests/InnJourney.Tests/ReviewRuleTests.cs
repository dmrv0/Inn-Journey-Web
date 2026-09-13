using InnJourney.Application.Common;
using InnJourney.Application.Features.Reviews;
using InnJourney.Domain.Entities.Identity;
using InnJourney.Domain.Enums;

namespace InnJourney.Tests;

/// <summary>
/// Reviews are earned: a completed stay, owned by the author, once each. These
/// tests pin that down, along with the rating aggregate derived from it.
/// </summary>
public class ReviewRuleTests : IDisposable
{
    private readonly TestDatabase _db = new();

    private static readonly DateOnly Stayed = new(2026, 5, 1);

    private CreateReviewCommandHandler HandlerFor(string userId) => new(
        _db.ReviewWrites,
        _db.Reviews,
        _db.Reservations,
        _db.HotelWrites,
        _db.Hotels,
        new FakeCurrentUser(userId, [Roles.Traveller]));

    [Fact]
    public async Task A_guest_may_review_a_completed_stay()
    {
        var (hotel, _) = await _db.SeedHotelAsync();
        var guest = await _db.SeedUserAsync();

        var stay = await _db.SeedReservationAsync(
            hotel, hotel.Rooms.First(), guest.Id, Stayed, Stayed.AddDays(2), ReservationStatus.CheckedOut);

        var review = await HandlerFor(guest.Id).Handle(
            new CreateReviewCommand { ReservationId = stay.Id, Rating = 5, Comment = "Excellent." },
            CancellationToken.None);

        review.Rating.ShouldBe(5);
        review.Comment.ShouldBe("Excellent.");
    }

    [Fact]
    public async Task A_stay_that_has_not_finished_cannot_be_reviewed()
    {
        var (hotel, _) = await _db.SeedHotelAsync();
        var guest = await _db.SeedUserAsync();

        var stay = await _db.SeedReservationAsync(
            hotel, hotel.Rooms.First(), guest.Id, Stayed, Stayed.AddDays(2), ReservationStatus.Confirmed);

        await Should.ThrowAsync<ConflictException>(() => HandlerFor(guest.Id).Handle(
            new CreateReviewCommand { ReservationId = stay.Id, Rating = 5 }, CancellationToken.None));
    }

    [Fact]
    public async Task Someone_elses_stay_cannot_be_reviewed()
    {
        var (hotel, _) = await _db.SeedHotelAsync();
        var guest = await _db.SeedUserAsync();
        var stranger = await _db.SeedUserAsync("Stranger");

        var stay = await _db.SeedReservationAsync(
            hotel, hotel.Rooms.First(), guest.Id, Stayed, Stayed.AddDays(2), ReservationStatus.CheckedOut);

        await Should.ThrowAsync<ForbiddenException>(() => HandlerFor(stranger.Id).Handle(
            new CreateReviewCommand { ReservationId = stay.Id, Rating = 1 }, CancellationToken.None));
    }

    [Fact]
    public async Task A_stay_cannot_be_reviewed_twice()
    {
        var (hotel, _) = await _db.SeedHotelAsync();
        var guest = await _db.SeedUserAsync();

        var stay = await _db.SeedReservationAsync(
            hotel, hotel.Rooms.First(), guest.Id, Stayed, Stayed.AddDays(2), ReservationStatus.CheckedOut);

        var handler = HandlerFor(guest.Id);

        await handler.Handle(new CreateReviewCommand { ReservationId = stay.Id, Rating = 4 }, CancellationToken.None);

        await Should.ThrowAsync<ConflictException>(() => handler.Handle(
            new CreateReviewCommand { ReservationId = stay.Id, Rating = 2 }, CancellationToken.None));
    }

    [Fact]
    public async Task Publishing_a_review_recomputes_the_hotels_rating()
    {
        var (hotel, _) = await _db.SeedHotelAsync(roomCount: 2);

        _db.Context.Hotels.Single(h => h.Id == hotel.Id).AverageRating.ShouldBe(0);

        await ReviewAsync(hotel.Id, hotel.Rooms.First().Id, rating: 5);
        await ReviewAsync(hotel.Id, hotel.Rooms.Last().Id, rating: 2);

        var updated = _db.Context.Hotels.Single(h => h.Id == hotel.Id);

        updated.AverageRating.ShouldBe(3.5);
        updated.ReviewCount.ShouldBe(2);
    }

    private async Task ReviewAsync(Guid hotelId, Guid roomId, int rating)
    {
        var hotel = _db.Context.Hotels.Single(h => h.Id == hotelId);
        var room = _db.Context.Rooms.Single(r => r.Id == roomId);
        var guest = await _db.SeedUserAsync();

        var stay = await _db.SeedReservationAsync(
            hotel, room, guest.Id, Stayed, Stayed.AddDays(1), ReservationStatus.CheckedOut);

        await HandlerFor(guest.Id).Handle(
            new CreateReviewCommand { ReservationId = stay.Id, Rating = rating }, CancellationToken.None);
    }

    public void Dispose() => _db.Dispose();
}
