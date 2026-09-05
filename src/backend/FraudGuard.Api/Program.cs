using System;
using System.Linq;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using FraudGuard.Api.Data;
using FraudGuard.Api.Middleware;
using FraudGuard.Api.Models;
using FraudGuard.Api.Services;
using FraudGuard.Api.Hubs;

var builder = WebApplication.CreateBuilder(args);

// 1. Database Context (SQL Server 2022)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<FraudGuardDbContext>(options =>
{
    options.UseSqlServer(connectionString, sqlServerOptions =>
    {
        sqlServerOptions.EnableRetryOnFailure(
            maxRetryCount: 5,
            maxRetryDelay: TimeSpan.FromSeconds(10),
            errorNumbersToAdd: null);
    });
});

// 2. CORS Policy for Angular Frontend (Environment Restricted)
var configuredOrigins = builder.Configuration.GetSection("CorsOrigins").Get<string[]>() ?? Array.Empty<string>();
var defaultOrigins = new[]
{
    "http://localhost:3000",
    "http://localhost:4200",
    "http://localhost:64988",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:4200",
    "http://127.0.0.1:64988",
    "http://192.168.1.109:3000",
    "http://192.168.1.110:3000"
};

var corsOrigins = configuredOrigins.Union(defaultOrigins).Distinct().ToArray();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularApp", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            policy.SetIsOriginAllowed(origin =>
            {
                if (string.IsNullOrEmpty(origin)) return false;
                if (corsOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase)) return true;
                if (Uri.TryCreate(origin, UriKind.Absolute, out var uri))
                {
                    return (uri.Host == "localhost" || uri.Host == "127.0.0.1" || uri.Host.StartsWith("192.168."))
                        && uri.Scheme == "http";
                }
                return false;
            })
            .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            .AllowAnyHeader()
            .AllowCredentials();
        }
        else
        {
            policy.WithOrigins(corsOrigins)
                  .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                  .AllowAnyHeader()
                  .AllowCredentials();
        }
    });
});

// 3. JWT Bearer Authentication & Token Configuration
var jwtConfig = builder.Configuration.GetSection("Jwt");
var jwtIssuer = jwtConfig.GetValue<string>("Issuer") ?? "FraudGuardAI";
var jwtAudience = jwtConfig.GetValue<string>("Audience") ?? "FraudGuardAI.Client";
var jwtSecretKey = Environment.GetEnvironmentVariable("JWT_SECRET_KEY")
    ?? builder.Configuration["JWT_SECRET_KEY"];

if (string.IsNullOrWhiteSpace(jwtSecretKey) || Encoding.UTF8.GetByteCount(jwtSecretKey) < 32)
{
    throw new InvalidOperationException(
        "CRITICAL SECURITY CONFIGURATION ERROR: 'JWT_SECRET_KEY' environment variable is missing, empty, or shorter than 32 bytes (256 bits). " +
        "Set the 'JWT_SECRET_KEY' environment variable before launching the service.");
}
var jwtKeyBytes = Encoding.UTF8.GetBytes(jwtSecretKey);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(jwtKeyBytes),
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromMinutes(1)
    };
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs"))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();

// 4. Rate Limiting for Login & Sensitive Endpoints
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("login_policy", opt =>
    {
        opt.PermitLimit = 10;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 0;
    });
    options.AddFixedWindowLimiter("ai_policy", opt =>
    {
        opt.PermitLimit = 10;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 0;
    });
    options.AddFixedWindowLimiter("fraud_policy", opt =>
    {
        opt.PermitLimit = 30;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        opt.QueueLimit = 0;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

// 5. Domain Services Dependency Injection
var fastApiConfig = builder.Configuration.GetSection("FastApi");
var fastApiBaseUrl = fastApiConfig.GetValue<string>("BaseUrl") ?? "http://127.0.0.1:8000/";
var fastApiTimeout = fastApiConfig.GetValue<int?>("TimeoutSeconds") ?? 30;
var fastApiInternalSecret = Environment.GetEnvironmentVariable("FASTAPI_INTERNAL_SECRET")
    ?? fastApiConfig.GetValue<string>("InternalSecret")
    ?? string.Empty;

builder.Services.AddHttpClient<IFastApiClient, FastApiClient>(client =>
{
    client.BaseAddress = new Uri(fastApiBaseUrl);
    client.Timeout = TimeSpan.FromSeconds(fastApiTimeout);
    if (!string.IsNullOrEmpty(fastApiInternalSecret))
    {
        client.DefaultRequestHeaders.Add("X-Internal-Secret", fastApiInternalSecret);
    }
});

builder.Services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();
builder.Services.AddSingleton<FraudPredictionMapper>();
builder.Services.AddScoped<IFraudPredictionService, FraudPredictionService>();

builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ICustomerService, CustomerService>();
builder.Services.AddScoped<IAccountService, AccountService>();
builder.Services.AddScoped<ITransactionService, TransactionService>();
builder.Services.AddScoped<IFraudAlertService, FraudAlertService>();
builder.Services.AddScoped<IInvestigationService, InvestigationService>();
builder.Services.AddScoped<IReportService, ReportService>();
builder.Services.AddScoped<IAuditLogService, AuditLogService>();
builder.Services.AddScoped<IAnalyticsService, AnalyticsService>();
builder.Services.AddScoped<IAIInvestigatorService, AIInvestigatorService>();

builder.Services.AddMemoryCache();
builder.Services.AddSignalR();

// 6. Controllers & JSON Options
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

// 7. Swagger / OpenAPI Documentation with JWT Bearer Security
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "FraudGuard AI — API Documentation",
        Version = "v1",
        Description = "Enterprise RESTful Web API for Agentic Financial Fraud Investigation, Alert Triage & Risk Intelligence.",
        Contact = new OpenApiContact
        {
            Name = "FraudGuard AI Engineering Team",
            Email = "engineering@fraudguard.enterprise.io"
        }
    });

    // Configure JWT Bearer Authorization in Swagger UI
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token in the text input below.\r\n\r\nExample: \"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// 8. Global Exception & Security Headers Middleware
app.UseMiddleware<ExceptionMiddleware>();
app.UseMiddleware<SecurityHeadersMiddleware>();

// 9. Swagger Documentation UI (Restricted to Development)
if (app.Environment.IsDevelopment() || builder.Configuration.GetValue<bool>("EnableSwaggerInProduction"))
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "FraudGuard AI API v1");
        c.RoutePrefix = "swagger";
    });
}

// 10. Pipeline Routing, Rate Limiting, Authentication & Authorization
app.UseCors("AllowAngularApp");

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<AnalyticsHub>("/hubs/analytics");

app.Run();
