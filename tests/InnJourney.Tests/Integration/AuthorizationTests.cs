using System.Net;
using System.Net.Http.Json;
using InnJourney.Domain.Entities.Identity;

namespace InnJourney.Tests.Integration;

/// <summary>
/// Proves the endpoints are actually protected. An attribute on a controller is
/// a claim about behaviour; these tests are the evidence for it.
/// </summary>
public class AuthorizationTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Theory]
    [InlineData("GET", "/api/v1/hotels/mine")]
    [InlineData("GET", "/api/v1/reservations/mine")]
    [InlineData("GET", "/api/v1/payments/mine")]
    [InlineData("GET", "/api/v1/reviews/mine")]
    [InlineData("GET", "/api/v1/users/me")]
    [InlineData("GET", "/api/v1/users")]
    [InlineData("POST", "/api/v1/hotels")]
    [InlineData("POST", "/api/v1/reservations")]
    [InlineData("POST", "/api/v1/payments")]
    [InlineData("POST", "/api/v1/reviews")]
    [InlineData("POST", "/api/v1/room-types")]
    [InlineData("POST", "/api/v1/amenities")]
    public async Task Protected_endpoints_reject_an_anonymous_caller(string method, string path)
    {
        var client = factory.CreateClient();

        var response = await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path));

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Theory]
    [InlineData("/api/v1/hotels")]
    [InlineData("/api/v1/room-types")]
    [InlineData("/api/v1/amenities")]
    public async Task Public_endpoints_are_readable_anonymously(string path)
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync(path);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task A_traveller_cannot_reach_owner_only_routes()
    {
        var (client, _) = await factory.SignUpAsync(Roles.Traveller);

        var response = await client.PostAsJsonAsync("/api/v1/hotels", new
        {
            name = "Should Not Exist",
            stars = 3,
            addressLine = "1 Test Street",
            city = "Testville",
            country = "Testland"
        });

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task A_traveller_cannot_reach_admin_only_routes()
    {
        var (client, _) = await factory.SignUpAsync(Roles.Traveller);

        var response = await client.PostAsJsonAsync("/api/v1/room-types", new
        {
            name = "Sneaky",
            defaultCapacity = 2
        });

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Registration_cannot_grant_the_administrator_role()
    {
        var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email = $"{Guid.NewGuid():N}@test.dev",
            password = "Passw0rd!",
            fullName = "Would-be Admin",
            role = Roles.Admin
        });

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task A_token_carries_the_callers_own_identity()
    {
        // A token must describe its own bearer and nobody else.
        var (client, auth) = await factory.SignUpAsync(Roles.Traveller);

        var me = await client.GetFromJsonAsync<UserResponse>("/api/v1/users/me");

        me.ShouldNotBeNull();
        me.Id.ShouldBe(auth.User.Id);
        me.Roles.ShouldBe([Roles.Traveller]);
        me.Roles.ShouldNotContain(Roles.Admin);
    }

    [Fact]
    public async Task A_malformed_id_is_a_bad_request_not_a_server_error()
    {
        var client = factory.CreateClient();

        var response = await client.GetAsync("/api/v1/hotels/not-a-guid");

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    private record UserResponse(string Id, string Email, string FullName, bool EmailConfirmed, string[] Roles);
}
