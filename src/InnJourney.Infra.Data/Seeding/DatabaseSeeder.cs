using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using InnJourney.Domain.Entities;
using InnJourney.Domain.Entities.Identity;
using InnJourney.Domain.Enums;
using InnJourney.Infra.Data.Contexts;

namespace InnJourney.Infra.Data.Seeding;

/// <summary>
/// Brings a fresh database to a demonstrable state: roles, catalogues, one user
/// per role, and a few properties with rooms and bookings. Idempotent, so it is
/// safe to run on every start.
/// </summary>
public class DatabaseSeeder(
    InnJourneyDbContext context,
    UserManager<AppUser> userManager,
    RoleManager<AppRole> roleManager,
    ILogger<DatabaseSeeder> logger)
{
    /// <summary>Password for every seeded demo account. Documented in the README.</summary>
    public const string DemoPassword = "Passw0rd!";

    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        await SeedRolesAsync();
        var owners = await SeedUsersAsync();
        var amenities = await SeedAmenitiesAsync(cancellationToken);
        var roomTypes = await SeedRoomTypesAsync(cancellationToken);
        await SeedHotelsAsync(owners, amenities, roomTypes, cancellationToken);

        logger.LogInformation("Database seeding complete.");
    }

    private async Task SeedRolesAsync()
    {
        foreach (var role in Roles.All)
        {
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new AppRole(role));
        }
    }

    private async Task<IReadOnlyList<AppUser>> SeedUsersAsync()
    {
        var specs = new (string Email, string FullName, string Role)[]
        {
            ("admin@innjourney.dev", "Avery Admin", Roles.Admin),
            ("owner@innjourney.dev", "Onur Owner", Roles.HotelOwner),
            ("owner2@innjourney.dev", "Olivia Owner", Roles.HotelOwner),
            ("guest@innjourney.dev", "Tess Traveller", Roles.Traveller)
        };

        var created = new List<AppUser>();

        foreach (var (email, fullName, role) in specs)
        {
            var user = await userManager.FindByEmailAsync(email);

            if (user is null)
            {
                user = new AppUser
                {
                    Id = Guid.NewGuid().ToString(),
                    UserName = email,
                    Email = email,
                    FullName = fullName,
                    EmailConfirmed = true
                };

                var result = await userManager.CreateAsync(user, DemoPassword);

                if (!result.Succeeded)
                {
                    logger.LogWarning("Could not seed {Email}: {Errors}", email,
                        string.Join("; ", result.Errors.Select(e => e.Description)));
                    continue;
                }

                await userManager.AddToRoleAsync(user, role);
            }

            if (role == Roles.HotelOwner)
                created.Add(user);
        }

        return created;
    }

    private async Task<Dictionary<string, Amenity>> SeedAmenitiesAsync(CancellationToken cancellationToken)
    {
        var specs = new (string Name, AmenityScope Scope)[]
        {
            ("Free Wi-Fi", AmenityScope.Hotel),
            ("Swimming pool", AmenityScope.Hotel),
            ("Parking", AmenityScope.Hotel),
            ("Breakfast included", AmenityScope.Hotel),
            ("Fitness centre", AmenityScope.Hotel),
            ("Pet friendly", AmenityScope.Hotel),
            ("Airport shuttle", AmenityScope.Hotel),
            ("Air conditioning", AmenityScope.Room),
            ("Sea view", AmenityScope.Room),
            ("Balcony", AmenityScope.Room),
            ("Minibar", AmenityScope.Room),
            ("Safe", AmenityScope.Room)
        };

        foreach (var (name, scope) in specs)
        {
            if (!await context.Amenities.AnyAsync(a => a.Name == name && a.Scope == scope, cancellationToken))
                context.Amenities.Add(new Amenity { Id = Guid.NewGuid(), Name = name, Scope = scope });
        }

        await context.SaveChangesAsync(cancellationToken);

        return await context.Amenities.ToDictionaryAsync(a => a.Name, cancellationToken);
    }

    private async Task<Dictionary<string, RoomType>> SeedRoomTypesAsync(CancellationToken cancellationToken)
    {
        var specs = new (string Name, string Description, int Capacity)[]
        {
            ("Standard", "A comfortable room with the essentials.", 2),
            ("Double", "Extra space and a larger bed.", 2),
            ("Family", "Room for four, with a separate sleeping area.", 4),
            ("Suite", "The largest rooms, with a lounge.", 3)
        };

        foreach (var (name, description, capacity) in specs)
        {
            if (!await context.RoomTypes.AnyAsync(t => t.Name == name, cancellationToken))
            {
                context.RoomTypes.Add(new RoomType
                {
                    Id = Guid.NewGuid(),
                    Name = name,
                    Description = description,
                    DefaultCapacity = capacity
                });
            }
        }

        await context.SaveChangesAsync(cancellationToken);

        return await context.RoomTypes.ToDictionaryAsync(t => t.Name, cancellationToken);
    }

    private async Task SeedHotelsAsync(
        IReadOnlyList<AppUser> owners,
        Dictionary<string, Amenity> amenities,
        Dictionary<string, RoomType> roomTypes,
        CancellationToken cancellationToken)
    {
        if (owners.Count == 0 || await context.Hotels.AnyAsync(cancellationToken))
            return;

        var specs = new (string Name, string City, string Country, int Stars, string Description, decimal BasePrice)[]
        {
            ("The Harbour Rooms", "Istanbul", "Türkiye", 4,
                "A converted customs house on the Bosphorus, with rooms facing the water.", 2400m),
            ("Pine & Salt", "Bodrum", "Türkiye", 5,
                "Low white buildings set into the hillside, ten minutes from the marina.", 5200m),
            ("The Signal Box", "Edinburgh", "United Kingdom", 3,
                "A railway hotel from 1908, restored and kept deliberately plain.", 1600m),
            ("Casa Ventana", "Valencia", "Spain", 4,
                "Shuttered windows, a tiled courtyard, and a very good breakfast.", 2100m),
            ("Northlight Lodge", "Tromsø", "Norway", 4,
                "Timber cabins above the fjord, built for watching the winter sky.", 3800m)
        };

        var random = new Random(20260913);
        var index = 0;

        foreach (var (name, city, country, stars, description, basePrice) in specs)
        {
            var owner = owners[index % owners.Count];
            index++;

            var hotel = new Hotel
            {
                Id = Guid.NewGuid(),
                OwnerId = owner.Id,
                Name = name,
                Description = description,
                Stars = stars,
                Email = $"stay@{name.ToLowerInvariant().Replace(" ", "").Replace("&", "and")}.example",
                Phone = "+90 555 000 0000",
                Address = new Address
                {
                    Line = $"{random.Next(1, 120)} Harbour Road",
                    City = city,
                    Country = country,
                    PostalCode = random.Next(10000, 99999).ToString()
                }
            };

            foreach (var amenityName in new[] { "Free Wi-Fi", "Parking", "Breakfast included" })
            {
                if (amenities.TryGetValue(amenityName, out var amenity))
                    hotel.Amenities.Add(new HotelAmenity { AmenityId = amenity.Id });
            }

            var floorPlan = new (string Type, int Count, decimal Multiplier)[]
            {
                ("Standard", 4, 1.0m),
                ("Double", 3, 1.35m),
                ("Family", 2, 1.8m),
                ("Suite", 1, 2.6m)
            };

            var roomNumber = 101;

            foreach (var (typeName, count, multiplier) in floorPlan)
            {
                if (!roomTypes.TryGetValue(typeName, out var type))
                    continue;

                for (var i = 0; i < count; i++)
                {
                    var price = Math.Round(basePrice * multiplier, 2);

                    hotel.Rooms.Add(new Room
                    {
                        Id = Guid.NewGuid(),
                        RoomTypeId = type.Id,
                        Number = roomNumber++.ToString(),
                        Capacity = type.DefaultCapacity,
                        AdultPrice = price,
                        ChildPrice = Math.Round(price * 0.5m, 2),
                        Status = RoomStatus.Available
                    });
                }
            }

            context.Hotels.Add(hotel);
        }

        await context.SaveChangesAsync(cancellationToken);
        logger.LogInformation("Seeded {Count} demonstration hotels.", specs.Length);
    }
}
