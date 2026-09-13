using InnJourney.Application.Abstractions;
using InnJourney.Application.Common;
using InnJourney.Domain.Entities.Identity;

namespace InnJourney.Tests;

/// <summary>
/// Ownership enforcement. This is the guard that makes the API's authorization
/// real: it must reject, not filter, so it cannot be used to probe for other
/// owners' hotel ids.
/// </summary>
public class HotelAccessTests : IDisposable
{
    private readonly TestDatabase _db = new();

    [Fact]
    public async Task An_owner_may_manage_their_own_hotel()
    {
        var (hotel, owner) = await _db.SeedHotelAsync();
        var access = new HotelAccess(Caller(owner.Id, Roles.HotelOwner), _db.Hotels);

        var loaded = await access.RequireManageableAsync(hotel.Id);

        loaded.Id.ShouldBe(hotel.Id);
    }

    [Fact]
    public async Task Another_owner_is_refused_with_forbidden_not_not_found()
    {
        // 403 rather than 404: the hotel exists, the caller simply may not touch
        // it. Returning an empty result instead would leak nothing but would
        // also let a client believe its write had succeeded.
        var (hotel, _) = await _db.SeedHotelAsync();
        var intruder = Caller(Guid.NewGuid().ToString(), Roles.HotelOwner);
        var access = new HotelAccess(intruder, _db.Hotels);

        await Should.ThrowAsync<ForbiddenException>(() => access.RequireManageableAsync(hotel.Id));
    }

    [Fact]
    public async Task An_administrator_may_manage_any_hotel()
    {
        var (hotel, _) = await _db.SeedHotelAsync();
        var access = new HotelAccess(Caller(Guid.NewGuid().ToString(), Roles.Admin), _db.Hotels);

        var loaded = await access.RequireManageableAsync(hotel.Id);

        loaded.Id.ShouldBe(hotel.Id);
    }

    [Fact]
    public async Task An_anonymous_caller_is_unauthorized()
    {
        var (hotel, _) = await _db.SeedHotelAsync();
        var access = new HotelAccess(new FakeCurrentUser(null, []), _db.Hotels);

        await Should.ThrowAsync<UnauthorizedException>(() => access.RequireManageableAsync(hotel.Id));
    }

    [Fact]
    public async Task A_missing_hotel_is_not_found()
    {
        var access = new HotelAccess(Caller(Guid.NewGuid().ToString(), Roles.HotelOwner), _db.Hotels);

        await Should.ThrowAsync<NotFoundException>(() => access.RequireManageableAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task A_soft_deleted_hotel_is_not_found()
    {
        var (hotel, owner) = await _db.SeedHotelAsync();

        var tracked = _db.Context.Hotels.Single(h => h.Id == hotel.Id);
        tracked.Deleted = true;
        await _db.Context.SaveChangesAsync();

        var access = new HotelAccess(Caller(owner.Id, Roles.HotelOwner), _db.Hotels);

        await Should.ThrowAsync<NotFoundException>(() => access.RequireManageableAsync(hotel.Id));
    }

    private static ICurrentUser Caller(string userId, params string[] roles) =>
        new FakeCurrentUser(userId, roles);

    public void Dispose() => _db.Dispose();
}

public sealed class FakeCurrentUser(string? userId, IReadOnlyCollection<string> roles) : ICurrentUser
{
    public string? UserId { get; } = userId;
    public string? Email => UserId is null ? null : $"{UserId}@test.dev";
    public bool IsAuthenticated => UserId is not null;
    public IReadOnlyCollection<string> Roles { get; } = roles;

    public bool IsInRole(string role) => Roles.Contains(role);

    public string RequireUserId() => UserId ?? throw new UnauthorizedException();
}
