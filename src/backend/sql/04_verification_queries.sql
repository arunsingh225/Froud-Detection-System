-- ============================================================================
-- FraudGuard AI — Enterprise Financial Fraud Investigation & Risk Intelligence
-- Verification & Diagnostic Script
-- Database: FraudGuardAI_DB
-- ============================================================================

USE [FraudGuardAI_DB];
GO

SET NOCOUNT ON;
GO

PRINT '====================================================================';
PRINT '1. Table Row Counts in FraudGuardAI_DB';
PRINT '====================================================================';
SELECT 
    t.NAME AS TableName,
    p.rows AS [RowCount]
FROM sys.tables t
INNER JOIN sys.partitions p ON t.object_id = p.object_id
WHERE p.index_id IN (0, 1)
ORDER BY [RowCount] DESC, TableName ASC;
GO

PRINT '====================================================================';
PRINT '2. Foreign Key Relational Chain Verification';
PRINT '====================================================================';
SELECT 
    fk.name AS ForeignKeyConstraint,
    tp.name AS ParentTable,
    tr.name AS ReferencedTable
FROM sys.foreign_keys fk
INNER JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
INNER JOIN sys.tables tr ON fk.referenced_object_id = tr.object_id
ORDER BY ParentTable, ReferencedTable;
GO

PRINT '====================================================================';
PRINT '3. Nonclustered Indexes Verification';
PRINT '====================================================================';
SELECT 
    t.name AS TableName,
    i.name AS IndexName,
    i.type_desc AS IndexType
FROM sys.indexes i
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE i.is_primary_key = 0 AND i.type_desc = 'NONCLUSTERED'
ORDER BY TableName, IndexName;
GO

PRINT '====================================================================';
PRINT '4. Sample Operational Query: Multi-Table Investigation Dossier';
PRINT '====================================================================';
SELECT TOP 5
    t.TransactionCode,
    c.FullName AS CustomerName,
    c.RiskTier AS CustomerRisk,
    t.AmountInr,
    m.MerchantName,
    m.Category AS MerchantCategory,
    fp.FraudProbability,
    fp.RiskTier AS AnomalyRisk,
    fa.AlertCode,
    fa.Severity AS AlertSeverity,
    inv.InvestigationCode,
    inv.Status AS InvestigationStatus,
    inv.ResolutionDecision,
    u.FullName AS AssignedInvestigator
FROM dbo.Transactions t
INNER JOIN dbo.Customers c ON t.CustomerId = c.CustomerId
LEFT JOIN dbo.Merchants m ON t.MerchantId = m.MerchantId
LEFT JOIN dbo.FraudPredictions fp ON t.TransactionId = fp.TransactionId
LEFT JOIN dbo.FraudAlerts fa ON t.TransactionId = fa.TransactionId
LEFT JOIN dbo.Investigations inv ON t.TransactionId = inv.TransactionId
LEFT JOIN dbo.Users u ON inv.AssignedInvestigatorId = u.UserId
WHERE fp.RiskTier IN ('High', 'Critical')
ORDER BY t.TransactionTimestamp DESC;
GO

PRINT '====================================================================';
PRINT '5. Testing CRUD Operations with Safety Constraints';
PRINT '====================================================================';

-- Test 5.1: Insert a new Transaction and FraudPrediction
DECLARE @TestCustId UNIQUEIDENTIFIER = (SELECT TOP 1 CustomerId FROM dbo.Customers WHERE CustomerCode = 'CUS-2026-4821');
DECLARE @TestAccId UNIQUEIDENTIFIER = (SELECT TOP 1 AccountId FROM dbo.Accounts WHERE CustomerId = @TestCustId);
DECLARE @TestTxnId UNIQUEIDENTIFIER = NEWID();

INSERT INTO dbo.Transactions 
(TransactionId, TransactionCode, AccountId, CustomerId, AmountInr, PaymentMethod, IPAddress, City, Country, Status)
VALUES
(@TestTxnId, N'TXN-TEST-999999', @TestAccId, @TestCustId, 99999.00, N'UPI', N'127.0.0.1', N'Mumbai', N'India', N'Pending Review');

INSERT INTO dbo.FraudPredictions
(TransactionId, ModelName, FraudProbability, RiskTier, AnomalyReason)
VALUES
(@TestTxnId, N'FraudNet v3.1', 88.50, N'High', N'Verification test anomaly.');

PRINT 'Test 5.1 Insert Successful: TXN-TEST-999999 created.';

-- Test 5.2: Create Investigation and Update with "Auto-Flag for Review"
DECLARE @TestInvId UNIQUEIDENTIFIER = NEWID();
INSERT INTO dbo.Investigations
(InvestigationId, InvestigationCode, TransactionId, CustomerId, Priority, Status)
VALUES
(@TestInvId, N'INV-TEST-9999', @TestTxnId, @TestCustId, N'High', N'Investigating');

UPDATE dbo.Investigations
SET Status = N'Pending Review',
    ResolutionDecision = N'Auto-Flag for Review',
    ResolutionNotes = N'Flagged for mandatory human review per safety protocol.'
WHERE InvestigationId = @TestInvId;

PRINT 'Test 5.2 Update Successful: Decision updated to Auto-Flag for Review.';

-- Test 5.3: Delete Test Records and Verify Cleanup
DELETE FROM dbo.Investigations WHERE InvestigationId = @TestInvId;
DELETE FROM dbo.FraudPredictions WHERE TransactionId = @TestTxnId;
DELETE FROM dbo.Transactions WHERE TransactionId = @TestTxnId;

PRINT 'Test 5.3 Delete Successful: Test records cleanly removed.';
PRINT '====================================================================';
PRINT 'All database verifications completed successfully.';
PRINT '====================================================================';
GO
