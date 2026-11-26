-- Adds FraudAlerts.Category (one threat category per alert) and backfills existing rows.
-- Replaces substring scans over AlertType/Reason in analytics with an indexed GROUP BY.
-- Idempotent. The CASE below must mirror AlertCategories.Classify() in FraudGuard.Api/Models/AlertCategories.cs.
USE [FraudGuardAI_DB];
GO

-- Required for DML on tables that have filtered indexes (sqlcmd defaults to OFF; SqlClient/EF use ON)
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('dbo.FraudAlerts', 'Category') IS NULL
    ALTER TABLE dbo.FraudAlerts ADD Category NVARCHAR(30) NOT NULL
        CONSTRAINT DF_FraudAlerts_Category DEFAULT N'Other';
GO

UPDATE dbo.FraudAlerts SET Category =
    CASE
        WHEN AlertType LIKE N'%Takeover%'  OR Reason LIKE N'%Device%' OR Reason LIKE N'%Root%'                         THEN N'AccountTakeover'
        WHEN AlertType LIKE N'%Velocity%'  OR Reason LIKE N'%Velocity%'                                                THEN N'VelocitySpike'
        WHEN AlertType LIKE N'%Synthetic%' OR Reason LIKE N'%Synthetic%' OR Reason LIKE N'%AML%'                       THEN N'SyntheticIdentity'
        WHEN AlertType LIKE N'%Auth%'      OR Reason LIKE N'%Auth%' OR Reason LIKE N'%PIN%'                            THEN N'CardTesting'
        ELSE N'Other'
    END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_FraudAlerts_Category')
    ALTER TABLE dbo.FraudAlerts ADD CONSTRAINT CK_FraudAlerts_Category
        CHECK (Category IN (N'AccountTakeover', N'VelocitySpike', N'SyntheticIdentity', N'CardTesting', N'Other'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_FraudAlerts_Category' AND object_id = OBJECT_ID('dbo.FraudAlerts'))
    CREATE NONCLUSTERED INDEX IX_FraudAlerts_Category ON dbo.FraudAlerts(Category);
GO
