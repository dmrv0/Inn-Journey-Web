using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using InnJourney.Application.Common;
using InnJourney.Application.Features.Payments;

namespace InnJourney.Services.Api.Controllers;

/// <summary>
/// Payment against a booking. The gateway is simulated in-process; no card value
/// is stored beyond the last four digits.
/// </summary>
[ApiController]
[Route("api/v1/payments")]
[Authorize]
[Produces("application/json")]
public class PaymentsController(IMediator mediator) : ControllerBase
{
    /// <summary>
    /// Pays for a pending reservation and confirms it. Use card
    /// <c>4242 4242 4242 4242</c> to be approved, <c>4000 0000 0000 0002</c> to
    /// be declined.
    /// </summary>
    [HttpPost]
    [Authorize(Policy = Policies.Traveller)]
    [ProducesResponseType(typeof(PaymentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<PaymentDto>> Pay(PayReservationCommand command, CancellationToken ct) =>
        Ok(await mediator.Send(command, ct));

    /// <summary>The caller's own payment history.</summary>
    [HttpGet("mine")]
    [ProducesResponseType(typeof(PagedResult<PaymentDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<PaymentDto>>> Mine(
        [FromQuery] GetMyPaymentsQuery query, CancellationToken ct) =>
        Ok(await mediator.Send(query, ct));

    /// <summary>Payments taken by a property the caller manages.</summary>
    [HttpGet("~/api/v1/hotels/{hotelId:guid}/payments")]
    [Authorize(Policy = Policies.HotelOwner)]
    [ProducesResponseType(typeof(PagedResult<PaymentDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<PaymentDto>>> ByHotel(
        Guid hotelId, [FromQuery] GetHotelPaymentsQuery query, CancellationToken ct)
    {
        query.HotelId = hotelId;
        return Ok(await mediator.Send(query, ct));
    }

    /// <summary>Daily revenue for the owner dashboard.</summary>
    [HttpGet("~/api/v1/hotels/{hotelId:guid}/revenue")]
    [Authorize(Policy = Policies.HotelOwner)]
    [ProducesResponseType(typeof(RevenueSummaryDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<RevenueSummaryDto>> Revenue(
        Guid hotelId, [FromQuery] GetRevenueSummaryQuery query, CancellationToken ct)
    {
        query.HotelId = hotelId;
        return Ok(await mediator.Send(query, ct));
    }
}
