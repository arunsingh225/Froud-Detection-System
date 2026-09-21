-- ============================================================================
-- FraudGuard AI — Enterprise Financial Fraud Investigation & Risk Intelligence
-- SQL Server 2022 Production Relational Schema
-- Database: FraudGuardAI_DB
-- ============================================================================

-- 1. Create Database if not exists
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = N'FraudGuardAI_DB')
BEGIN
    CREATE DATABASE [FraudGuardAI_DB]
    COLLATE Latin1_General_100_CI_AS_SC_UTF8;
END
GO

USE [FraudGuardAI_DB];
GO

-- Set recommended session settings
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- Drop Existing Tables (Reverse Order of Dependencies for clean re-run)
-- ============================================================================
IF OBJECT_ID(N'dbo.AuditLogs', N'U') IS NOT NULL DROP TABLE dbo.AuditLogs;
IF OBJECT_ID(N'dbo.Reports', N'U') IS NOT NULL DROP TABLE dbo.Reports;
IF OBJECT_ID(N'dbo.InvestigationTimeline', N'U') IS NOT NULL DROP TABLE dbo.InvestigationTimeline;
IF OBJECT_ID(N'dbo.InvestigationEvidence', N'U') IS NOT NULL DROP TABLE dbo.InvestigationEvidence;
IF OBJECT_ID(N'dbo.Investigations', N'U') IS NOT NULL DROP TABLE dbo.Investigations;
IF OBJECT_ID(N'dbo.FraudAlerts', N'U') IS NOT NULL DROP TABLE dbo.FraudAlerts;
IF OBJECT_ID(N'dbo.FraudPredictions', N'U') IS NOT NULL DROP TABLE dbo.FraudPredictions;
IF OBJECT_ID(N'dbo.Transactions', N'U') IS NOT NULL DROP TABLE dbo.Transactions;
IF OBJECT_ID(N'dbo.CustomerDevices', N'U') IS NOT NULL DROP TABLE dbo.CustomerDevices;
IF OBJECT_ID(N'dbo.Devices', N'U') IS NOT NULL DROP TABLE dbo.Devices;
IF OBJECT_ID(N'dbo.Merchants', N'U') IS NOT NULL DROP TABLE dbo.Merchants;
IF OBJECT_ID(N'dbo.Accounts', N'U') IS NOT NULL DROP TABLE dbo.Accounts;
IF OBJECT_ID(N'dbo.Customers', N'U') IS NOT NULL DROP TABLE dbo.Customers;
IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL DROP TABLE dbo.Users;
GO

-- ============================================================================
-- 1. Users (Platform Investigators, Compliance Officers, Admins)
-- ============================================================================
CREATE TABLE dbo.Users (
    UserId              UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    UserCode            NVARCHAR(50)        NOT NULL,
    FullName            NVARCHAR(100)       NOT NULL,
    Email               NVARCHAR(255)       NOT NULL,
    PasswordHash        NVARCHAR(255)       NOT NULL,
    Role                NVARCHAR(30)        NOT NULL,
    Department          NVARCHAR(100)       NULL,
    IsActive            BIT                 NOT NULL DEFAULT 1,
    AccessFailedCount   INT                 NOT NULL DEFAULT 0,
    LockoutEnd          DATETIMEOFFSET      NULL,
    LastLoginAt         DATETIMEOFFSET      NULL,
    CreatedAt           DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt           DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_Users PRIMARY KEY CLUSTERED (UserId),
    CONSTRAINT UQ_Users_UserCode UNIQUE (UserCode),
    CONSTRAINT UQ_Users_Email UNIQUE (Email),
    CONSTRAINT CK_Users_Role CHECK (Role IN ('ADMIN', 'INVESTIGATOR', 'ANALYST', 'VIEWER'))
);
GO

-- ============================================================================
-- 2. Customers (Entity Profiles & Behavioral Baselines)
-- ============================================================================
CREATE TABLE dbo.Customers (
    CustomerId          UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    CustomerCode        NVARCHAR(50)        NOT NULL,
    CustomerType        NVARCHAR(20)        NOT NULL DEFAULT 'INDIVIDUAL',
    FullName            NVARCHAR(150)       NOT NULL,
    Email               NVARCHAR(255)       NOT NULL,
    Phone               NVARCHAR(50)        NULL,
    AddressLine         NVARCHAR(255)       NULL,
    City                NVARCHAR(100)       NOT NULL,
    State               NVARCHAR(100)       NULL,
    Country             NVARCHAR(100)       NOT NULL DEFAULT 'India',
    PostalCode          NVARCHAR(20)        NULL,
    PAN                 NVARCHAR(20)        NULL,
    AadhaarMasked       NVARCHAR(20)        NULL,
    KYCStatus           NVARCHAR(20)        NOT NULL DEFAULT 'Pending',
    CustomerSinceYear   INT                 NOT NULL DEFAULT YEAR(GETDATE()),
    AccountAgeMonths    INT                 NOT NULL DEFAULT 0,
    BaselineAvgAmount   DECIMAL(18,2)       NOT NULL DEFAULT 0.00,
    Rolling30dVolume    DECIMAL(18,2)       NOT NULL DEFAULT 0.00,
    RiskScore           DECIMAL(5,2)        NOT NULL DEFAULT 0.00,
    RiskTier            NVARCHAR(20)        NOT NULL DEFAULT 'Low',
    Status              NVARCHAR(30)        NOT NULL DEFAULT 'Active',
    PriorFlagsCount     INT                 NOT NULL DEFAULT 0,
    CreatedAt           DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt           DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_Customers PRIMARY KEY CLUSTERED (CustomerId),
    CONSTRAINT UQ_Customers_CustomerCode UNIQUE (CustomerCode),
    CONSTRAINT CK_Customers_Type CHECK (CustomerType IN ('INDIVIDUAL', 'CORPORATE')),
    CONSTRAINT CK_Customers_KYC CHECK (KYCStatus IN ('Verified', 'Pending', 'Failed', 'Expired')),
    CONSTRAINT CK_Customers_RiskScore CHECK (RiskScore BETWEEN 0.00 AND 100.00),
    CONSTRAINT CK_Customers_RiskTier CHECK (RiskTier IN ('Critical', 'High', 'Medium', 'Low')),
    CONSTRAINT CK_Customers_Status CHECK (Status IN ('Active', 'Under Review', 'Suspended', 'Closed'))
);
GO

-- ============================================================================
-- 3. Accounts (Financial Accounts linked to Customers)
-- ============================================================================
CREATE TABLE dbo.Accounts (
    AccountId           UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    AccountCode         NVARCHAR(50)        NOT NULL,
    CustomerId          UNIQUEIDENTIFIER    NOT NULL,
    AccountNumber       NVARCHAR(50)        NOT NULL,
    AccountType         NVARCHAR(30)        NOT NULL,
    Currency            NVARCHAR(3)         NOT NULL DEFAULT 'INR',
    CurrentBalance      DECIMAL(18,2)       NOT NULL DEFAULT 0.00,
    DailyLimit          DECIMAL(18,2)       NOT NULL DEFAULT 1000000.00,
    Status              NVARCHAR(30)        NOT NULL DEFAULT 'ACTIVE',
    OpenedDate          DATE                NOT NULL,
    CreatedAt           DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt           DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_Accounts PRIMARY KEY CLUSTERED (AccountId),
    CONSTRAINT UQ_Accounts_AccountCode UNIQUE (AccountCode),
    CONSTRAINT UQ_Accounts_AccountNumber UNIQUE (AccountNumber),
    CONSTRAINT FK_Accounts_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId) ON DELETE CASCADE,
    CONSTRAINT CK_Accounts_Type CHECK (AccountType IN ('SAVINGS', 'CURRENT', 'CREDIT_CARD', 'VIRTUAL_WALLET', 'CORPORATE')),
    CONSTRAINT CK_Accounts_Status CHECK (Status IN ('ACTIVE', 'FLAGGED', 'RESTRICTED', 'FROZEN', 'CLOSED'))
);
GO

-- ============================================================================
-- 4. Merchants (Vendors & Virtual Asset Service Providers)
-- ============================================================================
CREATE TABLE dbo.Merchants (
    MerchantId          UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    MerchantCode        NVARCHAR(50)        NOT NULL,
    MerchantName        NVARCHAR(150)       NOT NULL,
    Category            NVARCHAR(50)        NOT NULL,
    MCC                 NVARCHAR(10)        NOT NULL,
    Country             NVARCHAR(100)       NOT NULL DEFAULT 'India',
    City                NVARCHAR(100)       NULL,
    RiskCategory        NVARCHAR(20)        NOT NULL DEFAULT 'Standard',
    IsVASP              BIT                 NOT NULL DEFAULT 0,
    CreatedAt           DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_Merchants PRIMARY KEY CLUSTERED (MerchantId),
    CONSTRAINT UQ_Merchants_MerchantCode UNIQUE (MerchantCode),
    CONSTRAINT CK_Merchants_RiskCategory CHECK (RiskCategory IN ('Elevated', 'High', 'Standard', 'Low'))
);
GO

-- ============================================================================
-- 5. Devices (Hardware & Session Fingerprints)
-- ============================================================================
CREATE TABLE dbo.Devices (
    DeviceId            UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    DeviceFingerprint   NVARCHAR(255)       NOT NULL,
    DeviceType          NVARCHAR(50)        NOT NULL,
    OperatingSystem     NVARCHAR(100)       NOT NULL,
    Browser             NVARCHAR(100)       NULL,
    IsRootedOrJailbroken BIT                NOT NULL DEFAULT 0,
    IsEmulator          BIT                 NOT NULL DEFAULT 0,
    FirstSeenAt         DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    LastSeenAt          DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_Devices PRIMARY KEY CLUSTERED (DeviceId),
    CONSTRAINT UQ_Devices_Fingerprint UNIQUE (DeviceFingerprint)
);
GO

-- ============================================================================
-- 6. CustomerDevices (M:N Link between Customers and Trusted Devices)
-- ============================================================================
CREATE TABLE dbo.CustomerDevices (
    CustomerId          UNIQUEIDENTIFIER    NOT NULL,
    DeviceId            UNIQUEIDENTIFIER    NOT NULL,
    IsTrusted           BIT                 NOT NULL DEFAULT 1,
    FirstLinkedAt       DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_CustomerDevices PRIMARY KEY CLUSTERED (CustomerId, DeviceId),
    CONSTRAINT FK_CustomerDevices_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId) ON DELETE CASCADE,
    CONSTRAINT FK_CustomerDevices_Devices FOREIGN KEY (DeviceId) REFERENCES dbo.Devices(DeviceId) ON DELETE CASCADE
);
GO

-- ============================================================================
-- 7. Transactions (Operational Transaction Ledger)
-- ============================================================================
CREATE TABLE dbo.Transactions (
    TransactionId       UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    TransactionCode     NVARCHAR(50)        NOT NULL,
    AccountId           UNIQUEIDENTIFIER    NOT NULL,
    CustomerId          UNIQUEIDENTIFIER    NOT NULL,
    MerchantId          UNIQUEIDENTIFIER    NULL,
    DeviceId            UNIQUEIDENTIFIER    NULL,
    AmountInr           DECIMAL(18,2)       NOT NULL,
    AmountUsd           DECIMAL(18,2)       NULL,
    PaymentMethod       NVARCHAR(50)        NOT NULL,
    CardLast4           NVARCHAR(4)         NULL,
    IPAddress           NVARCHAR(50)        NOT NULL,
    City                NVARCHAR(100)       NOT NULL,
    Country             NVARCHAR(100)       NOT NULL,
    Latitude            DECIMAL(9,6)        NULL,
    Longitude           DECIMAL(9,6)        NULL,
    DistanceFromTypicalKm DECIMAL(10,2)     NULL,
    VPNOrProxyDetected  BIT                 NOT NULL DEFAULT 0,
    TorExitNode         BIT                 NOT NULL DEFAULT 0,
    TransactionTimestamp DATETIMEOFFSET     NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    Status              NVARCHAR(30)        NOT NULL DEFAULT 'Pending Review',
    CreatedAt           DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt           DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_Transactions PRIMARY KEY CLUSTERED (TransactionId),
    CONSTRAINT UQ_Transactions_TransactionCode UNIQUE (TransactionCode),
    CONSTRAINT FK_Transactions_Accounts FOREIGN KEY (AccountId) REFERENCES dbo.Accounts(AccountId),
    CONSTRAINT FK_Transactions_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT FK_Transactions_Merchants FOREIGN KEY (MerchantId) REFERENCES dbo.Merchants(MerchantId),
    CONSTRAINT FK_Transactions_Devices FOREIGN KEY (DeviceId) REFERENCES dbo.Devices(DeviceId),
    CONSTRAINT CK_Transactions_Status CHECK (Status IN ('Pending Review', 'Investigating', 'Escalated', 'Resolved', 'Approved', 'Rejected'))
);
GO

-- ============================================================================
-- 8. FraudPredictions (ML Inference Scores & SHAP Explanations)
-- ============================================================================
CREATE TABLE dbo.FraudPredictions (
    PredictionId        UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    TransactionId       UNIQUEIDENTIFIER    NOT NULL,
    ModelName           NVARCHAR(100)       NOT NULL DEFAULT 'FraudNet v3.1',
    ModelVersion        NVARCHAR(50)        NOT NULL DEFAULT '3.1.2',
    FraudProbability    DECIMAL(5,2)        NOT NULL,
    RiskTier            NVARCHAR(20)        NOT NULL,
    InferenceLatencyMs  INT                 NOT NULL DEFAULT 24,
    VelocityRatio       DECIMAL(8,2)        NULL,
    TopRiskDriversJson  NVARCHAR(MAX)       NULL,
    AnomalyReason       NVARCHAR(MAX)       NOT NULL,
    PredictedAt         DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_FraudPredictions PRIMARY KEY CLUSTERED (PredictionId),
    CONSTRAINT UQ_FraudPredictions_TransactionId UNIQUE (TransactionId),
    CONSTRAINT FK_FraudPredictions_Transactions FOREIGN KEY (TransactionId) REFERENCES dbo.Transactions(TransactionId) ON DELETE CASCADE,
    CONSTRAINT CK_FraudPredictions_Probability CHECK (FraudProbability BETWEEN 0.00 AND 100.00),
    CONSTRAINT CK_FraudPredictions_RiskTier CHECK (RiskTier IN ('Critical', 'High', 'Medium', 'Low'))
);
GO

-- ============================================================================
-- 9. FraudAlerts (Triaged Real-Time Queue)
-- ============================================================================
CREATE TABLE dbo.FraudAlerts (
    AlertId             UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    AlertCode           NVARCHAR(50)        NOT NULL,
    TransactionId       UNIQUEIDENTIFIER    NOT NULL,
    CustomerId          UNIQUEIDENTIFIER    NOT NULL,
    Severity            NVARCHAR(20)        NOT NULL,
    AlertType           NVARCHAR(100)       NOT NULL,
    Reason              NVARCHAR(MAX)       NOT NULL,
    Status              NVARCHAR(30)        NOT NULL DEFAULT 'Open',
    AssignedToUserId    UNIQUEIDENTIFIER    NULL,
    ResolvedAt          DATETIMEOFFSET      NULL,
    CreatedAt           DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt           DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_FraudAlerts PRIMARY KEY CLUSTERED (AlertId),
    CONSTRAINT UQ_FraudAlerts_AlertCode UNIQUE (AlertCode),
    CONSTRAINT FK_FraudAlerts_Transactions FOREIGN KEY (TransactionId) REFERENCES dbo.Transactions(TransactionId),
    CONSTRAINT FK_FraudAlerts_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT FK_FraudAlerts_Users FOREIGN KEY (AssignedToUserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_FraudAlerts_Severity CHECK (Severity IN ('Critical', 'High', 'Medium', 'Low')),
    CONSTRAINT CK_FraudAlerts_Status CHECK (Status IN ('Open', 'Investigating', 'Escalated', 'Resolved'))
);
GO

-- ============================================================================
-- 10. Investigations (Case Management & Human Sign-off)
-- ============================================================================
CREATE TABLE dbo.Investigations (
    InvestigationId     UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    InvestigationCode   NVARCHAR(50)        NOT NULL,
    AlertId             UNIQUEIDENTIFIER    NULL,
    TransactionId       UNIQUEIDENTIFIER    NOT NULL,
    CustomerId          UNIQUEIDENTIFIER    NOT NULL,
    Priority            NVARCHAR(20)        NOT NULL DEFAULT 'Medium',
    Status              NVARCHAR(30)        NOT NULL DEFAULT 'New',
    AssignedInvestigatorId UNIQUEIDENTIFIER NULL,
    ResolutionDecision  NVARCHAR(50)        NULL,
    ResolutionNotes     NVARCHAR(MAX)       NULL,
    ResolvedAt          DATETIMEOFFSET      NULL,
    CreatedAt           DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt           DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_Investigations PRIMARY KEY CLUSTERED (InvestigationId),
    CONSTRAINT UQ_Investigations_InvestigationCode UNIQUE (InvestigationCode),
    CONSTRAINT FK_Investigations_Alerts FOREIGN KEY (AlertId) REFERENCES dbo.FraudAlerts(AlertId),
    CONSTRAINT FK_Investigations_Transactions FOREIGN KEY (TransactionId) REFERENCES dbo.Transactions(TransactionId),
    CONSTRAINT FK_Investigations_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT FK_Investigations_Users FOREIGN KEY (AssignedInvestigatorId) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_Investigations_Priority CHECK (Priority IN ('Critical', 'High', 'Medium', 'Low')),
    CONSTRAINT CK_Investigations_Status CHECK (Status IN ('New', 'Investigating', 'Pending Review', 'Escalated', 'Resolved', 'Approved', 'Rejected')),
    CONSTRAINT CK_Investigations_Resolution CHECK (ResolutionDecision IS NULL OR ResolutionDecision IN ('Approved', 'Auto-Flag for Review', 'Escalated', 'Rejected'))
);
GO

-- ============================================================================
-- 11. InvestigationEvidence (6 Multi-Vector Evidence Pillars)
-- ============================================================================
CREATE TABLE dbo.InvestigationEvidence (
    EvidenceId          UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    InvestigationId     UNIQUEIDENTIFIER    NOT NULL,
    Category            NVARCHAR(30)        NOT NULL,
    FindingType         NVARCHAR(100)       NOT NULL,
    FindingDetail       NVARCHAR(MAX)       NOT NULL,
    Confidence          DECIMAL(5,2)        NOT NULL,
    Severity            NVARCHAR(20)        NOT NULL,
    Source              NVARCHAR(150)       NOT NULL,
    EvidenceTimestamp   DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CreatedAt           DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_InvestigationEvidence PRIMARY KEY CLUSTERED (EvidenceId),
    CONSTRAINT FK_InvestigationEvidence_Investigations FOREIGN KEY (InvestigationId) REFERENCES dbo.Investigations(InvestigationId) ON DELETE CASCADE,
    CONSTRAINT CK_InvestigationEvidence_Category CHECK (Category IN ('Transaction', 'Behavioral', 'Device', 'Location', 'ML', 'Policy')),
    CONSTRAINT CK_InvestigationEvidence_Confidence CHECK (Confidence BETWEEN 0.00 AND 100.00),
    CONSTRAINT CK_InvestigationEvidence_Severity CHECK (Severity IN ('critical', 'high', 'medium', 'low', 'info'))
);
GO

-- ============================================================================
-- 12. InvestigationTimeline (Lifecycle Audit Steps)
-- ============================================================================
CREATE TABLE dbo.InvestigationTimeline (
    TimelineId          UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    InvestigationId     UNIQUEIDENTIFIER    NOT NULL,
    StepNumber          INT                 NOT NULL,
    Label               NVARCHAR(150)       NOT NULL,
    Description         NVARCHAR(MAX)       NOT NULL,
    Status              NVARCHAR(20)        NOT NULL,
    ActorType           NVARCHAR(20)        NOT NULL,
    ActorName           NVARCHAR(100)       NOT NULL,
    StepTimestamp       DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    CreatedAt           DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_InvestigationTimeline PRIMARY KEY CLUSTERED (TimelineId),
    CONSTRAINT FK_InvestigationTimeline_Investigations FOREIGN KEY (InvestigationId) REFERENCES dbo.Investigations(InvestigationId) ON DELETE CASCADE,
    CONSTRAINT CK_InvestigationTimeline_Status CHECK (Status IN ('completed', 'active', 'pending')),
    CONSTRAINT CK_InvestigationTimeline_ActorType CHECK (ActorType IN ('system', 'ai', 'human'))
);
GO

-- ============================================================================
-- 13. Reports (FinCEN SAR Drafts, AML Audits, Summaries)
-- ============================================================================
CREATE TABLE dbo.Reports (
    ReportId            UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
    ReportCode          NVARCHAR(50)        NOT NULL,
    InvestigationId     UNIQUEIDENTIFIER    NULL,
    TransactionId       UNIQUEIDENTIFIER    NULL,
    CustomerId          UNIQUEIDENTIFIER    NOT NULL,
    ReportTitle         NVARCHAR(255)       NOT NULL,
    Category            NVARCHAR(50)        NOT NULL,
    RiskLevel           NVARCHAR(20)        NOT NULL,
    GeneratedByUserId   UNIQUEIDENTIFIER    NULL,
    IsAiGenerated       BIT                 NOT NULL DEFAULT 0,
    Status              NVARCHAR(30)        NOT NULL DEFAULT 'Draft',
    Summary             NVARCHAR(MAX)       NOT NULL,
    Narrative           NVARCHAR(MAX)       NULL,
    FindingsCount       INT                 NOT NULL DEFAULT 0,
    CreatedAt           DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt           DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_Reports PRIMARY KEY CLUSTERED (ReportId),
    CONSTRAINT UQ_Reports_ReportCode UNIQUE (ReportCode),
    CONSTRAINT FK_Reports_Investigations FOREIGN KEY (InvestigationId) REFERENCES dbo.Investigations(InvestigationId),
    CONSTRAINT FK_Reports_Transactions FOREIGN KEY (TransactionId) REFERENCES dbo.Transactions(TransactionId),
    CONSTRAINT FK_Reports_Customers FOREIGN KEY (CustomerId) REFERENCES dbo.Customers(CustomerId),
    CONSTRAINT FK_Reports_Users FOREIGN KEY (GeneratedByUserId) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_Reports_Category CHECK (Category IN ('SAR Report', 'AML Audit Summary', 'Account Takeover', 'Velocity Anomaly')),
    CONSTRAINT CK_Reports_RiskLevel CHECK (RiskLevel IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
    CONSTRAINT CK_Reports_Status CHECK (Status IN ('Draft', 'Under Review', 'Published', 'Archived'))
);
GO

-- ============================================================================
-- 14. AuditLogs (WORM Tamper-Evident Security Log)
-- ============================================================================
CREATE TABLE dbo.AuditLogs (
    AuditLogId          BIGINT IDENTITY(1,1) NOT NULL,
    AuditCode           NVARCHAR(50)        NOT NULL,
    ActorId             UNIQUEIDENTIFIER    NULL,
    ActorName           NVARCHAR(100)       NOT NULL,
    ActorType           NVARCHAR(30)        NOT NULL,
    Action              NVARCHAR(100)       NOT NULL,
    SubAction           NVARCHAR(255)       NULL,
    ResourceTarget      NVARCHAR(100)       NOT NULL,
    Result              NVARCHAR(20)        NOT NULL,
    Category            NVARCHAR(50)        NOT NULL,
    DetailsJson         NVARCHAR(MAX)       NULL,
    IPAddress           NVARCHAR(50)        NULL,
    MerkleHash          NVARCHAR(64)        NULL,
    CreatedAt           DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),

    CONSTRAINT PK_AuditLogs PRIMARY KEY CLUSTERED (AuditLogId),
    CONSTRAINT UQ_AuditLogs_AuditCode UNIQUE (AuditCode),
    CONSTRAINT FK_AuditLogs_Users FOREIGN KEY (ActorId) REFERENCES dbo.Users(UserId),
    CONSTRAINT CK_AuditLogs_ActorType CHECK (ActorType IN ('AI AGENT', 'INVESTIGATOR', 'SERVICE', 'ADMIN', 'EXTERNAL')),
    CONSTRAINT CK_AuditLogs_Result CHECK (Result IN ('SUCCESS', 'PENDING', 'FAILED')),
    CONSTRAINT CK_AuditLogs_Category CHECK (Category IN ('Authentication', 'Investigation', 'Policy Change', 'Data Export', 'Rule Modification'))
);
GO

-- ============================================================================
-- Optimized Indexes for Performance & Analytical Telemetry
-- ============================================================================

-- Transactions
CREATE NONCLUSTERED INDEX IX_Transactions_Timestamp ON dbo.Transactions(TransactionTimestamp DESC)
INCLUDE (AmountInr, CustomerId, Status);

CREATE NONCLUSTERED INDEX IX_Transactions_CustomerId ON dbo.Transactions(CustomerId, TransactionTimestamp DESC);

CREATE NONCLUSTERED INDEX IX_Transactions_Status ON dbo.Transactions(Status)
INCLUDE (AmountInr, TransactionCode);

-- FraudPredictions
CREATE NONCLUSTERED INDEX IX_FraudPredictions_RiskTier_Prob ON dbo.FraudPredictions(RiskTier, FraudProbability DESC)
INCLUDE (TransactionId, VelocityRatio);

-- FraudAlerts
CREATE NONCLUSTERED INDEX IX_FraudAlerts_Status_Severity ON dbo.FraudAlerts(Status, Severity DESC)
INCLUDE (AlertCode, TransactionId, CustomerId, CreatedAt);

-- Investigations
CREATE NONCLUSTERED INDEX IX_Investigations_Status_Priority ON dbo.Investigations(Status, Priority DESC)
INCLUDE (InvestigationCode, TransactionId, AssignedInvestigatorId);

-- AuditLogs
CREATE NONCLUSTERED INDEX IX_AuditLogs_CreatedAt ON dbo.AuditLogs(CreatedAt DESC)
INCLUDE (ActorName, Action, ResourceTarget, Result);

CREATE NONCLUSTERED INDEX IX_AuditLogs_Category ON dbo.AuditLogs(Category, CreatedAt DESC);

-- Customers
CREATE NONCLUSTERED INDEX IX_Customers_RiskTier ON dbo.Customers(RiskTier, RiskScore DESC)
INCLUDE (CustomerCode, FullName, Rolling30dVolume);

GO
PRINT 'FraudGuard AI database and schema created successfully.'
