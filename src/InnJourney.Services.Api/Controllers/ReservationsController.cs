using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using InnJourney.Application.Common;
using InnJourney.Application.Features.Reservations;

namespace InnJourney.Services.Api.Controllers;

/// <summary>
/// Bookings. A traveller sees and manages only their own; hotel staff act on
/// reservations at properties they manage.
/// </summary>
[ApiController]
[Route("api/v1/reservations")]
[Authorize]
[Produces("application/json")]
public class ReservationsController(IMediator mediator) : ControllerBase
{
    /// <summary>Books a room. The guest is taken from the access token.</summary>
    [HttpPost]
    [Authorize(Policy = Policies.Traveller)]
    [ProducesResponseType(typeof(ReservationDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ReservationDto>> Create(
        CreateReservationCommand command, CancellationToken ct)
    {
        var reservation = await mediator.Send(command, ct);
        return CreatedAtAction(nameof(GetById), new { id = reservation.Id }, reservation);
    }

    /// <summary>The caller's own bookings.</summary>
    [HttpGet("mine")]
    [ProducesResponseType(typeof(PagedResult<ReservationDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<ReservationDto>>> Mine(
        [FromQuery] GetMyReservationsQuery query, CancellationToken ct) =>
        Ok(await mediator.Send(query, ct));

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ReservationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ReservationDto>> GetById(Guid id, CancellationToken ct) =>
        Ok(await mediator.Send(new GetReservationByIdQuery(id), ct));

    /// <summary>Bookings at a property the caller manages.</summary>
    [HttpGet("~/api/v1/hotels/{hotelId:guid}/reservations")]
    [Authorize(Policy = Policies.HotelOwner)]
    [ProducesResponseType(typeof(PagedResult<ReservationDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<ReservationDto>>> ByHotel(
        Guid hotelId, [FromQuery] GetHotelReservationsQuery query, CancellationToken ct)
    {
        query.HotelId = hotelId;
        return Ok(await mediator.Send(query, ct));
    }

    /// <summary>Cancels a booking. Available to the guest or to hotel staff.</summary>
    [HttpPost("{id:guid}/cancel")]
    [ProducesResponseType(typeof(ReservationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ReservationDto>> Cancel(Guid id, CancellationToken ct) =>
        Ok(await mediator.Send(new CancelReservationCommand(id), ct));

    /// <summary>Marks the guest as arrived. Hotel staff only.</summary>
    [HttpPost("{id:guid}/check-in")]
    [Authorize(Policy = Policies.HotelOwner)]
    [ProducesResponseType(typeof(ReservationDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ReservationDto>> CheckIn(Guid id, CancellationToken ct) =>
        Ok(await mediator.Send(new CheckInReservationCommand(id), ct));

    /// <summary>Completes the stay, which makes the guest eligible to review it.</summary>
    [HttpPost("{id:guid}/check-out")]
    [Authorize(Policy = Policies.HotelOwner)]
    [ProducesResponseType(typeof(ReservationDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ReservationDto>> CheckOut(Guid id, CancellationToken ct) =>
        Ok(await mediator.Send(new CheckOutReservationCommand(id), ct));
}
