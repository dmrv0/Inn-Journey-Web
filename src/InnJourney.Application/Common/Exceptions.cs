namespace InnJourney.Application.Common;

/// <summary>
/// Base for exceptions the API knows how to translate into a status code.
/// Anything not derived from this is a bug and becomes a 500.
/// </summary>
public abstract class AppException(string message) : Exception(message)
{
    public abstract int StatusCode { get; }
    public abstract string Title { get; }
}

/// <summary>404. The resource does not exist, or is soft-deleted.</summary>
public class NotFoundException(string message) : AppException(message)
{
    public override int StatusCode => 404;
    public override string Title => "Resource not found";

    public static NotFoundException For<T>(object key) =>
        new($"{typeof(T).Name} '{key}' was not found.");
}

/// <summary>403. Authenticated, but not permitted to touch this resource.</summary>
public class ForbiddenException(string message = "You do not have access to this resource.")
    : AppException(message)
{
    public override int StatusCode => 403;
    public override string Title => "Forbidden";
}

/// <summary>401. No usable credentials.</summary>
public class UnauthorizedException(string message = "Authentication is required.")
    : AppException(message)
{
    public override int StatusCode => 401;
    public override string Title => "Unauthorized";
}

/// <summary>409. The request is well-formed but conflicts with current state.</summary>
public class ConflictException(string message) : AppException(message)
{
    public override int StatusCode => 409;
    public override string Title => "Conflict";
}

/// <summary>400. Input failed validation. Carries per-field detail.</summary>
public class ValidationException(IDictionary<string, string[]> errors)
    : AppException("One or more validation errors occurred.")
{
    public override int StatusCode => 400;
    public override string Title => "Validation failed";

    public IDictionary<string, string[]> Errors { get; } = errors;

    public ValidationException(string field, string error)
        : this(new Dictionary<string, string[]> { [field] = [error] })
    {
    }
}
