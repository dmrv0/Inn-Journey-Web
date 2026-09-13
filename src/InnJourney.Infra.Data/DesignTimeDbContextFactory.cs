using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using InnJourney.Infra.Data.Contexts;

namespace InnJourney.Infra.Data;

/// <summary>
/// Used only by <c>dotnet ef</c> at design time. The connection string comes from
/// the environment so no credentials need to live in a committed file; the value
/// is never used at runtime, where the real string is injected via configuration.
/// </summary>
public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<InnJourneyDbContext>
{
    private const string FallbackConnection =
        "Host=localhost;Port=5432;Database=inn_journey;Username=postgres;Password=postgres";

    public InnJourneyDbContext CreateDbContext(string[] args)
    {
        var connectionString =
            Environment.GetEnvironmentVariable("ConnectionStrings__PostgreSQL")
            ?? FallbackConnection;

        var options = new DbContextOptionsBuilder<InnJourneyDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new InnJourneyDbContext(options);
    }
}
