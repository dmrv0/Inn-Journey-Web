using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using InnJourney.Application.Repositories;
using InnJourney.Domain.Entities;
using InnJourney.Domain.Entities.Common;
using InnJourney.Infra.Data.Contexts;

namespace InnJourney.Infra.Data.Repositories;

public class ReadRepository<T>(InnJourneyDbContext context) : IReadRepository<T>
    where T : BaseEntity
{
    protected InnJourneyDbContext Context { get; } = context;

    public DbSet<T> Table => Context.Set<T>();

    public IQueryable<T> GetAll(bool tracking = false) =>
        tracking ? Table : Table.AsNoTracking();

    public IQueryable<T> GetWhere(Expression<Func<T, bool>> predicate, bool tracking = false) =>
        GetAll(tracking).Where(predicate);

    public Task<T?> GetSingleAsync(Expression<Func<T, bool>> predicate, bool tracking = false,
        CancellationToken cancellationToken = default) =>
        GetAll(tracking).FirstOrDefaultAsync(predicate, cancellationToken);

    public Task<T?> GetByIdAsync(Guid id, bool tracking = false, CancellationToken cancellationToken = default) =>
        GetAll(tracking).FirstOrDefaultAsync(e => e.Id == id, cancellationToken);

    public Task<bool> ExistsAsync(Expression<Func<T, bool>> predicate,
        CancellationToken cancellationToken = default) =>
        Table.AnyAsync(predicate, cancellationToken);
}

public class WriteRepository<T>(InnJourneyDbContext context) : IWriteRepository<T>
    where T : BaseEntity
{
    protected InnJourneyDbContext Context { get; } = context;

    public DbSet<T> Table => Context.Set<T>();

    public async Task AddAsync(T entity, CancellationToken cancellationToken = default) =>
        await Table.AddAsync(entity, cancellationToken);

    public async Task AddRangeAsync(IEnumerable<T> entities, CancellationToken cancellationToken = default) =>
        await Table.AddRangeAsync(entities, cancellationToken);

    public void Update(T entity) => Table.Update(entity);

    public void SoftDelete(T entity)
    {
        entity.Deleted = true;
        Table.Update(entity);
    }

    public void HardDelete(T entity) => Table.Remove(entity);

    public Task<int> SaveAsync(CancellationToken cancellationToken = default) =>
        Context.SaveChangesAsync(cancellationToken);
}

public class HotelReadRepository(InnJourneyDbContext c) : ReadRepository<Hotel>(c), IHotelReadRepository;
public class HotelWriteRepository(InnJourneyDbContext c) : WriteRepository<Hotel>(c), IHotelWriteRepository;

public class HotelImageReadRepository(InnJourneyDbContext c) : ReadRepository<HotelImage>(c), IHotelImageReadRepository;
public class HotelImageWriteRepository(InnJourneyDbContext c) : WriteRepository<HotelImage>(c), IHotelImageWriteRepository;

public class RoomReadRepository(InnJourneyDbContext c) : ReadRepository<Room>(c), IRoomReadRepository;
public class RoomWriteRepository(InnJourneyDbContext c) : WriteRepository<Room>(c), IRoomWriteRepository;

public class RoomTypeReadRepository(InnJourneyDbContext c) : ReadRepository<RoomType>(c), IRoomTypeReadRepository;
public class RoomTypeWriteRepository(InnJourneyDbContext c) : WriteRepository<RoomType>(c), IRoomTypeWriteRepository;

public class AmenityReadRepository(InnJourneyDbContext c) : ReadRepository<Amenity>(c), IAmenityReadRepository;
public class AmenityWriteRepository(InnJourneyDbContext c) : WriteRepository<Amenity>(c), IAmenityWriteRepository;

public class ReservationReadRepository(InnJourneyDbContext c) : ReadRepository<Reservation>(c), IReservationReadRepository;
public class ReservationWriteRepository(InnJourneyDbContext c) : WriteRepository<Reservation>(c), IReservationWriteRepository;

public class PaymentReadRepository(InnJourneyDbContext c) : ReadRepository<Payment>(c), IPaymentReadRepository;
public class PaymentWriteRepository(InnJourneyDbContext c) : WriteRepository<Payment>(c), IPaymentWriteRepository;

public class ReviewReadRepository(InnJourneyDbContext c) : ReadRepository<Review>(c), IReviewReadRepository;
public class ReviewWriteRepository(InnJourneyDbContext c) : WriteRepository<Review>(c), IReviewWriteRepository;
