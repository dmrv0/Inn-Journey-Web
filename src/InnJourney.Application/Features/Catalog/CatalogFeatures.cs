using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using InnJourney.Application.Common;
using InnJourney.Application.Repositories;
using InnJourney.Domain.Entities;
using InnJourney.Domain.Enums;

namespace InnJourney.Application.Features.Catalog;

// Room types and amenities are shared catalogues administered centrally, so a
// filter for "Sea view" means the same thing across every property.

public class GetRoomTypesQuery : IRequest<IReadOnlyList<RoomTypeDto>>;

public class GetRoomTypesQueryHandler(IRoomTypeReadRepository roomTypes)
    : IRequestHandler<GetRoomTypesQuery, IReadOnlyList<RoomTypeDto>>
{
    public async Task<IReadOnlyList<RoomTypeDto>> Handle(
        GetRoomTypesQuery request, CancellationToken cancellationToken)
    {
        var items = await roomTypes.GetAll().OrderBy(t => t.Name).ToListAsync(cancellationToken);
        return items.Select(t => t.ToDto()).ToList();
    }
}

public class SaveRoomTypeCommand : IRequest<RoomTypeDto>
{
    /// <summary>Null creates a new entry; otherwise updates the named one.</summary>
    public Guid? Id { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public int DefaultCapacity { get; set; } = 2;
}

public class SaveRoomTypeCommandValidator : AbstractValidator<SaveRoomTypeCommand>
{
    public SaveRoomTypeCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
        RuleFor(x => x.Description).MaximumLength(2000);
        RuleFor(x => x.DefaultCapacity).InclusiveBetween(1, 20);
    }
}

public class SaveRoomTypeCommandHandler(
    IRoomTypeReadRepository reads,
    IRoomTypeWriteRepository writes)
    : IRequestHandler<SaveRoomTypeCommand, RoomTypeDto>
{
    public async Task<RoomTypeDto> Handle(SaveRoomTypeCommand request, CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();

        var clash = await reads.ExistsAsync(
            t => t.Name == name && (request.Id == null || t.Id != request.Id), cancellationToken);

        if (clash)
            throw new ConflictException($"A room type named '{name}' already exists.");

        RoomType entity;

        if (request.Id is { } id)
        {
            entity = await reads.GetByIdAsync(id, tracking: true, cancellationToken)
                     ?? throw NotFoundException.For<RoomType>(id);
        }
        else
        {
            entity = new RoomType { Id = Guid.NewGuid() };
            await writes.AddAsync(entity, cancellationToken);
        }

        entity.Name = name;
        entity.Description = request.Description;
        entity.ImageUrl = request.ImageUrl;
        entity.DefaultCapacity = request.DefaultCapacity;

        if (request.Id is not null)
            writes.Update(entity);

        await writes.SaveAsync(cancellationToken);

        return entity.ToDto();
    }
}

public class DeleteRoomTypeCommand(Guid id) : IRequest<Unit>
{
    public Guid Id { get; } = id;
}

public class DeleteRoomTypeCommandHandler(
    IRoomTypeReadRepository reads,
    IRoomTypeWriteRepository writes,
    IRoomReadRepository rooms)
    : IRequestHandler<DeleteRoomTypeCommand, Unit>
{
    public async Task<Unit> Handle(DeleteRoomTypeCommand request, CancellationToken cancellationToken)
    {
        var entity = await reads.GetByIdAsync(request.Id, tracking: true, cancellationToken)
                     ?? throw NotFoundException.For<RoomType>(request.Id);

        if (await rooms.ExistsAsync(r => r.RoomTypeId == entity.Id, cancellationToken))
            throw new ConflictException("Rooms still use this type, so it cannot be removed.");

        writes.SoftDelete(entity);
        await writes.SaveAsync(cancellationToken);

        return Unit.Value;
    }
}

public class GetAmenitiesQuery : IRequest<IReadOnlyList<AmenityDto>>
{
    public AmenityScope? Scope { get; set; }
}

public class GetAmenitiesQueryHandler(IAmenityReadRepository amenities)
    : IRequestHandler<GetAmenitiesQuery, IReadOnlyList<AmenityDto>>
{
    public async Task<IReadOnlyList<AmenityDto>> Handle(
        GetAmenitiesQuery request, CancellationToken cancellationToken)
    {
        var query = amenities.GetAll();

        if (request.Scope is { } scope)
            query = query.Where(a => a.Scope == scope);

        var items = await query.OrderBy(a => a.Name).ToListAsync(cancellationToken);

        return items.Select(a => a.ToDto()).ToList();
    }
}

public class SaveAmenityCommand : IRequest<AmenityDto>
{
    public Guid? Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? IconUrl { get; set; }
    public AmenityScope Scope { get; set; } = AmenityScope.Hotel;
}

public class SaveAmenityCommandValidator : AbstractValidator<SaveAmenityCommand>
{
    public SaveAmenityCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120);
        RuleFor(x => x.IconUrl).MaximumLength(1000);
    }
}

public class SaveAmenityCommandHandler(
    IAmenityReadRepository reads,
    IAmenityWriteRepository writes)
    : IRequestHandler<SaveAmenityCommand, AmenityDto>
{
    public async Task<AmenityDto> Handle(SaveAmenityCommand request, CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();

        var clash = await reads.ExistsAsync(
            a => a.Name == name && a.Scope == request.Scope && (request.Id == null || a.Id != request.Id),
            cancellationToken);

        if (clash)
            throw new ConflictException($"A {request.Scope.ToString().ToLowerInvariant()} amenity named '{name}' already exists.");

        Amenity entity;

        if (request.Id is { } id)
        {
            entity = await reads.GetByIdAsync(id, tracking: true, cancellationToken)
                     ?? throw NotFoundException.For<Amenity>(id);
        }
        else
        {
            entity = new Amenity { Id = Guid.NewGuid() };
            await writes.AddAsync(entity, cancellationToken);
        }

        entity.Name = name;
        entity.IconUrl = request.IconUrl;
        entity.Scope = request.Scope;

        if (request.Id is not null)
            writes.Update(entity);

        await writes.SaveAsync(cancellationToken);

        return entity.ToDto();
    }
}

public class DeleteAmenityCommand(Guid id) : IRequest<Unit>
{
    public Guid Id { get; } = id;
}

public class DeleteAmenityCommandHandler(
    IAmenityReadRepository reads,
    IAmenityWriteRepository writes)
    : IRequestHandler<DeleteAmenityCommand, Unit>
{
    public async Task<Unit> Handle(DeleteAmenityCommand request, CancellationToken cancellationToken)
    {
        var entity = await reads.GetByIdAsync(request.Id, tracking: true, cancellationToken)
                     ?? throw NotFoundException.For<Amenity>(request.Id);

        writes.SoftDelete(entity);
        await writes.SaveAsync(cancellationToken);

        return Unit.Value;
    }
}
