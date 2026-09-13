using System.Data;
using Microsoft.EntityFrameworkCore;
using InnJourney.Application.Abstractions;
using InnJourney.Infra.Data.Contexts;

namespace InnJourney.Infra.Data;

public class UnitOfWork(InnJourneyDbContext context) : IUnitOfWork
{
    public async Task<T> ExecuteInTransactionAsync<T>(
        Func<CancellationToken, Task<T>> operation,
        CancellationToken cancellationToken = default)
    {
        // Retrying execution strategies own the transaction boundary, so the
        // whole block has to be handed to the strategy rather than wrapped
        // around it. Without this, enabling retry-on-failure throws at runtime.
        var strategy = context.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync(async ct =>
        {
            await using var transaction =
                await context.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

            try
            {
                var result = await operation(ct);
                await transaction.CommitAsync(ct);
                return result;
            }
            catch
            {
                await transaction.RollbackAsync(ct);
                throw;
            }
        }, cancellationToken);
    }
}
