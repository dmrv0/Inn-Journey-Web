using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using InnJourney.Application.Abstractions;
using InnJourney.Application.Common;
using InnJourney.Application.Repositories;
using InnJourney.Domain.Entities;

namespace InnJourney.Application.Features.Hotels;

public class HotelWriteModel
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? GoogleMapsUrl { get; set; }
    public int Stars { get; set; } = 3;

    public string AddressLine { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string? PostalCode { get; set; }

    public Guid[] AmenityIds { get; set; } = [];
}

/// <summary>
/// Creates a property owned by the caller. Ownership is taken from the bearer
/// token, so a hotel can only ever be created for the account making the request.
/// </summary>
public class CreateHotelCommand : HotelWriteModel, IRequest<HotelDetailDto>;

public class HotelWriteModelValidator<T> : AbstractValidator<T> where T : HotelWriteModel
{
    public HotelWriteModelValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(4000);
        RuleFor(x => x.Phone).MaximumLength(40);
        RuleFor(x => x.Email).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.Stars).InclusiveBetween(1, 5);
        RuleFor(x => x.AddressLine).NotEmpty().MaximumLength(300);
        RuleFor(x => x.City).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Country).NotEmpty().MaximumLength(120);
    }
}

public class CreateHotelCommandValidator : HotelWriteModelValidator<CreateHotelCommand>;

public class CreateHotelCommandHandler(
    IHotelWriteRepository hotels,
    IHotelReadRepository hotelReads,
    ICurrentUser currentUser)
    : IRequestHandler<CreateHotelCommand, HotelDetailDto>
{
    public async Task<HotelDetailDto> Handle(CreateHotelCommand request, CancellationToken cancellationToken)
    {
        var hotel = new Hotel
        {
            Id = Guid.NewGuid(),
            OwnerId = currentUser.RequireUserId(),
            Name = request.Name.Trim(),
            Description = request.Description,
            Phone = request.Phone,
            Email = request.Email,
            GoogleMapsUrl = request.GoogleMapsUrl,
            Stars = request.Stars,
            Address = new Address
            {
                Line = request.AddressLine.Trim(),
                City = request.City.Trim(),
                Country = request.Country.Trim(),
                PostalCode = request.PostalCode
            }
        };

        foreach (var amenityId in request.AmenityIds.Distinct())
            hotel.Amenities.Add(new HotelAmenity { AmenityId = amenityId });

        await hotels.AddAsync(hotel, cancellationToken);
        await hotels.SaveAsync(cancellationToken);

        var created = await hotelReads.GetAll()
            .Include(h => h.Images)
            .Include(h => h.Amenities).ThenInclude(a => a.Amenity)
            .Include(h => h.Rooms).ThenInclude(r => r.RoomType)
            .FirstAsync(h => h.Id == hotel.Id, cancellationToken);

        return created.ToDetailDto();
    }
}

public class UpdateHotelCommand : HotelWriteModel, IRequest<HotelDetailDto>
{
    public Guid Id { get; set; }
}

public class UpdateHotelCommandValidator : HotelWriteModelValidator<UpdateHotelCommand>
{
    public UpdateHotelCommandValidator() => RuleFor(x => x.Id).NotEmpty();
}

public class UpdateHotelCommandHandler(
    IHotelWriteRepository hotels,
    IHotelReadRepository hotelReads,
    IHotelAccess hotelAccess)
    : IRequestHandler<UpdateHotelCommand, HotelDetailDto>
{
    public async Task<HotelDetailDto> Handle(UpdateHotelCommand request, CancellationToken cancellationToken)
    {
        // Throws 403 unless the caller owns this hotel, or is an administrator.
        var hotel = await hotelAccess.RequireManageableAsync(request.Id, cancellationToken);

        hotel.Name = request.Name.Trim();
        hotel.Description = request.Description;
        hotel.Phone = request.Phone;
        hotel.Email = request.Email;
        hotel.GoogleMapsUrl = request.GoogleMapsUrl;
        hotel.Stars = request.Stars;
        hotel.Address = new Address
        {
            Line = request.AddressLine.Trim(),
            City = request.City.Trim(),
            Country = request.Country.Trim(),
            PostalCode = request.PostalCode
        };

        var existing = await hotelReads.GetAll(tracking: true)
            .Include(h => h.Amenities)
            .FirstAsync(h => h.Id == request.Id, cancellationToken);

        existing.Amenities.Clear();

        foreach (var amenityId in request.AmenityIds.Distinct())
            existing.Amenities.Add(new HotelAmenity { HotelId = hotel.Id, AmenityId = amenityId });

        hotels.Update(hotel);
        await hotels.SaveAsync(cancellationToken);

        var updated = await hotelReads.GetAll()
            .Include(h => h.Images)
            .Include(h => h.Amenities).ThenInclude(a => a.Amenity)
            .Include(h => h.Rooms).ThenInclude(r => r.RoomType)
            .FirstAsync(h => h.Id == hotel.Id, cancellationToken);

        return updated.ToDetailDto();
    }
}

public class DeleteHotelCommand(Guid id) : IRequest<Unit>
{
    public Guid Id { get; } = id;
}

public class DeleteHotelCommandHandler(
    IHotelWriteRepository hotels,
    IReservationReadRepository reservations,
    IHotelAccess hotelAccess)
    : IRequestHandler<DeleteHotelCommand, Unit>
{
    public async Task<Unit> Handle(DeleteHotelCommand request, CancellationToken cancellationToken)
    {
        var hotel = await hotelAccess.RequireManageableAsync(request.Id, cancellationToken);

        // Refuse while guests still hold bookings, rather than stranding them.
        var hasLiveBookings = await reservations.GetWhere(r =>
                r.HotelId == hotel.Id &&
                Reservation.BlockingStatuses.Contains(r.Status))
            .AnyAsync(cancellationToken);

        if (hasLiveBookings)
        {
            throw new ConflictException(
                "This hotel still has active reservations. Cancel or complete them before removing it.");
        }

        hotels.SoftDelete(hotel);
        await hotels.SaveAsync(cancellationToken);

        return Unit.Value;
    }
}
