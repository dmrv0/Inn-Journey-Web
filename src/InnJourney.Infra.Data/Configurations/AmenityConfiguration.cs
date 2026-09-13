using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using InnJourney.Domain.Entities;
using InnJourney.Domain.Entities.Identity;

namespace InnJourney.Infra.Data.Configurations;

public class AmenityConfiguration : IEntityTypeConfiguration<Amenity>
{
    public void Configure(EntityTypeBuilder<Amenity> builder)
    {
        builder.HasKey(a => a.Id);

        builder.Property(a => a.Name).IsRequired().HasMaxLength(120);
        builder.Property(a => a.IconUrl).HasMaxLength(1000);
        builder.Property(a => a.Scope).HasConversion<string>().HasMaxLength(20);

        builder.HasIndex(a => new { a.Name, a.Scope }).IsUnique();
    }
}

public class HotelAmenityConfiguration : IEntityTypeConfiguration<HotelAmenity>
{
    public void Configure(EntityTypeBuilder<HotelAmenity> builder)
    {
        builder.HasKey(ha => new { ha.HotelId, ha.AmenityId });

        builder.HasOne(ha => ha.Hotel)
            .WithMany(h => h.Amenities)
            .HasForeignKey(ha => ha.HotelId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(ha => ha.Amenity)
            .WithMany(a => a.Hotels)
            .HasForeignKey(ha => ha.AmenityId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(ha => ha.AmenityId);

        // The join carries no soft-delete flag of its own, so it inherits the
        // filters of both ends. Without this a retired amenity would keep
        // appearing through the join.
        builder.HasQueryFilter(ha => !ha.Hotel!.Deleted && !ha.Amenity!.Deleted);
    }
}

public class RoomAmenityConfiguration : IEntityTypeConfiguration<RoomAmenity>
{
    public void Configure(EntityTypeBuilder<RoomAmenity> builder)
    {
        builder.HasKey(ra => new { ra.RoomId, ra.AmenityId });

        builder.HasOne(ra => ra.Room)
            .WithMany(r => r.Amenities)
            .HasForeignKey(ra => ra.RoomId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(ra => ra.Amenity)
            .WithMany(a => a.Rooms)
            .HasForeignKey(ra => ra.AmenityId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(ra => ra.AmenityId);

        builder.HasQueryFilter(ra => !ra.Room!.Deleted && !ra.Amenity!.Deleted);
    }
}

public class AppUserConfiguration : IEntityTypeConfiguration<AppUser>
{
    public void Configure(EntityTypeBuilder<AppUser> builder)
    {
        builder.Property(u => u.FullName).IsRequired().HasMaxLength(200);
        builder.Property(u => u.RefreshTokenHash).HasMaxLength(100);
    }
}
