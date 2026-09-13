using MediatR;
using Microsoft.EntityFrameworkCore;
using InnJourney.Application.Abstractions;
using InnJourney.Application.Common;
using InnJourney.Application.Repositories;
using InnJourney.Domain.Entities;

namespace InnJourney.Application.Features.Hotels;

/// <summary>Full detail for one hotel, including rooms. Anonymous.</summary>
public class GetHotelByIdQuery(Guid id) : IRequest<HotelDetailDto>
{
    public Guid Id { get; } = id;
}

public class GetHotelByIdQueryHandler(IHotelReadRepository hotels)
    : IRequestHandler<GetHotelByIdQuery, HotelDetailDto>
{
    public async Task<HotelDetailDto> Handle(GetHotelByIdQuery request, CancellationToken cancellationToken)
    {
        var hotel = await hotels.GetAll()
            .Include(h => h.Images)
            .Include(h => h.Amenities).ThenInclude(a => a.Amenity)
            .Include(h => h.Rooms).ThenInclude(r => r.RoomType)
            .Include(h => h.Rooms).ThenInclude(r => r.Amenities).ThenInclude(a => a.Amenity)
            .FirstOrDefaultAsync(h => h.Id == request.Id, cancellationToken)
            ?? throw NotFoundException.For<Hotel>(request.Id);

        return hotel.ToDetailDto();
    }
}

/// <summary>The signed-in owner's own properties.</summary>
public class GetMyHotelsQuery : PagedRequest, IRequest<PagedResult<HotelSummaryDto>>;

public class GetMyHotelsQueryHandler(IHotelReadRepository hotels, ICurrentUser currentUser)
    : IRequestHandler<GetMyHotelsQuery, PagedResult<HotelSummaryDto>>
{
    public async Task<PagedResult<HotelSummaryDto>> Handle(
        GetMyHotelsQuery request, CancellationToken cancellationToken)
    {
        // Scoped by the token's user id, never by a value from the request.
        var ownerId = currentUser.RequireUserId();

        var query = hotels.GetWhere(h => h.OwnerId == ownerId)
            .Include(h => h.Images)
            .Include(h => h.Rooms)
            .Include(h => h.Amenities).ThenInclude(a => a.Amenity)
            .OrderBy(h => h.Name);

        var page = await query.ToPagedResultAsync(request.Page, request.PageSize, cancellationToken);

        return page.Map(h => h.ToSummaryDto());
    }
}

public record AvailableRoomDto(RoomDto Room, decimal TotalPrice, int Nights);

/// <summary>Rooms free for a given span, with the total each would cost.</summary>
public class GetHotelAvailabilityQuery : IRequest<IReadOnlyList<AvailableRoomDto>>
{
    public Guid HotelId { get; set; }
    public DateOnly CheckIn { get; set; }
    public DateOnly CheckOut { get; set; }
    public int Adults { get; set; } = 1;
    public int Children { get; set; }
}

public class GetHotelAvailabilityQueryHandler(IAvailabilityService availability)
    : IRequestHandler<GetHotelAvailabilityQuery, IReadOnlyList<AvailableRoomDto>>
{
    public async Task<IReadOnlyList<AvailableRoomDto>> Handle(
        GetHotelAvailabilityQuery request, CancellationToken cancellationToken)
    {
        var guests = request.Adults + request.Children;

        var rooms = await availability.GetAvailableRoomsAsync(
            request.HotelId, request.CheckIn, request.CheckOut, guests, cancellationToken);

        var nights = request.CheckOut.DayNumber - request.CheckIn.DayNumber;

        return rooms
            .Select(room => new AvailableRoomDto(
                room.ToDto(),
                Pricing.TotalFor(room, request.Adults, request.Children, nights),
                nights))
            .ToList();
    }
}

/// <summary>Occupancy across a window, per room. Feeds the owner's occupancy ribbon.</summary>
public class GetOccupancyQuery : IRequest<OccupancyDto>
{
    public Guid HotelId { get; set; }
    public DateOnly From { get; set; }
    public DateOnly To { get; set; }
}

public record OccupancyRoomDto(Guid RoomId, string Number, int Capacity, IReadOnlyList<DateOnly> OccupiedDates);

public record OccupancyDto(Guid HotelId, DateOnly From, DateOnly To, IReadOnlyList<OccupancyRoomDto> Rooms);

public class GetOccupancyQueryHandler(
    IAvailabilityService availability,
    IRoomReadRepository rooms,
    IHotelAccess hotelAccess)
    : IRequestHandler<GetOccupancyQuery, OccupancyDto>
{
    public async Task<OccupancyDto> Handle(GetOccupancyQuery request, CancellationToken cancellationToken)
    {
        await hotelAccess.EnsureCanManageAsync(request.HotelId, cancellationToken);

        var occupied = await availability.GetOccupancyAsync(
            request.HotelId, request.From, request.To, cancellationToken);

        var byRoom = occupied
            .GroupBy(o => o.RoomId)
            .ToDictionary(g => g.Key, g => g.Select(o => o.Date).Distinct().OrderBy(d => d).ToList());

        var hotelRooms = await rooms.GetWhere(r => r.HotelId == request.HotelId)
            .OrderBy(r => r.Number)
            .ToListAsync(cancellationToken);

        var result = hotelRooms
            .Select(r => new OccupancyRoomDto(
                r.Id,
                r.Number,
                r.Capacity,
                byRoom.TryGetValue(r.Id, out var dates) ? dates : []))
            .ToList();

        return new OccupancyDto(request.HotelId, request.From, request.To, result);
    }
}

/// <summary>
/// Nightly pricing. Children are charged at the room's child rate; a booking is
/// priced per night for the whole party.
/// </summary>
public static class Pricing
{
    public static decimal TotalFor(Room room, int adults, int children, int nights) =>
        Math.Round((room.AdultPrice * adults + room.ChildPrice * children) * nights, 2);
}
