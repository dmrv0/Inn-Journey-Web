using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using InnJourney.Application.Repositories;
using InnJourney.Domain.Entities;
using InnJourney.Domain.Entities.Identity;
using InnJourney.Domain.Enums;
using InnJourney.Infra.Data.Contexts;
using InnJourney.Infra.Data.Repositories;

namespace InnJourney.Tests;

/// <summary>
/// An isolated SQLite database per test. Backed by a connection kept open for
/// the lifetime of the fixture, so the in-memory schema survives between calls.
/// </summary>
public sealed class TestDatabase : IDisposable
{
    private readonly SqliteConnection _connection;

    public InnJourneyDbContext Context { get; }

    public TestDatabase()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        var options = new DbContextOptionsBuilder<InnJourneyDbContext>()
            .UseSqlite(_connection)
            .Options;

        Context = new InnJourneyDbContext(options);
        Context.Database.EnsureCreated();
    }

    public IRoomReadRepository Rooms => new RoomReadRepository(Context);
    public IReservationReadRepository Reservations => new ReservationReadRepository(Context);
    public IReservationWriteRepository ReservationWrites => new ReservationWriteRepository(Context);
    public IHotelReadRepository Hotels => new HotelReadRepository(Context);
    public IHotelWriteRepository HotelWrites => new HotelWriteRepository(Context);
    public IReviewReadRepository Reviews => new ReviewReadRepository(Context);
    public IReviewWriteRepository ReviewWrites => new ReviewWriteRepository(Context);

    /// <summary>
    /// Creates a real user row. Reservations carry a foreign key to the user, so
    /// a made-up id is rejected by the database rather than silently accepted.
    /// </summary>
    public async Task<AppUser> SeedUserAsync(string fullName = "Test Guest")
    {
        var user = new AppUser
        {
            Id = Guid.NewGuid().ToString(),
            UserName = $"user-{Guid.NewGuid():N}@test.dev",
            Email = $"user-{Guid.NewGuid():N}@test.dev",
            FullName = fullName
        };

        Context.Users.Add(user);
        await Context.SaveChangesAsync();

        return user;
    }

    /// <summary>Creates a hotel with one owner and the given rooms.</summary>
    public async Task<(Hotel Hotel, AppUser Owner)> SeedHotelAsync(
        int roomCount = 2, int capacity = 2, decimal adultPrice = 100m)
    {
        var owner = new AppUser
        {
            Id = Guid.NewGuid().ToString(),
            UserName = $"owner-{Guid.NewGuid():N}@test.dev",
            Email = $"owner-{Guid.NewGuid():N}@test.dev",
            FullName = "Test Owner"
        };

        var roomType = new RoomType
        {
            Id = Guid.NewGuid(),
            Name = $"Type-{Guid.NewGuid():N}"[..12],
            DefaultCapacity = capacity
        };

        var hotel = new Hotel
        {
            Id = Guid.NewGuid(),
            OwnerId = owner.Id,
            Name = "Test Hotel",
            Stars = 3,
            Address = new Address { Line = "1 Test Street", City = "Testville", Country = "Testland" }
        };

        for (var i = 0; i < roomCount; i++)
        {
            hotel.Rooms.Add(new Room
            {
                Id = Guid.NewGuid(),
                RoomTypeId = roomType.Id,
                Number = (101 + i).ToString(),
                Capacity = capacity,
                AdultPrice = adultPrice,
                ChildPrice = adultPrice / 2,
                Status = RoomStatus.Available
            });
        }

        Context.Users.Add(owner);
        Context.RoomTypes.Add(roomType);
        Context.Hotels.Add(hotel);
        await Context.SaveChangesAsync();

        return (hotel, owner);
    }

    public async Task<Reservation> SeedReservationAsync(
        Hotel hotel, Room room, string userId, DateOnly checkIn, DateOnly checkOut,
        ReservationStatus status = ReservationStatus.Confirmed)
    {
        var reservation = new Reservation
        {
            Id = Guid.NewGuid(),
            Reference = $"INN-{Guid.NewGuid():N}"[..10].ToUpperInvariant(),
            UserId = userId,
            RoomId = room.Id,
            HotelId = hotel.Id,
            CheckIn = checkIn,
            CheckOut = checkOut,
            Adults = 1,
            TotalPrice = 100m,
            Status = status
        };

        Context.Reservations.Add(reservation);
        await Context.SaveChangesAsync();

        return reservation;
    }

    public void Dispose()
    {
        Context.Dispose();
        _connection.Dispose();
    }
}
