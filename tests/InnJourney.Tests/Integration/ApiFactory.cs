using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using InnJourney.Application.Abstractions;
using InnJourney.Application.Features.Auth;
using InnJourney.Domain.Entities.Identity;
using InnJourney.Infra.CrossCutting.Services;
using InnJourney.Infra.Data.Contexts;

namespace InnJourney.Tests.Integration;

/// <summary>
/// Boots the real application — the actual middleware pipeline, DI graph,
/// authentication, and routing — against an isolated SQLite database.
/// <para>
/// This is what proves authorization is enforced. Reading the attributes off the
/// controllers proves only that someone typed them.
/// </para>
/// </summary>
public class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly SqliteConnection _connection = new("DataSource=:memory:");

    public RecordingEmailSender Emails { get; } = new();

    static ApiFactory()
    {
        // Under the minimal hosting model the factory's own configuration
        // callbacks are applied only after Program.cs has finished executing, so
        // anything Program reads directly must come from the environment.
        var settings = new Dictionary<string, string>
        {
            ["Jwt__Issuer"] = "inn-journey-tests",
            ["Jwt__Audience"] = "inn-journey-tests",
            ["Jwt__SigningKey"] = "integration-test-signing-key-at-least-32-bytes-long",
            ["Jwt__AccessTokenMinutes"] = "30",
            ["Jwt__RefreshTokenDays"] = "7",

            // The schema is created directly; the migrations are Postgres-shaped.
            ["Database__MigrateOnStartup"] = "false",
            ["Database__SeedOnStartup"] = "false",

            // The limiter itself is exercised by its own test; every other test
            // would otherwise trip it while creating accounts.
            ["RateLimiting__AuthPermitsPerMinute"] = "10000",
            ["RateLimiting__GlobalPermitsPerMinute"] = "100000"
        };

        foreach (var (key, value) in settings)
            Environment.SetEnvironmentVariable(key, value);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<InnJourneyDbContext>>();
            services.RemoveAll<DbContextOptions>();
            services.RemoveAll<InnJourneyDbContext>();

            _connection.Open();

            services.AddDbContext<InnJourneyDbContext>(options => options.UseSqlite(_connection));

            // Capture mail rather than attempting SMTP.
            services.RemoveAll<IEmailSender>();
            services.AddSingleton<IEmailSender>(Emails);
        });
    }

    public async Task InitializeAsync()
    {
        using var scope = Services.CreateScope();

        var context = scope.ServiceProvider.GetRequiredService<InnJourneyDbContext>();
        await context.Database.EnsureCreatedAsync();

        var roleManager = scope.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.Identity.RoleManager<AppRole>>();

        foreach (var role in Roles.All)
        {
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new AppRole(role));
        }
    }

    /// <summary>Registers an account and returns a client already carrying its token.</summary>
    public async Task<(HttpClient Client, AuthResponse Auth)> SignUpAsync(string role, string? email = null)
    {
        var client = CreateClient();
        email ??= $"{Guid.NewGuid():N}@test.dev";

        var response = await client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email,
            password = "Passw0rd!",
            fullName = "Test Person",
            role
        });

        response.EnsureSuccessStatusCode();

        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>()
                   ?? throw new InvalidOperationException("Registration returned no body.");

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        return (client, auth);
    }

    /// <summary>Signs in an existing account and returns a client carrying its token.</summary>
    public async Task<HttpClient> SignInAsync(string email, string password = "Passw0rd!")
    {
        var client = CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        response.EnsureSuccessStatusCode();

        var auth = await response.Content.ReadFromJsonAsync<AuthResponse>()
                   ?? throw new InvalidOperationException("Login returned no body.");

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", auth.AccessToken);

        return client;
    }

    /// <summary>
    /// Grants the administrator role directly. Registration deliberately refuses
    /// to do this, so tests needing an admin go around the public surface.
    /// </summary>
    public async Task PromoteToAdminAsync(string userId)
    {
        using var scope = Services.CreateScope();

        var users = scope.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.Identity.UserManager<AppUser>>();

        var user = await users.FindByIdAsync(userId)
                   ?? throw new InvalidOperationException($"No user '{userId}'.");

        await users.AddToRoleAsync(user, Roles.Admin);
    }

    public new async Task DisposeAsync()
    {
        await _connection.DisposeAsync();
        await base.DisposeAsync();
    }
}
