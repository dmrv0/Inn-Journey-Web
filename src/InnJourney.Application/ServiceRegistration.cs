using System.Reflection;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using InnJourney.Application.Behaviors;
using InnJourney.Application.Common;

namespace InnJourney.Application;

public static class ServiceRegistration
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        var assembly = Assembly.GetExecutingAssembly();

        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(assembly));

        services.AddValidatorsFromAssembly(assembly, includeInternalTypes: true);

        // Validation runs ahead of every handler.
        services.AddTransient(typeof(MediatR.IPipelineBehavior<,>), typeof(ValidationBehavior<,>));

        services.AddScoped<IHotelAccess, HotelAccess>();
        services.AddScoped<IAvailabilityService, AvailabilityService>();

        return services;
    }
}
