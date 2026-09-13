using Microsoft.AspNetCore.Identity;
using InnJourney.Application.Abstractions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using InnJourney.Application.Repositories;
using InnJourney.Domain.Entities.Identity;
using InnJourney.Infra.Data.Contexts;
using InnJourney.Infra.Data.Repositories;
using InnJourney.Infra.Data.Seeding;

namespace InnJourney.Infra.Data;

public static class ServiceRegistration
{
    public static IServiceCollection AddPersistenceServices(
        this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("PostgreSQL")
            ?? throw new InvalidOperationException(
                "Connection string 'PostgreSQL' is not configured. Set ConnectionStrings__PostgreSQL " +
                "as an environment variable or via dotnet user-secrets.");

        // PostgreSQL is the deployment target. A "Data Source=" string selects
        // SQLite instead, which is what makes the application runnable — seeded
        // and end to end — on a machine with no database server on it.
        var isSqlite = connectionString.TrimStart()
            .StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase);

        services.AddDbContext<InnJourneyDbContext>(options =>
        {
            if (isSqlite)
                options.UseSqlite(connectionString);
            else
                options.UseNpgsql(connectionString, npgsql => npgsql.EnableRetryOnFailure());
        });

        // AddIdentityCore, not AddIdentity: the latter registers cookie
        // authentication and sets DefaultAuthenticateScheme to
        // Identity.Application, which overrides the bearer scheme and makes the
        // API answer every authenticated request with a redirect to a login page
        // this application does not have.
        services.AddIdentityCore<AppUser>(options =>
            {
                options.Password.RequiredLength = 8;
                options.Password.RequireNonAlphanumeric = false;
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = true;

                options.User.RequireUniqueEmail = true;

                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);

                options.SignIn.RequireConfirmedEmail = false;
            })
            .AddRoles<AppRole>()
            .AddRoleManager<RoleManager<AppRole>>()
            .AddEntityFrameworkStores<InnJourneyDbContext>()
            .AddDefaultTokenProviders();

        services.AddScoped<DatabaseSeeder>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        return services.AddRepositories();
    }

    private static IServiceCollection AddRepositories(this IServiceCollection services)
    {
        services.AddScoped<IHotelReadRepository, HotelReadRepository>();
        services.AddScoped<IHotelWriteRepository, HotelWriteRepository>();
        services.AddScoped<IHotelImageReadRepository, HotelImageReadRepository>();
        services.AddScoped<IHotelImageWriteRepository, HotelImageWriteRepository>();
        services.AddScoped<IRoomReadRepository, RoomReadRepository>();
        services.AddScoped<IRoomWriteRepository, RoomWriteRepository>();
        services.AddScoped<IRoomTypeReadRepository, RoomTypeReadRepository>();
        services.AddScoped<IRoomTypeWriteRepository, RoomTypeWriteRepository>();
        services.AddScoped<IAmenityReadRepository, AmenityReadRepository>();
        services.AddScoped<IAmenityWriteRepository, AmenityWriteRepository>();
        services.AddScoped<IReservationReadRepository, ReservationReadRepository>();
        services.AddScoped<IReservationWriteRepository, ReservationWriteRepository>();
        services.AddScoped<IPaymentReadRepository, PaymentReadRepository>();
        services.AddScoped<IPaymentWriteRepository, PaymentWriteRepository>();
        services.AddScoped<IReviewReadRepository, ReviewReadRepository>();
        services.AddScoped<IReviewWriteRepository, ReviewWriteRepository>();

        return services;
    }
}
