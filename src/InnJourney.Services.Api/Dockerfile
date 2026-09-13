# Build context is the repository root, so the API can reach its sibling
# projects under src/.
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Project files first, so the restore layer is not invalidated by every edit.
COPY src/InnJourney.Domain/*.csproj src/InnJourney.Domain/
COPY src/InnJourney.Application/*.csproj src/InnJourney.Application/
COPY src/InnJourney.Infra.CrossCutting/*.csproj src/InnJourney.Infra.CrossCutting/
COPY src/InnJourney.Infra.Data/*.csproj src/InnJourney.Infra.Data/
COPY src/InnJourney.Services.Api/*.csproj src/InnJourney.Services.Api/

RUN dotnet restore src/InnJourney.Services.Api/InnJourney.Services.Api.csproj

COPY src/InnJourney.Domain/ src/InnJourney.Domain/
COPY src/InnJourney.Application/ src/InnJourney.Application/
COPY src/InnJourney.Infra.CrossCutting/ src/InnJourney.Infra.CrossCutting/
COPY src/InnJourney.Infra.Data/ src/InnJourney.Infra.Data/
COPY src/InnJourney.Services.Api/ src/InnJourney.Services.Api/

RUN dotnet publish src/InnJourney.Services.Api/InnJourney.Services.Api.csproj \
    -c Release -o /app --no-restore

# Runtime stage.
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# The base image ships neither curl nor wget, and the healthcheck needs one.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && adduser --disabled-password --gecos "" --uid 5678 appuser

COPY --from=build /app .

# After the copy, so the published files and the uploads directory both end up
# owned by the user the container actually runs as.
RUN mkdir -p /app/wwwroot/uploads && chown -R appuser /app

USER appuser

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=6 \
    CMD curl -fsS http://localhost:8080/health || exit 1

ENTRYPOINT ["dotnet", "InnJourney.Services.Api.dll"]
