using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using InnJourney.Application.Abstractions;
using InnJourney.Application.Common;
using InnJourney.Application.Repositories;
using InnJourney.Domain.Entities;
using InnJourney.Domain.Entities.Identity;
using InnJourney.Domain.Enums;

namespace InnJourney.Application.Features.Reservations;

/// <summary>
/// Moves a reservation to a new status. Every transition goes through
/// <see cref="ReservationStatusTransitions"/>, so a cancelled booking can never
/// be checked in and a stay cannot be completed twice.
/// </summary>
public abstract class ReservationTransitionHandler(
    IReservationReadRepository reads,
    IReservationWriteRepository writes,
    IHotelAccess hotelAccess,
    ICurrentUser currentUser)
{
    protected async Task<Reservation> TransitionAsync(
        Guid reservationId,
        ReservationStatus target,
        bool guestMayPerform,
        CancellationToken cancellationToken)
    {
        var reservation = await reads.GetAll(tracking: true)
            .Include(r => r.Hotel)
            .Include(r => r.Room)
            .Include(r => r.Payment)
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Id == reservationId, cancellationToken)
            ?? throw NotFoundException.For<Reservation>(reservationId);

        var userId = currentUser.RequireUserId();
        var isGuest = string.Equals(reservation.UserId, userId, StringComparison.Ordinal);

        if (!(guestMayPerform && isGuest))
        {
            // Anyone who is not the guest must be able to manage the property.
            await hotelAccess.EnsureCanManageAsync(reservation.HotelId, cancellationToken);
        }

        if (!ReservationStatusTransitions.CanTransition(reservation.Status, target))
        {
            throw new ConflictException(
                $"A {reservation.Status} reservation cannot become {target}.");
        }

        reservation.Status = target;
        writes.Update(reservation);
        await writes.SaveAsync(cancellationToken);

        return reservation;
    }
}

public class CancelReservationCommand(Guid id) : IRequest<ReservationDto>
{
    public Guid Id { get; } = id;
}

public class CancelReservationCommandHandler(
    IReservationReadRepository reads,
    IReservationWriteRepository writes,
    IHotelAccess hotelAccess,
    ICurrentUser currentUser,
    IPaymentGateway paymentGateway,
    IPaymentWriteRepository payments,
    IEmailSender emailSender)
    : ReservationTransitionHandler(reads, writes, hotelAccess, currentUser),
        IRequestHandler<CancelReservationCommand, ReservationDto>
{
    public async Task<ReservationDto> Handle(CancelReservationCommand request, CancellationToken cancellationToken)
    {
        // The guest may cancel their own booking; so may the hotel.
        var reservation = await TransitionAsync(
            request.Id, ReservationStatus.Cancelled, guestMayPerform: true, cancellationToken);

        // Refund any captured payment.
        if (reservation.Payment is { Status: PaymentStatus.Succeeded, ProviderReference: { } reference } payment)
        {
            var refund = await paymentGateway.RefundAsync(reference, payment.Amount, cancellationToken);

            if (refund.Succeeded)
            {
                payment.Status = PaymentStatus.Refunded;
                payments.Update(payment);
                await payments.SaveAsync(cancellationToken);
            }
        }

        if (reservation.User?.Email is { } email)
        {
            await emailSender.SendAsync(new EmailMessage(
                email,
                $"Booking {reservation.Reference} cancelled",
                $"<p>Your stay at {reservation.Hotel?.Name} has been cancelled.</p>"), cancellationToken);
        }

        return reservation.ToDto();
    }
}

/// <summary>Marks the guest as arrived. Hotel staff only.</summary>
public class CheckInReservationCommand(Guid id) : IRequest<ReservationDto>
{
    public Guid Id { get; } = id;
}

public class CheckInReservationCommandHandler(
    IReservationReadRepository reads,
    IReservationWriteRepository writes,
    IHotelAccess hotelAccess,
    ICurrentUser currentUser)
    : ReservationTransitionHandler(reads, writes, hotelAccess, currentUser),
        IRequestHandler<CheckInReservationCommand, ReservationDto>
{
    public async Task<ReservationDto> Handle(CheckInReservationCommand request, CancellationToken cancellationToken)
    {
        var reservation = await TransitionAsync(
            request.Id, ReservationStatus.CheckedIn, guestMayPerform: false, cancellationToken);

        return reservation.ToDto();
    }
}

/// <summary>Completes the stay, which is what makes the guest eligible to review it.</summary>
public class CheckOutReservationCommand(Guid id) : IRequest<ReservationDto>
{
    public Guid Id { get; } = id;
}

public class CheckOutReservationCommandHandler(
    IReservationReadRepository reads,
    IReservationWriteRepository writes,
    IHotelAccess hotelAccess,
    ICurrentUser currentUser)
    : ReservationTransitionHandler(reads, writes, hotelAccess, currentUser),
        IRequestHandler<CheckOutReservationCommand, ReservationDto>
{
    public async Task<ReservationDto> Handle(CheckOutReservationCommand request, CancellationToken cancellationToken)
    {
        var reservation = await TransitionAsync(
            request.Id, ReservationStatus.CheckedOut, guestMayPerform: false, cancellationToken);

        return reservation.ToDto();
    }
}

public class GetMyReservationsQuery : PagedRequest, IRequest<PagedResult<ReservationDto>>
{
    /// <summary>When true, returns only stays that have not yet finished.</summary>
    public bool? Upcoming { get; set; }
}

public class GetMyReservationsQueryHandler(
    IReservationReadRepository reservations,
    ICurrentUser currentUser,
    IClock clock)
    : IRequestHandler<GetMyReservationsQuery, PagedResult<ReservationDto>>
{
    public async Task<PagedResult<ReservationDto>> Handle(
        GetMyReservationsQuery request, CancellationToken cancellationToken)
    {
        var userId = currentUser.RequireUserId();

        var query = reservations.GetWhere(r => r.UserId == userId)
            .Include(r => r.Hotel)
            .Include(r => r.Room)
            .Include(r => r.Payment)
            .Include(r => r.Review)
            .AsQueryable();

        if (request.Upcoming is true)
            query = query.Where(r => r.CheckOut >= clock.Today && r.Status != ReservationStatus.Cancelled);
        else if (request.Upcoming is false)
            query = query.Where(r => r.CheckOut < clock.Today || r.Status == ReservationStatus.Cancelled);

        var ordered = query.OrderByDescending(r => r.CheckIn);

        var page = await ordered.ToPagedResultAsync(request.Page, request.PageSize, cancellationToken);

        return page.Map(r => r.ToDto());
    }
}

public class GetReservationByIdQuery(Guid id) : IRequest<ReservationDto>
{
    public Guid Id { get; } = id;
}

public class GetReservationByIdQueryHandler(
    IReservationReadRepository reservations,
    ICurrentUser currentUser,
    IHotelAccess hotelAccess)
    : IRequestHandler<GetReservationByIdQuery, ReservationDto>
{
    public async Task<ReservationDto> Handle(GetReservationByIdQuery request, CancellationToken cancellationToken)
    {
        var reservation = await reservations.GetAll()
            .Include(r => r.Hotel)
            .Include(r => r.Room)
            .Include(r => r.Payment)
            .Include(r => r.Review)
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken)
            ?? throw NotFoundException.For<Reservation>(request.Id);

        var userId = currentUser.RequireUserId();

        // The guest sees their own booking; everyone else must manage the hotel.
        if (!string.Equals(reservation.UserId, userId, StringComparison.Ordinal))
            await hotelAccess.EnsureCanManageAsync(reservation.HotelId, cancellationToken);

        return reservation.ToDto();
    }
}

public class GetHotelReservationsQuery : PagedRequest, IRequest<PagedResult<ReservationDto>>
{
    public Guid HotelId { get; set; }
    public ReservationStatus? Status { get; set; }
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
}

public class GetHotelReservationsQueryHandler(
    IReservationReadRepository reservations,
    IHotelAccess hotelAccess)
    : IRequestHandler<GetHotelReservationsQuery, PagedResult<ReservationDto>>
{
    public async Task<PagedResult<ReservationDto>> Handle(
        GetHotelReservationsQuery request, CancellationToken cancellationToken)
    {
        await hotelAccess.EnsureCanManageAsync(request.HotelId, cancellationToken);

        var query = reservations.GetWhere(r => r.HotelId == request.HotelId)
            .Include(r => r.Hotel)
            .Include(r => r.Room)
            .Include(r => r.Payment)
            .AsQueryable();

        if (request.Status is { } status)
            query = query.Where(r => r.Status == status);

        if (request.From is { } from)
            query = query.Where(r => r.CheckOut > from);

        if (request.To is { } to)
            query = query.Where(r => r.CheckIn < to);

        var ordered = query.OrderBy(r => r.CheckIn);

        var page = await ordered.ToPagedResultAsync(request.Page, request.PageSize, cancellationToken);

        return page.Map(r => r.ToDto());
    }
}

public class GetHotelReservationsQueryValidator : AbstractValidator<GetHotelReservationsQuery>
{
    public GetHotelReservationsQueryValidator()
    {
        RuleFor(x => x.HotelId).NotEmpty();

        RuleFor(x => x.To)
            .GreaterThan(x => x.From!.Value)
            .When(x => x is { From: not null, To: not null })
            .WithMessage("The end of the range must be later than its start.");
    }
}
