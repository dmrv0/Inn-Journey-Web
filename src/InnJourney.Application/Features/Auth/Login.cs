using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using InnJourney.Application.Abstractions;
using InnJourney.Application.Common;
using InnJourney.Domain.Entities.Identity;

namespace InnJourney.Application.Features.Auth;

public class LoginCommand : IRequest<AuthResponse>
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty();
        RuleFor(x => x.Password).NotEmpty();
    }
}

public class LoginCommandHandler(UserManager<AppUser> userManager, ITokenHandler tokenHandler)
    : IRequestHandler<LoginCommand, AuthResponse>
{
    public async Task<AuthResponse> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByEmailAsync(request.Email)
                   ?? await userManager.FindByNameAsync(request.Email);

        // One message for both "no such user" and "wrong password", so the
        // endpoint cannot be used to discover which addresses are registered.
        if (user is null)
            throw new UnauthorizedException("Email address or password is incorrect.");

        if (await userManager.IsLockedOutAsync(user))
            throw new UnauthorizedException("This account is temporarily locked. Try again later.");

        if (!await userManager.CheckPasswordAsync(user, request.Password))
        {
            await userManager.AccessFailedAsync(user);
            throw new UnauthorizedException("Email address or password is incorrect.");
        }

        await userManager.ResetAccessFailedCountAsync(user);

        var roles = await userManager.GetRolesAsync(user);
        var tokens = tokenHandler.CreateTokenPair(user.Id, user.Email!, roles);

        user.RefreshTokenHash = tokenHandler.HashRefreshToken(tokens.RefreshToken);
        user.RefreshTokenExpiresAt = tokens.RefreshTokenExpiresAt;
        await userManager.UpdateAsync(user);

        return new AuthResponse(
            tokens.AccessToken,
            tokens.AccessTokenExpiresAt,
            tokens.RefreshToken,
            new UserDto(user.Id, user.Email!, user.FullName, user.EmailConfirmed, roles.ToList()));
    }
}

public class RefreshTokenCommand : IRequest<AuthResponse>
{
    public string RefreshToken { get; set; } = string.Empty;
}

public class RefreshTokenCommandValidator : AbstractValidator<RefreshTokenCommand>
{
    public RefreshTokenCommandValidator() => RuleFor(x => x.RefreshToken).NotEmpty();
}

/// <summary>
/// Exchanges a refresh token for a new pair, rotating the stored token so a
/// captured value cannot be replayed.
/// </summary>
public class RefreshTokenCommandHandler(
    UserManager<AppUser> userManager,
    ITokenHandler tokenHandler,
    IClock clock)
    : IRequestHandler<RefreshTokenCommand, AuthResponse>
{
    public async Task<AuthResponse> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        var hash = tokenHandler.HashRefreshToken(request.RefreshToken);

        var user = await userManager.Users
            .FirstOrDefaultAsync(u => u.RefreshTokenHash == hash, cancellationToken);

        if (user is null || user.RefreshTokenExpiresAt is null || user.RefreshTokenExpiresAt <= clock.UtcNow)
            throw new UnauthorizedException("The refresh token is invalid or has expired.");

        var roles = await userManager.GetRolesAsync(user);
        var tokens = tokenHandler.CreateTokenPair(user.Id, user.Email!, roles);

        user.RefreshTokenHash = tokenHandler.HashRefreshToken(tokens.RefreshToken);
        user.RefreshTokenExpiresAt = tokens.RefreshTokenExpiresAt;
        await userManager.UpdateAsync(user);

        return new AuthResponse(
            tokens.AccessToken,
            tokens.AccessTokenExpiresAt,
            tokens.RefreshToken,
            new UserDto(user.Id, user.Email!, user.FullName, user.EmailConfirmed, roles.ToList()));
    }
}

/// <summary>Clears the stored refresh token so it can no longer be exchanged.</summary>
public class LogoutCommand : IRequest<Unit>;

public class LogoutCommandHandler(UserManager<AppUser> userManager, ICurrentUser currentUser)
    : IRequestHandler<LogoutCommand, Unit>
{
    public async Task<Unit> Handle(LogoutCommand request, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByIdAsync(currentUser.RequireUserId());

        if (user is not null)
        {
            user.RefreshTokenHash = null;
            user.RefreshTokenExpiresAt = null;
            await userManager.UpdateAsync(user);
        }

        return Unit.Value;
    }
}
