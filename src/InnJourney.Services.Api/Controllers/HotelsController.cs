using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using InnJourney.Application.Common;
using InnJourney.Application.Features.Hotels;

namespace InnJourney.Services.Api.Controllers;

/// <summary>
/// Hotel search and property management. Search and detail are public; every
/// mutating route requires the caller to own the property.
/// </summary>
[ApiController]
[Route("api/v1/hotels")]
[Produces("application/json")]
public class HotelsController(IMediator mediator) : ControllerBase
{
    /// <summary>Paged, filtered hotel search.</summary>
    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PagedResult<HotelSummaryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<HotelSummaryDto>>> Search(
        [FromQuery] SearchHotelsQuery query, CancellationToken ct) =>
        Ok(await mediator.Send(query, ct));

    /// <summary>Full detail for one hotel, including its rooms.</summary>
    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(HotelDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<HotelDetailDto>> GetById(Guid id, CancellationToken ct) =>
        Ok(await mediator.Send(new GetHotelByIdQuery(id), ct));

    /// <summary>Rooms free for a date span, with the total each would cost.</summary>
    [HttpGet("{id:guid}/availability")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<AvailableRoomDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AvailableRoomDto>>> Availability(
        Guid id, [FromQuery] GetHotelAvailabilityQuery query, CancellationToken ct)
    {
        query.HotelId = id;
        return Ok(await mediator.Send(query, ct));
    }

    /// <summary>The signed-in owner's own properties.</summary>
    [HttpGet("mine")]
    [Authorize(Policy = Policies.HotelOwner)]
    [ProducesResponseType(typeof(PagedResult<HotelSummaryDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<HotelSummaryDto>>> Mine(
        [FromQuery] GetMyHotelsQuery query, CancellationToken ct) =>
        Ok(await mediator.Send(query, ct));

    /// <summary>Per-room occupancy across a window. Feeds the owner's occupancy board.</summary>
    [HttpGet("{id:guid}/occupancy")]
    [Authorize(Policy = Policies.HotelOwner)]
    [ProducesResponseType(typeof(OccupancyDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<OccupancyDto>> Occupancy(
        Guid id, [FromQuery] GetOccupancyQuery query, CancellationToken ct)
    {
        query.HotelId = id;
        return Ok(await mediator.Send(query, ct));
    }

    /// <summary>Creates a property owned by the caller.</summary>
    [HttpPost]
    [Authorize(Policy = Policies.HotelOwner)]
    [ProducesResponseType(typeof(HotelDetailDto), StatusCodes.Status201Created)]
    public async Task<ActionResult<HotelDetailDto>> Create(CreateHotelCommand command, CancellationToken ct)
    {
        var hotel = await mediator.Send(command, ct);
        return CreatedAtAction(nameof(GetById), new { id = hotel.Id }, hotel);
    }

    /// <summary>Updates a property the caller owns.</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = Policies.HotelOwner)]
    [ProducesResponseType(typeof(HotelDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<HotelDetailDto>> Update(
        Guid id, UpdateHotelCommand command, CancellationToken ct)
    {
        // The route wins over the body, so the payload cannot retarget the write.
        command.Id = id;
        return Ok(await mediator.Send(command, ct));
    }

    /// <summary>Removes a property. Refused while it still has active reservations.</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Policies.HotelOwner)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await mediator.Send(new DeleteHotelCommand(id), ct);
        return NoContent();
    }

    /// <summary>Adds an image to the gallery.</summary>
    [HttpPost("{id:guid}/images")]
    [Authorize(Policy = Policies.HotelOwner)]
    [RequestSizeLimit(10 * 1024 * 1024)]
    [ProducesResponseType(typeof(HotelImageDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<HotelImageDto>> UploadImage(
        Guid id, IFormFile file, [FromForm] string? altText, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new ProblemDetails { Title = "Choose a file to upload.", Status = 400 });

        await using var stream = file.OpenReadStream();

        var image = await mediator.Send(new UploadHotelImageCommand
        {
            HotelId = id,
            Content = stream,
            FileName = file.FileName,
            ContentType = file.ContentType,
            AltText = altText
        }, ct);

        return Ok(image);
    }

    /// <summary>Chooses which image represents the hotel in search results.</summary>
    [HttpPut("{id:guid}/images/{imageId:guid}/cover")]
    [Authorize(Policy = Policies.HotelOwner)]
    public async Task<IActionResult> SetCover(Guid id, Guid imageId, CancellationToken ct)
    {
        await mediator.Send(new SetCoverImageCommand { HotelId = id, ImageId = imageId }, ct);
        return NoContent();
    }

    /// <summary>Removes an image from the gallery and from storage.</summary>
    [HttpDelete("{id:guid}/images/{imageId:guid}")]
    [Authorize(Policy = Policies.HotelOwner)]
    public async Task<IActionResult> DeleteImage(Guid id, Guid imageId, CancellationToken ct)
    {
        await mediator.Send(new DeleteHotelImageCommand { HotelId = id, ImageId = imageId }, ct);
        return NoContent();
    }
}
