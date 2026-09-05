using System;
using System.Collections.Generic;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using FraudGuard.Api.DTOs.Common;

namespace FraudGuard.Api.Middleware
{
    public class ExceptionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ExceptionMiddleware> _logger;
        private readonly IWebHostEnvironment _env;

        public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger, IWebHostEnvironment env)
        {
            _next = next;
            _logger = logger;
            _env = env;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                var correlationId = context.TraceIdentifier;
                _logger.LogError(ex, "Unhandled exception [CorrelationId: {CorrelationId}] processing {Method} {Path}",
                    correlationId, context.Request.Method, context.Request.Path);

                await HandleExceptionAsync(context, ex, correlationId);
            }
        }

        private Task HandleExceptionAsync(HttpContext context, Exception exception, string correlationId)
        {
            context.Response.ContentType = "application/json";
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;

            var safeErrors = new List<string>
            {
                $"Reference correlation ID: {correlationId}"
            };

            if (_env.IsDevelopment())
            {
                // In local development, include sanitized exception type without exposing credentials or disk paths
                safeErrors.Add($"Exception: {exception.GetType().Name}");
            }

            var response = ApiResponse<object>.Fail(
                "An unexpected server error occurred while processing your request.",
                safeErrors
            );

            var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            return context.Response.WriteAsync(json);
        }
    }
}
