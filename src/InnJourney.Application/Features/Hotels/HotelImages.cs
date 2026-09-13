using MediatR;
using Microsoft.EntityFrameworkCore;
using InnJourney.Application.Abstractions;
using InnJourney.Application.Common;
using InnJourney.Application.Repositories;
using InnJourney.Domain.Entities;

namespace InnJourney.Application.Features.Hotels;

/// <summary>
/// Adds an image to a hotel's gallery. The first image uploaded becomes the
/// cover unless another is chosen.
/// </summary>
public class UploadHotelImageCommand : IRequest<HotelImageDto>
{
    public Guid HotelId { get; set; }
    public Stream Content { get; set; } = Stream.Null;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public string? AltText { get; set; }
}

public class UploadHotelImageCommandHandler(
    IHotelImageWriteRepository images,
    IHotelImageReadRepository imageReads,
    IFileStorage storage,
    IHotelAccess hotelAccess)
    : IRequestHandler<UploadHotelImageCommand, HotelImageDto>
{
    public async Task<HotelImageDto> Handle(UploadHotelImageCommand request, CancellationToken cancellationToken)
    {
        await hotelAccess.EnsureCanManageAsync(request.HotelId, cancellationToken);

        var stored = await storage.SaveAsync(
            request.Content, request.FileName, request.ContentType,
            folder: request.HotelId.ToString("N"), cancellationToken);

        var existing = await imageReads.GetWhere(i => i.HotelId == request.HotelId)
            .ToListAsync(cancellationToken);

        var image = new HotelImage
        {
            Id = Guid.NewGuid(),
            HotelId = request.HotelId,
            Url = stored.Url,
            AltText = request.AltText,
            SortOrder = existing.Count,

            // The first image uploaded becomes the cover by default.
            IsCover = existing.Count == 0
        };

        await images.AddAsync(image, cancellationToken);
        await images.SaveAsync(cancellationToken);

        return image.ToDto();
    }
}

public class SetCoverImageCommand : IRequest<Unit>
{
    public Guid HotelId { get; set; }
    public Guid ImageId { get; set; }
}

public class SetCoverImageCommandHandler(
    IHotelImageReadRepository imageReads,
    IHotelImageWriteRepository images,
    IHotelAccess hotelAccess)
    : IRequestHandler<SetCoverImageCommand, Unit>
{
    public async Task<Unit> Handle(SetCoverImageCommand request, CancellationToken cancellationToken)
    {
        await hotelAccess.EnsureCanManageAsync(request.HotelId, cancellationToken);

        var gallery = await imageReads.GetWhere(i => i.HotelId == request.HotelId, tracking: true)
            .ToListAsync(cancellationToken);

        if (gallery.All(i => i.Id != request.ImageId))
            throw NotFoundException.For<HotelImage>(request.ImageId);

        // Clear the old cover first: a filtered unique index permits only one.
        foreach (var image in gallery)
        {
            image.IsCover = image.Id == request.ImageId;
            images.Update(image);
        }

        await images.SaveAsync(cancellationToken);

        return Unit.Value;
    }
}

public class DeleteHotelImageCommand : IRequest<Unit>
{
    public Guid HotelId { get; set; }
    public Guid ImageId { get; set; }
}

public class DeleteHotelImageCommandHandler(
    IHotelImageReadRepository imageReads,
    IHotelImageWriteRepository images,
    IFileStorage storage,
    IHotelAccess hotelAccess)
    : IRequestHandler<DeleteHotelImageCommand, Unit>
{
    public async Task<Unit> Handle(DeleteHotelImageCommand request, CancellationToken cancellationToken)
    {
        await hotelAccess.EnsureCanManageAsync(request.HotelId, cancellationToken);

        var image = await imageReads.GetSingleAsync(
                        i => i.Id == request.ImageId && i.HotelId == request.HotelId,
                        tracking: true, cancellationToken)
                    ?? throw NotFoundException.For<HotelImage>(request.ImageId);

        images.HardDelete(image);
        await images.SaveAsync(cancellationToken);

        await storage.DeleteAsync(image.Url, cancellationToken);

        // Promote another image so the hotel is not left without a cover.
        if (image.IsCover)
        {
            var replacement = await imageReads.GetWhere(i => i.HotelId == request.HotelId, tracking: true)
                .OrderBy(i => i.SortOrder)
                .FirstOrDefaultAsync(cancellationToken);

            if (replacement is not null)
            {
                replacement.IsCover = true;
                images.Update(replacement);
                await images.SaveAsync(cancellationToken);
            }
        }

        return Unit.Value;
    }
}
