namespace InnJourney.Domain.Entities;

/// <summary>
/// Owned value object stored inline on the hotel row. City is indexed because
/// it is the primary search facet.
/// </summary>
public class Address
{
    public string Line { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Country { get; set; } = string.Empty;
    public string? PostalCode { get; set; }

    public override string ToString() =>
        string.Join(", ", new[] { Line, City, PostalCode, Country }.Where(p => !string.IsNullOrWhiteSpace(p)));
}
