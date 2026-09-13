using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using InnJourney.Application.Common;

namespace InnJourney.Services.Api.Middleware;

/// <summary>
/// Translates exceptions into RFC 7807 problem responses.
/// <para>
/// Without this every failure surfaced as an unhandled 500 — including a
/// malformed route id, which reached <c>Guid.Parse</c> and threw.
/// </para>
/// </summary>
public class ExceptionHandlingMiddleware(
    RequestDelegate next,
    ILogger<ExceptionHandlingMiddleware> logger,
    IHostEnvironment environment)
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Exception ex)
        {
            await WriteProblemAsync(context, ex);
        }
    }

    private async Task WriteProblemAsync(HttpContext context, Exception exception)
    {
        if (context.Response.HasStarted)
        {
            logger.LogError(exception, "Response already started; cannot convert this failure to a problem response.");
            throw exception;
        }

        var problem = BuildProblem(exception, context);

        if (problem.Status >= 500)
            logger.LogError(exception, "Unhandled failure on {Method} {Path}.", context.Request.Method, context.Request.Path);
        else
            logger.LogInformation("{Status} on {Method} {Path}: {Message}", problem.Status, context.Request.Method, context.Request.Path, exception.Message);

        problem.Instance = context.Request.Path;
        problem.Extensions["traceId"] = context.TraceIdentifier;

        context.Response.Clear();
        context.Response.StatusCode = problem.Status ?? StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/problem+json";

        // Serialised to a string rather than via WriteAsJsonAsync: that path
        // writes through a PipeWriter, which TestServer's implementation does
        // not fully support.
        var payload = JsonSerializer.Serialize(problem, SerializerOptions);

        await context.Response.WriteAsync(payload);
    }

    private ProblemDetails BuildProblem(Exception exception, HttpContext context) => exception switch
    {
        ValidationException validation => new ValidationProblemDetails(validation.Errors)
        {
            Status = validation.StatusCode,
            Title = validation.Title
        },

        AppException app => new ProblemDetails
        {
            Status = app.StatusCode,
            Title = app.Title,
            Detail = app.Message
        },

        // Malformed route or query values are the caller's mistake, not ours.
        FormatException or OverflowException => new ProblemDetails
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "Malformed request",
            Detail = "One or more values in the request could not be read."
        },

        // 499 is nginx's "client closed request"; ASP.NET Core has no constant for it.
        OperationCanceledException when context.RequestAborted.IsCancellationRequested => new ProblemDetails
        {
            Status = 499,
            Title = "Request cancelled"
        },

        _ => new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "Something went wrong",

            // Stack traces are for the log, not the caller — except in development.
            Detail = environment.IsDevelopment()
                ? exception.ToString()
                : "An unexpected error occurred. The incident has been logged."
        }
    };
}
