namespace InnJourney.Application.Abstractions;

/// <summary>
/// Card details as submitted for a single charge. Never persisted: only the last
/// four digits are kept, on the resulting payment record.
/// </summary>
public record CardDetails(
    string HolderName,
    string Number,
    string ExpiryMonth,
    string ExpiryYear,
    string Cvc)
{
    public string Last4 =>
        Number.Length >= 4 ? Number[^4..] : Number;
}

public record PaymentRequest(decimal Amount, string Reference, CardDetails Card);

public record PaymentResult(bool Succeeded, string? ProviderReference, string? FailureReason)
{
    public static PaymentResult Success(string providerReference) => new(true, providerReference, null);
    public static PaymentResult Failure(string reason) => new(false, null, reason);
}

/// <summary>
/// Charges a card. The shipped implementation simulates a provider in-process,
/// so a clone of this repository runs end to end with no payment account and no
/// card data leaving the machine.
/// </summary>
public interface IPaymentGateway
{
    Task<PaymentResult> ChargeAsync(PaymentRequest request, CancellationToken cancellationToken = default);

    Task<PaymentResult> RefundAsync(string providerReference, decimal amount,
        CancellationToken cancellationToken = default);
}
