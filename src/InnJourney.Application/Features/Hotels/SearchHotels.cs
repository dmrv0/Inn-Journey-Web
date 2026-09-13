using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using InnJourney.Application.Common;
using InnJourney.Application.Repositories;
using InnJourney.Domain.Entities;

namespace InnJourney.Application.Features.Hotels;

/// <summary>
/// Paged, filtered hotel search. Anonymous.
/// <para>
/// Replaces an endpoint that returned every hotel in the database with no
/// filtering, paging, or ordering of any kind.
/// </para>
/// </summary>
public class SearchHotelsQuery : PagedRequest, IRequest<PagedResult<HotelSummaryDto>>
{
    /// <summary>Free text matched against hotel name and description.</summary>
    public string? Query { get; set; }

    public string? City { get; set; }

    /// <summary>When both dates are supplied, only hotels with a free room are returned.</summary>
    public DateOnly? CheckIn { get; set; }

    public DateOnly? CheckOut { get; set; }

    public int Guests { get; set; } = 1;

    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }

    public int? MinStars { get; set; }
    public double? MinRating { get; set; }

    public Guid[]? AmenityIds { get; set; }
}

public class SearchHotelsQueryValidator : AbstractValidator<SearchHotelsQuery>
{
    public SearchHotelsQueryValidator()
    {
        RuleFor(x => x.Guests).InclusiveBetween(1, 20);
        RuleFor(x => x.MinStars).InclusiveBetween(1, 5).When(x => x.MinStars.HasValue);
        RuleFor(x => x.MinRating).InclusiveBetween(0, 5).When(x => x.MinRating.HasValue);
        RuleFor(x => x.MinPrice).GreaterThanOrEqualTo(0).When(x => x.MinPrice.HasValue);

        RuleFor(x => x.MaxPrice)
            .GreaterThanOrEqualTo(x => x.MinPrice!.Value)
            .When(x => x is { MinPrice: not null, MaxPrice: not null })
            .WithMessage("The maximum price must be at least the minimum price.");

        RuleFor(x => x.CheckOut)
            .GreaterThan(x => x.CheckIn!.Value)
            .When(x => x is { CheckIn: not null, CheckOut: not null })
            .WithMessage("Check-out must be later than check-in.");

        RuleFor(x => x.CheckOut)
            .NotNull()
            .When(x => x.CheckIn is not null)
            .WithMessage("Provide both dates, or neither.");

        RuleFor(x => x.CheckIn)
            .NotNull()
            .When(x => x.CheckOut is not null)
            .WithMessage("Provide both dates, or neither.");
    }
}

public class SearchHotelsQueryHandler(
    IHotelReadRepository hotels,
    IAvailabilityService availability)
    : IRequestHandler<SearchHotelsQuery, PagedResult<HotelSummaryDto>>
{
    public async Task<PagedResult<HotelSummaryDto>> Handle(
        SearchHotelsQuery request, CancellationToken cancellationToken)
    {
        var query = hotels.GetAll()
            .Include(h => h.Images)
            .Include(h => h.Rooms)
            .Include(h => h.Amenities).ThenInclude(a => a.Amenity)
            .AsQueryable();

        // Case-insensitive matching is expressed with ToLower rather than the
        // Npgsql-only EF.Functions.ILike, so the Application layer stays
        // provider-agnostic and handler tests can run against SQLite.
        if (!string.IsNullOrWhiteSpace(request.Query))
        {
            var term = request.Query.Trim().ToLowerInvariant();
            query = query.Where(h =>
                h.Name.ToLower().Contains(term) ||
                (h.Description != null && h.Description.ToLower().Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(request.City))
        {
            var city = request.City.Trim().ToLowerInvariant();
            query = query.Where(h => h.Address.City.ToLower() == city);
        }

        if (request.MinStars is { } minStars)
            query = query.Where(h => h.Stars >= minStars);

        if (request.MinRating is { } minRating)
            query = query.Where(h => h.AverageRating >= minRating);

        // Price filters apply to the cheapest room that can hold the party.
        if (request.MinPrice is { } minPrice)
            query = query.Where(h => h.Rooms.Any(r => r.AdultPrice >= minPrice));

        if (request.MaxPrice is { } maxPrice)
            query = query.Where(h => h.Rooms.Any(r => r.AdultPrice <= maxPrice));

        if (request.Guests > 1)
            query = query.Where(h => h.Rooms.Any(r => r.Capacity >= request.Guests));

        if (request.AmenityIds is { Length: > 0 } amenityIds)
        {
            // Every requested amenity must be present, not just any of them.
            query = query.Where(h => amenityIds.All(id => h.Amenities.Any(a => a.AmenityId == id)));
        }

        if (request is { CheckIn: { } from, CheckOut: { } to })
        {
            var availableIds = await availability
                .GetHotelIdsWithAvailabilityAsync(from, to, request.Guests, cancellationToken);

            query = query.Where(h => availableIds.Contains(h.Id));
        }

        query = ApplySort(query, request.Sort);

        var page = await query.ToPagedResultAsync(request.Page, request.PageSize, cancellationToken);

        return page.Map(h => h.ToSummaryDto());
    }

    private static IQueryable<Hotel> ApplySort(IQueryable<Hotel> query, string? sort) => sort switch
    {
        "price_asc" => query.OrderBy(h => h.Rooms.Min(r => (decimal?)r.AdultPrice) ?? decimal.MaxValue),
        "price_desc" => query.OrderByDescending(h => h.Rooms.Min(r => (decimal?)r.AdultPrice) ?? 0),
        "rating_desc" => query.OrderByDescending(h => h.AverageRating).ThenByDescending(h => h.ReviewCount),
        "stars_desc" => query.OrderByDescending(h => h.Stars).ThenByDescending(h => h.AverageRating),
        "name_asc" => query.OrderBy(h => h.Name),
        _ => query.OrderByDescending(h => h.AverageRating).ThenBy(h => h.Name)
    };
}
