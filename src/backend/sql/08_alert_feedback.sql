-- Analyst feedback (ground-truth labels): adds FraudAlerts.ResolutionOutcome / ResolutionNotes / ResolvedByUserId.
-- Idempotent: safe on a database that already has them (and a no-op on a fresh 01 schema).
USE [FraudGuardAI_DB];
GO
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH(N'dbo.FraudAlerts', N'ResolutionOutcome') IS NULL
    ALTER TABLE dbo.FraudAlerts ADD ResolutionOutcome NVARCHAR(20) NULL;
IF COL_LENGTH(N'dbo.FraudAlerts', N'ResolutionNotes') IS NULL
    ALTER TABLE dbo.FraudAlerts ADD ResolutionNotes NVARCHAR(1000) NULL;
IF COL_LENGTH(N'dbo.FraudAlerts', N'ResolvedByUserId') IS NULL
    ALTER TABLE dbo.FraudAlerts ADD ResolvedByUserId UNIQUEIDENTIFIER NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_FraudAlerts_ResolvedBy')
    ALTER TABLE dbo.FraudAlerts ADD CONSTRAINT FK_FraudAlerts_ResolvedBy FOREIGN KEY (ResolvedByUserId) REFERENCES dbo.Users(UserId);
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_FraudAlerts_Outcome')
    EXEC(N'ALTER TABLE dbo.FraudAlerts ADD CONSTRAINT CK_FraudAlerts_Outcome CHECK (ResolutionOutcome IS NULL OR ResolutionOutcome IN (N''CONFIRMED_FRAUD'', N''FALSE_POSITIVE''))');
GO
PRINT 'Alert feedback columns are in place.';
GO
