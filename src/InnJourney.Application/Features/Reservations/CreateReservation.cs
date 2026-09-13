using System.Security.Cryptography;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using InnJourney.Application.Abstractions;
using InnJourney.Application.Common;
using InnJourney.Application.Features.Hotels;
using InnJourney.Application.Repositories;
using InnJourney.Domain.Entities;
using InnJourney.Domain.Enums;

namespace InnJourney.Application.Features.Reservations;

/// <summary>
/// Books a room for the signed-in traveller. The guest is taken from the token,
/// never from the payload.
/// </summary>
public class CreateReservationCommand : IRequest<ReservationDto>
{
    public Guid RoomId { get; set; }
    public DateOnly CheckIn { get; set; }
    public DateOnly CheckOut { get; set; }
    public int Adults { get; set; } = 1;
    public int Children { get; set; }
}

public class CreateReservationCommandValidator : AbstractValidator<CreateReservationCommand>
{
    public CreateReservationCommandValidator()
    {
        RuleFor(x => x.RoomId).NotEmpty();
        RuleFor(x => x.Adults).InclusiveBetween(1, 20);
        RuleFor(x => x.Children).InclusiveBetween(0, 20);

        RuleFor(x => x.CheckOut)
            .GreaterThan(x => x.CheckIn)
            .WithMessage("Check-out must be later than check-in.");
    }
}

public class CreateReservationCommandHandler(
    IReservationWriteRepository reservations,
    IReservationReadRepository reservationReads,
    IRoomReadRepository rooms,
    IAvailabilityService availability,
    ICurrentUser currentUser,
    IUnitOfWork unitOfWork,
    IEmailSender emailSender,
    IClock clock)
    : IRequestHandler<CreateReservationCommand, ReservationDto>
{
    public async Task<ReservationDto> Handle(CreateReservationCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUser.RequireUserId();

        if (request.CheckIn < clock.Today)
            throw new ValidationException(nameof(request.CheckIn), "Check-in cannot be in the past.");

        var room = await rooms.GetAll()
            .Include(r => r.Hotel)
            .Include(r => r.RoomType)
            .FirstOrDefaultAsync(r => r.Id == request.RoomId, cancellationToken)
            ?? throw NotFoundException.For<Room>(request.RoomId);

        if (room.Status != RoomStatus.Available)
            throw new ConflictException("This room is not currently available to book.");

        var guests = request.Adults + request.Children;

        if (guests > room.Capacity)
        {
            throw new ValidationException(nameof(request.Adults),
                $"This room sleeps {room.Capacity}; you asked for {guests}.");
        }

        var nights = request.CheckOut.DayNumber - request.CheckIn.DayNumber;
        var total = Pricing.TotalFor(room, request.Adults, request.Children, nights);

        // Availability is re-checked inside the transaction, so two concurrent
        // requests for the same span cannot both pass the check and both insert.
        var reservation = await unitOfWork.ExecuteInTransactionAsync(async ct =>
        {
            var free = await availability.IsRoomAvailableAsync(
                request.RoomId, request.CheckIn, request.CheckOut, cancellationToken: ct);

            if (!free)
                throw new ConflictException("Those dates have just been taken for this room.");

            var entity = new Reservation
            {
                Id = Guid.NewGuid(),
                Reference = await GenerateReferenceAsync(ct),
                UserId = userId,
                RoomId = room.Id,
                HotelId = room.HotelId,
                CheckIn = request.CheckIn,
                CheckOut = request.CheckOut,
                Adults = request.Adults,
                Children = request.Children,
                TotalPrice = total,
                Status = ReservationStatus.Pending
            };

            await reservations.AddAsync(entity, ct);
            await reservations.SaveAsync(ct);

            return entity;
        }, cancellationToken);

        if (currentUser.Email is { } email)
        {
            await emailSender.SendAsync(new EmailMessage(
                email,
                $"Your booking {reservation.Reference} is held",
                $"""
                 <p>We are holding {room.Hotel?.Name} for you.</p>
                 <p><strong>{reservation.Reference}</strong> &middot; room {room.Number}<br>
                 {reservation.CheckIn:d MMM yyyy} to {reservation.CheckOut:d MMM yyyy}, {nights} night(s)</p>
                 <p>Total {total:N2}. Complete payment to confirm the booking.</p>
                 """), cancellationToken);
        }

        var saved = await reservationReads.GetAll()
            .Include(r => r.Hotel)
            .Include(r => r.Room)
            .Include(r => r.Payment)
            .FirstAsync(r => r.Id == reservation.Id, cancellationToken);

        return saved.ToDto();
    }

    /// <summary>
    /// Builds a short, quotable reference from an unambiguous alphabet: no I, O,
    /// 0 or 1, so a guest reading it aloud cannot be misheard.
    /// </summary>
    private async Task<string> GenerateReferenceAsync(CancellationToken cancellationToken)
    {
        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

        for (var attempt = 0; attempt < 10; attempt++)
        {
            var chars = new char[6];

            for (var i = 0; i < chars.Length; i++)
                chars[i] = alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)];

            var candidate = $"INN-{new string(chars)}";

            if (!await reservationReads.ExistsAsync(r => r.Reference == candidate, cancellationToken))
                return candidate;
        }

        // Practically unreachable; falls back to a value that cannot collide.
        return $"INN-{Guid.NewGuid():N}"[..14].ToUpperInvariant();
    }
}
