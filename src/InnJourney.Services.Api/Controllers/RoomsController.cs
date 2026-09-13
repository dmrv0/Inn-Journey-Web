using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using InnJourney.Application.Common;
using InnJourney.Application.Features.Rooms;

namespace InnJourney.Services.Api.Controllers;

/// <summary>Rooms within a property.</summary>
[ApiController]
[Route("api/v1")]
[Produces("application/json")]
public class RoomsController(IMediator mediator) : ControllerBase
{
    /// <summary>Lists a hotel's rooms.</summary>
    [HttpGet("hotels/{hotelId:guid}/rooms")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PagedResult<RoomDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<RoomDto>>> ByHotel(
        Guid hotelId, [FromQuery] GetRoomsByHotelQuery query, CancellationToken ct)
    {
        query.HotelId = hotelId;
        return Ok(await mediator.Send(query, ct));
    }

    [HttpGet("rooms/{id:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(RoomDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RoomDto>> GetById(Guid id, CancellationToken ct) =>
        Ok(await mediator.Send(new GetRoomByIdQuery(id), ct));

    /// <summary>Adds a room to a property the caller owns.</summary>
    [HttpPost("hotels/{hotelId:guid}/rooms")]
    [Authorize(Policy = Policies.HotelOwner)]
    [ProducesResponseType(typeof(RoomDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<RoomDto>> Create(
        Guid hotelId, CreateRoomCommand command, CancellationToken ct)
    {
        command.HotelId = hotelId;
        var room = await mediator.Send(command, ct);
        return CreatedAtAction(nameof(GetById), new { id = room.Id }, room);
    }

    [HttpPut("rooms/{id:guid}")]
    [Authorize(Policy = Policies.HotelOwner)]
    [ProducesResponseType(typeof(RoomDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<RoomDto>> Update(Guid id, UpdateRoomCommand command, CancellationToken ct)
    {
        command.Id = id;
        return Ok(await mediator.Send(command, ct));
    }

    /// <summary>Removes a room. Refused while it still has active reservations.</summary>
    [HttpDelete("rooms/{id:guid}")]
    [Authorize(Policy = Policies.HotelOwner)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await mediator.Send(new DeleteRoomCommand(id), ct);
        return NoContent();
    }
}
