using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using InnJourney.Application.Abstractions;
using InnJourney.Application.Common;
using InnJourney.Application.Repositories;
using InnJourney.Domain.Entities;
using InnJourney.Domain.Enums;

namespace InnJourney.Application.Features.Payments;

/// <summary>
/// Pays for a pending reservation, confirming it on success.
/// <para>
/// Card values are passed to the gateway and discarded; only the last four
/// digits are kept, on the payment record.
/// </para>
/// </summary>
public class PayReservationCommand : IRequest<PaymentDto>
{
    public Guid ReservationId { get; set; }
    public string CardHolderName { get; set; } = string.Empty;
    public string CardNumber { get; set; } = string.Empty;
    public string ExpiryMonth { get; set; } = string.Empty;
    public string ExpiryYear { get; set; } = string.Empty;
    public string Cvc { get; set; } = string.Empty;
}

public class PayReservationCommandValidator : AbstractValidator<PayReservationCommand>
{
    public PayReservationCommandValidator()
    {
        RuleFor(x => x.ReservationId).NotEmpty();
        RuleFor(x => x.CardHolderName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.CardNumber).NotEmpty().Matches(@"^[\d\s]{12,23}$")
            .WithMessage("Enter a valid card number.");
        RuleFor(x => x.ExpiryMonth).NotEmpty().Matches(@"^(0?[1-9]|1[0-2])$")
            .WithMessage("Enter the expiry month as 1-12.");
        RuleFor(x => x.ExpiryYear).NotEmpty().Matches(@"^\d{2}|\d{4}$")
            .WithMessage("Enter the expiry year.");
        RuleFor(x => x.Cvc).NotEmpty().Matches(@"^\d{3,4}$")
            .WithMessage("Enter the 3 or 4 digit security code.");
    }
}

public class PayReservationCommandHandler(
    IReservationReadRepository reservationReads,
    IReservationWriteRepository reservationWrites,
    IPaymentReadRepository paymentReads,
    IPaymentWriteRepository payments,
    IPaymentGateway gateway,
    ICurrentUser currentUser,
    IUnitOfWork unitOfWork,
    IEmailSender emailSender,
    IClock clock)
    : IRequestHandler<PayReservationCommand, PaymentDto>
{
    public async Task<PaymentDto> Handle(PayReservationCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUser.RequireUserId();

        var reservation = await reservationReads.GetAll(tracking: true)
            .Include(r => r.Hotel)
            .Include(r => r.Room)
            .Include(r => r.Payment)
            .FirstOrDefaultAsync(r => r.Id == request.ReservationId, cancellationToken)
            ?? throw NotFoundException.For<Reservation>(request.ReservationId);

        // Only the guest who made the booking may pay for it.
        if (!string.Equals(reservation.UserId, userId, StringComparison.Ordinal))
            throw new ForbiddenException("This reservation belongs to someone else.");

        if (reservation.Status != ReservationStatus.Pending)
            throw new ConflictException($"A {reservation.Status} reservation cannot be paid for.");

        if (reservation.Payment is { Status: PaymentStatus.Succeeded })
            throw new ConflictException("This reservation has already been paid.");

        var card = new CardDetails(
            request.CardHolderName,
            request.CardNumber.Replace(" ", string.Empty),
            request.ExpiryMonth,
            request.ExpiryYear,
            request.Cvc);

        var result = await gateway.ChargeAsync(
            new PaymentRequest(reservation.TotalPrice, reservation.Reference, card), cancellationToken);

        var payment = await paymentReads.GetSingleAsync(
            p => p.ReservationId == reservation.Id, tracking: true, cancellationToken);

        var isNew = payment is null;

        payment ??= new Payment
        {
            Id = Guid.NewGuid(),
            ReservationId = reservation.Id,
            UserId = userId,
            HotelId = reservation.HotelId
        };

        payment.Amount = reservation.TotalPrice;
        payment.Method = PaymentMethod.Card;
        payment.CardLast4 = card.Last4;
        payment.ProcessedAt = clock.UtcNow;
        payment.Status = result.Succeeded ? PaymentStatus.Succeeded : PaymentStatus.Failed;
        payment.ProviderReference = result.ProviderReference;
        payment.FailureReason = result.FailureReason;

        await unitOfWork.ExecuteInTransactionAsync(async ct =>
        {
            if (isNew)
                await payments.AddAsync(payment, ct);
            else
                payments.Update(payment);

            // The booking is confirmed by the payment, in the same transaction,
            // so a captured charge can never be left attached to a pending stay.
            if (result.Succeeded)
            {
                reservation.Status = ReservationStatus.Confirmed;
                reservationWrites.Update(reservation);
            }

            await payments.SaveAsync(ct);
            return true;
        }, cancellationToken);

        if (!result.Succeeded)
            throw new ConflictException(result.FailureReason ?? "The payment was declined.");

        if (currentUser.Email is { } email)
        {
            await emailSender.SendAsync(new EmailMessage(
                email,
                $"Booking {reservation.Reference} confirmed",
                $"""
                 <p>Your stay at {reservation.Hotel?.Name} is confirmed.</p>
                 <p><strong>{reservation.Reference}</strong> &middot; room {reservation.Room?.Number}<br>
                 {reservation.CheckIn:d MMM yyyy} to {reservation.CheckOut:d MMM yyyy}</p>
                 <p>Paid {payment.Amount:N2} with the card ending {payment.CardLast4}.</p>
                 """), cancellationToken);
        }

        return payment.ToDto();
    }
}

public class GetMyPaymentsQuery : PagedRequest, IRequest<PagedResult<PaymentDto>>;

public class GetMyPaymentsQueryHandler(IPaymentReadRepository payments, ICurrentUser currentUser)
    : IRequestHandler<GetMyPaymentsQuery, PagedResult<PaymentDto>>
{
    public async Task<PagedResult<PaymentDto>> Handle(
        GetMyPaymentsQuery request, CancellationToken cancellationToken)
    {
        var userId = currentUser.RequireUserId();

        var query = payments.GetWhere(p => p.UserId == userId)
            .OrderByDescending(p => p.ProcessedAt);

        var page = await query.ToPagedResultAsync(request.Page, request.PageSize, cancellationToken);

        return page.Map(p => p.ToDto());
    }
}

public class GetHotelPaymentsQuery : PagedRequest, IRequest<PagedResult<PaymentDto>>
{
    public Guid HotelId { get; set; }
}

public class GetHotelPaymentsQueryHandler(IPaymentReadRepository payments, IHotelAccess hotelAccess)
    : IRequestHandler<GetHotelPaymentsQuery, PagedResult<PaymentDto>>
{
    public async Task<PagedResult<PaymentDto>> Handle(
        GetHotelPaymentsQuery request, CancellationToken cancellationToken)
    {
        await hotelAccess.EnsureCanManageAsync(request.HotelId, cancellationToken);

        var query = payments.GetWhere(p => p.HotelId == request.HotelId)
            .OrderByDescending(p => p.ProcessedAt);

        var page = await query.ToPagedResultAsync(request.Page, request.PageSize, cancellationToken);

        return page.Map(p => p.ToDto());
    }
}

public record RevenuePoint(DateOnly Date, decimal Amount, int Bookings);

public record RevenueSummaryDto(
    decimal TotalRevenue,
    int PaidBookings,
    decimal AverageBookingValue,
    IReadOnlyList<RevenuePoint> Series);

/// <summary>Daily revenue for the owner dashboard chart.</summary>
public class GetRevenueSummaryQuery : IRequest<RevenueSummaryDto>
{
    public Guid HotelId { get; set; }
    public DateOnly From { get; set; }
    public DateOnly To { get; set; }
}

public class GetRevenueSummaryQueryHandler(IPaymentReadRepository payments, IHotelAccess hotelAccess)
    : IRequestHandler<GetRevenueSummaryQuery, RevenueSummaryDto>
{
    public async Task<RevenueSummaryDto> Handle(
        GetRevenueSummaryQuery request, CancellationToken cancellationToken)
    {
        await hotelAccess.EnsureCanManageAsync(request.HotelId, cancellationToken);

        var from = request.From.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var to = request.To.ToDateTime(TimeOnly.MaxValue, DateTimeKind.Utc);

        var rows = await payments.GetWhere(p =>
                p.HotelId == request.HotelId &&
                p.Status == PaymentStatus.Succeeded &&
                p.ProcessedAt >= from && p.ProcessedAt <= to)
            .Select(p => new { p.ProcessedAt, p.Amount })
            .ToListAsync(cancellationToken);

        var series = rows
            .GroupBy(r => DateOnly.FromDateTime(r.ProcessedAt))
            .Select(g => new RevenuePoint(g.Key, g.Sum(x => x.Amount), g.Count()))
            .OrderBy(p => p.Date)
            .ToList();

        var total = rows.Sum(r => r.Amount);

        return new RevenueSummaryDto(
            total,
            rows.Count,
            rows.Count == 0 ? 0 : Math.Round(total / rows.Count, 2),
            series);
    }
}
