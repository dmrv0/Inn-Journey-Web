// FluentValidation ships its own ValidationException. Handlers throw ours, which
// carries per-field errors and maps to a 400 ProblemDetails response.
global using ValidationException = InnJourney.Application.Common.ValidationException;
