using System.ComponentModel.DataAnnotations;

namespace InnJourney.Infra.CrossCutting.Options;

public class JwtOptions
{
    public const string SectionName = "Jwt";

    [Required(AllowEmptyStrings = false)]
    public string Issuer { get; set; } = string.Empty;

    [Required(AllowEmptyStrings = false)]
    public string Audience { get; set; } = string.Empty;

    /// <summary>
    /// Signing key. Supplied by environment variable or user-secrets; never
    /// committed. Must be at least 32 bytes for HMAC-SHA256.
    /// </summary>
    [Required(AllowEmptyStrings = false)]
    [MinLength(32, ErrorMessage = "Jwt:SigningKey must be at least 32 characters.")]
    public string SigningKey { get; set; } = string.Empty;

    [Range(1, 1440)]
    public int AccessTokenMinutes { get; set; } = 30;

    [Range(1, 365)]
    public int RefreshTokenDays { get; set; } = 7;
}

public class StorageOptions
{
    public const string SectionName = "Storage";

    /// <summary>Filesystem root for uploaded media, relative to the content root.</summary>
    public string RootPath { get; set; } = "wwwroot/uploads";

    /// <summary>Public URL prefix the stored files are served from.</summary>
    public string PublicBaseUrl { get; set; } = "/uploads";

    public long MaxFileSizeBytes { get; set; } = 5 * 1024 * 1024;

    public string[] AllowedContentTypes { get; set; } =
        ["image/jpeg", "image/png", "image/webp", "image/avif"];
}

public class EmailOptions
{
    public const string SectionName = "Email";

    public string FromAddress { get; set; } = "no-reply@innjourney.dev";
    public string FromName { get; set; } = "Inn Journey";
    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 1025;
    public bool UseSsl { get; set; }
    public string? UserName { get; set; }
    public string? Password { get; set; }
}
