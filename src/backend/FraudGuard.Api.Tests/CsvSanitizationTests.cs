using FraudGuard.Api.Services;
using Xunit;

namespace FraudGuard.Api.Tests
{
    public class CsvSanitizationTests
    {
        [Theory]
        [InlineData("=1+1", "'=1+1")]
        [InlineData("+2+2", "'+2+2")]
        [InlineData("-cmd|' /C calc'!A0", "'-cmd|' /C calc'!A0")]
        [InlineData("@SUM(A1:A10)", "'@SUM(A1:A10)")]
        [InlineData("\tmalicious", "'\tmalicious")]
        [InlineData("\rmalicious", "'\rmalicious")]
        public void SanitizeCsvCell_PrefixesRiskyCharacters_WithSingleQuote(string input, string expected)
        {
            var result = AnalyticsService.SanitizeCsvCell(input);
            Assert.Equal(expected, result);
        }

        [Theory]
        [InlineData("TXN-2026-0001", "TXN-2026-0001")]
        [InlineData("Riya Desai", "Riya Desai")]
        [InlineData("Normal clean text", "Normal clean text")]
        [InlineData("", "")]
        [InlineData(null, "")]
        public void SanitizeCsvCell_LeavesBenignTextUnchanged(string? input, string expected)
        {
            var result = AnalyticsService.SanitizeCsvCell(input);
            Assert.Equal(expected, result);
        }

        [Fact]
        public void SanitizeCsvCell_EscapesDoubleQuotes()
        {
            var input = "Text with \"quotes\" inside";
            var result = AnalyticsService.SanitizeCsvCell(input);
            Assert.Equal("Text with \"\"quotes\"\" inside", result);
        }
    }
}
