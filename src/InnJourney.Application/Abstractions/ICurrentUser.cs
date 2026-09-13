using InnJourney.Application.Common;

namespace InnJourney.Application.Abstractions;

/// <summary>
/// The authenticated caller, read from the validated token.
/// <para>
/// Handlers take identity from here and never from the request body. A user id
/// accepted from the payload is a user id the caller chooses, so no command
/// exposes one.
/// </para>
/// </summary>
public interface ICurrentUser
{
    /// <summary>Null when the request is anonymous.</summary>
    string? UserId { get; }

    string? Email { get; }

    bool IsAuthenticated { get; }

    IReadOnlyCollection<string> Roles { get; }

    bool IsInRole(string role);

    /// <summary>The caller's id, or <see cref="UnauthorizedException"/> if anonymous.</summary>
    string RequireUserId();
}
