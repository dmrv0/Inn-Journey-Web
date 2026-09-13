using Microsoft.AspNetCore.Identity;

namespace InnJourney.Domain.Entities.Identity;

public class AppUser : IdentityUser<string>
{
    public string FullName { get; set; } = string.Empty;

    public DateOnly? DateOfBirth { get; set; }

    /// <summary>
    /// SHA-256 hash of the active refresh token. The raw value is returned to the
    /// client once and never stored.
    /// </summary>
    public string? RefreshTokenHash { get; set; }

    public DateTime? RefreshTokenExpiresAt { get; set; }

    public ICollection<Hotel> Hotels { get; set; } = [];
    public ICollection<Reservation> Reservations { get; set; } = [];
    public ICollection<Review> Reviews { get; set; } = [];
}
