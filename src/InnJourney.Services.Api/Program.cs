using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using InnJourney.Services.Api.Middleware;
using InnJourney.Application;
using InnJourney.Domain.Entities.Identity;
using InnJourney.Infra.CrossCutting;
using InnJourney.Infra.CrossCutting.Options;
using InnJourney.Infra.Data;
using InnJourney.Infra.Data.Seeding;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .Enrich.FromLogContext());

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Enums travel as names, so clients read "Confirmed" rather than 1.
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Inn Journey API",
        Version = "v1",
        Description = "Hotel search, booking, and property management."
    });

    // Without this, no protected endpoint can be exercised from the Swagger UI.
    var scheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste the access token returned by /api/v1/auth/login.",
        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
    };

    options.AddSecurityDefinition("Bearer", scheme);
    options.AddSecurityRequirement(new OpenApiSecurityRequirement { [scheme] = [] });

    var xmlFile = Path.Combine(AppContext.BaseDirectory,
        $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml");

    if (File.Exists(xmlFile))
        options.IncludeXmlComments(xmlFile);
});

builder.Services.AddPersistenceServices(builder.Configuration);
builder.Services.AddInfrastructureServices(builder.Configuration);
builder.Services.AddApplicationServices();

var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>()
          ?? throw new InvalidOperationException("The Jwt configuration section is missing.");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),

            // Tokens expire when they say they do.
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy(Policies.Traveller, policy => policy.RequireRole(Roles.Traveller, Roles.Admin))
    .AddPolicy(Policies.HotelOwner, policy => policy.RequireRole(Roles.HotelOwner, Roles.Admin))
    .AddPolicy(Policies.Admin, policy => policy.RequireRole(Roles.Admin));

var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                  ?? ["http://localhost:4200"];

builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .WithOrigins(corsOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()));

// Configurable so deployments can tune them, and so the test host can lift them.
var authPermits = builder.Configuration.GetValue("RateLimiting:AuthPermitsPerMinute", 10);
var globalPermits = builder.Configuration.GetValue("RateLimiting:GlobalPermitsPerMinute", 300);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddFixedWindowLimiter(RateLimitPolicies.Authentication, limiter =>
    {
        // Tight enough to blunt credential stuffing without troubling a real user.
        limiter.PermitLimit = authPermits;
        limiter.Window = TimeSpan.FromMinutes(1);
        limiter.QueueLimit = 0;
    });

    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        RateLimitPartition.GetFixedWindowLimiter(
            context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = globalPermits,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

var healthChecks = builder.Services.AddHealthChecks();

// Only probe the database when a connection string is actually configured, so a
// misconfigured or test host fails on its own terms rather than here.
if (builder.Configuration.GetConnectionString("PostgreSQL") is { Length: > 0 } healthConnection
    && !healthConnection.TrimStart().StartsWith("Data Source=", StringComparison.OrdinalIgnoreCase))
    healthChecks.AddNpgSql(healthConnection, name: "database");

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options => options.SwaggerEndpoint("/swagger/v1/swagger.json", "Inn Journey API v1"));
}

app.UseMiddleware<ExceptionHandlingMiddleware>();

app.UseSerilogRequestLogging();

if (!app.Environment.IsDevelopment())
    app.UseHttpsRedirection();

// Uploaded images are served from here.
app.UseStaticFiles();

app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

await MigrateAndSeedAsync(app);

app.Run();

static async Task MigrateAndSeedAsync(WebApplication app)
{
    if (!app.Configuration.GetValue("Database:MigrateOnStartup", true))
        return;

    using var scope = app.Services.CreateScope();

    var context = scope.ServiceProvider
        .GetRequiredService<InnJourney.Infra.Data.Contexts.InnJourneyDbContext>();

    // The migrations are generated against Npgsql, so they cannot be replayed on
    // SQLite; there the model builds the schema directly.
    if (context.Database.ProviderName?.Contains("Sqlite", StringComparison.OrdinalIgnoreCase) == true)
        await context.Database.EnsureCreatedAsync();
    else
        await context.Database.MigrateAsync();

    if (app.Configuration.GetValue("Database:SeedOnStartup", true))
        await scope.ServiceProvider.GetRequiredService<DatabaseSeeder>().SeedAsync();
}

/// <summary>Authorization policy names, so controllers never repeat role strings.</summary>
public static class Policies
{
    public const string Traveller = nameof(Traveller);
    public const string HotelOwner = nameof(HotelOwner);
    public const string Admin = nameof(Admin);
}

public static class RateLimitPolicies
{
    public const string Authentication = nameof(Authentication);
}

/// <summary>Exposed so the integration tests can build a host from this configuration.</summary>
public partial class Program;
