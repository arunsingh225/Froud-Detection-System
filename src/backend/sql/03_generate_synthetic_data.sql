-- ============================================================================
-- FraudGuard AI — Enterprise Financial Fraud Investigation & Risk Intelligence
-- Stored Procedure: Automated Synthetic Data Generator for Development
-- Database: FraudGuardAI_DB
-- ============================================================================

USE [FraudGuardAI_DB];
GO

IF OBJECT_ID(N'dbo.sp_GenerateSyntheticFraudData', N'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GenerateSyntheticFraudData;
GO

CREATE PROCEDURE dbo.sp_GenerateSyntheticFraudData
    @TransactionCount INT = 200
AS
BEGIN
    SET NOCOUNT ON;

    PRINT 'Starting automated synthetic fraud data generation: ' + CAST(@TransactionCount AS VARCHAR(10)) + ' records...';

    -- Prepare reference collections
    DECLARE @Accounts TABLE (Idx INT IDENTITY(1,1), AccountId UNIQUEIDENTIFIER, CustomerId UNIQUEIDENTIFIER);
    INSERT INTO @Accounts (AccountId, CustomerId)
    SELECT AccountId, CustomerId FROM dbo.Accounts;

    DECLARE @AccountTotal INT = (SELECT COUNT(*) FROM @Accounts);
    IF @AccountTotal = 0
    BEGIN
        RAISERROR('No accounts found. Please run 02_seed_demo_data.sql first.', 16, 1);
        RETURN;
    END;

    DECLARE @Merchants TABLE (Idx INT IDENTITY(1,1), MerchantId UNIQUEIDENTIFIER, Category NVARCHAR(50));
    INSERT INTO @Merchants (MerchantId, Category)
    SELECT MerchantId, Category FROM dbo.Merchants;
    DECLARE @MerchantTotal INT = (SELECT COUNT(*) FROM @Merchants);

    DECLARE @Devices TABLE (Idx INT IDENTITY(1,1), DeviceId UNIQUEIDENTIFIER, IsRooted BIT);
    INSERT INTO @Devices (DeviceId, IsRooted)
    SELECT DeviceId, IsRootedOrJailbroken FROM dbo.Devices;
    DECLARE @DeviceTotal INT = (SELECT COUNT(*) FROM @Devices);

    DECLARE @Users TABLE (Idx INT IDENTITY(1,1), UserId UNIQUEIDENTIFIER);
    INSERT INTO @Users (UserId)
    SELECT UserId FROM dbo.Users WHERE Role IN ('INVESTIGATOR', 'ADMIN');
    DECLARE @UserTotal INT = (SELECT COUNT(*) FROM @Users);

    -- Cities and Coordinates
    DECLARE @Cities TABLE (Idx INT IDENTITY(1,1), City NVARCHAR(100), Country NVARCHAR(100), Lat DECIMAL(9,6), Lon DECIMAL(9,6));
    INSERT INTO @Cities (City, Country, Lat, Lon)
    VALUES 
    (N'Mumbai', N'India', 19.0760, 72.8777),
    (N'Delhi', N'India', 28.6139, 77.2090),
    (N'Bangalore', N'India', 12.9716, 77.5946),
    (N'Hyderabad', N'India', 17.3850, 78.4867),
    (N'Chennai', N'India', 13.0827, 80.2707),
    (N'Pune', N'India', 18.5204, 73.8567),
    (N'Kolkata', N'India', 22.5726, 88.3639),
    (N'Dubai', N'United Arab Emirates', 25.2048, 55.2708),
    (N'Singapore', N'Singapore', 1.3521, 103.8198),
    (N'Tbilisi', N'Georgia', 41.7151, 44.8271),
    (N'London', N'United Kingdom', 51.5074, -0.1278);
    DECLARE @CityTotal INT = (SELECT COUNT(*) FROM @Cities);

    -- Payment Methods
    DECLARE @Methods TABLE (Idx INT IDENTITY(1,1), Method NVARCHAR(50));
    INSERT INTO @Methods (Method)
    VALUES 
    (N'UPI (PhonePe)'), (N'UPI (Google Pay)'), (N'Credit Card'), (N'Debit Card'), (N'RTGS Wire Transfer'), (N'IMPS');

    DECLARE @i INT = 1;
    DECLARE @NextCodeNum INT = 1000 + (SELECT ISNULL(COUNT(*), 0) FROM dbo.Transactions);

    WHILE @i <= @TransactionCount
    BEGIN
        -- Pick pseudo-random properties
        DECLARE @AccIdx INT = 1 + (ABS(CHECKSUM(NEWID())) % @AccountTotal);
        DECLARE @MerIdx INT = 1 + (ABS(CHECKSUM(NEWID())) % @MerchantTotal);
        DECLARE @DevIdx INT = 1 + (ABS(CHECKSUM(NEWID())) % @DeviceTotal);
        DECLARE @CitIdx INT = 1 + (ABS(CHECKSUM(NEWID())) % @CityTotal);
        DECLARE @MetIdx INT = 1 + (ABS(CHECKSUM(NEWID())) % 6);

        DECLARE @AccId UNIQUEIDENTIFIER, @CustId UNIQUEIDENTIFIER;
        SELECT @AccId = AccountId, @CustId = CustomerId FROM @Accounts WHERE Idx = @AccIdx;

        DECLARE @MerId UNIQUEIDENTIFIER, @Category NVARCHAR(50);
        SELECT @MerId = MerchantId, @Category = Category FROM @Merchants WHERE Idx = @MerIdx;

        DECLARE @DevId UNIQUEIDENTIFIER, @IsDevRooted BIT;
        SELECT @DevId = DeviceId, @IsDevRooted = IsRooted FROM @Devices WHERE Idx = @DevIdx;

        DECLARE @City NVARCHAR(100), @Country NVARCHAR(100), @Lat DECIMAL(9,6), @Lon DECIMAL(9,6);
        SELECT @City = City, @Country = Country, @Lat = Lat, @Lon = Lon FROM @Cities WHERE Idx = @CitIdx;

        DECLARE @Method NVARCHAR(50);
        SELECT @Method = Method FROM @Methods WHERE Idx = @MetIdx;

        -- Random Roll for Risk Distribution (88% Low, 8% Medium, 4% High/Critical)
        DECLARE @Roll INT = ABS(CHECKSUM(NEWID())) % 100;
        DECLARE @Amount DECIMAL(18,2);
        DECLARE @Prob DECIMAL(5,2);
        DECLARE @RiskTier NVARCHAR(20);
        DECLARE @Status NVARCHAR(30);
        DECLARE @Vpn BIT = 0;
        DECLARE @Distance DECIMAL(10,2) = 5.00 + (ABS(CHECKSUM(NEWID())) % 20);
        DECLARE @Reason NVARCHAR(MAX);

        IF @Roll < 88  -- Low Risk (Normal Traffic)
        BEGIN
            SET @Amount = 500.00 + (ABS(CHECKSUM(NEWID())) % 25000);
            SET @Prob = 2.00 + (ABS(CHECKSUM(NEWID())) % 2200) / 100.0;
            SET @RiskTier = N'Low';
            SET @Status = N'Approved';
            SET @Vpn = 0;
            SET @Reason = N'Routine retail velocity consistent with 90-day baseline.';
        END
        ELSE IF @Roll < 96 -- Medium Risk (Elevated)
        BEGIN
            SET @Amount = 35000.00 + (ABS(CHECKSUM(NEWID())) % 180000);
            SET @Prob = 35.00 + (ABS(CHECKSUM(NEWID())) % 3200) / 100.0;
            SET @RiskTier = N'Medium';
            SET @Status = N'Pending Review';
            SET @Vpn = CASE WHEN (ABS(CHECKSUM(NEWID())) % 2) = 1 THEN 1 ELSE 0 END;
            SET @Reason = N'Amount exceeds 4x historical average. Velocity check triggered.';
        END
        ELSE -- Critical / High Risk (Anomalous)
        BEGIN
            SET @Amount = 250000.00 + (ABS(CHECKSUM(NEWID())) % 3500000);
            SET @Prob = 75.00 + (ABS(CHECKSUM(NEWID())) % 2400) / 100.0;
            SET @RiskTier = CASE WHEN @Prob > 92.00 THEN N'Critical' ELSE N'High' END;
            SET @Status = N'Investigating';
            SET @Vpn = 1;
            SET @Distance = 1200.00 + (ABS(CHECKSUM(NEWID())) % 6000);
            SET @Reason = N'Extreme velocity spike (>15x baseline). Unregistered VPN exit node and novel geographic origin.';
        END

        -- Time offset: between 1 and 30 days ago
        DECLARE @MinutesAgo INT = ABS(CHECKSUM(NEWID())) % (30 * 24 * 60);
        DECLARE @TxnTime DATETIMEOFFSET = DATEADD(MINUTE, -@MinutesAgo, SYSDATETIMEOFFSET());
        DECLARE @TxnCode NVARCHAR(50) = N'TXN-2026-' + RIGHT('000000' + CAST(@NextCodeNum + @i AS VARCHAR(10)), 6);
        DECLARE @TxnId UNIQUEIDENTIFIER = NEWID();

        INSERT INTO dbo.Transactions
        (TransactionId, TransactionCode, AccountId, CustomerId, MerchantId, DeviceId, AmountInr, AmountUsd, PaymentMethod, IPAddress, City, Country, Latitude, Longitude, DistanceFromTypicalKm, VPNOrProxyDetected, TransactionTimestamp, Status)
        VALUES
        (@TxnId, @TxnCode, @AccId, @CustId, @MerId, @DevId, @Amount, ROUND(@Amount / 83.5, 2), @Method, 
         CAST(100 + (ABS(CHECKSUM(NEWID())) % 100) AS VARCHAR(3)) + N'.' +
         CAST(ABS(CHECKSUM(NEWID())) % 255 AS VARCHAR(3)) + N'.' +
         CAST(ABS(CHECKSUM(NEWID())) % 255 AS VARCHAR(3)) + N'.' +
         CAST(ABS(CHECKSUM(NEWID())) % 255 AS VARCHAR(3)),
         @City, @Country, @Lat, @Lon, @Distance, @Vpn, @TxnTime, @Status);

        -- Insert FraudPrediction
        DECLARE @VelocityRatio DECIMAL(8,2) = CASE WHEN @Roll >= 96 THEN 18.50 ELSE (CASE WHEN @Roll >= 88 THEN 4.20 ELSE 1.10 END) END;
        INSERT INTO dbo.FraudPredictions
        (TransactionId, ModelName, ModelVersion, FraudProbability, RiskTier, InferenceLatencyMs, VelocityRatio, AnomalyReason, PredictedAt)
        VALUES
        (@TxnId, N'FraudNet v3.1', N'3.1.2', @Prob, @RiskTier, 18 + (ABS(CHECKSUM(NEWID())) % 15), @VelocityRatio, @Reason, @TxnTime);

        -- If High/Critical, also trigger FraudAlert and Investigation
        IF @RiskTier IN ('High', 'Critical')
        BEGIN
            DECLARE @AlertId UNIQUEIDENTIFIER = NEWID();
            DECLARE @AlertCode NVARCHAR(50) = N'ALT-2026-' + RIGHT('0000' + CAST(1000 + @i AS VARCHAR(10)), 4);
            DECLARE @AssignedUser UNIQUEIDENTIFIER;
            SELECT TOP 1 @AssignedUser = UserId FROM @Users ORDER BY NEWID();

            INSERT INTO dbo.FraudAlerts
            (AlertId, AlertCode, TransactionId, CustomerId, Severity, AlertType, Reason, Status, AssignedToUserId, CreatedAt)
            VALUES
            (@AlertId, @AlertCode, @TxnId, @CustId, @RiskTier, N'Synthetic Anomaly Breach', @Reason, N'Investigating', @AssignedUser, @TxnTime);

            DECLARE @InvId UNIQUEIDENTIFIER = NEWID();
            DECLARE @InvCode NVARCHAR(50) = N'INV-2026-' + RIGHT('0000' + CAST(500 + @i AS VARCHAR(10)), 4);

            INSERT INTO dbo.Investigations
            (InvestigationId, InvestigationCode, AlertId, TransactionId, CustomerId, Priority, Status, AssignedInvestigatorId, ResolutionDecision, CreatedAt)
            VALUES
            (@InvId, @InvCode, @AlertId, @TxnId, @CustId, @RiskTier, N'Investigating', @AssignedUser, N'Auto-Flag for Review', @TxnTime);

            -- Evidence
            INSERT INTO dbo.InvestigationEvidence
            (InvestigationId, Category, FindingType, FindingDetail, Confidence, Severity, Source, EvidenceTimestamp)
            VALUES
            (@InvId, N'Transaction', N'Velocity Threshold', N'Amount ₹' + CAST(@Amount AS VARCHAR(20)) + N' breached 90-day threshold.', 95.00, LOWER(@RiskTier), N'RuleEngine v4.2', @TxnTime),
            (@InvId, N'ML', N'FraudNet v3.1 Score', N'Model inference computed ' + CAST(@Prob AS VARCHAR(10)) + N'% probability.', @Prob, LOWER(@RiskTier), N'FraudNet v3.1', @TxnTime);

            -- Timeline
            INSERT INTO dbo.InvestigationTimeline
            (InvestigationId, StepNumber, Label, Description, Status, ActorType, ActorName, StepTimestamp)
            VALUES
            (@InvId, 1, N'Transaction Monitored', N'Real-time ingestion flagged anomalous vector.', N'completed', N'system', N'StreamProcessor', @TxnTime),
            (@InvId, 2, N'Neural Scoring Done', N'FraudNet v3.1 generated risk inference.', N'completed', N'ai', N'FraudNet-AI', DATEADD(SECOND, 2, @TxnTime)),
            (@InvId, 3, N'Human Review Queued', N'Case assigned to investigator for review.', N'active', N'human', N'Investigator', DATEADD(SECOND, 5, @TxnTime));
        END

        SET @i = @i + 1;
    END;

    PRINT 'Successfully generated ' + CAST(@TransactionCount AS VARCHAR(10)) + ' synthetic transaction and risk records.';
END;
GO

PRINT 'Stored procedure dbo.sp_GenerateSyntheticFraudData created successfully.'
