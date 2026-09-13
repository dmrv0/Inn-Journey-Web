using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using InnJourney.Application.Common;
using InnJourney.Application.Features.Reviews;

namespace InnJourney.Services.Api.Controllers;

/// <summary>
/// Guest reviews. Reading is public; writing requires a completed stay at the
/// property being reviewed.
/// </summary>
[ApiController]
[Route("api/v1/reviews")]
[Produces("application/json")]
public class ReviewsController(IMediator mediator) : ControllerBase
{
    /// <summary>Reviews of one hotel.</summary>
    [HttpGet("~/api/v1/hotels/{hotelId:guid}/reviews")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(PagedResult<ReviewDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<ReviewDto>>> ByHotel(
        Guid hotelId, [FromQuery] GetHotelReviewsQuery query, CancellationToken ct)
    {
        query.HotelId = hotelId;
        return Ok(await mediator.Send(query, ct));
    }

    /// <summary>Reviews written by the caller.</summary>
    [HttpGet("mine")]
    [Authorize]
    [ProducesResponseType(typeof(PagedResult<ReviewDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<ReviewDto>>> Mine(
        [FromQuery] GetMyReviewsQuery query, CancellationToken ct) =>
        Ok(await mediator.Send(query, ct));

    /// <summary>Publishes a review of a completed stay. One per stay.</summary>
    [HttpPost]
    [Authorize(Policy = Policies.Traveller)]
    [ProducesResponseType(typeof(ReviewDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ReviewDto>> Create(CreateReviewCommand command, CancellationToken ct) =>
        Ok(await mediator.Send(command, ct));

    /// <summary>The hotel owner's single public reply to a review.</summary>
    [HttpPost("{id:guid}/response")]
    [Authorize(Policy = Policies.HotelOwner)]
    [ProducesResponseType(typeof(ReviewDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ReviewDto>> Respond(
        Guid id, RespondToReviewCommand command, CancellationToken ct)
    {
        command.ReviewId = id;
        return Ok(await mediator.Send(command, ct));
    }

    /// <summary>Withdraws a review. The author, or an administrator.</summary>
    [HttpDelete("{id:guid}")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await mediator.Send(new DeleteReviewCommand(id), ct);
        return NoContent();
    }
}
