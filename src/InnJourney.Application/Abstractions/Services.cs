namespace InnJourney.Application.Abstractions;

/// <summary>Issued token pair. The refresh token is returned once and stored only as a hash.</summary>
public record TokenPair(string AccessToken, DateTime AccessTokenExpiresAt, string RefreshToken, DateTime RefreshTokenExpiresAt);

public interface ITokenHandler
{
    /// <summary>
    /// Builds an access token carrying the user's real id, email and roles.
    /// </summary>
    TokenPair CreateTokenPair(string userId, string email, IEnumerable<string> roles);

    /// <summary>Hashes a refresh token for storage. Raw values are never persisted.</summary>
    string HashRefreshToken(string refreshToken);
}

public record StoredFile(string Url, string FileName, long SizeBytes, string ContentType);

/// <summary>
/// Binary storage for uploaded media. The local-disk implementation writes under
/// the API's static files root; the interface is shaped so an object-store
/// adapter can replace it without touching handlers.
/// </summary>
public interface IFileStorage
{
    Task<StoredFile> SaveAsync(Stream content, string fileName, string contentType,
        string folder, CancellationToken cancellationToken = default);

    Task DeleteAsync(string url, CancellationToken cancellationToken = default);
}

public record EmailMessage(string To, string Subject, string HtmlBody);

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default);
}

/// <summary>Wall-clock access, injected so tests can pin dates.</summary>
public interface IClock
{
    DateTime UtcNow { get; }
    DateOnly Today { get; }
}

public class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
    public DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);
}
