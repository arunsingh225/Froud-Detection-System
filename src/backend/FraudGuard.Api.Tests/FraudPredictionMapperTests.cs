using System;
using FraudGuard.Api.DTOs.Fraud;
using FraudGuard.Api.Models;
using FraudGuard.Api.Services;
using Xunit;

namespace FraudGuard.Api.Tests
{
    public class FraudPredictionMapperTests
    {
        private readonly FraudPredictionMapper _mapper = new();

        [Fact]
        public void MapToFastApiRequest_NormalizesInrAmountToUsd()
        {
            // Arrange
            var txn = new Transaction
            {
                TransactionId = Guid.NewGuid(),
                TransactionCode = "TXN-001",
                AmountInr = 8350.00m,
                PaymentMethod = "Visa Credit",
                City = "Mumbai",
                Country = "India",
                TransactionTimestamp = DateTimeOffset.UtcNow
            };

            // Act
            var request = _mapper.MapToFastApiRequest(txn);

            // Assert
            Assert.Equal(100.00m, request.TransactionAmt); // 8350 / 83.5 = 100.00
            Assert.Equal("visa", request.Card4);
            Assert.Equal("credit", request.Card6);
            Assert.True(request.Card1 > 0);
            Assert.True(request.Addr1 > 0);
            Assert.Equal(87.0m, request.Addr2);
        }

        [Fact]
        public void MapToFastApiRequest_ExtractsEmailDomainAndDeviceTelemetry()
        {
            // Arrange
            var customer = new Customer
            {
                CustomerId = Guid.NewGuid(),
                FullName = "Priya Sharma",
                Email = "priya.sharma@hdfcbank.com"
            };

            var device = new Device
            {
                DeviceId = Guid.NewGuid(),
                DeviceType = "Mobile",
                OperatingSystem = "iOS 16"
            };

            var txn = new Transaction
            {
                TransactionId = Guid.NewGuid(),
                AmountInr = 5000m,
                Customer = customer,
                Device = device,
                PaymentMethod = "Mastercard Debit",
                City = "Delhi",
                Country = "India",
                VPNOrProxyDetected = true
            };

            // Act
            var request = _mapper.MapToFastApiRequest(txn);

            // Assert
            Assert.Equal("hdfcbank.com", request.PEmailDomain);
            Assert.Equal("mastercard", request.Card4);
            Assert.Equal("debit", request.Card6);
            Assert.Contains("Mobile", request.DeviceInfo!);
            Assert.Equal("mobile", request.DeviceType);
            Assert.Equal(15.0m, request.C13); // High synthetic velocity on VPN detection
        }

        [Fact]
        public void MapDtoToFastApiRequest_HandlesAdHocPayload()
        {
            // Arrange
            var dto = new PredictFraudRequestDto
            {
                TransactionAmount = 16700.00m,
                PaymentMethod = "Credit Card",
                CardLast4 = "4321",
                City = "Bengaluru",
                VpnDetected = false
            };

            // Act
            var request = _mapper.MapDtoToFastApiRequest(dto);

            // Assert
            Assert.Equal(200.00m, request.TransactionAmt);
            Assert.Equal("credit", request.Card6);
            Assert.Equal(2.0m, request.C13);
        }
    }
}
