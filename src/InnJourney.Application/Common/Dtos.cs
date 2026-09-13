using InnJourney.Domain.Entities;
using InnJourney.Domain.Enums;

namespace InnJourney.Application.Common;

public record AmenityDto(Guid Id, string Name, string? IconUrl, AmenityScope Scope);

public record AddressDto(string Line, string City, string Country, string? PostalCode);

public record HotelImageDto(Guid Id, string Url, string? AltText, int SortOrder, bool IsCover);

public record RoomTypeDto(Guid Id, string Name, string? Description, string? ImageUrl, int DefaultCapacity);

public record RoomDto(
    Guid Id,
    Guid HotelId,
    string Number,
    int Capacity,
    decimal AdultPrice,
    decimal ChildPrice,
    RoomStatus Status,
    RoomTypeDto? RoomType,
    IReadOnlyList<AmenityDto> Amenities);

/// <summary>Summary shape used in search results. Deliberately omits rooms.</summary>
public record HotelSummaryDto(
    Guid Id,
    string Name,
    string? Description,
    int Stars,
    double AverageRating,
    int ReviewCount,
    AddressDto Address,
    string? CoverImageUrl,
    decimal? FromPrice,
    IReadOnlyList<AmenityDto> Amenities);

public record HotelDetailDto(
    Guid Id,
    string Name,
    string? Description,
    string? Phone,
    string? Email,
    string? GoogleMapsUrl,
    int Stars,
    double AverageRating,
    int ReviewCount,
    AddressDto Address,
    IReadOnlyList<HotelImageDto> Images,
    IReadOnlyList<AmenityDto> Amenities,
    IReadOnlyList<RoomDto> Rooms);

public record PaymentDto(
    Guid Id,
    Guid ReservationId,
    decimal Amount,
    PaymentStatus Status,
    PaymentMethod Method,
    string? CardLast4,
    string? FailureReason,
    DateTime ProcessedAt);

public record ReservationDto(
    Guid Id,
    string Reference,
    Guid HotelId,
    string HotelName,
    Guid RoomId,
    string RoomNumber,
    DateOnly CheckIn,
    DateOnly CheckOut,
    int Nights,
    int Adults,
    int Children,
    decimal TotalPrice,
    ReservationStatus Status,
    IReadOnlyCollection<ReservationStatus> AllowedNextStatuses,
    PaymentDto? Payment,
    bool CanReview);

public record ReviewDto(
    Guid Id,
    Guid HotelId,
    string AuthorName,
    int Rating,
    string? Comment,
    string? OwnerResponse,
    DateTime? RespondedAt,
    DateTime? CreatedDate);

public record UserDto(
    string Id,
    string Email,
    string FullName,
    bool EmailConfirmed,
    IReadOnlyList<string> Roles);

/// <summary>
/// Projections from entity to contract. Kept as plain extension methods rather
/// than a mapping library: the shapes are few and explicit mapping keeps the
/// exposed surface obvious at a glance.
/// </summary>
public static class DtoMappings
{
    public static AmenityDto ToDto(this Amenity a) => new(a.Id, a.Name, a.IconUrl, a.Scope);

    public static AddressDto ToDto(this Address a) => new(a.Line, a.City, a.Country, a.PostalCode);

    public static HotelImageDto ToDto(this HotelImage i) => new(i.Id, i.Url, i.AltText, i.SortOrder, i.IsCover);

    public static RoomTypeDto ToDto(this RoomType t) =>
        new(t.Id, t.Name, t.Description, t.ImageUrl, t.DefaultCapacity);

    public static RoomDto ToDto(this Room r) => new(
        r.Id,
        r.HotelId,
        r.Number,
        r.Capacity,
        r.AdultPrice,
        r.ChildPrice,
        r.Status,
        r.RoomType?.ToDto(),
        r.Amenities.Where(a => a.Amenity is not null).Select(a => a.Amenity!.ToDto()).ToList());

    public static HotelSummaryDto ToSummaryDto(this Hotel h) => new(
        h.Id,
        h.Name,
        h.Description,
        h.Stars,
        h.AverageRating,
        h.ReviewCount,
        h.Address.ToDto(),
        h.Images.FirstOrDefault(i => i.IsCover)?.Url ?? h.Images.OrderBy(i => i.SortOrder).FirstOrDefault()?.Url,
        h.Rooms.Count == 0 ? null : h.Rooms.Min(r => r.AdultPrice),
        h.Amenities.Where(a => a.Amenity is not null).Select(a => a.Amenity!.ToDto()).ToList());

    public static HotelDetailDto ToDetailDto(this Hotel h) => new(
        h.Id,
        h.Name,
        h.Description,
        h.Phone,
        h.Email,
        h.GoogleMapsUrl,
        h.Stars,
        h.AverageRating,
        h.ReviewCount,
        h.Address.ToDto(),
        h.Images.OrderBy(i => i.SortOrder).Select(i => i.ToDto()).ToList(),
        h.Amenities.Where(a => a.Amenity is not null).Select(a => a.Amenity!.ToDto()).ToList(),
        h.Rooms.OrderBy(r => r.Number).Select(r => r.ToDto()).ToList());

    public static PaymentDto ToDto(this Payment p) => new(
        p.Id, p.ReservationId, p.Amount, p.Status, p.Method, p.CardLast4, p.FailureReason, p.ProcessedAt);

    public static ReservationDto ToDto(this Reservation r) => new(
        r.Id,
        r.Reference,
        r.HotelId,
        r.Hotel?.Name ?? string.Empty,
        r.RoomId,
        r.Room?.Number ?? string.Empty,
        r.CheckIn,
        r.CheckOut,
        r.Nights,
        r.Adults,
        r.Children,
        r.TotalPrice,
        r.Status,
        ReservationStatusTransitions.NextFrom(r.Status),
        r.Payment?.ToDto(),
        r.Status == ReservationStatus.CheckedOut && r.Review is null);

    public static ReviewDto ToDto(this Review r) => new(
        r.Id,
        r.HotelId,
        r.User?.FullName ?? "Guest",
        r.Rating,
        r.Comment,
        r.OwnerResponse,
        r.RespondedAt,
        r.CreatedDate);
}
