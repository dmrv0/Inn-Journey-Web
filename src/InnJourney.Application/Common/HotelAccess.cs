using InnJourney.Application.Abstractions;
using InnJourney.Application.Repositories;
using InnJourney.Domain.Entities;
using InnJourney.Domain.Entities.Identity;

namespace InnJourney.Application.Common;

/// <summary>
/// Single place where "may this caller manage this hotel?" is answered.
/// <para>
/// Ownership is checked against the token's user id, not against anything the
/// client sent, and a mismatch is a 403 rather than an empty result. Returning a
/// filtered list instead would leak existence and let a determined caller probe
/// for other owners' hotel ids.
/// </para>
/// </summary>
public interface IHotelAccess
{
    /// <summary>Loads the hotel and throws unless the caller may manage it.</summary>
    Task<Hotel> RequireManageableAsync(Guid hotelId, CancellationToken cancellationToken = default);

    /// <summary>Throws unless the caller may manage the given hotel.</summary>
    Task EnsureCanManageAsync(Guid hotelId, CancellationToken cancellationToken = default);
}

public class HotelAccess(ICurrentUser currentUser, IHotelReadRepository hotels) : IHotelAccess
{
    public async Task<Hotel> RequireManageableAsync(Guid hotelId, CancellationToken cancellationToken = default)
    {
        var hotel = await hotels.GetByIdAsync(hotelId, tracking: true, cancellationToken)
                    ?? throw NotFoundException.For<Hotel>(hotelId);

        var userId = currentUser.RequireUserId();

        // Admins may act on any property; owners only on their own.
        if (currentUser.IsInRole(Roles.Admin))
            return hotel;

        if (!string.Equals(hotel.OwnerId, userId, StringComparison.Ordinal))
            throw new ForbiddenException("You do not manage this hotel.");

        return hotel;
    }

    public Task EnsureCanManageAsync(Guid hotelId, CancellationToken cancellationToken = default) =>
        RequireManageableAsync(hotelId, cancellationToken);
}
