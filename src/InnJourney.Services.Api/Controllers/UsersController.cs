using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using InnJourney.Application.Common;
using InnJourney.Application.Features.Users;

namespace InnJourney.Services.Api.Controllers;

/// <summary>The caller's own profile, and account administration.</summary>
[ApiController]
[Route("api/v1/users")]
[Authorize]
[Produces("application/json")]
public class UsersController(IMediator mediator) : ControllerBase
{
    /// <summary>The signed-in user, with their roles.</summary>
    [HttpGet("me")]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<UserDto>> Me(CancellationToken ct) =>
        Ok(await mediator.Send(new GetCurrentUserQuery(), ct));

    [HttpPut("me")]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<UserDto>> UpdateProfile(
        UpdateProfileCommand command, CancellationToken ct) =>
        Ok(await mediator.Send(command, ct));

    /// <summary>Lists accounts. Administrators only.</summary>
    [HttpGet]
    [Authorize(Policy = Policies.Admin)]
    [ProducesResponseType(typeof(PagedResult<UserDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<UserDto>>> List(
        [FromQuery] GetUsersQuery query, CancellationToken ct) =>
        Ok(await mediator.Send(query, ct));

    /// <summary>Replaces a user's roles. Administrators only.</summary>
    [HttpPut("{id}/roles")]
    [Authorize(Policy = Policies.Admin)]
    [ProducesResponseType(typeof(UserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<UserDto>> SetRoles(
        string id, SetUserRolesCommand command, CancellationToken ct)
    {
        command.UserId = id;
        return Ok(await mediator.Send(command, ct));
    }
}
