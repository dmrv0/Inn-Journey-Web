using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using InnJourney.Domain.Entities;

namespace InnJourney.Infra.Data.Configurations;

public class HotelConfiguration : IEntityTypeConfiguration<Hotel>
{
    public void Configure(EntityTypeBuilder<Hotel> builder)
    {
        builder.HasKey(h => h.Id);

        builder.Property(h => h.Name).IsRequired().HasMaxLength(200);
        builder.Property(h => h.Description).HasMaxLength(4000);
        builder.Property(h => h.Phone).HasMaxLength(40);
        builder.Property(h => h.Email).HasMaxLength(256);
        builder.Property(h => h.GoogleMapsUrl).HasMaxLength(1000);
        builder.Property(h => h.OwnerId).IsRequired();

        builder.ToTable(t =>
        {
            t.HasCheckConstraint("CK_Hotel_Stars", "\"Stars\" BETWEEN 1 AND 5");
            t.HasCheckConstraint("CK_Hotel_AverageRating", "\"AverageRating\" BETWEEN 0 AND 5");
        });

        // Stored inline on the hotel row rather than as a separate table.
        builder.OwnsOne(h => h.Address, address =>
        {
            address.Property(a => a.Line).IsRequired().HasMaxLength(300).HasColumnName("AddressLine");
            address.Property(a => a.City).IsRequired().HasMaxLength(120).HasColumnName("City");
            address.Property(a => a.Country).IsRequired().HasMaxLength(120).HasColumnName("Country");
            address.Property(a => a.PostalCode).HasMaxLength(20).HasColumnName("PostalCode");

            // City is the primary search facet.
            address.HasIndex(a => a.City);
        });

        builder.HasOne(h => h.Owner)
            .WithMany(u => u.Hotels)
            .HasForeignKey(h => h.OwnerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(h => h.Rooms)
            .WithOne(r => r.Hotel)
            .HasForeignKey(r => r.HotelId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(h => h.Images)
            .WithOne(i => i.Hotel)
            .HasForeignKey(i => i.HotelId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(h => h.OwnerId);
        builder.HasIndex(h => h.Stars);
        builder.HasIndex(h => h.AverageRating);
    }
}
