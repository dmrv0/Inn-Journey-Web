# Inn Journey

A hotel reservation platform. Travellers search by the nights they need, book a room and pay for it, then review the stay once it is done. Hotel owners manage their properties, rooms and bookings from an occupancy board. Administrators curate the catalogues that every property shares.

**ASP.NET Core 8 · PostgreSQL · Entity Framework Core · Angular 19**

## Running it

The application seeds itself on first start, so either path below ends with a catalogue you can search, book and review against.

### Without a database server

PostgreSQL is the deployment target, but a connection string beginning `Data Source=` selects SQLite instead, and the schema is built from the model. Nothing to install, nothing to run alongside it:

```bash
export Jwt__SigningKey="$(openssl rand -base64 48)"
export ConnectionStrings__PostgreSQL="Data Source=inn-journey.db"

dotnet run --project src/InnJourney.Services.Api --no-launch-profile --urls http://localhost:8080
```

```powershell
$env:Jwt__SigningKey = [Convert]::ToBase64String((1..48 | % { Get-Random -Max 256 }))
$env:ConnectionStrings__PostgreSQL = "Data Source=inn-journey.db"

dotnet run --project src/InnJourney.Services.Api --no-launch-profile --urls http://localhost:8080
```

`--urls` matters: without it `dotnet run` takes the port from `launchSettings.json`, and the client proxies to `8080`. The signing key is validated at startup and must be at least 32 characters, so a missing or short key fails the boot rather than issuing tokens nobody can verify.

Then the client, in a second terminal:

```bash
cd src/InnJourney.UI.Web
npm install
npm start
```

The API answers on `http://localhost:8080` with Swagger at `/swagger`; the client is on `http://localhost:4200` and proxies `/api` and `/uploads` to the API, so the browser only ever sees one origin.

### With Docker Compose

Brings up PostgreSQL, the API, the client, and MailHog to catch the outgoing mail:

```bash
cp .env.example .env     # set JWT_SIGNING_KEY
docker compose up --build
```

Client on `:4200`, API on `:8080`, MailHog's inbox on `:8025`.

### Signing in

Every seeded account uses the password `Passw0rd!`:

| Account | Role | Sees |
| --- | --- | --- |
| `guest@innjourney.dev` | Traveller | Search, booking, their own stays and reviews |
| `owner@innjourney.dev` | Hotel owner | Occupancy board, booking queue, rooms, revenue |
| `owner2@innjourney.dev` | Hotel owner | A second owner, to prove the boundary between them |
| `admin@innjourney.dev` | Administrator | Shared catalogues of facilities and room types |

Payments are simulated, so the card you use decides the outcome:

| Card | Result |
| --- | --- |
| `4242 4242 4242 4242` | Approved |
| `4000 0000 0000 0002` | Declined by the issuer |
| `4000 0000 0000 9995` | Declined for insufficient funds |

Any other number is checked against the Luhn algorithm and its expiry, then approved.

## Structure

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

It is onion in shape rather than in doctrine, and the two departures are deliberate. `Domain` references ASP.NET Identity because `AppUser` extends `IdentityUser`, and `Application` references EF Core because its read repositories expose `IQueryable<T>`. That second leak is load-bearing: it is what lets the handler tests run against SQLite in seconds instead of against a container.

Requests arrive at a thin controller, are dispatched through MediatR to a handler holding the whole feature, and validation runs as a pipeline behaviour ahead of every one of them. Failures surface as RFC 7807 problem responses from a single middleware, so no handler formats an error itself.

The client is documented separately in [`src/InnJourney.UI.Web`](src/InnJourney.UI.Web/README.md).

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

## Rules worth knowing before reading the code

**A stay is a half-open interval.** Overlap in `AvailabilityService` is `CheckIn < to && CheckOut > from`, so a departure and an arrival on the same date do not collide and a room re-lets on its turnover day. Using `<=` and `>=` instead would quietly cost a night's revenue on every turnover.

**A rating is not a classification.** `Stars` is what the owner claims about the property. `AverageRating` is derived from reviews, each of which requires a checked-out reservation belonging to its author, one per stay. Only the review handler writes it.

**A reservation moves through one table of transitions.** `Pending → Confirmed → CheckedIn → CheckedOut`, with `Cancelled` reachable from the first two and nowhere else. Nothing outside that table may move a booking.

**Deletes are soft.** A global query filter hides retired rows, and the amenity join entities declare matching filters of their own — without them, withdrawn facilities keep surfacing in search.

## Tests

```bash
dotnet build InnJourney.sln
dotnet test tests/InnJourney.Tests/InnJourney.Tests.csproj
```

A single test or fixture:

```bash
dotnet test --filter "FullyQualifiedName~AvailabilityServiceTests"
```

Each test gets an isolated in-memory SQLite database with a real schema, so foreign keys are genuinely enforced rather than mocked away. The integration tests boot the application through `WebApplicationFactory` and drive it over HTTP, which is why they catch the things unit tests cannot — an authentication scheme registered the wrong way, or a route that answers a redirect where it should answer `401`.

## Licence

MIT. See [LICENSE](LICENSE).
