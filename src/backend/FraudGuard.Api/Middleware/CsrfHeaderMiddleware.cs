using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace FraudGuard.Api.Middleware
{
    /// <summary>
    /// Defence-in-depth CSRF protection for cookie-authenticated, state-changing requests.
    ///
    /// Browsers attach the HttpOnly auth cookie automatically, so a malicious site could try to make the
    /// victim's browser send POST/PUT/PATCH/DELETE to this API. A cross-site request cannot add a custom
    /// header without a CORS preflight (which the CORS policy only grants to our own origins), so
    /// requiring one on unsafe methods blocks it. Requests that carry no auth cookie (Bearer-token
    /// clients, login) are not browser-ambient credentials and are not affected.
    /// SameSite=Strict (production) remains the first layer; this is the second.
    /// </summary>
    public class CsrfHeaderMiddleware
    {
        public const string HeaderName = "X-Requested-With";
        public const string HeaderValue = "XMLHttpRequest";
        private const string AuthCookieName = "FG_Auth";

        private readonly RequestDelegate _next;

        public CsrfHeaderMiddleware(RequestDelegate next) => _next = next;

        public async Task InvokeAsync(HttpContext context)
        {
            if (IsUnsafeMethod(context.Request.Method)
                && context.Request.Cookies.ContainsKey(AuthCookieName)
                && !string.Equals(context.Request.Headers[HeaderName], HeaderValue, StringComparison.Ordinal))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync(
                    "{\"success\":false,\"message\":\"Missing required anti-CSRF header.\"}");
                return;
            }

            await _next(context);
        }

        private static bool IsUnsafeMethod(string method) =>
            HttpMethods.IsPost(method) || HttpMethods.IsPut(method) ||
            HttpMethods.IsPatch(method) || HttpMethods.IsDelete(method);
    }
}
