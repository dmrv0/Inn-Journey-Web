namespace InnJourney.Application.Abstractions;

/// <summary>
/// Runs work inside a serializable transaction.
/// <para>
/// Booking needs this: availability is re-checked and the reservation inserted
/// atomically, so two simultaneous requests for the same room and span cannot
/// both observe the room as free and both succeed.
/// </para>
/// </summary>
public interface IUnitOfWork
{
    Task<T> ExecuteInTransactionAsync<T>(
        Func<CancellationToken, Task<T>> operation,
        CancellationToken cancellationToken = default);
}
