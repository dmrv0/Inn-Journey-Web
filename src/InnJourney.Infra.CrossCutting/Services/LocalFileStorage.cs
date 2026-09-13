using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Options;
using InnJourney.Application.Abstractions;
using InnJourney.Application.Common;
using InnJourney.Infra.CrossCutting.Options;

namespace InnJourney.Infra.CrossCutting.Services;

/// <summary>
/// Writes uploads beneath the web root and returns a public URL. Shaped so an
/// object-store adapter can replace it without touching any handler.
/// </summary>
public class LocalFileStorage(
    IOptions<StorageOptions> options,
    IWebHostEnvironment environment) : IFileStorage
{
    private readonly StorageOptions _options = options.Value;

    public async Task<StoredFile> SaveAsync(Stream content, string fileName, string contentType,
        string folder, CancellationToken cancellationToken = default)
    {
        if (!_options.AllowedContentTypes.Contains(contentType, StringComparer.OrdinalIgnoreCase))
            throw new ValidationException("file", $"'{contentType}' is not an accepted image format.");

        if (content.CanSeek && content.Length > _options.MaxFileSizeBytes)
        {
            throw new ValidationException("file",
                $"The file is larger than the {_options.MaxFileSizeBytes / (1024 * 1024)} MB limit.");
        }

        var safeFolder = Sanitise(folder);
        var extension = Path.GetExtension(fileName);
        var storedName = $"{Guid.NewGuid():N}{extension}";

        var directory = Path.Combine(environment.ContentRootPath, _options.RootPath, safeFolder);
        Directory.CreateDirectory(directory);

        var fullPath = Path.Combine(directory, storedName);

        await using (var target = File.Create(fullPath))
        {
            await content.CopyToAsync(target, cancellationToken);
        }

        var size = new FileInfo(fullPath).Length;

        if (size > _options.MaxFileSizeBytes)
        {
            File.Delete(fullPath);
            throw new ValidationException("file",
                $"The file is larger than the {_options.MaxFileSizeBytes / (1024 * 1024)} MB limit.");
        }

        var url = $"{_options.PublicBaseUrl.TrimEnd('/')}/{safeFolder}/{storedName}";

        return new StoredFile(url, storedName, size, contentType);
    }

    public Task DeleteAsync(string url, CancellationToken cancellationToken = default)
    {
        var prefix = _options.PublicBaseUrl.TrimEnd('/');

        if (!url.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            return Task.CompletedTask;

        var relative = url[prefix.Length..].TrimStart('/');

        // Guard against a stored URL escaping the uploads root.
        var root = Path.GetFullPath(Path.Combine(environment.ContentRootPath, _options.RootPath));
        var target = Path.GetFullPath(Path.Combine(root, relative));

        if (!target.StartsWith(root, StringComparison.Ordinal))
            return Task.CompletedTask;

        if (File.Exists(target))
            File.Delete(target);

        return Task.CompletedTask;
    }

    private static string Sanitise(string folder) =>
        new(folder.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_').ToArray());
}
