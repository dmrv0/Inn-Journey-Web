using FluentValidation;
using MediatR;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using InnJourney.Application.Abstractions;
using InnJourney.Application.Common;
using InnJourney.Domain.Entities.Identity;

namespace InnJourney.Application.Features.Users;

/// <summary>The signed-in user's own profile.</summary>
public class GetCurrentUserQuery : IRequest<UserDto>;

public class GetCurrentUserQueryHandler(UserManager<AppUser> userManager, ICurrentUser currentUser)
    : IRequestHandler<GetCurrentUserQuery, UserDto>
{
    public async Task<UserDto> Handle(GetCurrentUserQuery request, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByIdAsync(currentUser.RequireUserId())
                   ?? throw new UnauthorizedException();

        var roles = await userManager.GetRolesAsync(user);

        return new UserDto(user.Id, user.Email!, user.FullName, user.EmailConfirmed, roles.ToList());
    }
}

public class UpdateProfileCommand : IRequest<UserDto>
{
    public string FullName { get; set; } = string.Empty;
    public DateOnly? DateOfBirth { get; set; }
}

public class UpdateProfileCommandValidator : AbstractValidator<UpdateProfileCommand>
{
    public UpdateProfileCommandValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);

        RuleFor(x => x.DateOfBirth)
            .LessThan(DateOnly.FromDateTime(DateTime.UtcNow))
            .When(x => x.DateOfBirth.HasValue)
            .WithMessage("Date of birth must be in the past.");
    }
}

public class UpdateProfileCommandHandler(UserManager<AppUser> userManager, ICurrentUser currentUser)
    : IRequestHandler<UpdateProfileCommand, UserDto>
{
    public async Task<UserDto> Handle(UpdateProfileCommand request, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByIdAsync(currentUser.RequireUserId())
                   ?? throw new UnauthorizedException();

        user.FullName = request.FullName.Trim();
        user.DateOfBirth = request.DateOfBirth;

        await userManager.UpdateAsync(user);

        var roles = await userManager.GetRolesAsync(user);

        return new UserDto(user.Id, user.Email!, user.FullName, user.EmailConfirmed, roles.ToList());
    }
}

/// <summary>Administrator listing of accounts.</summary>
public class GetUsersQuery : PagedRequest, IRequest<PagedResult<UserDto>>
{
    public string? Query { get; set; }
    public string? Role { get; set; }
}

public class GetUsersQueryHandler(UserManager<AppUser> userManager)
    : IRequestHandler<GetUsersQuery, PagedResult<UserDto>>
{
    public async Task<PagedResult<UserDto>> Handle(GetUsersQuery request, CancellationToken cancellationToken)
    {
        var query = userManager.Users.AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Query))
        {
            var term = request.Query.Trim().ToLowerInvariant();
            query = query.Where(u =>
                u.FullName.ToLower().Contains(term) ||
                (u.Email != null && u.Email.ToLower().Contains(term)));
        }

        var ordered = query.OrderBy(u => u.FullName);

        var page = await ordered.ToPagedResultAsync(request.Page, request.PageSize, cancellationToken);

        var items = new List<UserDto>(page.Items.Count);

        foreach (var user in page.Items)
        {
            var roles = await userManager.GetRolesAsync(user);

            if (!string.IsNullOrWhiteSpace(request.Role) && !roles.Contains(request.Role))
                continue;

            items.Add(new UserDto(user.Id, user.Email!, user.FullName, user.EmailConfirmed, roles.ToList()));
        }

        return new PagedResult<UserDto>
        {
            Items = items,
            Page = page.Page,
            PageSize = page.PageSize,
            TotalCount = page.TotalCount
        };
    }
}

public class SetUserRolesCommand : IRequest<UserDto>
{
    public string UserId { get; set; } = string.Empty;
    public string[] Roles { get; set; } = [];
}

public class SetUserRolesCommandValidator : AbstractValidator<SetUserRolesCommand>
{
    public SetUserRolesCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();

        RuleForEach(x => x.Roles)
            .Must(role => Domain.Entities.Identity.Roles.All.Contains(role))
            .WithMessage($"Roles must be drawn from: {string.Join(", ", Domain.Entities.Identity.Roles.All)}.");
    }
}

public class SetUserRolesCommandHandler(UserManager<AppUser> userManager, ICurrentUser currentUser)
    : IRequestHandler<SetUserRolesCommand, UserDto>
{
    public async Task<UserDto> Handle(SetUserRolesCommand request, CancellationToken cancellationToken)
    {
        var user = await userManager.FindByIdAsync(request.UserId)
                   ?? throw new NotFoundException($"User '{request.UserId}' was not found.");

        // Guard against an administrator removing their own last privilege and
        // locking everyone out of role management.
        var isSelf = string.Equals(user.Id, currentUser.UserId, StringComparison.Ordinal);

        if (isSelf && !request.Roles.Contains(Domain.Entities.Identity.Roles.Admin))
            throw new ConflictException("You cannot remove your own administrator role.");

        var current = await userManager.GetRolesAsync(user);

        await userManager.RemoveFromRolesAsync(user, current.Except(request.Roles));
        await userManager.AddToRolesAsync(user, request.Roles.Except(current));

        var updated = await userManager.GetRolesAsync(user);

        return new UserDto(user.Id, user.Email!, user.FullName, user.EmailConfirmed, updated.ToList());
    }
}
