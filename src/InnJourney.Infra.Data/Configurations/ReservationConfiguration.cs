using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using InnJourney.Domain.Entities;

namespace InnJourney.Infra.Data.Configurations;

public class ReservationConfiguration : IEntityTypeConfiguration<Reservation>
{
    public void Configure(EntityTypeBuilder<Reservation> builder)
    {
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Reference).IsRequired().HasMaxLength(20);
        builder.Property(r => r.UserId).IsRequired();
        builder.Property(r => r.TotalPrice).HasPrecision(18, 2);
        builder.Property(r => r.Status).HasConversion<string>().HasMaxLength(20);

        builder.Ignore(r => r.Nights);
        builder.Ignore(r => r.Guests);

        builder.ToTable(t =>
        {
            t.HasCheckConstraint("CK_Reservation_Dates", "\"CheckOut\" > \"CheckIn\"");
            t.HasCheckConstraint("CK_Reservation_Guests", "\"Adults\" > 0 AND \"Children\" >= 0");
        });

        builder.HasIndex(r => r.Reference).IsUnique();

        builder.HasOne(r => r.User)
            .WithMany(u => u.Reservations)
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(r => r.Room)
            .WithMany(room => room.Reservations)
            .HasForeignKey(r => r.RoomId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(r => r.Hotel)
            .WithMany(h => h.Reservations)
            .HasForeignKey(r => r.HotelId)
            .OnDelete(DeleteBehavior.Restrict);

        // Serves the availability overlap scan.
        builder.HasIndex(r => new { r.RoomId, r.CheckIn, r.CheckOut });
        builder.HasIndex(r => new { r.UserId, r.Status });
        builder.HasIndex(r => new { r.HotelId, r.CheckIn });
    }
}

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Amount).HasPrecision(18, 2);
        builder.Property(p => p.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(p => p.Method).HasConversion<string>().HasMaxLength(20);
        builder.Property(p => p.ProviderReference).HasMaxLength(100);
        builder.Property(p => p.CardLast4).HasMaxLength(4);
        builder.Property(p => p.FailureReason).HasMaxLength(500);
        builder.Property(p => p.UserId).IsRequired();

        // Exactly one payment per reservation.
        builder.HasOne(p => p.Reservation)
            .WithOne(r => r.Payment)
            .HasForeignKey<Payment>(p => p.ReservationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(p => p.User)
            .WithMany()
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(p => p.Hotel)
            .WithMany()
            .HasForeignKey(p => p.HotelId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(p => p.ReservationId).IsUnique();
        builder.HasIndex(p => new { p.HotelId, p.ProcessedAt });
        builder.HasIndex(p => p.UserId);
    }
}

public class ReviewConfiguration : IEntityTypeConfiguration<Review>
{
    public void Configure(EntityTypeBuilder<Review> builder)
    {
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Comment).HasMaxLength(4000);
        builder.Property(r => r.OwnerResponse).HasMaxLength(4000);
        builder.Property(r => r.UserId).IsRequired();

        builder.ToTable(t =>
            t.HasCheckConstraint("CK_Review_Rating", "\"Rating\" BETWEEN 1 AND 5"));

        builder.HasOne(r => r.Hotel)
            .WithMany(h => h.Reviews)
            .HasForeignKey(r => r.HotelId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(r => r.User)
            .WithMany(u => u.Reviews)
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // One review per stay.
        builder.HasOne(r => r.Reservation)
            .WithOne(res => res.Review)
            .HasForeignKey<Review>(r => r.ReservationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(r => r.ReservationId).IsUnique();
        builder.HasIndex(r => r.HotelId);
    }
}
