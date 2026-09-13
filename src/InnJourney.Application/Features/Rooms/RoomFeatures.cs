using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using InnJourney.Application.Common;
using InnJourney.Application.Repositories;
using InnJourney.Domain.Entities;
using InnJourney.Domain.Enums;

namespace InnJourney.Application.Features.Rooms;

public class GetRoomsByHotelQuery : PagedRequest, IRequest<PagedResult<RoomDto>>
{
    public Guid HotelId { get; set; }
}

public class GetRoomsByHotelQueryHandler(IRoomReadRepository rooms)
    : IRequestHandler<GetRoomsByHotelQuery, PagedResult<RoomDto>>
{
    public async Task<PagedResult<RoomDto>> Handle(GetRoomsByHotelQuery request, CancellationToken cancellationToken)
    {
        var query = rooms.GetWhere(r => r.HotelId == request.HotelId)
            .Include(r => r.RoomType)
            .Include(r => r.Amenities).ThenInclude(a => a.Amenity)
            .OrderBy(r => r.Number);

        var page = await query.ToPagedResultAsync(request.Page, request.PageSize, cancellationToken);

        return page.Map(r => r.ToDto());
    }
}

public class GetRoomByIdQuery(Guid id) : IRequest<RoomDto>
{
    public Guid Id { get; } = id;
}

public class GetRoomByIdQueryHandler(IRoomReadRepository rooms) : IRequestHandler<GetRoomByIdQuery, RoomDto>
{
    public async Task<RoomDto> Handle(GetRoomByIdQuery request, CancellationToken cancellationToken)
    {
        var room = await rooms.GetAll()
            .Include(r => r.RoomType)
            .Include(r => r.Amenities).ThenInclude(a => a.Amenity)
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken)
            ?? throw NotFoundException.For<Room>(request.Id);

        return room.ToDto();
    }
}

public class RoomWriteModel
{
    public Guid RoomTypeId { get; set; }
    public string Number { get; set; } = string.Empty;
    public int Capacity { get; set; } = 2;
    public decimal AdultPrice { get; set; }
    public decimal ChildPrice { get; set; }
    public RoomStatus Status { get; set; } = RoomStatus.Available;
    public Guid[] AmenityIds { get; set; } = [];
}

public class RoomWriteModelValidator<T> : AbstractValidator<T> where T : RoomWriteModel
{
    public RoomWriteModelValidator()
    {
        RuleFor(x => x.Number).NotEmpty().MaximumLength(20);
        RuleFor(x => x.RoomTypeId).NotEmpty();
        RuleFor(x => x.Capacity).InclusiveBetween(1, 20);
        RuleFor(x => x.AdultPrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.ChildPrice).GreaterThanOrEqualTo(0);
    }
}

public class CreateRoomCommand : RoomWriteModel, IRequest<RoomDto>
{
    public Guid HotelId { get; set; }
}

public class CreateRoomCommandValidator : RoomWriteModelValidator<CreateRoomCommand>
{
    public CreateRoomCommandValidator() => RuleFor(x => x.HotelId).NotEmpty();
}

public class CreateRoomCommandHandler(
    IRoomWriteRepository rooms,
    IRoomReadRepository roomReads,
    IRoomTypeReadRepository roomTypes,
    IHotelAccess hotelAccess)
    : IRequestHandler<CreateRoomCommand, RoomDto>
{
    public async Task<RoomDto> Handle(CreateRoomCommand request, CancellationToken cancellationToken)
    {
        await hotelAccess.EnsureCanManageAsync(request.HotelId, cancellationToken);

        if (!await roomTypes.ExistsAsync(t => t.Id == request.RoomTypeId, cancellationToken))
            throw new ValidationException(nameof(request.RoomTypeId), "That room type does not exist.");

        var duplicate = await roomReads.ExistsAsync(
            r => r.HotelId == request.HotelId && r.Number == request.Number, cancellationToken);

        if (duplicate)
            throw new ConflictException($"This hotel already has a room numbered '{request.Number}'.");

        var room = new Room
        {
            Id = Guid.NewGuid(),
            HotelId = request.HotelId,
            RoomTypeId = request.RoomTypeId,
            Number = request.Number.Trim(),
            Capacity = request.Capacity,
            AdultPrice = request.AdultPrice,
            ChildPrice = request.ChildPrice,
            Status = request.Status
        };

        foreach (var amenityId in request.AmenityIds.Distinct())
            room.Amenities.Add(new RoomAmenity { AmenityId = amenityId });

        await rooms.AddAsync(room, cancellationToken);
        await rooms.SaveAsync(cancellationToken);

        var created = await roomReads.GetAll()
            .Include(r => r.RoomType)
            .Include(r => r.Amenities).ThenInclude(a => a.Amenity)
            .FirstAsync(r => r.Id == room.Id, cancellationToken);

        return created.ToDto();
    }
}

public class UpdateRoomCommand : RoomWriteModel, IRequest<RoomDto>
{
    public Guid Id { get; set; }
}

public class UpdateRoomCommandValidator : RoomWriteModelValidator<UpdateRoomCommand>
{
    public UpdateRoomCommandValidator() => RuleFor(x => x.Id).NotEmpty();
}

public class UpdateRoomCommandHandler(
    IRoomWriteRepository rooms,
    IRoomReadRepository roomReads,
    IHotelAccess hotelAccess)
    : IRequestHandler<UpdateRoomCommand, RoomDto>
{
    public async Task<RoomDto> Handle(UpdateRoomCommand request, CancellationToken cancellationToken)
    {
        var room = await roomReads.GetAll(tracking: true)
            .Include(r => r.Amenities)
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken)
            ?? throw NotFoundException.For<Room>(request.Id);

        await hotelAccess.EnsureCanManageAsync(room.HotelId, cancellationToken);

        var duplicate = await roomReads.ExistsAsync(
            r => r.HotelId == room.HotelId && r.Number == request.Number && r.Id != room.Id,
            cancellationToken);

        if (duplicate)
            throw new ConflictException($"This hotel already has a room numbered '{request.Number}'.");

        room.RoomTypeId = request.RoomTypeId;
        room.Number = request.Number.Trim();
        room.Capacity = request.Capacity;
        room.AdultPrice = request.AdultPrice;
        room.ChildPrice = request.ChildPrice;
        room.Status = request.Status;

        room.Amenities.Clear();
        foreach (var amenityId in request.AmenityIds.Distinct())
            room.Amenities.Add(new RoomAmenity { RoomId = room.Id, AmenityId = amenityId });

        rooms.Update(room);
        await rooms.SaveAsync(cancellationToken);

        var updated = await roomReads.GetAll()
            .Include(r => r.RoomType)
            .Include(r => r.Amenities).ThenInclude(a => a.Amenity)
            .FirstAsync(r => r.Id == room.Id, cancellationToken);

        return updated.ToDto();
    }
}

public class DeleteRoomCommand(Guid id) : IRequest<Unit>
{
    public Guid Id { get; } = id;
}

public class DeleteRoomCommandHandler(
    IRoomWriteRepository rooms,
    IRoomReadRepository roomReads,
    IReservationReadRepository reservations,
    IHotelAccess hotelAccess)
    : IRequestHandler<DeleteRoomCommand, Unit>
{
    public async Task<Unit> Handle(DeleteRoomCommand request, CancellationToken cancellationToken)
    {
        var room = await roomReads.GetByIdAsync(request.Id, tracking: true, cancellationToken)
                   ?? throw NotFoundException.For<Room>(request.Id);

        await hotelAccess.EnsureCanManageAsync(room.HotelId, cancellationToken);

        var hasLiveBookings = await reservations.GetWhere(r =>
                r.RoomId == room.Id &&
                Reservation.BlockingStatuses.Contains(r.Status))
            .AnyAsync(cancellationToken);

        if (hasLiveBookings)
        {
            throw new ConflictException(
                "This room has active reservations. Take it out of service instead, or cancel them first.");
        }

        rooms.SoftDelete(room);
        await rooms.SaveAsync(cancellationToken);

        return Unit.Value;
    }
}
