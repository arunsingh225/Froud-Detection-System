using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace FraudGuard.Api.Services.ExternalLogin
{
    public sealed class TwilioOptions
    {
        public string? AccountSid { get; set; }
        public string? AuthToken { get; set; }
        public string? From { get; set; }
        public bool IsComplete => !string.IsNullOrWhiteSpace(AccountSid) && !string.IsNullOrWhiteSpace(AuthToken) && !string.IsNullOrWhiteSpace(From);
    }

    /// <summary>Configuration section "Sms": Provider is "console" (demo only), "twilio", or empty (phone sign-in disabled).</summary>
    public sealed class SmsOptions
    {
        public string? Provider { get; set; }
        public TwilioOptions Twilio { get; set; } = new();
    }

    public interface ISmsSender
    {
        /// <summary>False when no provider is configured; phone sign-in is then switched off.</summary>
        bool Enabled { get; }
        string ProviderName { get; }
        Task SendAsync(string toE164, string message, CancellationToken cancellationToken = default);
    }

    /// <summary>No provider configured.</summary>
    public sealed class NullSmsSender : ISmsSender
    {
        public bool Enabled => false;
        public string ProviderName => "none";
        public Task SendAsync(string toE164, string message, CancellationToken cancellationToken = default)
            => throw new InvalidOperationException("No SMS provider is configured.");
    }

    /// <summary>
    /// DEMO ONLY. Writes the message (including the code) to the API log instead of sending an SMS, so phone sign-in
    /// can be tried without an SMS account. Never use it where other people can read the log.
    /// </summary>
    public sealed class ConsoleSmsSender : ISmsSender
    {
        private readonly ILogger<ConsoleSmsSender> _logger;
        public ConsoleSmsSender(ILogger<ConsoleSmsSender> logger) => _logger = logger;

        public bool Enabled => true;
        public string ProviderName => "console";

        public Task SendAsync(string toE164, string message, CancellationToken cancellationToken = default)
        {
            _logger.LogWarning("[SMS demo, not sent] To {To}: {Message}", PhoneNumberNormalizer.Mask(toE164), message);
            return Task.CompletedTask;
        }
    }

    /// <summary>Sends SMS through the Twilio REST API.</summary>
    public sealed class TwilioSmsSender : ISmsSender
    {
        private readonly HttpClient _http;
        private readonly TwilioOptions _options;

        public TwilioSmsSender(HttpClient http, TwilioOptions options)
        {
            _http = http;
            _options = options;
        }

        public bool Enabled => _options.IsComplete;
        public string ProviderName => "twilio";

        public async Task SendAsync(string toE164, string message, CancellationToken cancellationToken = default)
        {
            var url = $"https://api.twilio.com/2010-04-01/Accounts/{Uri.EscapeDataString(_options.AccountSid!)}/Messages.json";
            using var request = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["To"] = toE164,
                    ["From"] = _options.From!,
                    ["Body"] = message
                })
            };
            var basic = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{_options.AccountSid}:{_options.AuthToken}"));
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", basic);

            using var response = await _http.SendAsync(request, cancellationToken);
            response.EnsureSuccessStatusCode();
        }
    }
}
