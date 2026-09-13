using Microsoft.Extensions.Logging.Abstractions;
using InnJourney.Application.Abstractions;
using InnJourney.Application.Common;
using InnJourney.Application.Features.Hotels;
using InnJourney.Domain.Entities;
using InnJourney.Domain.Enums;
using InnJourney.Infra.CrossCutting.Services;

namespace InnJourney.Tests;

public class ReservationStatusTests
{
    [Theory]
    [InlineData(ReservationStatus.Pending, ReservationStatus.Confirmed)]
    [InlineData(ReservationStatus.Pending, ReservationStatus.Cancelled)]
    [InlineData(ReservationStatus.Confirmed, ReservationStatus.CheckedIn)]
    [InlineData(ReservationStatus.Confirmed, ReservationStatus.Cancelled)]
    [InlineData(ReservationStatus.CheckedIn, ReservationStatus.CheckedOut)]
    public void Permits_the_legal_transitions(ReservationStatus from, ReservationStatus to) =>
        ReservationStatusTransitions.CanTransition(from, to).ShouldBeTrue();

    [Theory]
    [InlineData(ReservationStatus.Cancelled, ReservationStatus.Confirmed)]
    [InlineData(ReservationStatus.Cancelled, ReservationStatus.CheckedIn)]
    [InlineData(ReservationStatus.CheckedOut, ReservationStatus.CheckedIn)]
    [InlineData(ReservationStatus.CheckedOut, ReservationStatus.Cancelled)]
    [InlineData(ReservationStatus.Pending, ReservationStatus.CheckedIn)]
    [InlineData(ReservationStatus.Pending, ReservationStatus.CheckedOut)]
    public void Refuses_everything_else(ReservationStatus from, ReservationStatus to) =>
        ReservationStatusTransitions.CanTransition(from, to).ShouldBeFalse();

    [Fact]
    public void A_completed_stay_is_terminal() =>
        ReservationStatusTransitions.NextFrom(ReservationStatus.CheckedOut).ShouldBeEmpty();

    [Fact]
    public void A_cancelled_booking_is_terminal() =>
        ReservationStatusTransitions.NextFrom(ReservationStatus.Cancelled).ShouldBeEmpty();
}

public class ReservationSpanTests
{
    private static Reservation Stay(int startDay, int endDay) => new()
    {
        CheckIn = new DateOnly(2026, 6, startDay),
        CheckOut = new DateOnly(2026, 6, endDay)
    };

    [Fact]
    public void Counts_nights_not_days() => Stay(1, 4).Nights.ShouldBe(3);

    [Fact]
    public void Overlap_is_half_open_at_the_start() =>
        Stay(4, 6).Overlaps(new DateOnly(2026, 6, 1), new DateOnly(2026, 6, 4)).ShouldBeFalse();

    [Fact]
    public void Overlap_is_half_open_at_the_end() =>
        Stay(1, 4).Overlaps(new DateOnly(2026, 6, 4), new DateOnly(2026, 6, 6)).ShouldBeFalse();

    [Fact]
    public void A_contained_span_overlaps() =>
        Stay(1, 10).Overlaps(new DateOnly(2026, 6, 3), new DateOnly(2026, 6, 5)).ShouldBeTrue();

    [Fact]
    public void A_straddling_span_overlaps() =>
        Stay(3, 5).Overlaps(new DateOnly(2026, 6, 1), new DateOnly(2026, 6, 10)).ShouldBeTrue();
}

public class PricingTests
{
    private static Room Room(decimal adult, decimal child) => new()
    {
        AdultPrice = adult,
        ChildPrice = child
    };

    [Fact]
    public void Charges_each_adult_for_each_night() =>
        Pricing.TotalFor(Room(100m, 50m), adults: 2, children: 0, nights: 3).ShouldBe(600m);

    [Fact]
    public void Charges_children_at_the_child_rate() =>
        Pricing.TotalFor(Room(100m, 50m), adults: 2, children: 2, nights: 1).ShouldBe(300m);

    [Fact]
    public void A_zero_night_stay_costs_nothing() =>
        Pricing.TotalFor(Room(100m, 50m), adults: 2, children: 0, nights: 0).ShouldBe(0m);

    [Fact]
    public void Rounds_to_two_places() =>
        Pricing.TotalFor(Room(33.333m, 0m), adults: 1, children: 0, nights: 1).ShouldBe(33.33m);
}

public class SimulatedPaymentGatewayTests
{
    private readonly SimulatedPaymentGateway _gateway = new(NullLogger<SimulatedPaymentGateway>.Instance);

    private static CardDetails Card(string number) =>
        new("Test Guest", number, "12", (DateTime.UtcNow.Year + 2).ToString(), "123");

    private static PaymentRequest Charge(string number, decimal amount = 100m) =>
        new(amount, "INN-TEST01", Card(number));

    [Fact]
    public async Task Approves_the_success_test_card()
    {
        var result = await _gateway.ChargeAsync(Charge(SimulatedPaymentGateway.TestCards.Approved));

        result.Succeeded.ShouldBeTrue();
        result.ProviderReference.ShouldNotBeNullOrWhiteSpace();
    }

    [Fact]
    public async Task Declines_the_decline_test_card()
    {
        var result = await _gateway.ChargeAsync(Charge(SimulatedPaymentGateway.TestCards.Declined));

        result.Succeeded.ShouldBeFalse();
        result.FailureReason.ShouldBe("The card was declined.");
    }

    [Fact]
    public async Task Reports_insufficient_funds_distinctly()
    {
        var result = await _gateway.ChargeAsync(Charge(SimulatedPaymentGateway.TestCards.InsufficientFunds));

        result.Succeeded.ShouldBeFalse();
        result.FailureReason.ShouldBe("Insufficient funds.");
    }

    [Fact]
    public async Task Rejects_a_number_failing_the_checksum()
    {
        var result = await _gateway.ChargeAsync(Charge("4242424242424241"));

        result.Succeeded.ShouldBeFalse();
        result.FailureReason.ShouldBe("The card number is not valid.");
    }

    [Fact]
    public async Task Rejects_an_expired_card()
    {
        var expired = new CardDetails("Test Guest", SimulatedPaymentGateway.TestCards.Approved, "01", "2020", "123");

        var result = await _gateway.ChargeAsync(new PaymentRequest(100m, "INN-TEST01", expired));

        result.Succeeded.ShouldBeFalse();
        result.FailureReason.ShouldBe("The card has expired.");
    }

    [Fact]
    public async Task Rejects_a_non_positive_amount()
    {
        var result = await _gateway.ChargeAsync(Charge(SimulatedPaymentGateway.TestCards.Approved, 0m));

        result.Succeeded.ShouldBeFalse();
    }

    [Fact]
    public void Exposes_only_the_last_four_digits() =>
        Card("4242424242424242").Last4.ShouldBe("4242");
}

public class PagingTests
{
    [Fact]
    public void Clamps_an_oversized_page_size()
    {
        var request = new TestPagedRequest { PageSize = 5_000 };

        request.PageSize.ShouldBe(PagedRequest.MaxPageSize);
    }

    [Fact]
    public void Clamps_a_non_positive_page()
    {
        var request = new TestPagedRequest { Page = 0, PageSize = 0 };

        request.Page.ShouldBe(1);
        request.PageSize.ShouldBe(1);
    }

    [Fact]
    public void Computes_the_page_count_by_rounding_up()
    {
        var result = new PagedResult<int> { Items = [1, 2], Page = 1, PageSize = 20, TotalCount = 41 };

        result.TotalPages.ShouldBe(3);
        result.HasNext.ShouldBeTrue();
        result.HasPrevious.ShouldBeFalse();
    }

    private sealed class TestPagedRequest : PagedRequest;
}
