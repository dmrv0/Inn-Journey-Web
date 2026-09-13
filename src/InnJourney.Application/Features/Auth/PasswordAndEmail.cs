using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Identity;
using InnJourney.Application.Abstractions;
using InnJourney.Application.Common;
using InnJourney.Domain.Entities.Identity;

namespace InnJourney.Application.Features.Auth;

public class ForgotPasswordCommand : IRequest<Unit>
{
    public string Email { get; set; } = string.Empty;
}

public class ForgotPasswordCommandValidator : AbstractValidator<ForgotPasswordCommand>
{
    public ForgotPasswordCommandValidator() => RuleFor(x => x.Email).NotEmpty().EmailAddress();
}

public class ForgotPasswordCommandHandler(UserManager<AppUser> userManager, IEmailSender emailSender)
    : IRequestHandler<ForgotPasswordCommand, Unit>
{
    public async Task<Unit> Handle(ForgotPasswordCommand request, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByEmailAsync(request.Email);

        // Always report success. Reporting "no such account" would turn this
        // endpoint into a register of which addresses hold accounts.
        if (user is null)
            return Unit.Value;

        var token = await userManager.GeneratePasswordResetTokenAsync(user);

        await emailSender.SendAsync(new EmailMessage(
            user.Email!,
            "Reset your password",
            $"""
             <p>Someone asked to reset the password for this account.</p>
             <p>If it was you, use this token to choose a new one:</p>
             <p><code>{token}</code></p>
             <p>If it wasn't, no action is needed.</p>
             """), cancellationToken);

        return Unit.Value;
    }
}

public class ResetPasswordCommand : IRequest<Unit>
{
    public string Email { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class ResetPasswordCommandValidator : AbstractValidator<ResetPasswordCommand>
{
    public ResetPasswordCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Token).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8);
    }
}

public class ResetPasswordCommandHandler(UserManager<AppUser> userManager)
    : IRequestHandler<ResetPasswordCommand, Unit>
{
    public async Task<Unit> Handle(ResetPasswordCommand request, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByEmailAsync(request.Email)
                   ?? throw new ValidationException(nameof(request.Token), "This reset link is no longer valid.");

        var result = await userManager.ResetPasswordAsync(user, request.Token, request.NewPassword);

        if (!result.Succeeded)
        {
            throw new ValidationException(nameof(request.NewPassword),
                string.Join(" ", result.Errors.Select(e => e.Description)));
        }

        // A password change invalidates any outstanding session.
        user.RefreshTokenHash = null;
        user.RefreshTokenExpiresAt = null;
        await userManager.UpdateAsync(user);

        return Unit.Value;
    }
}

public class ConfirmEmailCommand : IRequest<Unit>
{
    public string Email { get; set; } = string.Empty;
    public string Token { get; set; } = string.Empty;
}

public class ConfirmEmailCommandValidator : AbstractValidator<ConfirmEmailCommand>
{
    public ConfirmEmailCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress();
        RuleFor(x => x.Token).NotEmpty();
    }
}

public class ConfirmEmailCommandHandler(UserManager<AppUser> userManager)
    : IRequestHandler<ConfirmEmailCommand, Unit>
{
    public async Task<Unit> Handle(ConfirmEmailCommand request, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByEmailAsync(request.Email)
                   ?? throw new ValidationException(nameof(request.Token), "This confirmation link is no longer valid.");

        var result = await userManager.ConfirmEmailAsync(user, request.Token);

        if (!result.Succeeded)
            throw new ValidationException(nameof(request.Token), "This confirmation link is no longer valid.");

        return Unit.Value;
    }
}

public class ChangePasswordCommand : IRequest<Unit>
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class ChangePasswordCommandValidator : AbstractValidator<ChangePasswordCommand>
{
    public ChangePasswordCommandValidator()
    {
        RuleFor(x => x.CurrentPassword).NotEmpty();
        RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(8)
            .NotEqual(x => x.CurrentPassword)
            .WithMessage("The new password must differ from the current one.");
    }
}

public class ChangePasswordCommandHandler(UserManager<AppUser> userManager, ICurrentUser currentUser)
    : IRequestHandler<ChangePasswordCommand, Unit>
{
    public async Task<Unit> Handle(ChangePasswordCommand request, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByIdAsync(currentUser.RequireUserId())
                   ?? throw new UnauthorizedException();

        var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);

        if (!result.Succeeded)
        {
            throw new ValidationException(nameof(request.CurrentPassword),
                string.Join(" ", result.Errors.Select(e => e.Description)));
        }

        user.RefreshTokenHash = null;
        user.RefreshTokenExpiresAt = null;
        await userManager.UpdateAsync(user);

        return Unit.Value;
    }
}
