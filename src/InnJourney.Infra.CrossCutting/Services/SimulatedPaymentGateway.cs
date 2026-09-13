using Microsoft.Extensions.Logging;
using InnJourney.Application.Abstractions;

namespace InnJourney.Infra.CrossCutting.Services;

/// <summary>
/// Stands in for a card processor, entirely in-process.
/// <para>
/// The project deliberately integrates no real payment provider: a clone of this
/// repository runs end to end with no merchant account, and no card value ever
/// leaves the machine or reaches the database.
/// </para>
/// <para>
/// Outcomes are deterministic so tests and demos can rely on them. See
/// <see cref="TestCards"/> for the numbers that force each result.
/// </para>
/// </summary>
public class SimulatedPaymentGateway(ILogger<SimulatedPaymentGateway> logger) : IPaymentGateway
{
    public static class TestCards
    {
        /// <summary>Always approved.</summary>
        public const string Approved = "4242424242424242";

        /// <summary>Always declined by the issuer.</summary>
        public const string Declined = "4000000000000002";

        /// <summary>Always declined for insufficient funds.</summary>
        public const string InsufficientFunds = "4000000000009995";
    }

    public Task<PaymentResult> ChargeAsync(PaymentRequest request, CancellationToken cancellationToken = default)
    {
        var number = Digits(request.Card.Number);

        if (request.Amount <= 0)
            return Task.FromResult(PaymentResult.Failure("Amount must be greater than zero."));

        if (!PassesLuhn(number))
            return Task.FromResult(PaymentResult.Failure("The card number is not valid."));

        if (IsExpired(request.Card))
            return Task.FromResult(PaymentResult.Failure("The card has expired."));

        var result = number switch
        {
            TestCards.Declined => PaymentResult.Failure("The card was declined."),
            TestCards.InsufficientFunds => PaymentResult.Failure("Insufficient funds."),
            _ => PaymentResult.Success($"SIM-{Guid.NewGuid():N}"[..20])
        };

        logger.LogInformation(
            "Simulated charge of {Amount} for {Reference}: {Outcome}",
            request.Amount, request.Reference, result.Succeeded ? "approved" : "declined");

        return Task.FromResult(result);
    }

    public Task<PaymentResult> RefundAsync(string providerReference, decimal amount,
        CancellationToken cancellationToken = default)
    {
        logger.LogInformation("Simulated refund of {Amount} against {Reference}.", amount, providerReference);
        return Task.FromResult(PaymentResult.Success($"SIMREF-{Guid.NewGuid():N}"[..20]));
    }

    private static string Digits(string value) => new(value.Where(char.IsDigit).ToArray());

    private static bool IsExpired(CardDetails card)
    {
        if (!int.TryParse(card.ExpiryMonth, out var month) || month is < 1 or > 12)
            return true;

        if (!int.TryParse(card.ExpiryYear, out var year))
            return true;

        if (year < 100)
            year += 2000;

        // A card is good through the last day of its stated month.
        var expiresAfter = new DateTime(year, month, 1).AddMonths(1).AddDays(-1);
        return expiresAfter < DateTime.UtcNow.Date;
    }

    /// <summary>Standard checksum every real processor applies before anything else.</summary>
    private static bool PassesLuhn(string number)
    {
        if (number.Length is < 12 or > 19)
            return false;

        var sum = 0;
        var doubling = false;

        for (var i = number.Length - 1; i >= 0; i--)
        {
            var digit = number[i] - '0';

            if (doubling)
            {
                digit *= 2;
                if (digit > 9)
                    digit -= 9;
            }

            sum += digit;
            doubling = !doubling;
        }

        return sum % 10 == 0;
    }
}
