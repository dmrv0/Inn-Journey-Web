using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using InnJourney.Domain.Entities;

namespace InnJourney.Infra.Data.Configurations;

public class RoomConfiguration : IEntityTypeConfiguration<Room>
{
    public void Configure(EntityTypeBuilder<Room> builder)
    {
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Number).IsRequired().HasMaxLength(20);
        builder.Property(r => r.AdultPrice).HasPrecision(18, 2);
        builder.Property(r => r.ChildPrice).HasPrecision(18, 2);
        builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(20);

        builder.ToTable(t =>
        {
            t.HasCheckConstraint("CK_Room_Capacity", "\"Capacity\" > 0");
            t.HasCheckConstraint("CK_Room_Prices", "\"AdultPrice\" >= 0 AND \"ChildPrice\" >= 0");
        });

        builder.HasOne(r => r.RoomType)
            .WithMany(t => t.Rooms)
            .HasForeignKey(r => r.RoomTypeId)
            .OnDelete(DeleteBehavior.Restrict);

        // Door numbers are unique within a property, not globally.
        builder.HasIndex(r => new { r.HotelId, r.Number }).IsUnique();
        builder.HasIndex(r => r.RoomTypeId);
    }
}

public class RoomTypeConfiguration : IEntityTypeConfiguration<RoomType>
{
    public void Configure(EntityTypeBuilder<RoomType> builder)
    {
        builder.HasKey(t => t.Id);

        builder.Property(t => t.Name).IsRequired().HasMaxLength(120);
        builder.Property(t => t.Description).HasMaxLength(2000);
        builder.Property(t => t.ImageUrl).HasMaxLength(1000);

        builder.HasIndex(t => t.Name).IsUnique();
    }
}

public class HotelImageConfiguration : IEntityTypeConfiguration<HotelImage>
{
    public void Configure(EntityTypeBuilder<HotelImage> builder)
    {
        builder.HasKey(i => i.Id);

        builder.Property(i => i.Url).IsRequired().HasMaxLength(1000);
        builder.Property(i => i.AltText).HasMaxLength(300);

        builder.HasIndex(i => i.HotelId);

        // At most one cover image per hotel.
        builder.HasIndex(i => i.HotelId)
            .IsUnique()
            .HasFilter("\"IsCover\" = true AND \"Deleted\" = false")
            .HasDatabaseName("IX_HotelImages_SingleCoverPerHotel");
    }
}
