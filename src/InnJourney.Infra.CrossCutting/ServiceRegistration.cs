using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using InnJourney.Application.Abstractions;
using InnJourney.Infra.CrossCutting.Options;
using InnJourney.Infra.CrossCutting.Services;

namespace InnJourney.Infra.CrossCutting;

public static class ServiceRegistration
{
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services, IConfiguration configuration)
    {
        // Validated on first resolve and at startup, so a missing signing key
        // fails loudly rather than producing unverifiable tokens.
        services.AddOptions<JwtOptions>()
            .Bind(configuration.GetSection(JwtOptions.SectionName))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.Configure<StorageOptions>(configuration.GetSection(StorageOptions.SectionName));
        services.Configure<EmailOptions>(configuration.GetSection(EmailOptions.SectionName));

        services.AddHttpContextAccessor();

        services.AddScoped<ICurrentUser, CurrentUser>();
        services.AddSingleton<ITokenHandler, TokenHandler>();
        services.AddSingleton<IClock, SystemClock>();
        services.AddScoped<IPaymentGateway, SimulatedPaymentGateway>();
        services.AddScoped<IFileStorage, LocalFileStorage>();
        services.AddScoped<IEmailSender, SmtpEmailSender>();

        return services;
    }
}
