using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Identity;
using InnJourney.Application.Abstractions;
using InnJourney.Application.Common;
using InnJourney.Domain.Entities.Identity;

namespace InnJourney.Application.Features.Auth;

/// <summary>
/// Creates an account. The caller may choose to sign up as a traveller or as a
/// hotel owner; <see cref="Roles.Admin"/> is deliberately not offered here and
/// can only be granted by an existing administrator.
/// </summary>
public class RegisterCommand : IRequest<AuthResponse>
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;

    /// <summary>Either <c>Traveller</c> or <c>HotelOwner</c>. Defaults to traveller.</summary>
    public string Role { get; set; } = Roles.Traveller;
}

public record AuthResponse(
    string AccessToken,
    DateTime ExpiresAt,
    string RefreshToken,
    UserDto User);

public class RegisterCommandValidator : AbstractValidator<RegisterCommand>
{
    public RegisterCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Password).NotEmpty().MinimumLength(8);

        RuleFor(x => x.Role)
            .Must(role => role == Roles.Traveller || role == Roles.HotelOwner)
            .WithMessage($"Role must be either '{Roles.Traveller}' or '{Roles.HotelOwner}'.");
    }
}

public class RegisterCommandHandler(
    UserManager<AppUser> userManager,
    ITokenHandler tokenHandler,
    IEmailSender emailSender)
    : IRequestHandler<RegisterCommand, AuthResponse>
{
    public async Task<AuthResponse> Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        if (await userManager.FindByEmailAsync(request.Email) is not null)
            throw new ConflictException("An account with that email address already exists.");

        var user = new AppUser
        {
            Id = Guid.NewGuid().ToString(),
            UserName = request.Email,
            Email = request.Email,
            FullName = request.FullName
        };

        var result = await userManager.CreateAsync(user, request.Password);

        if (!result.Succeeded)
        {
            throw new ValidationException(result.Errors
                .GroupBy(e => MapErrorCodeToField(e.Code))
                .ToDictionary(g => g.Key, g => g.Select(e => e.Description).ToArray()));
        }

        await userManager.AddToRoleAsync(user, request.Role);

        var confirmationToken = await userManager.GenerateEmailConfirmationTokenAsync(user);

        await emailSender.SendAsync(new EmailMessage(
            user.Email!,
            "Confirm your email address",
            $"""
             <p>Welcome to Inn Journey, {user.FullName}.</p>
             <p>Confirm your address to finish setting up your account.</p>
             <p>Confirmation token: <code>{confirmationToken}</code></p>
             """), cancellationToken);

        var tokens = tokenHandler.CreateTokenPair(user.Id, user.Email!, [request.Role]);

        user.RefreshTokenHash = tokenHandler.HashRefreshToken(tokens.RefreshToken);
        user.RefreshTokenExpiresAt = tokens.RefreshTokenExpiresAt;
        await userManager.UpdateAsync(user);

        return new AuthResponse(
            tokens.AccessToken,
            tokens.AccessTokenExpiresAt,
            tokens.RefreshToken,
            new UserDto(user.Id, user.Email!, user.FullName, user.EmailConfirmed, [request.Role]));
    }

    private static string MapErrorCodeToField(string code) => code switch
    {
        var c when c.Contains("Password", StringComparison.OrdinalIgnoreCase) => nameof(RegisterCommand.Password),
        var c when c.Contains("Email", StringComparison.OrdinalIgnoreCase) => nameof(RegisterCommand.Email),
        var c when c.Contains("UserName", StringComparison.OrdinalIgnoreCase) => nameof(RegisterCommand.Email),
        _ => string.Empty
    };
}
