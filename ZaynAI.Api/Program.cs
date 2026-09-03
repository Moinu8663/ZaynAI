using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("AngularClient", policy =>
        policy.WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? ["http://localhost:4200"])
              .AllowAnyHeader().AllowAnyMethod());
});

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
});

builder.Services.AddSingleton<AppStore>();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<PlanCapabilityService>();
builder.Services.AddHttpClient<GeminiGateway>(c => c.Timeout = TimeSpan.FromSeconds(300));
builder.Services.AddHttpClient<OAuthService>();

var app = builder.Build();
app.UseCors("AngularClient");

app.MapGet("/", () => Results.Ok(new { name = "ZaynAI API", status = "running" }));

app.MapGet("/api/plans", async (AppStore store) =>
    Results.Ok(await store.GetAllPlansAsync()));

app.MapPost("/api/auth/signup", async (SignupRequest request, AppStore store, TokenService tokens) =>
{
    var email = NormalizeEmail(request.Email);
    if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(request.Password))
        return Results.BadRequest(new ApiError("Name, email and password are required."));
    if (request.Password.Length < 8)
        return Results.BadRequest(new ApiError("Password must be at least 8 characters."));

    var userId = Guid.NewGuid().ToString("n");
    var hash   = PasswordHasher.Hash(request.Password);
    var planId = request.PlanId ?? "free";

    var (result, user) = await store.SignUpAsync(userId, request.Name.Trim(), email, hash, planId);
    return result switch
    {
        1 => Results.Conflict(new ApiError("An account already exists for this email.")),
        _ => Results.Created($"/api/users/{userId}", AuthResponse.From(user!, tokens.CreateToken(user!)))
    };
});

app.MapPost("/api/auth/signin", async (SigninRequest request, AppStore store, TokenService tokens) =>
{
    var email = NormalizeEmail(request.Email);
    var user  = await store.GetUserForSignInAsync(email);
    if (user is null || !PasswordHasher.Verify(request.Password, user.PasswordHash))
        return Results.Unauthorized();

    await store.UpdateLastSignedInAsync(user.Id);
    return Results.Ok(AuthResponse.From(user, tokens.CreateToken(user)));
});

// ── OAuth: initiate ───────────────────────────────────────────────────────────
app.MapGet("/api/auth/oauth/{provider}", (string provider, string redirect, IConfiguration config, HttpContext http) =>
{
    var state       = Convert.ToBase64String(RandomNumberGenerator.GetBytes(16));
    var callbackUrl = $"{http.Request.Scheme}://{http.Request.Host}/api/auth/oauth/{provider}/callback";

    var authUrl = provider.ToLowerInvariant() switch
    {
        "google"    => OAuthUrlBuilder.Google(config, callbackUrl, state, redirect),
        "github"    => OAuthUrlBuilder.GitHub(config, callbackUrl, state, redirect),
        "microsoft" => OAuthUrlBuilder.Microsoft(config, callbackUrl, state, redirect),
        _           => null
    };

    if (authUrl is null) return Results.BadRequest(new ApiError($"Unknown OAuth provider: {provider}"));
    return Results.Redirect(authUrl);
});

// ── OAuth: callback ───────────────────────────────────────────────────────────
app.MapGet("/api/auth/oauth/{provider}/callback", async (
    string provider, string? code, string? error, string? state,
    AppStore store, TokenService tokens, OAuthService oauth, IConfiguration config, HttpContext http) =>
{
    if (!string.IsNullOrEmpty(error))
        return Results.Redirect($"http://localhost:4200/auth/callback?error={Uri.EscapeDataString(error)}");
    if (string.IsNullOrEmpty(code))
        return Results.Redirect("http://localhost:4200/auth/callback?error=missing_code");

    var callbackUrl = $"{http.Request.Scheme}://{http.Request.Host}/api/auth/oauth/{provider}/callback";

    OAuthProfile? profile;
    try
    {
        profile = provider.ToLowerInvariant() switch
        {
            "google"    => await oauth.GetGoogleProfileAsync(code, callbackUrl, config),
            "github"    => await oauth.GetGitHubProfileAsync(code, callbackUrl, config),
            "microsoft" => await oauth.GetMicrosoftProfileAsync(code, callbackUrl, config),
            _           => null
        };
    }
    catch (Exception ex)
    {
        return Results.Redirect($"http://localhost:4200/auth/callback?error={Uri.EscapeDataString(ex.Message)}");
    }

    if (profile is null)
        return Results.Redirect("http://localhost:4200/auth/callback?error=unsupported_provider");

    var (_, user) = await store.UpsertOAuthUserAsync(profile.Id, profile.Name, profile.Email, provider);
    if (user is null)
        return Results.Redirect("http://localhost:4200/auth/callback?error=account_error");

    await store.UpdateLastSignedInAsync(user.Id);
    var token = tokens.CreateToken(user);
    var angularOrigin = config["Cors:AllowedOrigins:0"] ?? "http://localhost:4200";
    return Results.Redirect($"{angularOrigin}/auth/callback?token={Uri.EscapeDataString(token)}");
});

app.MapGet("/api/me", async (HttpContext http, AppStore store, TokenService tokens) =>
{
    var user = await GetCurrentUserAsync(http, store, tokens);
    return user is null ? Results.Unauthorized() : Results.Ok(UserDto.From(user));
});

app.MapPut("/api/subscription", async (SubscriptionRequest request, HttpContext http, AppStore store, TokenService tokens) =>
{
    var user = await GetCurrentUserAsync(http, store, tokens);
    if (user is null) return Results.Unauthorized();

    var (result, updated) = await store.ChangeSubscriptionAsync(user.Id, request.PlanId);
    return result switch
    {
        1 => Results.BadRequest(new ApiError("Unknown subscription plan.")),
        _ => Results.Ok(UserDto.From(updated!))
    };
});

app.MapPost("/api/subscription/cancel", async (HttpContext http, AppStore store, TokenService tokens) =>
{
    var user = await GetCurrentUserAsync(http, store, tokens);
    if (user is null) return Results.Unauthorized();
    var updated = await store.CancelSubscriptionAsync(user.Id);
    return Results.Ok(UserDto.From(updated!));
});

app.MapPost("/api/assistant", async (
    AssistantRequest request, HttpContext http,
    AppStore store, TokenService tokens,
    PlanCapabilityService caps, GeminiGateway gemini) =>
{
    var user = await GetCurrentUserAsync(http, store, tokens);
    if (user is null) return Results.Unauthorized();
    if (user.Subscription.Status != SubscriptionStatus.Active)
        return Results.StatusCode(StatusCodes.Status402PaymentRequired);
    if (string.IsNullOrWhiteSpace(request.Prompt))
        return Results.BadRequest(new ApiError("Prompt is required."));

    var capability = caps.For(user.Subscription.Plan.Id);

    // Strip workspace context if the plan does not allow it (do not block the request)
    // Also cap workspace context size to avoid timeouts on large payloads
    const int maxWorkspaceChars = 80_000;
    var effectiveRequest = !capability.AllowWorkspaceScan
        ? request with { WorkspaceContext = string.Empty }
        : request.WorkspaceContext?.Length > maxWorkspaceChars
            ? request with { WorkspaceContext = request.WorkspaceContext[..maxWorkspaceChars] }
            : request;

    var (canProceed, quotaCap) = await store.CheckAssistantQuotaAsync(user.Id);
    if (!canProceed)
        return Results.StatusCode(StatusCodes.Status429TooManyRequests);

    var sw = System.Diagnostics.Stopwatch.StartNew();
    string text;
    int statusCode = 200;
    string? errorMsg = null;
    try
    {
        text = await gemini.AskAsync(effectiveRequest, quotaCap ?? capability);
    }
    catch (Exception ex)
    {
        sw.Stop();
        statusCode = 500;
        errorMsg   = ex.Message;
        await store.LogAssistantRequestAsync(user.Id, effectiveRequest.Area, capability.Model, null, null, statusCode, errorMsg, (int)sw.ElapsedMilliseconds);
        throw;
    }

    sw.Stop();
    await store.LogAssistantRequestAsync(user.Id, effectiveRequest.Area, capability.Model, null, null, statusCode, null, (int)sw.ElapsedMilliseconds);
    return Results.Ok(new AssistantResponse(text));
});

app.MapGet("/api/capabilities", async (HttpContext http, AppStore store, TokenService tokens, PlanCapabilityService caps) =>
{
    var user = await GetCurrentUserAsync(http, store, tokens);
    if (user is null) return Results.Unauthorized();
    return Results.Ok(caps.For(user.Subscription.Plan.Id));
});

app.MapGet("/api/usage", async (HttpContext http, AppStore store, TokenService tokens) =>
{
    var user = await GetCurrentUserAsync(http, store, tokens);
    if (user is null) return Results.Unauthorized();
    return Results.Ok(await store.GetUserUsageSummaryAsync(user.Id));
});

app.Run();

static string NormalizeEmail(string? email) => email?.Trim().ToLowerInvariant() ?? string.Empty;

static async Task<UserAccount?> GetCurrentUserAsync(HttpContext http, AppStore store, TokenService tokens)
{
    var header = http.Request.Headers.Authorization.ToString();
    if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)) return null;
    var token = header["Bearer ".Length..].Trim();
    var email = tokens.ValidateToken(token);
    return string.IsNullOrWhiteSpace(email) ? null : await store.GetUserByEmailAsync(email);
}

// ── Records & DTOs ────────────────────────────────────────────────────────────

public sealed record ApiError(string Message);
public sealed record SignupRequest(string Name, string Email, string Password, string? PlanId);
public sealed record SigninRequest(string Email, string Password);
public sealed record SubscriptionRequest(string PlanId);
public sealed record ConversationTurn(string Role, string Content);
public sealed record AssistantRequest(string Area, string Prompt, string WorkspaceContext, string? SelectedCode, ConversationTurn[]? History);
public sealed record AssistantResponse(string Text);

public sealed record AuthResponse(string Token, UserDto User)
{
    public static AuthResponse From(UserAccount user, string token) => new(token, UserDto.From(user));
}

public sealed record UserDto(
    string Id, string Name, string Email,
    SubscriptionDto Subscription,
    DateTimeOffset CreatedAt, DateTimeOffset? LastSignedInAt)
{
    public static UserDto From(UserAccount u) =>
        new(u.Id, u.Name, u.Email, SubscriptionDto.From(u.Subscription), u.CreatedAt, u.LastSignedInAt);
}

public sealed record SubscriptionDto(
    string PlanId, string PlanName, decimal MonthlyPrice, string Status,
    DateTimeOffset StartedAt, DateTimeOffset? RenewsAt, DateTimeOffset? CanceledAt)
{
    public static SubscriptionDto From(Subscription s) =>
        new(s.Plan.Id, s.Plan.Name, s.Plan.MonthlyPrice, s.Status.ToString(),
            s.StartedAt, s.RenewsAt, s.CanceledAt);
}

public sealed record SubscriptionPlan(
    string Id, string Name, decimal MonthlyPrice,
    int MonthlyAssistantRequests, int WorkspaceScans, string[] Features);

public sealed class UserAccount
{
    public required string Id           { get; init; }
    public required string Name         { get; set; }
    public required string Email        { get; init; }
    public required string PasswordHash { get; init; }
    public required Subscription Subscription { get; set; }
    public DateTimeOffset  CreatedAt      { get; init; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LastSignedInAt { get; set; }
}

public sealed record Subscription(
    SubscriptionPlan Plan, SubscriptionStatus Status,
    DateTimeOffset StartedAt, DateTimeOffset? RenewsAt, DateTimeOffset? CanceledAt)
{
    public static Subscription Active(SubscriptionPlan plan)
    {
        var now = DateTimeOffset.UtcNow;
        return new Subscription(plan, SubscriptionStatus.Active, now,
            plan.MonthlyPrice > 0 ? now.AddMonths(1) : null, null);
    }
}

public enum SubscriptionStatus { Active, Canceled }

// ── Plan capability ───────────────────────────────────────────────────────────

public sealed record PlanCapability(
    string PlanId, string Model, int MaxOutputTokens,
    bool AllowCodeChanges, bool AllowWorkspaceScan);

public sealed class PlanCapabilityService(IConfiguration configuration)
{
    private static readonly PlanCapability Default = new("free", "gemini-3.6-flash", 1024, false, false);

    public PlanCapability For(string planId)
    {
        var s = configuration.GetSection($"Gemini:Plans:{planId}");
        if (!s.Exists()) return Default with { PlanId = planId };
        return new PlanCapability(
            planId,
            s["Model"] ?? Default.Model,
            s.GetValue("MaxOutputTokens", Default.MaxOutputTokens),
            s.GetValue("AllowCodeChanges", Default.AllowCodeChanges),
            s.GetValue("AllowWorkspaceScan", Default.AllowWorkspaceScan));
    }
}

// ── Gemini gateway ────────────────────────────────────────────────────────────

public sealed class GeminiGateway(HttpClient http, IConfiguration configuration)
{
    public async Task<string> AskAsync(AssistantRequest request, PlanCapability capability)
    {
        var apiKey  = configuration["Gemini:ApiKey"] ?? throw new InvalidOperationException("Gemini:ApiKey is not configured.");
        var baseUrl = configuration["Gemini:BaseUrl"] ?? "https://generativelanguage.googleapis.com/v1beta";
        var url     = $"{baseUrl}/models/{capability.Model}:generateContent?key={apiKey}";

        // Build multi-turn contents array from history + current prompt
        var history = request.History ?? [];
        var contents = history
            .Select(t => new { role = t.Role == "assistant" ? "model" : "user", parts = new[] { new { text = t.Content } } })
            .Cast<object>()
            .ToList();
        contents.Add(new { role = "user", parts = new[] { new { text = request.Prompt } } });

        var body = new
        {
            system_instruction = new { parts = new[] { new { text = BuildSystemPrompt(request, capability) } } },
            contents,
            generationConfig = new
            {
                maxOutputTokens = capability.MaxOutputTokens,
                temperature     = 0.15,
                topP            = 0.95,
                topK            = 40
            }
        };

        using var msg = new HttpRequestMessage(HttpMethod.Post, url);
        msg.Content = JsonContent.Create(body);
        using var response = await http.SendAsync(msg);
        var raw = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            var status = (int)response.StatusCode;
            string detail;
            try { detail = JsonDocument.Parse(raw).RootElement.GetProperty("error").GetProperty("message").GetString() ?? raw; }
            catch { detail = raw; }
            throw status switch
            {
                400 => new InvalidOperationException($"Bad request to Gemini: {detail}"),
                401 or 403 => new InvalidOperationException("Gemini API key is invalid or lacks permission."),
                404 => new InvalidOperationException($"Gemini model '{capability.Model}' not found. Update the model name in appsettings.json."),
                429 => new InvalidOperationException("Gemini rate limit reached. Please wait a moment and try again."),
                500 or 503 => new InvalidOperationException("Gemini service is temporarily unavailable. Please try again shortly."),
                _ => new InvalidOperationException($"Gemini API error {status}: {detail}")
            };
        }

        using var doc = JsonDocument.Parse(raw);

        // Check for prompt blocked by safety filters
        if (doc.RootElement.TryGetProperty("promptFeedback", out var feedback) &&
            feedback.TryGetProperty("blockReason", out var blockReason))
            throw new InvalidOperationException($"Request blocked by Gemini safety filters: {blockReason.GetString()}. Please rephrase your prompt.");

        if (doc.RootElement.TryGetProperty("candidates", out var candidates) &&
            candidates.GetArrayLength() > 0)
        {
            var candidate = candidates[0];

            // Check finish reason
            if (candidate.TryGetProperty("finishReason", out var finishReason))
            {
                var reason = finishReason.GetString();
                if (reason == "SAFETY") throw new InvalidOperationException("Response blocked by Gemini safety filters. Please rephrase your prompt.");
                if (reason == "RECITATION") throw new InvalidOperationException("Response blocked due to recitation policy. Try a more specific prompt.");
                if (reason == "MAX_TOKENS") { /* partial response — still return it */ }
            }

            if (candidate.TryGetProperty("content", out var content) &&
                content.TryGetProperty("parts", out var parts) &&
                parts.GetArrayLength() > 0 &&
                parts[0].TryGetProperty("text", out var textProp))
                return textProp.GetString() ?? "The model returned no text.";
        }

        throw new InvalidOperationException("Gemini returned an empty response. The prompt may be too large or the model may be overloaded.");
    }

    private static string BuildSystemPrompt(AssistantRequest request, PlanCapability capability)
    {
        var changeBlock = capability.AllowCodeChanges
            ? """
ALWAYS respond with exactly one JSON object inside a ```json code fence. No prose outside the fence.
Schema:
{
  "summary": "Concise developer-facing summary of what you found and did (2-4 sentences)",
  "findings": [
    {
      "category": "error" | "performance" | "security" | "code-review",
      "severity":  "critical" | "high" | "medium" | "low",
      "file": "relative/path/to/file",
      "line": <line number or null>,
      "title": "Short issue title",
      "description": "Precise explanation of the problem",
      "recommendation": "Exact fix with code snippet if applicable"
    }
  ],
  "changes": [
    {
      "path": "relative/path/to/file",
      "content": "<complete new file content — never truncate>",
      "description": "What changed and why"
    }
  ]
}
Rules for changes:
- Include the COMPLETE file content, never use placeholders like '// ... rest of file'
- Only include files that actually need modification
- Preserve all existing functionality unless explicitly asked to remove it
- Use the same coding style, indentation, and conventions as the existing code
"""
            : """
ALWAYS respond with exactly one JSON object inside a ```json code fence. No prose outside the fence.
Schema:
{
  "summary": "Concise developer-facing summary (2-4 sentences)",
  "findings": [
    {
      "category": "error" | "performance" | "security" | "code-review",
      "severity":  "critical" | "high" | "medium" | "low",
      "file": "relative/path/to/file",
      "line": <line number or null>,
      "title": "Short issue title",
      "description": "Precise explanation of the problem",
      "recommendation": "Exact fix with code snippet"
    }
  ],
  "changes": []
}
Note: Automated file edits require a Pro or Team plan.
""";

        var workspace = capability.AllowWorkspaceScan && !string.IsNullOrWhiteSpace(request.WorkspaceContext)
            ? $"\n\n<workspace_context>\n{request.WorkspaceContext}\n</workspace_context>" : string.Empty;
        var selected = string.IsNullOrWhiteSpace(request.SelectedCode)
            ? string.Empty : $"\n\n<selected_code>\n{request.SelectedCode}\n</selected_code>";

        return $"""
You are ZaynAI, an elite senior software engineer and architect with deep expertise across all major languages, frameworks, cloud platforms, databases, DevOps, and security.
You are embedded inside VS Code as a developer assistant.

Focus area for this request: {request.Area}

Core principles:
1. ACCURACY FIRST — Never guess. If you are uncertain, say so explicitly and explain what additional context would help.
2. PRODUCTION QUALITY — All code you write must be production-ready: handle edge cases, errors, null safety, and resource cleanup.
3. COMPLETE IMPLEMENTATIONS — Never truncate code with comments like '// rest of implementation'. Always provide the full, working code.
4. CONTEXT AWARENESS — Study the workspace context carefully. Match the existing architecture, naming conventions, patterns, and tech stack.
5. SECURITY MINDSET — Proactively identify and fix security issues: injection, auth flaws, secrets exposure, insecure defaults.
6. PERFORMANCE AWARENESS — Flag O(n²) algorithms, N+1 queries, memory leaks, and unnecessary allocations.
7. HONEST LIMITATIONS — Never claim to have run, tested, or executed code. Clearly distinguish what you know from what you infer.
8. CHAIN OF THOUGHT — For complex problems, reason step by step before giving the final answer.

Area-specific guidance:
- Architecture: Evaluate coupling, cohesion, SOLID principles, scalability, and deployment topology.
- Coding: Write idiomatic, well-typed, testable code. Prefer composition over inheritance.
- Debugging: Identify root cause, not just symptoms. Explain why the bug occurs.
- Security: Apply OWASP Top 10, check for secrets, validate all inputs, enforce least privilege.
- Performance: Measure before optimizing. Suggest profiling strategies alongside fixes.
- Testing: Generate tests that cover happy path, edge cases, and failure modes. Use the project's existing test framework.
- Database: Write efficient SQL, use parameterized queries, check indexes, avoid N+1.
- DevOps: Follow 12-factor app principles. Suggest health checks, graceful shutdown, and observability.
- Migration: Provide step-by-step migration plan with rollback strategy.
- Documentation: Write clear, accurate docs that explain the "why", not just the "what".
{workspace}{selected}

{changeBlock}
""";
    }
}

// ── OAuth helpers ────────────────────────────────────────────────────────────

public sealed record OAuthProfile(string Id, string Name, string Email, string Provider);

public static class OAuthUrlBuilder
{
    public static string Google(IConfiguration cfg, string callback, string state, string redirect) =>
        "https://accounts.google.com/o/oauth2/v2/auth?" +
        $"client_id={Uri.EscapeDataString(cfg["OAuth:Google:ClientId"] ?? "")}" +
        $"&redirect_uri={Uri.EscapeDataString(callback)}" +
        "&response_type=code&scope=openid%20email%20profile" +
        $"&state={Uri.EscapeDataString(state + "|" + redirect)}";

    public static string GitHub(IConfiguration cfg, string callback, string state, string redirect) =>
        "https://github.com/login/oauth/authorize?" +
        $"client_id={Uri.EscapeDataString(cfg["OAuth:GitHub:ClientId"] ?? "")}" +
        $"&redirect_uri={Uri.EscapeDataString(callback)}" +
        "&scope=user%3Aemail" +
        $"&state={Uri.EscapeDataString(state + "|" + redirect)}";

    public static string Microsoft(IConfiguration cfg, string callback, string state, string redirect)
    {
        var tenant = cfg["OAuth:Microsoft:TenantId"] ?? "common";
        return $"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?" +
               $"client_id={Uri.EscapeDataString(cfg["OAuth:Microsoft:ClientId"] ?? "")}" +
               $"&redirect_uri={Uri.EscapeDataString(callback)}" +
               "&response_type=code&scope=openid%20email%20profile%20User.Read" +
               $"&state={Uri.EscapeDataString(state + "|" + redirect)}";
    }
}

public sealed class OAuthService(HttpClient http)
{
    public async Task<OAuthProfile> GetGoogleProfileAsync(string code, string callbackUrl, IConfiguration cfg)
    {
        var tokenResp = await ExchangeCodeAsync("https://oauth2.googleapis.com/token",
            cfg["OAuth:Google:ClientId"]!, cfg["OAuth:Google:ClientSecret"]!, code, callbackUrl);

        // Decode id_token (JWT) — no signature verification needed for profile claims
        var idToken = tokenResp.GetProperty("id_token").GetString()!;
        var handler = new JwtSecurityTokenHandler();
        var jwt     = handler.ReadJwtToken(idToken);
        var sub     = jwt.Claims.First(c => c.Type == "sub").Value;
        var email   = jwt.Claims.First(c => c.Type == "email").Value;
        var name    = jwt.Claims.FirstOrDefault(c => c.Type == "name")?.Value ?? email.Split('@')[0];
        return new OAuthProfile(sub, name, email, "google");
    }

    public async Task<OAuthProfile> GetGitHubProfileAsync(string code, string callbackUrl, IConfiguration cfg)
    {
        var tokenResp = await ExchangeCodeAsync("https://github.com/login/oauth/access_token",
            cfg["OAuth:GitHub:ClientId"]!, cfg["OAuth:GitHub:ClientSecret"]!, code, callbackUrl,
            isForm: true, acceptJson: true);

        var accessToken = tokenResp.GetProperty("access_token").GetString()!;

        using var req = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/user");
        req.Headers.Add("Authorization", $"Bearer {accessToken}");
        req.Headers.Add("User-Agent", "ZaynAI");
        using var resp = await http.SendAsync(req);
        var user = JsonDocument.Parse(await resp.Content.ReadAsStringAsync()).RootElement;

        var id    = user.GetProperty("id").GetInt64().ToString();
        var login = user.TryGetProperty("name", out var n) && n.ValueKind != JsonValueKind.Null
            ? n.GetString()! : user.GetProperty("login").GetString()!;

        // GitHub may not expose email in profile — fetch primary verified email
        string email;
        if (user.TryGetProperty("email", out var em) && em.ValueKind != JsonValueKind.Null && !string.IsNullOrEmpty(em.GetString()))
        {
            email = em.GetString()!;
        }
        else
        {
            using var emailReq = new HttpRequestMessage(HttpMethod.Get, "https://api.github.com/user/emails");
            emailReq.Headers.Add("Authorization", $"Bearer {accessToken}");
            emailReq.Headers.Add("User-Agent", "ZaynAI");
            using var emailResp = await http.SendAsync(emailReq);
            var emails = JsonDocument.Parse(await emailResp.Content.ReadAsStringAsync()).RootElement;
            email = emails.EnumerateArray()
                .Where(e => e.TryGetProperty("primary", out var p) && p.GetBoolean() &&
                            e.TryGetProperty("verified", out var v) && v.GetBoolean())
                .Select(e => e.GetProperty("email").GetString()!)
                .FirstOrDefault() ?? $"{login}@github.noemail";
        }

        return new OAuthProfile(id, login, email, "github");
    }

    public async Task<OAuthProfile> GetMicrosoftProfileAsync(string code, string callbackUrl, IConfiguration cfg)
    {
        var tenant    = cfg["OAuth:Microsoft:TenantId"] ?? "common";
        var tokenResp = await ExchangeCodeAsync(
            $"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
            cfg["OAuth:Microsoft:ClientId"]!, cfg["OAuth:Microsoft:ClientSecret"]!, code, callbackUrl,
            isForm: true);

        var accessToken = tokenResp.GetProperty("access_token").GetString()!;

        using var req = new HttpRequestMessage(HttpMethod.Get, "https://graph.microsoft.com/v1.0/me");
        req.Headers.Add("Authorization", $"Bearer {accessToken}");
        using var resp = await http.SendAsync(req);
        var profile = JsonDocument.Parse(await resp.Content.ReadAsStringAsync()).RootElement;

        var id    = profile.GetProperty("id").GetString()!;
        var name  = profile.TryGetProperty("displayName", out var dn) ? dn.GetString()! : "User";
        var email = profile.TryGetProperty("mail", out var mail) && mail.ValueKind != JsonValueKind.Null
            ? mail.GetString()!
            : profile.TryGetProperty("userPrincipalName", out var upn) ? upn.GetString()! : id + "@microsoft";

        return new OAuthProfile(id, name, email, "microsoft");
    }

    private async Task<JsonElement> ExchangeCodeAsync(
        string tokenUrl, string clientId, string clientSecret,
        string code, string redirectUri,
        bool isForm = false, bool acceptJson = false)
    {
        HttpResponseMessage resp;
        if (isForm)
        {
            var form = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"]     = clientId,
                ["client_secret"] = clientSecret,
                ["code"]          = code,
                ["redirect_uri"]  = redirectUri,
                ["grant_type"]    = "authorization_code"
            });
            if (acceptJson) form.Headers.Add("Accept", "application/json");
            resp = await http.PostAsync(tokenUrl, form);
        }
        else
        {
            var body = new { client_id = clientId, client_secret = clientSecret, code, redirect_uri = redirectUri, grant_type = "authorization_code" };
            resp = await http.PostAsJsonAsync(tokenUrl, body);
        }

        var raw = await resp.Content.ReadAsStringAsync();
        if (!resp.IsSuccessStatusCode)
            throw new InvalidOperationException($"OAuth token exchange failed: {raw}");

        return JsonDocument.Parse(raw).RootElement;
    }
}

// ── SQL AppStore ──────────────────────────────────────────────────────────────

public sealed class AppStore(IConfiguration configuration)
{
    private string ConnectionString =>
        configuration.GetConnectionString("DefaultConnection1")
        ?? throw new InvalidOperationException("DefaultConnection1 connection string is not configured.");

    private SqlConnection Open()
    {
        var conn = new SqlConnection(ConnectionString);
        conn.Open();
        return conn;
    }

    // Plans
    public async Task<List<SubscriptionPlan>> GetAllPlansAsync()
    {
        var plans = new List<SubscriptionPlan>();
        await using var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand("dbo.SP_GetAllPlans", conn) { CommandType = CommandType.StoredProcedure };
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var featuresJson = reader["FeaturesJson"] as string ?? "[]";
            string[] features;
            try { features = JsonSerializer.Deserialize<string[]>($"[{featuresJson}]") ?? []; }
            catch { features = []; }

            plans.Add(new SubscriptionPlan(
                reader.GetString("Id"),
                reader.GetString("Name"),
                reader.GetDecimal("MonthlyPrice"),
                reader.GetInt32("MonthlyAssistantRequests"),
                reader.GetInt32("WorkspaceScans"),
                features));
        }
        return plans;
    }

    // Upsert OAuth user (create if new, return existing if email matches)
    public async Task<(int Result, UserAccount? User)> UpsertOAuthUserAsync(
        string oauthId, string name, string email, string provider)
    {
        await using var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand("dbo.SP_UpsertOAuthUser", conn) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("@UserId",   Guid.NewGuid().ToString("n"));
        cmd.Parameters.AddWithValue("@OAuthId",  oauthId);
        cmd.Parameters.AddWithValue("@Provider", provider);
        cmd.Parameters.AddWithValue("@Name",     name);
        cmd.Parameters.AddWithValue("@Email",    email.Trim().ToLowerInvariant());
        var resultParam = cmd.Parameters.Add("@Result", SqlDbType.Int);
        resultParam.Direction = ParameterDirection.Output;

        UserAccount? user = null;
        await using (var reader = await cmd.ExecuteReaderAsync())
        {
            if (await reader.ReadAsync()) user = MapUser(reader);
        }
        var resultCode = resultParam.Value is DBNull ? 0 : (int)resultParam.Value;
        return (resultCode, user);
    }

    // Sign up
    public async Task<(int Result, UserAccount? User)> SignUpAsync(
        string userId, string name, string email, string passwordHash, string planId)
    {
        await using var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand("dbo.SP_SignUp", conn) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("@UserId",       userId);
        cmd.Parameters.AddWithValue("@Name",         name);
        cmd.Parameters.AddWithValue("@Email",        email);
        cmd.Parameters.AddWithValue("@PasswordHash", passwordHash);
        cmd.Parameters.AddWithValue("@PlanId",       planId);
        var resultParam = cmd.Parameters.Add("@Result", SqlDbType.Int);
        resultParam.Direction = ParameterDirection.Output;

        UserAccount? user = null;
        // Reader must be fully closed before output params are populated
        await using (var reader = await cmd.ExecuteReaderAsync())
        {
            if (await reader.ReadAsync()) user = MapUser(reader);
        }

        var resultCode = resultParam.Value is DBNull ? 0 : (int)resultParam.Value;
        return (resultCode, user);
    }

    // Sign in — returns user with password hash for verification
    public async Task<UserAccount?> GetUserForSignInAsync(string email)
    {
        await using var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand("dbo.SP_SignIn", conn) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("@Email", email);
        await using var reader = await cmd.ExecuteReaderAsync();
        return await reader.ReadAsync() ? MapUserWithHash(reader) : null;
    }

    public async Task UpdateLastSignedInAsync(string userId)
    {
        await using var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand("dbo.SP_UpdateLastSignedIn", conn) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("@UserId", userId);
        await cmd.ExecuteNonQueryAsync();
    }

    // Get by email (token validation / /api/me)
    public async Task<UserAccount?> GetUserByEmailAsync(string email)
    {
        await using var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand("dbo.SP_GetUserByEmail", conn) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("@Email", email);
        await using var reader = await cmd.ExecuteReaderAsync();
        return await reader.ReadAsync() ? MapUser(reader) : null;
    }

    // Change subscription
    public async Task<(int Result, UserAccount? User)> ChangeSubscriptionAsync(string userId, string planId)
    {
        await using var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand("dbo.SP_ChangeSubscription", conn) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("@UserId",    userId);
        cmd.Parameters.AddWithValue("@NewPlanId", planId);
        var resultParam = cmd.Parameters.Add("@Result", SqlDbType.Int);
        resultParam.Direction = ParameterDirection.Output;

        UserAccount? user = null;
        // Reader must be fully closed before output params are populated
        await using (var reader = await cmd.ExecuteReaderAsync())
        {
            if (await reader.ReadAsync()) user = MapUser(reader);
        }

        var resultCode = resultParam.Value is DBNull ? 0 : (int)resultParam.Value;
        return (resultCode, user);
    }

    // Cancel subscription
    public async Task<UserAccount?> CancelSubscriptionAsync(string userId)
    {
        await using var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand("dbo.SP_CancelSubscription", conn) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("@UserId", userId);
        await using var reader = await cmd.ExecuteReaderAsync();
        return await reader.ReadAsync() ? MapUser(reader) : null;
    }

    // Quota check
    public async Task<(bool CanProceed, PlanCapability? Capability)> CheckAssistantQuotaAsync(string userId)
    {
        await using var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand("dbo.SP_CheckAssistantQuota", conn) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("@UserId", userId);

        var canProceedParam         = cmd.Parameters.Add("@CanProceed",         SqlDbType.Bit);
        var modelParam              = cmd.Parameters.Add("@GeminiModel",         SqlDbType.NVarChar, 100);
        var maxTokensParam          = cmd.Parameters.Add("@MaxOutputTokens",     SqlDbType.Int);
        var allowChangesParam       = cmd.Parameters.Add("@AllowCodeChanges",    SqlDbType.Bit);
        var allowWorkspaceScanParam = cmd.Parameters.Add("@AllowWorkspaceScan",  SqlDbType.Bit);

        canProceedParam.Direction         = ParameterDirection.Output;
        modelParam.Direction              = ParameterDirection.Output;
        maxTokensParam.Direction          = ParameterDirection.Output;
        allowChangesParam.Direction       = ParameterDirection.Output;
        allowWorkspaceScanParam.Direction = ParameterDirection.Output;

        await cmd.ExecuteNonQueryAsync();

        var canProceed = canProceedParam.Value is true or 1 or (byte)1;
        if (!canProceed) return (false, null);

        var cap = new PlanCapability(
            userId,
            modelParam.Value as string ?? "gemini-3.6-flash",
            maxTokensParam.Value is int mt ? mt : 1024,
            allowChangesParam.Value is true or 1 or (byte)1,
            allowWorkspaceScanParam.Value is true or 1 or (byte)1);

        return (true, cap);
    }

    // Log assistant request
    public async Task LogAssistantRequestAsync(
        string userId, string area, string model,
        int? promptTokens, int? completionTokens,
        int statusCode, string? errorMessage, int? durationMs)
    {
        await using var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand("dbo.SP_LogAssistantRequest", conn) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("@UserId",           userId);
        cmd.Parameters.AddWithValue("@Area",             area);
        cmd.Parameters.AddWithValue("@GeminiModel",      model);
        cmd.Parameters.AddWithValue("@PromptTokens",     (object?)promptTokens     ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@CompletionTokens", (object?)completionTokens ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@StatusCode",       statusCode);
        cmd.Parameters.AddWithValue("@ErrorMessage",     (object?)errorMessage     ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@DurationMs",       (object?)durationMs       ?? DBNull.Value);
        await cmd.ExecuteNonQueryAsync();
    }

    // Usage summary
    public async Task<object> GetUserUsageSummaryAsync(string userId)
    {
        await using var conn = new SqlConnection(ConnectionString);
        await conn.OpenAsync();
        await using var cmd = new SqlCommand("dbo.SP_GetUserUsageSummary", conn) { CommandType = CommandType.StoredProcedure };
        cmd.Parameters.AddWithValue("@UserId", userId);
        await using var reader = await cmd.ExecuteReaderAsync();
        if (!await reader.ReadAsync()) return new { };

        return new
        {
            PlanId                  = reader["PlanId"],
            PlanName                = reader["PlanName"],
            GeminiModel             = reader["GeminiModel"],
            AllowCodeChanges        = reader["AllowCodeChanges"],
            AllowWorkspaceScan      = reader["AllowWorkspaceScan"],
            AssistantRequestsUsed   = reader["AssistantRequestsUsed"],
            AssistantRequestsLimit  = reader["AssistantRequestsLimit"],
            WorkspaceScansUsed      = reader["WorkspaceScansUsed"],
            WorkspaceScansLimit     = reader["WorkspaceScansLimit"]
        };
    }

    // ── Mapping helpers ───────────────────────────────────────────────────────

    private static UserAccount MapUser(SqlDataReader r) => MapUserCore(r, string.Empty);
    private static UserAccount MapUserWithHash(SqlDataReader r) => MapUserCore(r, r.GetString("PasswordHash"));

    private static UserAccount MapUserCore(SqlDataReader r, string passwordHash)
    {
        var plan = new SubscriptionPlan(
            r.GetString("PlanId"),
            r.GetString("PlanName"),
            r.GetDecimal("MonthlyPrice"),
            0, 0, []);

        var status = r.GetString("SubscriptionStatus").Equals("Active", StringComparison.OrdinalIgnoreCase)
            ? SubscriptionStatus.Active : SubscriptionStatus.Canceled;

        var subscription = new Subscription(
            plan, status,
            r.GetDateTimeOffset(r.GetOrdinal("StartedAt")),
            r.IsDBNull(r.GetOrdinal("RenewsAt"))   ? null : r.GetDateTimeOffset(r.GetOrdinal("RenewsAt")),
            r.IsDBNull(r.GetOrdinal("CanceledAt"))  ? null : r.GetDateTimeOffset(r.GetOrdinal("CanceledAt")));

        return new UserAccount
        {
            Id           = r.GetString("UserId"),
            Name         = r.GetString("Name"),
            Email        = r.GetString("Email"),
            PasswordHash = passwordHash,
            Subscription = subscription,
            CreatedAt    = r.GetDateTimeOffset(r.GetOrdinal("CreatedAt")),
            LastSignedInAt = r.IsDBNull(r.GetOrdinal("LastSignedInAt"))
                ? null : r.GetDateTimeOffset(r.GetOrdinal("LastSignedInAt"))
        };
    }
}

// ── Token service ─────────────────────────────────────────────────────────────

public sealed class TokenService(IConfiguration configuration)
{
    private readonly byte[] secret = Encoding.UTF8.GetBytes(
        configuration["Auth:TokenSecret"] ?? "local-development-secret-change-before-production");

    public string CreateToken(UserAccount user)
    {
        var payload = new TokenPayload(user.Email, DateTimeOffset.UtcNow.AddHours(12).ToUnixTimeSeconds());
        var encoded = Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(payload));
        return $"{encoded}.{Sign(encoded)}";
    }

    public string? ValidateToken(string token)
    {
        var parts = token.Split('.', 2);
        if (parts.Length != 2 || !FixedTimeEquals(Sign(parts[0]), parts[1])) return null;
        var payload = JsonSerializer.Deserialize<TokenPayload>(Base64UrlDecode(parts[0]));
        if (payload is null || payload.ExpiresAt < DateTimeOffset.UtcNow.ToUnixTimeSeconds()) return null;
        return payload.Email;
    }

    private string Sign(string value)
    {
        using var hmac = new HMACSHA256(secret);
        return Base64UrlEncode(hmac.ComputeHash(Encoding.UTF8.GetBytes(value)));
    }

    private static bool FixedTimeEquals(string l, string r)
    {
        var lb = Encoding.UTF8.GetBytes(l);
        var rb = Encoding.UTF8.GetBytes(r);
        return lb.Length == rb.Length && CryptographicOperations.FixedTimeEquals(lb, rb);
    }

    private static string Base64UrlEncode(byte[] v) =>
        Convert.ToBase64String(v).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string v)
    {
        var p = v.Replace('-', '+').Replace('_', '/');
        p = p.PadRight(p.Length + (4 - p.Length % 4) % 4, '=');
        return Convert.FromBase64String(p);
    }
}

public sealed record TokenPayload(string Email, long ExpiresAt);

// ── Password hasher ───────────────────────────────────────────────────────────

public static class PasswordHasher
{
    private const int SaltSize = 16, HashSize = 32, Iterations = 100_000;

    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, HashSize);
        return $"{Iterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    public static bool Verify(string password, string storedHash)
    {
        var parts = storedHash.Split('.', 3);
        if (parts.Length != 3 || !int.TryParse(parts[0], out var iterations)) return false;
        var salt     = Convert.FromBase64String(parts[1]);
        var expected = Convert.FromBase64String(parts[2]);
        var actual   = Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);
        return CryptographicOperations.FixedTimeEquals(expected, actual);
    }
}
