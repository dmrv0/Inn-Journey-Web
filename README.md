# Inn Journey

A hotel reservation platform. Travellers search by the nights they need, book a room and pay for it, then review the stay once it is done. Hotel owners manage their properties, rooms and bookings from an occupancy board. Administrators curate the catalogues that every property shares.

**ASP.NET Core 8 · PostgreSQL · Entity Framework Core · Angular 19**

Onion architecture: every project reference points inward, and `Domain` depends on nothing.

```
src/
  InnJourney.Domain              entities, enums, invariants
  InnJourney.Application         CQRS handlers, validators, contracts
  InnJourney.Infra.CrossCutting  tokens, payments, storage, email
  InnJourney.Infra.Data          DbContext, configurations, repositories
  InnJourney.Services.Api        controllers, middleware, composition root
  InnJourney.UI.Web              Angular client
tests/
  InnJourney.Tests
```

## What it does

- Date-span search with filters for city, price, classification, rating and facilities
- Per-room availability, a two-step booking and payment flow, and a confirmation reference
- Accounts for upcoming and past stays, with cancellation and refunds
- Reviews that require a completed stay, feeding a rating nothing else can write
- An owner dashboard: occupancy board, booking queue, rooms, and revenue
- Three roles — traveller, hotel owner, administrator — enforced by the API, not the interface

## What it demonstrates

**Authorization that holds.** Handlers take the caller's identity from the validated bearer token; no command accepts a user id, because one supplied in a request body is one the caller chooses. Ownership is answered in a single place and returns `403` rather than a filtered result.

**Concurrency taken seriously.** Booking re-checks availability inside a serializable transaction, so two simultaneous requests for the same room and dates cannot both succeed.

**Payments without a provider.** The gateway is an interface with an in-process implementation that validates the Luhn checksum and expiry. The project runs end to end with no merchant account, and no card value leaves the machine or reaches the database.

**Tests that prove the claims.** 80 of them — handler coverage against SQLite, plus integration tests that boot the real application and drive it over HTTP, checking that protected routes reject anonymous callers, that owners and guests cannot reach each other's data, and that the whole book → pay → check out → review flow works.

## Licence

MIT. See [LICENSE](LICENSE).
