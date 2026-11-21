using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using FraudGuard.Api.Middleware;
using Xunit;

namespace FraudGuard.Api.Tests
{
    public class CsrfHeaderMiddlewareTests
    {
        private static async Task<(int status, bool reachedApp)> Send(string method, bool cookie, string? header)
        {
            var ctx = new DefaultHttpContext();
            ctx.Response.Body = new MemoryStream();
            ctx.Request.Method = method;
            if (cookie) ctx.Request.Headers["Cookie"] = "FG_Auth=abc";
            if (header != null) ctx.Request.Headers[CsrfHeaderMiddleware.HeaderName] = header;
            var reached = false;
            await new CsrfHeaderMiddleware(_ => { reached = true; return Task.CompletedTask; }).InvokeAsync(ctx);
            return (ctx.Response.StatusCode, reached);
        }

        [Theory]
        [InlineData("POST")]
        [InlineData("PUT")]
        [InlineData("PATCH")]
        [InlineData("DELETE")]
        public async Task CookieAuthenticatedUnsafeRequest_WithoutHeader_IsBlocked(string method)
        {
            var (status, reached) = await Send(method, cookie: true, header: null);
            Assert.Equal(403, status);
            Assert.False(reached);
        }

        [Fact]
        public async Task WrongHeaderValue_IsBlocked()
        {
            var (status, reached) = await Send("POST", cookie: true, header: "fetch");
            Assert.Equal(403, status);
            Assert.False(reached);
        }

        [Fact]
        public async Task CookieAuthenticatedUnsafeRequest_WithHeader_Passes()
        {
            var (_, reached) = await Send("POST", cookie: true, header: "XMLHttpRequest");
            Assert.True(reached);
        }

        [Theory]
        [InlineData("GET", true)]    // safe method
        [InlineData("POST", false)]  // no ambient cookie credential (Bearer client / login)
        public async Task SafeMethodOrNoCookie_Passes(string method, bool cookie)
        {
            var (_, reached) = await Send(method, cookie, header: null);
            Assert.True(reached);
        }
    }
}
