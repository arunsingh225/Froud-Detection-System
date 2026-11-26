-- Phone (one-time code) sign-in: adds Users.PhoneNumber and the LoginOtps table.
-- Idempotent: safe to run on a database that already has them (and a no-op on a fresh 01 schema).
USE [FraudGuardAI_DB];
GO
SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH(N'dbo.Users', N'PhoneNumber') IS NULL
    ALTER TABLE dbo.Users ADD PhoneNumber NVARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_Users_PhoneNumber' AND object_id = OBJECT_ID(N'dbo.Users'))
    EXEC(N'CREATE UNIQUE INDEX UX_Users_PhoneNumber ON dbo.Users (PhoneNumber) WHERE PhoneNumber IS NOT NULL');
GO

IF OBJECT_ID(N'dbo.LoginOtps', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.LoginOtps (
        OtpId       UNIQUEIDENTIFIER    NOT NULL DEFAULT NEWID(),
        UserId      UNIQUEIDENTIFIER    NOT NULL,
        CodeHash    NVARCHAR(64)        NOT NULL,
        ExpiresAt   DATETIMEOFFSET      NOT NULL,
        Attempts    INT                 NOT NULL DEFAULT 0,
        ConsumedAt  DATETIMEOFFSET      NULL,
        CreatedAt   DATETIMEOFFSET      NOT NULL DEFAULT SYSDATETIMEOFFSET(),

        CONSTRAINT PK_LoginOtps PRIMARY KEY CLUSTERED (OtpId),
        CONSTRAINT FK_LoginOtps_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(UserId) ON DELETE CASCADE
    );
    CREATE INDEX IX_LoginOtps_User_Created ON dbo.LoginOtps (UserId, CreatedAt DESC);
END
GO
PRINT 'Phone OTP sign-in schema is in place.';
GO
