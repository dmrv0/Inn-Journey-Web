using System.Linq.Expressions;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using InnJourney.Domain.Entities;
using InnJourney.Domain.Entities.Common;
using InnJourney.Domain.Entities.Identity;

namespace InnJourney.Infra.Data.Contexts;

public class InnJourneyDbContext : IdentityDbContext<AppUser, AppRole, string>
{
    public InnJourneyDbContext(DbContextOptions<InnJourneyDbContext> options)
        : base(options)
    {
    }

    public DbSet<Hotel> Hotels => Set<Hotel>();
    public DbSet<HotelImage> HotelImages => Set<HotelImage>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<RoomType> RoomTypes => Set<RoomType>();
    public DbSet<Amenity> Amenities => Set<Amenity>();
    public DbSet<HotelAmenity> HotelAmenities => Set<HotelAmenity>();
    public DbSet<RoomAmenity> RoomAmenities => Set<RoomAmenity>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Review> Reviews => Set<Review>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(InnJourneyDbContext).Assembly);
        ApplySoftDeleteFilter(builder);
    }

    /// <summary>
    /// Adds <c>WHERE NOT "Deleted"</c> to every aggregate, so a soft-deleted row
    /// disappears from reads without any query having to remember to exclude it.
    /// </summary>
    private static void ApplySoftDeleteFilter(ModelBuilder builder)
    {
        foreach (var entityType in builder.Model.GetEntityTypes())
        {
            if (!typeof(BaseEntity).IsAssignableFrom(entityType.ClrType))
                continue;

            var parameter = Expression.Parameter(entityType.ClrType, "e");
            var property = Expression.Property(parameter, nameof(BaseEntity.Deleted));
            var filter = Expression.Lambda(Expression.Not(property), parameter);

            entityType.SetQueryFilter(filter);
        }
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        StampTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    public override int SaveChanges()
    {
        StampTimestamps();
        return base.SaveChanges();
    }

    /// <summary>
    /// Stamps audit timestamps. Only Added and Modified carry meaning here; an
    /// Unchanged entity has nothing to record, and Detached is not tracked.
    /// </summary>
    private void StampTimestamps()
    {
        var now = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedDate = now;
                    break;

                case EntityState.Modified:
                    entry.Entity.UpdatedDate = now;

                    // A soft delete arrives as a Modified entity with Deleted flipped on.
                    if (entry.Entity is { Deleted: true, DeletedDate: null })
                        entry.Entity.DeletedDate = now;
                    break;
            }
        }
    }
}
