using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using InnJourney.Application.Abstractions;
using InnJourney.Infra.CrossCutting.Options;

namespace InnJourney.Infra.CrossCutting.Services;

/// <summary>
/// Sends over SMTP. In development this points at MailHog from the compose file,
/// so mail is captured and viewable rather than delivered.
/// </summary>
public class SmtpEmailSender(IOptions<EmailOptions> options, ILogger<SmtpEmailSender> logger) : IEmailSender
{
    private readonly EmailOptions _options = options.Value;

    public async Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        using var client = new SmtpClient(_options.Host, _options.Port)
        {
            EnableSsl = _options.UseSsl,
            Credentials = string.IsNullOrWhiteSpace(_options.UserName)
                ? CredentialCache.DefaultNetworkCredentials
                : new NetworkCredential(_options.UserName, _options.Password)
        };

        using var mail = new MailMessage
        {
            From = new MailAddress(_options.FromAddress, _options.FromName),
            Subject = message.Subject,
            Body = message.HtmlBody,
            IsBodyHtml = true
        };

        mail.To.Add(message.To);

        try
        {
            await client.SendMailAsync(mail, cancellationToken);
        }
        catch (Exception ex)
        {
            // A failed notification must not fail the booking that triggered it.
            logger.LogError(ex, "Could not send '{Subject}' to {Recipient}.", message.Subject, message.To);
        }
    }
}

/// <summary>Records messages instead of sending them. Used by tests.</summary>
public class RecordingEmailSender : IEmailSender
{
    private readonly List<EmailMessage> _sent = [];

    public IReadOnlyList<EmailMessage> Sent
    {
        get
        {
            lock (_sent) return _sent.ToList();
        }
    }

    public Task SendAsync(EmailMessage message, CancellationToken cancellationToken = default)
    {
        lock (_sent) _sent.Add(message);
        return Task.CompletedTask;
    }
}
