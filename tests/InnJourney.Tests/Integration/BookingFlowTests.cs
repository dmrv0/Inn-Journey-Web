using System.Net;
using System.Net.Http.Json;
using InnJourney.Domain.Entities.Identity;
using InnJourney.Infra.CrossCutting.Services;

namespace InnJourney.Tests.Integration;

/// <summary>
/// The whole system, end to end, through HTTP: an owner lists a property, a
/// guest books and pays for it, the stay completes, and the guest reviews it.
/// Also covers the isolation between two owners.
/// </summary>
public class BookingFlowTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly DateOnly CheckIn = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30));
    private static readonly DateOnly CheckOut = CheckIn.AddDays(3);

    [Fact]
    public async Task An_owner_can_publish_a_property_and_a_guest_can_book_pay_and_review_it()
    {
        var (owner, hotelId, roomId) = await CreateHotelWithRoomAsync();

        // The hotel is now visible to anonymous search.
        var anonymous = factory.CreateClient();
        var detail = await anonymous.GetAsync($"/api/v1/hotels/{hotelId}");
        detail.StatusCode.ShouldBe(HttpStatusCode.OK);

        // A guest books it.
        var (guest, guestAuth) = await factory.SignUpAsync(Roles.Traveller);

        var bookResponse = await guest.PostAsJsonAsync("/api/v1/reservations", new
        {
            roomId,
            checkIn = CheckIn.ToString("yyyy-MM-dd"),
            checkOut = CheckOut.ToString("yyyy-MM-dd"),
            adults = 2,
            children = 0
        });

        bookResponse.StatusCode.ShouldBe(HttpStatusCode.Created);

        var reservation = await bookResponse.Content.ReadFromJsonAsync<ReservationResponse>();
        reservation.ShouldNotBeNull();
        reservation.Status.ShouldBe("Pending");
        reservation.Nights.ShouldBe(3);
        reservation.Reference.ShouldStartWith("INN-");

        // 2 adults x 200 x 3 nights.
        reservation.TotalPrice.ShouldBe(1200m);

        // Paying confirms it.
        var payResponse = await guest.PostAsJsonAsync("/api/v1/payments", new
        {
            reservationId = reservation.Id,
            cardHolderName = "Test Guest",
            cardNumber = SimulatedPaymentGateway.TestCards.Approved,
            expiryMonth = "12",
            expiryYear = (DateTime.UtcNow.Year + 2).ToString(),
            cvc = "123"
        });

        payResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        var payment = await payResponse.Content.ReadFromJsonAsync<PaymentResponse>();
        payment!.Status.ShouldBe("Succeeded");
        payment.CardLast4.ShouldBe("4242");

        var confirmed = await guest.GetFromJsonAsync<ReservationResponse>($"/api/v1/reservations/{reservation.Id}");
        confirmed!.Status.ShouldBe("Confirmed");

        // The room is no longer offered for those dates.
        var availability = await anonymous.GetFromJsonAsync<List<AvailableRoomResponse>>(
            $"/api/v1/hotels/{hotelId}/availability?checkIn={CheckIn:yyyy-MM-dd}&checkOut={CheckOut:yyyy-MM-dd}&adults=2");

        availability!.ShouldNotContain(r => r.Room.Id == roomId);

        // The hotel walks the stay through to completion.
        (await owner.PostAsync($"/api/v1/reservations/{reservation.Id}/check-in", null))
            .StatusCode.ShouldBe(HttpStatusCode.OK);

        (await owner.PostAsync($"/api/v1/reservations/{reservation.Id}/check-out", null))
            .StatusCode.ShouldBe(HttpStatusCode.OK);

        // Only now may the guest review it.
        var reviewResponse = await guest.PostAsJsonAsync("/api/v1/reviews", new
        {
            reservationId = reservation.Id,
            rating = 5,
            comment = "A genuinely good stay."
        });

        reviewResponse.StatusCode.ShouldBe(HttpStatusCode.OK);

        // The published rating reflects it.
        var updated = await anonymous.GetFromJsonAsync<HotelDetailResponse>($"/api/v1/hotels/{hotelId}");
        updated!.AverageRating.ShouldBe(5);
        updated.ReviewCount.ShouldBe(1);

        _ = guestAuth;
    }

    [Fact]
    public async Task A_guest_cannot_review_a_stay_that_has_not_completed()
    {
        var (_, _, roomId) = await CreateHotelWithRoomAsync();
        var (guest, _) = await factory.SignUpAsync(Roles.Traveller);

        var booking = await BookAsync(guest, roomId, CheckIn.AddDays(100), CheckIn.AddDays(102));

        var response = await guest.PostAsJsonAsync("/api/v1/reviews", new
        {
            reservationId = booking.Id,
            rating = 5
        });

        response.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task The_same_room_and_dates_cannot_be_booked_twice()
    {
        var (_, _, roomId) = await CreateHotelWithRoomAsync();

        var (first, _) = await factory.SignUpAsync(Roles.Traveller);
        var (second, _) = await factory.SignUpAsync(Roles.Traveller);

        var from = CheckIn.AddDays(200);
        var to = from.AddDays(2);

        await BookAsync(first, roomId, from, to);

        var clash = await second.PostAsJsonAsync("/api/v1/reservations", new
        {
            roomId,
            checkIn = from.ToString("yyyy-MM-dd"),
            checkOut = to.ToString("yyyy-MM-dd"),
            adults = 1,
            children = 0
        });

        clash.StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task A_room_can_be_relet_on_the_day_the_previous_guest_leaves()
    {
        var (_, _, roomId) = await CreateHotelWithRoomAsync();

        var (first, _) = await factory.SignUpAsync(Roles.Traveller);
        var (second, _) = await factory.SignUpAsync(Roles.Traveller);

        var from = CheckIn.AddDays(300);
        var turnover = from.AddDays(2);

        await BookAsync(first, roomId, from, turnover);

        var response = await second.PostAsJsonAsync("/api/v1/reservations", new
        {
            roomId,
            checkIn = turnover.ToString("yyyy-MM-dd"),
            checkOut = turnover.AddDays(2).ToString("yyyy-MM-dd"),
            adults = 1,
            children = 0
        });

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task An_owner_cannot_touch_another_owners_hotel()
    {
        var (_, hotelId, _) = await CreateHotelWithRoomAsync();
        var (intruder, _) = await factory.SignUpAsync(Roles.HotelOwner);

        var update = await intruder.PutAsJsonAsync($"/api/v1/hotels/{hotelId}", new
        {
            name = "Hijacked",
            stars = 1,
            addressLine = "Nowhere",
            city = "Nowhere",
            country = "Nowhere"
        });

        update.StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        var delete = await intruder.DeleteAsync($"/api/v1/hotels/{hotelId}");
        delete.StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        var reservations = await intruder.GetAsync($"/api/v1/hotels/{hotelId}/reservations");
        reservations.StatusCode.ShouldBe(HttpStatusCode.Forbidden);

        var revenue = await intruder.GetAsync(
            $"/api/v1/hotels/{hotelId}/revenue?from={CheckIn:yyyy-MM-dd}&to={CheckOut:yyyy-MM-dd}");
        revenue.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task A_guest_cannot_read_another_guests_reservation()
    {
        var (_, _, roomId) = await CreateHotelWithRoomAsync();

        var (guest, _) = await factory.SignUpAsync(Roles.Traveller);
        var (stranger, _) = await factory.SignUpAsync(Roles.Traveller);

        var booking = await BookAsync(guest, roomId, CheckIn.AddDays(400), CheckIn.AddDays(402));

        var response = await stranger.GetAsync($"/api/v1/reservations/{booking.Id}");

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task A_declined_card_leaves_the_booking_unconfirmed()
    {
        var (_, _, roomId) = await CreateHotelWithRoomAsync();
        var (guest, _) = await factory.SignUpAsync(Roles.Traveller);

        var booking = await BookAsync(guest, roomId, CheckIn.AddDays(500), CheckIn.AddDays(502));

        var payResponse = await guest.PostAsJsonAsync("/api/v1/payments", new
        {
            reservationId = booking.Id,
            cardHolderName = "Test Guest",
            cardNumber = SimulatedPaymentGateway.TestCards.Declined,
            expiryMonth = "12",
            expiryYear = (DateTime.UtcNow.Year + 2).ToString(),
            cvc = "123"
        });

        payResponse.StatusCode.ShouldBe(HttpStatusCode.Conflict);

        var after = await guest.GetFromJsonAsync<ReservationResponse>($"/api/v1/reservations/{booking.Id}");
        after!.Status.ShouldBe("Pending");
    }

    private async Task<ReservationResponse> BookAsync(HttpClient client, Guid roomId, DateOnly from, DateOnly to)
    {
        var response = await client.PostAsJsonAsync("/api/v1/reservations", new
        {
            roomId,
            checkIn = from.ToString("yyyy-MM-dd"),
            checkOut = to.ToString("yyyy-MM-dd"),
            adults = 1,
            children = 0
        });

        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<ReservationResponse>())!;
    }

    /// <summary>An owner with one hotel and one bookable room priced at 200 a night.</summary>
    private async Task<(HttpClient Owner, Guid HotelId, Guid RoomId)> CreateHotelWithRoomAsync()
    {
        var (owner, _) = await factory.SignUpAsync(Roles.HotelOwner);

        var hotelResponse = await owner.PostAsJsonAsync("/api/v1/hotels", new
        {
            name = $"Test Hotel {Guid.NewGuid():N}"[..20],
            description = "Somewhere to sleep.",
            stars = 4,
            addressLine = "1 Harbour Road",
            city = "Testville",
            country = "Testland"
        });

        hotelResponse.EnsureSuccessStatusCode();
        var hotel = (await hotelResponse.Content.ReadFromJsonAsync<HotelDetailResponse>())!;

        var anonymous = factory.CreateClient();
        var roomTypes = await anonymous.GetFromJsonAsync<List<RoomTypeResponse>>("/api/v1/room-types");

        Guid roomTypeId;

        if (roomTypes is { Count: > 0 })
        {
            roomTypeId = roomTypes[0].Id;
        }
        else
        {
            // No catalogue yet: create one as an administrator.
            var admin = await CreateAdminClientAsync();

            var created = await admin.PostAsJsonAsync("/api/v1/room-types", new
            {
                name = $"Type {Guid.NewGuid():N}"[..12],
                defaultCapacity = 4
            });

            created.EnsureSuccessStatusCode();
            roomTypeId = (await created.Content.ReadFromJsonAsync<RoomTypeResponse>())!.Id;
        }

        var roomResponse = await owner.PostAsJsonAsync($"/api/v1/hotels/{hotel.Id}/rooms", new
        {
            roomTypeId,
            number = Random.Shared.Next(100, 999).ToString(),
            capacity = 4,
            adultPrice = 200m,
            childPrice = 100m,
            status = "Available"
        });

        roomResponse.EnsureSuccessStatusCode();
        var room = (await roomResponse.Content.ReadFromJsonAsync<RoomResponse>())!;

        return (owner, hotel.Id, room.Id);
    }

    private async Task<HttpClient> CreateAdminClientAsync()
    {
        var (client, auth) = await factory.SignUpAsync(Roles.Traveller);
        await factory.PromoteToAdminAsync(auth.User.Id);

        // Re-authenticate so the new role is present in the token.
        return await factory.SignInAsync(auth.User.Email);
    }

    private record ReservationResponse(
        Guid Id, string Reference, Guid HotelId, Guid RoomId,
        int Nights, decimal TotalPrice, string Status);

    private record PaymentResponse(Guid Id, decimal Amount, string Status, string? CardLast4);

    private record HotelDetailResponse(Guid Id, string Name, double AverageRating, int ReviewCount);

    private record RoomTypeResponse(Guid Id, string Name);

    private record RoomResponse(Guid Id, Guid HotelId, string Number);

    private record AvailableRoomResponse(RoomResponse Room, decimal TotalPrice, int Nights);
}
