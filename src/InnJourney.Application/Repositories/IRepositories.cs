using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using InnJourney.Domain.Entities;
using InnJourney.Domain.Entities.Common;

namespace InnJourney.Application.Repositories;

public interface IRepository<T> where T : BaseEntity
{
    DbSet<T> Table { get; }
}

public interface IReadRepository<T> : IRepository<T> where T : BaseEntity
{
    IQueryable<T> GetAll(bool tracking = false);

    IQueryable<T> GetWhere(Expression<Func<T, bool>> predicate, bool tracking = false);

    Task<T?> GetSingleAsync(Expression<Func<T, bool>> predicate, bool tracking = false,
        CancellationToken cancellationToken = default);

    Task<T?> GetByIdAsync(Guid id, bool tracking = false, CancellationToken cancellationToken = default);

    Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate, CancellationToken cancellationToken = default);
}

public interface IWriteRepository<T> : IRepository<T> where T : BaseEntity
{
    Task AddAsync(T entity, CancellationToken cancellationToken = default);

    Task AddRangeAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default);

    void Update(T entity);

    /// <summary>Flips the soft-delete flag. The DbContext stamps DeletedDate on save.</summary>
    void SoftDelete(T entity);

    void HardDelete(T entity);

    Task<int> SaveAsync(CancellationToken cancellationToken = default);
}

public interface IHotelReadRepository : IReadRepository<Hotel>;
public interface IHotelWriteRepository : IWriteRepository<Hotel>;

public interface IHotelImageReadRepository : IReadRepository<HotelImage>;
public interface IHotelImageWriteRepository : IWriteRepository<HotelImage>;

public interface IRoomReadRepository : IReadRepository<Room>;
public interface IRoomWriteRepository : IWriteRepository<Room>;

public interface IRoomTypeReadRepository : IReadRepository<RoomType>;
public interface IRoomTypeWriteRepository : IWriteRepository<RoomType>;

public interface IAmenityReadRepository : IReadRepository<Amenity>;
public interface IAmenityWriteRepository : IWriteRepository<Amenity>;

public interface IReservationReadRepository : IReadRepository<Reservation>;
public interface IReservationWriteRepository : IWriteRepository<Reservation>;

public interface IPaymentReadRepository : IReadRepository<Payment>;
public interface IPaymentWriteRepository : IWriteRepository<Payment>;

public interface IReviewReadRepository : IReadRepository<Review>;
public interface IReviewWriteRepository : IWriteRepository<Review>;
