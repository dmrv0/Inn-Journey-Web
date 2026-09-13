using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using InnJourney.Application.Common;
using InnJourney.Application.Features.Catalog;

namespace InnJourney.Services.Api.Controllers;

/// <summary>
/// Shared catalogues. Readable by anyone so search filters can be populated;
/// only administrators may change them, which is what keeps "Sea view" meaning
/// the same thing across every property.
/// </summary>
[ApiController]
[Route("api/v1")]
[Produces("application/json")]
public class CatalogController(IMediator mediator) : ControllerBase
{
    [HttpGet("room-types")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<RoomTypeDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<RoomTypeDto>>> RoomTypes(CancellationToken ct) =>
        Ok(await mediator.Send(new GetRoomTypesQuery(), ct));

    [HttpPost("room-types")]
    [Authorize(Policy = Policies.Admin)]
    [ProducesResponseType(typeof(RoomTypeDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<RoomTypeDto>> SaveRoomType(
        SaveRoomTypeCommand command, CancellationToken ct) =>
        Ok(await mediator.Send(command, ct));

    [HttpPut("room-types/{id:guid}")]
    [Authorize(Policy = Policies.Admin)]
    [ProducesResponseType(typeof(RoomTypeDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<RoomTypeDto>> UpdateRoomType(
        Guid id, SaveRoomTypeCommand command, CancellationToken ct)
    {
        command.Id = id;
        return Ok(await mediator.Send(command, ct));
    }

    [HttpDelete("room-types/{id:guid}")]
    [Authorize(Policy = Policies.Admin)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> DeleteRoomType(Guid id, CancellationToken ct)
    {
        await mediator.Send(new DeleteRoomTypeCommand(id), ct);
        return NoContent();
    }

    [HttpGet("amenities")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyList<AmenityDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AmenityDto>>> Amenities(
        [FromQuery] GetAmenitiesQuery query, CancellationToken ct) =>
        Ok(await mediator.Send(query, ct));

    [HttpPost("amenities")]
    [Authorize(Policy = Policies.Admin)]
    [ProducesResponseType(typeof(AmenityDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<AmenityDto>> SaveAmenity(
        SaveAmenityCommand command, CancellationToken ct) =>
        Ok(await mediator.Send(command, ct));

    [HttpPut("amenities/{id:guid}")]
    [Authorize(Policy = Policies.Admin)]
    [ProducesResponseType(typeof(AmenityDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<AmenityDto>> UpdateAmenity(
        Guid id, SaveAmenityCommand command, CancellationToken ct)
    {
        command.Id = id;
        return Ok(await mediator.Send(command, ct));
    }

    [HttpDelete("amenities/{id:guid}")]
    [Authorize(Policy = Policies.Admin)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteAmenity(Guid id, CancellationToken ct)
    {
        await mediator.Send(new DeleteAmenityCommand(id), ct);
        return NoContent();
    }
}
