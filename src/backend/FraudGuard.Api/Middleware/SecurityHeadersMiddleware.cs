using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace FraudGuard.Api.Middleware
{
    public class SecurityHeadersMiddleware
    {
        private readonly RequestDelegate _next;

        public SecurityHeadersMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            context.Response.OnStarting(() =>
            {
                var headers = context.Response.Headers;

                if (!headers.ContainsKey("X-Content-Type-Options"))
                {
                    headers["X-Content-Type-Options"] = "nosniff";
                }

                if (!headers.ContainsKey("X-Frame-Options"))
                {
                    headers["X-Frame-Options"] = "DENY";
                }

                if (!headers.ContainsKey("Referrer-Policy"))
                {
                    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
                }

                if (!headers.ContainsKey("X-XSS-Protection"))
                {
                    headers["X-XSS-Protection"] = "1; mode=block";
                }

                if (!headers.ContainsKey("Permissions-Policy"))
                {
                    headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()";
                }

                if (!headers.ContainsKey("Strict-Transport-Security") && context.Request.IsHttps)
                {
                    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
                }

                if (!headers.ContainsKey("Content-Security-Policy"))
                {
                    headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' http://localhost:* http://127.0.0.1:* http://192.168.* ws://localhost:* ws://127.0.0.1:* ws://192.168.* wss://localhost:* wss://127.0.0.1:* wss://192.168.*; frame-ancestors 'none';";
                }

                return Task.CompletedTask;
            });

            await _next(context);
        }
    }
}
