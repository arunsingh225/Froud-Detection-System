-- Idempotent upgrade for databases created before the security-hardening pass.
--   1. Users.TokensRevokedAt  : persistent token revocation (replaces the old in-memory store)
--   2. CK_Users_Role          : allow the COMPLIANCE role that the API and controllers already use
USE [FraudGuardAI_DB];
GO

-- Required for DML on tables that have filtered indexes (sqlcmd defaults to OFF; SqlClient/EF use ON)
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('dbo.Users', 'TokensRevokedAt') IS NULL
    ALTER TABLE dbo.Users ADD TokensRevokedAt DATETIMEOFFSET NULL;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_Role' AND parent_object_id = OBJECT_ID('dbo.Users'))
    ALTER TABLE dbo.Users DROP CONSTRAINT CK_Users_Role;
GO
ALTER TABLE dbo.Users ADD CONSTRAINT CK_Users_Role
    CHECK (Role IN ('ADMIN', 'INVESTIGATOR', 'COMPLIANCE', 'ANALYST', 'VIEWER'));
GO
