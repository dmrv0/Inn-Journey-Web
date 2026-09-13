using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using InnJourney.Application.Abstractions;
using InnJourney.Application.Common;
using InnJourney.Application.Repositories;
using InnJourney.Domain.Entities;
using InnJourney.Domain.Enums;

namespace InnJourney.Application.Features.Reviews;

/// <summary>
/// Publishes a review of a completed stay.
/// <para>
/// A review has to be earned: it requires a checked-out reservation belonging to
/// the author, and each stay yields at most one. That is what makes the
/// published rating a statement about people who actually stayed.
/// </para>
/// </summary>
public class CreateReviewCommand : IRequest<ReviewDto>
{
    public Guid ReservationId { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
}

public class CreateReviewCommandValidator : AbstractValidator<CreateReviewCommand>
{
    public CreateReviewCommandValidator()
    {
        RuleFor(x => x.ReservationId).NotEmpty();
        RuleFor(x => x.Rating).InclusiveBetween(1, 5);
        RuleFor(x => x.Comment).MaximumLength(4000);
    }
}

public class CreateReviewCommandHandler(
    IReviewWriteRepository reviews,
    IReviewReadRepository reviewReads,
    IReservationReadRepository reservations,
    IHotelWriteRepository hotels,
    IHotelReadRepository hotelReads,
    ICurrentUser currentUser)
    : IRequestHandler<CreateReviewCommand, ReviewDto>
{
    public async Task<ReviewDto> Handle(CreateReviewCommand request, CancellationToken cancellationToken)
    {
        var userId = currentUser.RequireUserId();

        var reservation = await reservations.GetByIdAsync(request.ReservationId, cancellationToken: cancellationToken)
                          ?? throw NotFoundException.For<Reservation>(request.ReservationId);

        if (!string.Equals(reservation.UserId, userId, StringComparison.Ordinal))
            throw new ForbiddenException("You can only review your own stays.");

        if (reservation.Status != ReservationStatus.CheckedOut)
            throw new ConflictException("You can review a stay once it is complete.");

        if (await reviewReads.ExistsAsync(r => r.ReservationId == reservation.Id, cancellationToken))
            throw new ConflictException("You have already reviewed this stay.");

        var review = new Review
        {
            Id = Guid.NewGuid(),
            HotelId = reservation.HotelId,
            UserId = userId,
            ReservationId = reservation.Id,
            Rating = request.Rating,
            Comment = request.Comment?.Trim()
        };

        await reviews.AddAsync(review, cancellationToken);
        await reviews.SaveAsync(cancellationToken);

        await RecalculateRatingAsync(reservation.HotelId, cancellationToken);

        var saved = await reviewReads.GetAll()
            .Include(r => r.User)
            .FirstAsync(r => r.Id == review.Id, cancellationToken);

        return saved.ToDto();
    }

    /// <summary>
    /// Recomputes the hotel's published rating. <c>AverageRating</c> and
    /// <c>ReviewCount</c> are derived values; nothing else writes them.
    /// </summary>
    private async Task RecalculateRatingAsync(Guid hotelId, CancellationToken cancellationToken)
    {
        var stats = await reviewReads.GetWhere(r => r.HotelId == hotelId)
            .GroupBy(_ => 1)
            .Select(g => new { Average = g.Average(r => (double)r.Rating), Count = g.Count() })
            .FirstOrDefaultAsync(cancellationToken);

        var hotel = await hotelReads.GetByIdAsync(hotelId, tracking: true, cancellationToken);

        if (hotel is null)
            return;

        hotel.AverageRating = stats is null ? 0 : Math.Round(stats.Average, 2);
        hotel.ReviewCount = stats?.Count ?? 0;

        hotels.Update(hotel);
        await hotels.SaveAsync(cancellationToken);
    }
}

public class GetHotelReviewsQuery : PagedRequest, IRequest<PagedResult<ReviewDto>>
{
    public Guid HotelId { get; set; }
}

public class GetHotelReviewsQueryHandler(IReviewReadRepository reviews)
    : IRequestHandler<GetHotelReviewsQuery, PagedResult<ReviewDto>>
{
    public async Task<PagedResult<ReviewDto>> Handle(
        GetHotelReviewsQuery request, CancellationToken cancellationToken)
    {
        var query = reviews.GetWhere(r => r.HotelId == request.HotelId)
            .Include(r => r.User)
            .OrderByDescending(r => r.CreatedDate);

        var page = await query.ToPagedResultAsync(request.Page, request.PageSize, cancellationToken);

        return page.Map(r => r.ToDto());
    }
}

public class GetMyReviewsQuery : PagedRequest, IRequest<PagedResult<ReviewDto>>;

public class GetMyReviewsQueryHandler(IReviewReadRepository reviews, ICurrentUser currentUser)
    : IRequestHandler<GetMyReviewsQuery, PagedResult<ReviewDto>>
{
    public async Task<PagedResult<ReviewDto>> Handle(
        GetMyReviewsQuery request, CancellationToken cancellationToken)
    {
        var userId = currentUser.RequireUserId();

        var query = reviews.GetWhere(r => r.UserId == userId)
            .Include(r => r.User)
            .OrderByDescending(r => r.CreatedDate);

        var page = await query.ToPagedResultAsync(request.Page, request.PageSize, cancellationToken);

        return page.Map(r => r.ToDto());
    }
}

/// <summary>The hotel owner's single reply to a review.</summary>
public class RespondToReviewCommand : IRequest<ReviewDto>
{
    public Guid ReviewId { get; set; }
    public string Response { get; set; } = string.Empty;
}

public class RespondToReviewCommandValidator : AbstractValidator<RespondToReviewCommand>
{
    public RespondToReviewCommandValidator()
    {
        RuleFor(x => x.ReviewId).NotEmpty();
        RuleFor(x => x.Response).NotEmpty().MaximumLength(4000);
    }
}

public class RespondToReviewCommandHandler(
    IReviewReadRepository reviewReads,
    IReviewWriteRepository reviews,
    IHotelAccess hotelAccess,
    IClock clock)
    : IRequestHandler<RespondToReviewCommand, ReviewDto>
{
    public async Task<ReviewDto> Handle(RespondToReviewCommand request, CancellationToken cancellationToken)
    {
        var review = await reviewReads.GetAll(tracking: true)
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Id == request.ReviewId, cancellationToken)
            ?? throw NotFoundException.For<Review>(request.ReviewId);

        await hotelAccess.EnsureCanManageAsync(review.HotelId, cancellationToken);

        if (!string.IsNullOrWhiteSpace(review.OwnerResponse))
            throw new ConflictException("This review already has a reply.");

        review.OwnerResponse = request.Response.Trim();
        review.RespondedAt = clock.UtcNow;

        reviews.Update(review);
        await reviews.SaveAsync(cancellationToken);

        return review.ToDto();
    }
}

public class DeleteReviewCommand(Guid id) : IRequest<Unit>
{
    public Guid Id { get; } = id;
}

public class DeleteReviewCommandHandler(
    IReviewReadRepository reviewReads,
    IReviewWriteRepository reviews,
    ICurrentUser currentUser)
    : IRequestHandler<DeleteReviewCommand, Unit>
{
    public async Task<Unit> Handle(DeleteReviewCommand request, CancellationToken cancellationToken)
    {
        var review = await reviewReads.GetByIdAsync(request.Id, tracking: true, cancellationToken)
                     ?? throw NotFoundException.For<Review>(request.Id);

        var userId = currentUser.RequireUserId();
        var isAuthor = string.Equals(review.UserId, userId, StringComparison.Ordinal);

        // The author may withdraw their review; an administrator may remove any.
        if (!isAuthor && !currentUser.IsInRole(Domain.Entities.Identity.Roles.Admin))
            throw new ForbiddenException("You can only remove your own review.");

        reviews.SoftDelete(review);
        await reviews.SaveAsync(cancellationToken);

        return Unit.Value;
    }
}
