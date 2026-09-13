using Microsoft.AspNetCore.Identity;

namespace InnJourney.Domain.Entities.Identity;

public class AppRole : IdentityRole<string>
{
    public AppRole() { }

    public AppRole(string roleName) : base(roleName)
    {
        Id = Guid.NewGuid().ToString();
        NormalizedName = roleName.ToUpperInvariant();
    }
}

/// <summary>The three roles the API recognises. Seeded at startup.</summary>
public static class Roles
{
    public const string Traveller = nameof(Traveller);
    public const string HotelOwner = nameof(HotelOwner);
    public const string Admin = nameof(Admin);

    public static readonly string[] All = [Traveller, HotelOwner, Admin];
}
