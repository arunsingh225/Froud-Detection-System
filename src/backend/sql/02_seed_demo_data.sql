-- ============================================================================
-- FraudGuard AI — Enterprise Financial Fraud Investigation & Risk Intelligence
-- Seed Script: Deterministic Baseline Entities Matching UI
-- Database: FraudGuardAI_DB
-- ============================================================================

USE [FraudGuardAI_DB];
GO

SET NOCOUNT ON;
GO

-- Clean existing data before seeding
DELETE FROM dbo.AuditLogs;
DELETE FROM dbo.Reports;
DELETE FROM dbo.InvestigationTimeline;
DELETE FROM dbo.InvestigationEvidence;
DELETE FROM dbo.Investigations;
DELETE FROM dbo.FraudAlerts;
DELETE FROM dbo.FraudPredictions;
DELETE FROM dbo.Transactions;
DELETE FROM dbo.CustomerDevices;
DELETE FROM dbo.Devices;
DELETE FROM dbo.Merchants;
DELETE FROM dbo.Accounts;
DELETE FROM dbo.Customers;
DELETE FROM dbo.Users;
GO

-- ============================================================================
-- 1. Insert Users
-- ============================================================================
DECLARE @U_Riya UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111101';
DECLARE @U_Suresh UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111102';
DECLARE @U_Priyanka UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111103';
DECLARE @U_Amit UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111104';

INSERT INTO dbo.Users (UserId, UserCode, FullName, Email, PasswordHash, Role, Department)
VALUES 
(@U_Riya, N'USR-INV-001', N'Riya Desai', N'riya.desai@fraudguard.enterprise.io', N'$2a$12$e8Y6bF8Qz...demo_hash', N'INVESTIGATOR', N'Fraud Investigation Unit'),
(@U_Suresh, N'USR-INV-002', N'Suresh Menon', N'suresh.menon@fraudguard.enterprise.io', N'$2a$12$e8Y6bF8Qz...demo_hash', N'INVESTIGATOR', N'Special Investigations'),
(@U_Priyanka, N'USR-ADM-001', N'Priyanka Iyer', N'priyanka.iyer@fraudguard.enterprise.io', N'$2a$12$e8Y6bF8Qz...demo_hash', N'ADMIN', N'Chief Compliance Officer'),
(@U_Amit, N'USR-ANL-001', N'Amit Bose', N'amit.bose@fraudguard.enterprise.io', N'$2a$12$e8Y6bF8Qz...demo_hash', N'ANALYST', N'AML Analytics');

-- ============================================================================
-- 2. Insert Merchants
-- ============================================================================
DECLARE @M_Crypto UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222201';
DECLARE @M_AirIndia UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222202';
DECLARE @M_FZCO UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222203';
DECLARE @M_LGI UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222204';
DECLARE @M_Samsung UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222205';
DECLARE @M_BigBasket UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222206';
DECLARE @M_Emirates UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222207';
DECLARE @M_AWS UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222208';

INSERT INTO dbo.Merchants (MerchantId, MerchantCode, MerchantName, Category, MCC, Country, City, RiskCategory, IsVASP)
VALUES
(@M_Crypto, N'MER-CRYPTO-01', N'CryptoSwap Pro', N'Crypto', N'6051', N'Georgia', N'Tbilisi', N'High', 1),
(@M_AirIndia, N'MER-AIR-01', N'Air India Ltd', N'Travel & Airline', N'4511', N'India', N'New Delhi', N'Elevated', 0),
(@M_FZCO, N'MER-FZCO-01', N'FZCO Trade Int.', N'Finance', N'6012', N'Singapore', N'Singapore', N'High', 0),
(@M_LGI, N'MER-LUX-01', N'Luxury Goods International (LGI)', N'Luxury', N'5944', N'India', N'Mumbai', N'Standard', 0),
(@M_Samsung, N'MER-ELEC-01', N'Samsung India Store', N'Electronics', N'5732', N'India', N'Hyderabad', N'Standard', 0),
(@M_BigBasket, N'MER-GROC-01', N'BigBasket India', N'Grocery', N'5411', N'India', N'Pune', N'Low', 0),
(@M_Emirates, N'MER-AIR-02', N'Emirates Airlines', N'Travel & Airline', N'4511', N'United Arab Emirates', N'Dubai', N'Elevated', 0),
(@M_AWS, N'MER-DIGI-01', N'Amazon Web Services', N'Digital Goods', N'7372', N'India', N'Bangalore', N'Standard', 0);

-- ============================================================================
-- 3. Insert Customers
-- ============================================================================
DECLARE @C_Arjun UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333301';
DECLARE @C_Priya UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333302';
DECLARE @C_Vikram UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333303';
DECLARE @C_Sanjana UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333304';
DECLARE @C_Rajesh UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333305';
DECLARE @C_Neeraj UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333306';
DECLARE @C_Deepika UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333307';
DECLARE @C_TechStart UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333308';

INSERT INTO dbo.Customers 
(CustomerId, CustomerCode, CustomerType, FullName, Email, Phone, City, Country, PAN, KYCStatus, CustomerSinceYear, AccountAgeMonths, BaselineAvgAmount, Rolling30dVolume, RiskScore, RiskTier, Status, PriorFlagsCount)
VALUES
(@C_Arjun, N'CUS-2026-4821', N'INDIVIDUAL', N'Arjun Mehta', N'arjun.mehta@proton.me', N'+91-98201-44821', N'Mumbai', N'India', N'AXMPM1234K', N'Verified', 2023, 27, 28000.00, 1875000.00, 97.20, N'Critical', N'Under Review', 4),
(@C_Priya, N'CUS-2026-3314', N'INDIVIDUAL', N'Priya Sharma', N'priya.sharma@gmail.com', N'+91-99100-33142', N'Delhi', N'India', N'BTPPS5678L', N'Verified', 2021, 49, 18000.00, 650000.00, 78.40, N'High', N'Active', 1),
(@C_Vikram, N'ORG-2026-1102', N'CORPORATE', N'Vikram Industries Pvt Ltd', N'finance@vikramindustries.in', N'+91-80-4411-1102', N'Bangalore', N'India', N'AAACV1102R', N'Verified', 2019, 76, 1500000.00, 42000000.00, 88.00, N'High', N'Under Review', 2),
(@C_Sanjana, N'CUS-2026-7723', N'INDIVIDUAL', N'Sanjana Kapoor', N'sanjana.k@outlook.com', N'+91-97200-77230', N'Mumbai', N'India', N'CKPSK2233M', N'Verified', 2022, 36, 22000.00, 420000.00, 58.00, N'Medium', N'Active', 0),
(@C_Rajesh, N'CUS-2026-5591', N'INDIVIDUAL', N'Rajesh Kumar', N'rajesh.kumar@yahoo.com', N'+91-94400-55910', N'Hyderabad', N'India', N'DLKRK4415N', N'Verified', 2020, 64, 8500.00, 180000.00, 42.00, N'Medium', N'Active', 0),
(@C_Neeraj, N'CUS-2026-2219', N'INDIVIDUAL', N'Neeraj Agarwal', N'neeraj.a@gmail.com', N'+91-98760-22190', N'Pune', N'India', N'EMANA1119P', N'Verified', 2018, 88, 4200.00, 85000.00, 14.00, N'Low', N'Active', 0),
(@C_Deepika, N'CUS-2026-6634', N'INDIVIDUAL', N'Deepika Nair', N'deepika.nair@rediffmail.com', N'+91-95500-66340', N'Chennai', N'India', N'FNDPN6634Q', N'Pending', 2023, 25, 35000.00, 720000.00, 51.00, N'Medium', N'Active', 1),
(@C_TechStart, N'ORG-2026-3341', N'CORPORATE', N'TechStart Solutions LLP', N'accounts@techstart.io', N'+91-80-6700-3341', N'Bangalore', N'India', N'AABCT3341K', N'Verified', 2021, 51, 160000.00, 12000000.00, 79.00, N'High', N'Under Review', 1);

-- ============================================================================
-- 4. Insert Accounts
-- ============================================================================
DECLARE @A_Arjun UNIQUEIDENTIFIER = '44444444-4444-4444-4444-444444444401';
DECLARE @A_Priya UNIQUEIDENTIFIER = '44444444-4444-4444-4444-444444444402';
DECLARE @A_Vikram UNIQUEIDENTIFIER = '44444444-4444-4444-4444-444444444403';
DECLARE @A_Sanjana UNIQUEIDENTIFIER = '44444444-4444-4444-4444-444444444404';
DECLARE @A_Rajesh UNIQUEIDENTIFIER = '44444444-4444-4444-4444-444444444405';
DECLARE @A_Neeraj UNIQUEIDENTIFIER = '44444444-4444-4444-4444-444444444406';
DECLARE @A_Deepika UNIQUEIDENTIFIER = '44444444-4444-4444-4444-444444444407';
DECLARE @A_TechStart UNIQUEIDENTIFIER = '44444444-4444-4444-4444-444444444408';

INSERT INTO dbo.Accounts (AccountId, AccountCode, CustomerId, AccountNumber, AccountType, CurrentBalance, DailyLimit, Status, OpenedDate)
VALUES
(@A_Arjun, N'ACC-2023-4821-01', @C_Arjun, N'HDFC9028104821', N'CURRENT', 2410500.00, 2500000.00, N'FLAGGED', '2023-04-10'),
(@A_Priya, N'ACC-2021-3314-01', @C_Priya, N'ICIC4400193314', N'CREDIT_CARD', 185000.00, 500000.00, N'ACTIVE', '2021-02-18'),
(@A_Vikram, N'ACC-2019-1102-01', @C_Vikram, N'KKBK0091821102', N'CORPORATE', 88400000.00, 100000000.00, N'FLAGGED', '2019-06-05'),
(@A_Sanjana, N'ACC-2022-7723-01', @C_Sanjana, N'SBIN0048197723', N'SAVINGS', 412000.00, 500000.00, N'ACTIVE', '2022-09-12'),
(@A_Rajesh, N'ACC-2020-5591-01', @C_Rajesh, N'AXIS0018405591', N'SAVINGS', 124000.00, 200000.00, N'ACTIVE', '2020-11-20'),
(@A_Neeraj, N'ACC-2018-2219-01', @C_Neeraj, N'BOFA0081722219', N'SAVINGS', 78900.00, 100000.00, N'ACTIVE', '2018-05-14'),
(@A_Deepika, N'ACC-2023-6634-01', @C_Deepika, N'UBIN0048296634', N'SAVINGS', 380000.00, 500000.00, N'ACTIVE', '2023-08-22'),
(@A_TechStart, N'ACC-2021-3341-01', @C_TechStart, N'HDFC0099283341', N'CORPORATE', 14500000.00, 50000000.00, N'ACTIVE', '2021-01-30');

-- ============================================================================
-- 5. Insert Devices
-- ============================================================================
DECLARE @D_Rooted UNIQUEIDENTIFIER = '55555555-5555-5555-5555-555555555501';
DECLARE @D_iPhone15 UNIQUEIDENTIFIER = '55555555-5555-5555-5555-555555555502';
DECLARE @D_LinuxAPI UNIQUEIDENTIFIER = '55555555-5555-5555-5555-555555555503';
DECLARE @D_MacBook UNIQUEIDENTIFIER = '55555555-5555-5555-5555-555555555504';
DECLARE @D_GalaxyS24 UNIQUEIDENTIFIER = '55555555-5555-5555-5555-555555555505';
DECLARE @D_Android14 UNIQUEIDENTIFIER = '55555555-5555-5555-5555-555555555506';
DECLARE @D_Win11 UNIQUEIDENTIFIER = '55555555-5555-5555-5555-555555555507';
DECLARE @D_MacSequoia UNIQUEIDENTIFIER = '55555555-5555-5555-5555-555555555508';

INSERT INTO dbo.Devices (DeviceId, DeviceFingerprint, DeviceType, OperatingSystem, Browser, IsRootedOrJailbroken, IsEmulator)
VALUES
(@D_Rooted, N'FP-ANDROID-ROOT-991A', N'Mobile', N'Android 14 (Rooted / Magisk)', N'Chrome Mobile 122', 1, 0),
(@D_iPhone15, N'FP-IOS-IPHONE15P-882B', N'Mobile', N'iOS 17.4', N'Safari 17.4', 0, 0),
(@D_LinuxAPI, N'FP-LINUX-SERVER-110C', N'API', N'Linux Ubuntu 22.04 LTS', N'Go-http-client/1.1', 0, 0),
(@D_MacBook, N'FP-MACOS-MBP-339D', N'Desktop', N'macOS Sonoma 14.2', N'Chrome 121', 0, 0),
(@D_GalaxyS24, N'FP-ANDROID-SGS24-559E', N'Mobile', N'Android 14 (OneUI 6.1)', N'Samsung Internet 24', 0, 0),
(@D_Android14, N'FP-ANDROID-PX8-221F', N'Mobile', N'Android 14', N'Chrome Mobile 121', 0, 0),
(@D_Win11, N'FP-WIN11-PC-881G', N'Desktop', N'Windows 11 Pro', N'Firefox 122', 0, 0),
(@D_MacSequoia, N'FP-MACOS-AIR-442H', N'Desktop', N'macOS Sequoia 15.0', N'Safari 18.0', 0, 0);

-- Customer Devices mapping
INSERT INTO dbo.CustomerDevices (CustomerId, DeviceId, IsTrusted)
VALUES
(@C_Arjun, @D_Rooted, 0),
(@C_Priya, @D_iPhone15, 1),
(@C_Vikram, @D_LinuxAPI, 1),
(@C_Sanjana, @D_MacBook, 1),
(@C_Rajesh, @D_GalaxyS24, 1),
(@C_Neeraj, @D_Android14, 1),
(@C_Deepika, @D_Win11, 0),
(@C_TechStart, @D_MacSequoia, 1);

-- ============================================================================
-- 6. Insert Transactions
-- ============================================================================
DECLARE @T_102 UNIQUEIDENTIFIER = '66666666-6666-6666-6666-666666666601';
DECLARE @T_099 UNIQUEIDENTIFIER = '66666666-6666-6666-6666-666666666602';
DECLARE @T_095 UNIQUEIDENTIFIER = '66666666-6666-6666-6666-666666666603';
DECLARE @T_091 UNIQUEIDENTIFIER = '66666666-6666-6666-6666-666666666604';
DECLARE @T_088 UNIQUEIDENTIFIER = '66666666-6666-6666-6666-666666666605';
DECLARE @T_084 UNIQUEIDENTIFIER = '66666666-6666-6666-6666-666666666606';
DECLARE @T_081 UNIQUEIDENTIFIER = '66666666-6666-6666-6666-666666666607';
DECLARE @T_078 UNIQUEIDENTIFIER = '66666666-6666-6666-6666-666666666608';

INSERT INTO dbo.Transactions 
(TransactionId, TransactionCode, AccountId, CustomerId, MerchantId, DeviceId, AmountInr, AmountUsd, PaymentMethod, CardLast4, IPAddress, City, Country, DistanceFromTypicalKm, VPNOrProxyDetected, TransactionTimestamp, Status)
VALUES
(@T_102, N'TXN-2026-000102', @A_Arjun, @C_Arjun, @M_Crypto, @D_Rooted, 875000.00, 10450.00, N'UPI / IMPS', NULL, N'185.220.101.14', N'Tbilisi', N'Georgia', 5200.00, 1, '2026-01-15T02:14:37+05:30', N'Pending Review'),
(@T_099, N'TXN-2026-000099', @A_Priya, @C_Priya, @M_AirIndia, @D_iPhone15, 420000.00, 5020.00, N'Credit Card •••• 7741', N'7741', N'85.115.56.4', N'Dubai', N'UAE', 1900.00, 0, '2026-01-15T01:55:10+05:30', N'Investigating'),
(@T_095, N'TXN-2026-000095', @A_Vikram, @C_Vikram, @M_FZCO, @D_LinuxAPI, 9450000.00, 112800.00, N'RTGS Wire Transfer', NULL, N'103.28.89.12', N'Singapore', N'Singapore', 4100.00, 0, '2026-01-14T23:44:02+05:30', N'Escalated'),
(@T_091, N'TXN-2026-000091', @A_Sanjana, @C_Sanjana, @M_LGI, @D_MacBook, 185000.00, 2210.00, N'Debit Card •••• 3392', N'3392', N'117.98.12.44', N'Mumbai', N'India', 5.00, 0, '2026-01-14T20:11:50+05:30', N'Pending Review'),
(@T_088, N'TXN-2026-000088', @A_Rajesh, @C_Rajesh, @M_Samsung, @D_GalaxyS24, 52000.00, 621.00, N'UPI (PhonePe)', NULL, N'49.204.116.8', N'Hyderabad', N'India', 10.00, 0, '2026-01-14T18:30:00+05:30', N'Resolved'),
(@T_084, N'TXN-2026-000084', @A_Neeraj, @C_Neeraj, @M_BigBasket, @D_Android14, 12000.00, NULL, N'UPI (Google Pay)', NULL, N'117.220.88.2', N'Pune', N'India', 3.00, 0, '2026-01-14T15:22:11+05:30', N'Approved'),
(@T_081, N'TXN-2026-000081', @A_Deepika, @C_Deepika, @M_Emirates, @D_Win11, 340000.00, 4060.00, N'Credit Card •••• 8812', N'8812', N'91.198.174.2', N'Dubai', N'UAE', 2200.00, 0, '2026-01-13T09:05:33+05:30', N'Pending Review'),
(@T_078, N'TXN-2026-000078', @A_TechStart, @C_TechStart, @M_AWS, @D_MacSequoia, 2800000.00, 33450.00, N'Corporate Card •••• 4421', N'4421', N'103.12.44.188', N'Bangalore', N'India', 5.00, 0, '2026-01-13T14:18:00+05:30', N'Investigating');

-- ============================================================================
-- 7. Insert FraudPredictions
-- ============================================================================
INSERT INTO dbo.FraudPredictions
(TransactionId, ModelName, ModelVersion, FraudProbability, RiskTier, InferenceLatencyMs, VelocityRatio, TopRiskDriversJson, AnomalyReason)
VALUES
(@T_102, N'FraudNet v3.1', N'3.1.2', 97.20, N'Critical', 22, 34.00, N'{"velocity":0.41,"device":0.28,"location":0.18,"time":0.09}', N'Velocity 34x 90-day baseline. First-time overseas crypto destination. Root device fingerprint.'),
(@T_099, N'FraudNet v3.1', N'3.1.2', 78.40, N'High', 26, 22.00, N'{"amount":0.35,"geo":0.31,"card_not_present":0.18}', N'Business class booking 22x avg. No prior international travel pattern. Card not present.'),
(@T_095, N'FraudNet v3.1', N'3.1.2', 93.10, N'High', 19, 14.50, N'{"offshore_wire":0.48,"after_hours":0.26,"unregistered_counterparty":0.18}', N'Unusual after-hours RTGS to unregistered offshore entity. First such transaction in 4-year history.'),
(@T_091, N'FraudNet v3.1', N'3.1.2', 62.50, N'Medium', 24, 8.00, N'{"amount_spike":0.52,"category_deviation":0.22}', N'Single luxury purchase 8x historical average. Location normal but amount anomalous.'),
(@T_088, N'FraudNet v3.1', N'3.1.2', 44.20, N'Medium', 21, 2.10, N'{"auth_retries":0.61,"pin_failures":0.24}', N'Multiple auth retries before successful UPI payment. Common micro-fraud pattern.'),
(@T_084, N'FraudNet v3.1', N'3.1.2', 18.70, N'Low', 18, 1.05, N'{"routine_mcc":0.75}', N'Low-risk routine grocery purchase. Flagged by velocity rule due to same-day transactions.'),
(@T_081, N'FraudNet v3.1', N'3.1.2', 55.80, N'Medium', 28, 6.20, N'{"impossible_travel":0.58,"speed_kmh":920.0}', N'Card used in UAE within 4 hours of last India transaction. Velocity rule triggered.'),
(@T_078, N'FraudNet v3.1', N'3.1.2', 82.40, N'High', 25, 18.00, N'{"provisioning_spike":0.44,"billing_surge":0.32}', N'Bulk cloud infrastructure provisioning: 18x monthly average. Automated velocity rule triggered.');

-- ============================================================================
-- 8. Insert FraudAlerts
-- ============================================================================
DECLARE @AL_0891 UNIQUEIDENTIFIER = '77777777-7777-7777-7777-777777777701';
DECLARE @AL_0890 UNIQUEIDENTIFIER = '77777777-7777-7777-7777-777777777702';
DECLARE @AL_0887 UNIQUEIDENTIFIER = '77777777-7777-7777-7777-777777777703';
DECLARE @AL_0884 UNIQUEIDENTIFIER = '77777777-7777-7777-7777-777777777704';
DECLARE @AL_0880 UNIQUEIDENTIFIER = '77777777-7777-7777-7777-777777777705';
DECLARE @AL_0875 UNIQUEIDENTIFIER = '77777777-7777-7777-7777-777777777706';
DECLARE @AL_0869 UNIQUEIDENTIFIER = '77777777-7777-7777-7777-777777777707';

INSERT INTO dbo.FraudAlerts
(AlertId, AlertCode, TransactionId, CustomerId, Severity, AlertType, Reason, Status, AssignedToUserId, CreatedAt)
VALUES
(@AL_0891, N'ALT-2026-0891', @T_102, @C_Arjun, N'Critical', N'Velocity Anomaly + Device Risk', N'Velocity 34x baseline — overseas crypto transfer via VPN from unregistered device', N'Open', @U_Riya, '2026-01-15T02:18:00+05:30'),
(@AL_0890, N'ALT-2026-0890', @T_099, @C_Priya, N'High', N'Behavioral Anomaly', N'Airline booking 22x average — no prior international card usage pattern detected', N'Investigating', @U_Suresh, '2026-01-15T01:58:00+05:30'),
(@AL_0887, N'ALT-2026-0887', @T_095, @C_Vikram, N'High', N'AML — Cross-Border Wire', N'After-hours RTGS wire to unverified offshore entity — first such transaction in 4-year history', N'Escalated', @U_Priyanka, '2026-01-14T23:49:00+05:30'),
(@AL_0884, N'ALT-2026-0884', @T_091, @C_Sanjana, N'Medium', N'Amount Anomaly', N'Luxury goods purchase 8x historical average amount — card present locally', N'Open', NULL, '2026-01-14T20:15:00+05:30'),
(@AL_0880, N'ALT-2026-0880', @T_088, @C_Rajesh, N'Medium', N'Auth Anomaly', N'Multiple UPI PIN auth retries before success — micro-fraud pattern match', N'Resolved', @U_Suresh, '2026-01-14T18:35:00+05:30'),
(@AL_0875, N'ALT-2026-0875', @T_078, @C_TechStart, N'High', N'Velocity Anomaly', N'Bulk cloud infrastructure spend 18x monthly average — automated velocity guardrail triggered', N'Investigating', @U_Riya, '2026-01-13T14:22:00+05:30'),
(@AL_0869, N'ALT-2026-0869', @T_081, @C_Deepika, N'Medium', N'Impossible Travel', N'Card used in UAE within 4 hours of domestic India transaction — impossible travel pattern', N'Open', NULL, '2026-01-13T09:09:00+05:30');

-- ============================================================================
-- 9. Insert Investigations
-- ============================================================================
DECLARE @INV_0441 UNIQUEIDENTIFIER = '88888888-8888-8888-8888-888888888801';
DECLARE @INV_0439 UNIQUEIDENTIFIER = '88888888-8888-8888-8888-888888888802';
DECLARE @INV_0436 UNIQUEIDENTIFIER = '88888888-8888-8888-8888-888888888803';
DECLARE @INV_0428 UNIQUEIDENTIFIER = '88888888-8888-8888-8888-888888888804';
DECLARE @INV_0419 UNIQUEIDENTIFIER = '88888888-8888-8888-8888-888888888805';
DECLARE @INV_0405 UNIQUEIDENTIFIER = '88888888-8888-8888-8888-888888888806';

INSERT INTO dbo.Investigations
(InvestigationId, InvestigationCode, AlertId, TransactionId, CustomerId, Priority, Status, AssignedInvestigatorId, ResolutionDecision, CreatedAt)
VALUES
(@INV_0441, N'INV-2026-0441', @AL_0891, @T_102, @C_Arjun, N'Critical', N'Investigating', @U_Riya, NULL, '2026-01-15T02:18:00+05:30'),
(@INV_0439, N'INV-2026-0439', @AL_0887, @T_095, @C_Vikram, N'High', N'Escalated', @U_Priyanka, N'Escalated', '2026-01-14T23:50:00+05:30'),
(@INV_0436, N'INV-2026-0436', @AL_0890, @T_099, @C_Priya, N'High', N'Pending Review', @U_Suresh, N'Auto-Flag for Review', '2026-01-15T01:58:00+05:30'),
(@INV_0428, N'INV-2026-0428', @AL_0875, @T_078, @C_TechStart, N'High', N'Investigating', @U_Riya, NULL, '2026-01-13T14:22:00+05:30'),
(@INV_0419, N'INV-2026-0419', @AL_0884, @T_091, @C_Sanjana, N'Medium', N'New', @U_Amit, NULL, '2026-01-14T20:15:00+05:30'),
(@INV_0405, N'INV-2026-0405', @AL_0869, @T_081, @C_Deepika, N'Medium', N'Resolved', @U_Suresh, N'Approved', '2026-01-13T09:10:00+05:30');

-- ============================================================================
-- 10. Insert InvestigationEvidence (for INV-2026-0441)
-- ============================================================================
INSERT INTO dbo.InvestigationEvidence
(InvestigationId, Category, FindingType, FindingDetail, Confidence, Severity, Source, EvidenceTimestamp)
VALUES
(@INV_0441, N'Transaction', N'Velocity Spike', N'Transaction amount ₹8,75,000 is 34x the 90-day average of ₹25,700', 99.00, N'critical', N'Velocity Engine v4.2', '2026-01-15T02:14:38+05:30'),
(@INV_0441, N'Transaction', N'Destination Risk', N'CryptoSwap Pro is listed in FATF high-risk virtual asset service providers database', 94.00, N'high', N'VASP Risk Index', '2026-01-15T02:14:40+05:30'),
(@INV_0441, N'Behavioral', N'First-Time Pattern', N'Customer has never made a crypto exchange transaction in 2 years account history', 98.00, N'critical', N'Behavioral Baseline Model', '2026-01-15T02:14:41+05:30'),
(@INV_0441, N'Behavioral', N'Time Anomaly', N'Transaction at 02:14 IST — customer historically transacts between 09:00-21:00 IST', 87.00, N'high', N'Behavioral Baseline Model', '2026-01-15T02:14:41+05:30'),
(@INV_0441, N'Device', N'Unknown Device', N'Android device fingerprint has zero overlap with 3 registered devices in customer profile', 97.00, N'critical', N'Device Intelligence v2.1', '2026-01-15T02:14:39+05:30'),
(@INV_0441, N'Device', N'Root Detected', N'Device OS has been rooted — banking app integrity check failed', 95.00, N'critical', N'Device Intelligence v2.1', '2026-01-15T02:14:39+05:30'),
(@INV_0441, N'Location', N'Overseas Transaction', N'IP geolocated to Tbilisi, Georgia — 5,200 km from customer home (Mumbai)', 96.00, N'critical', N'MaxMind GeoIP v5', '2026-01-15T02:14:38+05:30'),
(@INV_0441, N'Location', N'VPN Detected', N'Mullvad VPN exit node confirmed via ASN 39351. IP: 185.220.101.14', 99.00, N'high', N'IP Intelligence Engine', '2026-01-15T02:14:38+05:30'),
(@INV_0441, N'ML', N'FraudNet Score', N'FraudNet v3.1 ensemble model: 97.2% fraud probability (threshold: 75%)', 97.00, N'critical', N'FraudNet v3.1 (XGBoost + Transformer)', '2026-01-15T02:14:39+05:30'),
(@INV_0441, N'ML', N'SHAP Drivers', N'Top risk drivers: velocity (0.41), device (0.28), location (0.18), time (0.09)', 95.00, N'high', N'SHAP Explainability Module', '2026-01-15T02:14:39+05:30'),
(@INV_0441, N'Policy', N'Policy Match', N'FraudGuard Policy v3.4 §6.1 mandates Tier-2 review for overseas crypto >5x velocity', 100.00, N'critical', N'RAG Policy Engine v2.0', '2026-01-15T02:14:44+05:30'),
(@INV_0441, N'Policy', N'RBI Guideline', N'RBI Master Direction §11(3): Overseas digital asset transfers require enhanced due diligence', 100.00, N'high', N'RBI Policy Database 2025', '2026-01-15T02:14:44+05:30');

-- ============================================================================
-- 11. Insert InvestigationTimeline (for INV-2026-0441)
-- ============================================================================
INSERT INTO dbo.InvestigationTimeline
(InvestigationId, StepNumber, Label, Description, Status, ActorType, ActorName, StepTimestamp)
VALUES
(@INV_0441, 1, N'Transaction Detected', N'Real-time rule engine flagged TXN-2026-000102 at 02:14:37 IST — velocity threshold breached.', N'completed', N'system', N'RuleEngine v4', '2026-01-15T02:14:37+05:30'),
(@INV_0441, 2, N'ML Model Analysis', N'FraudNet v3.1 scored transaction at 97.2% fraud probability. SHAP explanation generated.', N'completed', N'ai', N'FraudNet-AI', '2026-01-15T02:14:39+05:30'),
(@INV_0441, 3, N'Customer History Retrieved', N'90-day behavioral baseline loaded. 34x velocity spike confirmed. 4 prior flags on record.', N'completed', N'ai', N'BehaviorProfiler', '2026-01-15T02:14:41+05:30'),
(@INV_0441, 4, N'Behavior Anomaly Detected', N'Root device + overseas IP + crypto destination — novel combination for this customer profile.', N'completed', N'ai', N'AnomalyClassifier', '2026-01-15T02:14:43+05:30'),
(@INV_0441, 5, N'Policy Retrieved (RAG)', N'FraudGuard Policy v3.4 §6.1 retrieved: "Overseas crypto transfers >5x velocity require T2 review."', N'completed', N'ai', N'RAGPolicyEngine', '2026-01-15T02:14:44+05:30'),
(@INV_0441, 6, N'AI Investigation Completed', N'Investigation report INV-2026-0441 drafted. Evidence classified into 6 categories.', N'completed', N'ai', N'AgentSynthesizer', '2026-01-15T02:16:12+05:30'),
(@INV_0441, 7, N'Human Review Required', N'Assigned to Riya Desai (Senior Investigator). Awaiting approval decision.', N'active', N'human', N'Riya Desai', '2026-01-15T02:18:00+05:30'),
(@INV_0441, 8, N'Final Decision', N'Pending investigator action: Approve / Auto-Flag for Review / Escalate.', N'pending', N'human', N'Riya Desai', '2026-01-15T02:20:00+05:30');

-- ============================================================================
-- 12. Insert Reports
-- ============================================================================
INSERT INTO dbo.Reports
(ReportCode, InvestigationId, TransactionId, CustomerId, ReportTitle, Category, RiskLevel, GeneratedByUserId, IsAiGenerated, Status, Summary, Narrative, FindingsCount)
VALUES
(N'RPT-2026-0115', @INV_0441, @T_102, @C_Arjun, N'Overseas Crypto Transfer — Velocity & Device Anomaly', N'SAR Report', N'CRITICAL', @U_Riya, 1, N'Draft', N'AI-drafted SAR for 34x velocity overseas crypto transfer via VPN from rooted device. Pending compliance review.', N'On Jan 15, 2026, a transaction of ₹8,75,000 was flagged for suspicious activity by the FraudGuard AI system. Customer: Arjun Mehta.', 6),
(N'RPT-2026-0112', @INV_0439, @T_095, @C_Vikram, N'RTGS Wire to Offshore Shell — AML Assessment', N'AML Audit Summary', N'CRITICAL', @U_Suresh, 0, N'Under Review', N'₹94.5 lakh after-hours wire to unregistered Singapore entity. Potential AML violation under PMLA 2002.', N'Offshore wire transfer assessment for corporate entity Vikram Industries.', 4),
(N'RPT-2026-0108', @INV_0428, @T_078, @C_TechStart, N'Cloud Spend Velocity Anomaly — Corporate Account', N'Velocity Anomaly', N'HIGH', @U_Riya, 1, N'Published', N'₹28 lakh AWS cloud provision — 18x MoM average. Automated guardrail triggered. Investigation resolved: legitimate.', N'Investigation resolved and cleared as verified enterprise infrastructure expansion.', 3),
(N'RPT-2026-0099', NULL, NULL, @C_Vikram, N'Q4 2025 Flagged Entities & Escalation Summary', N'AML Audit Summary', N'HIGH', @U_Priyanka, 0, N'Published', N'Consolidated overview: 2,147 flagged transactions, 134 escalated cases, ₹4.2 Cr potential fraud prevented in Q4-2025.', N'Quarterly AML compliance audit report signed by Chief Compliance Officer.', 18);

-- ============================================================================
-- 13. Insert AuditLogs
-- ============================================================================
INSERT INTO dbo.AuditLogs
(AuditCode, ActorId, ActorName, ActorType, Action, SubAction, ResourceTarget, Result, Category, MerkleHash)
VALUES
(N'AUD-2026-001', NULL, N'FraudNet-AI v3.1', N'AI AGENT', N'Risk Score Updated', N'ML reassessment — TXN velocity spike detected', N'TXN-2026-000102', N'SUCCESS', N'Investigation', N'8b29c91f4a98e83109a128e4693b48f6c37492c10b75d710a3952f41b21908aa'),
(N'AUD-2026-002', @U_Riya, N'Riya Desai', N'INVESTIGATOR', N'Investigation Opened', N'INV-2026-0441 created and assigned', N'TXN-2026-000102', N'SUCCESS', N'Investigation', N'3fa85f6457174b26b429188e404bc043000959082c16182cf5ee408d66dfab01'),
(N'AUD-2026-003', NULL, N'Policy Engine', N'SERVICE', N'Policy Retrieved', N'FraudGuard Policy v3.4 §6.1 — RAG match', N'INV-2026-0441', N'SUCCESS', N'Investigation', N'4a5e1e2d3c4b5a6f7e8d9c0b1a2f3e4d5c6b7a8f9e0d1c2b3a4f5e6d7c8b9a0f'),
(N'AUD-2026-004', @U_Priyanka, N'Priyanka Iyer', N'ADMIN', N'Investigation Escalated', N'INV-2026-0439 — AML potential, Tier-3 referral', N'ORG-2026-1102', N'SUCCESS', N'Investigation', N'1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b'),
(N'AUD-2026-005', NULL, N'Unknown IP', N'EXTERNAL', N'Auth Attempt', N'Invalid credentials — 3 consecutive failures', N'USR-ADMIN-001', N'FAILED', N'Authentication', N'9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e'),
(N'AUD-2026-006', @U_Suresh, N'Suresh Menon', N'INVESTIGATOR', N'SAR Draft Generated', N'RPT-2026-0112 — Awaiting compliance sign-off', N'INV-2026-0428', N'SUCCESS', N'Investigation', N'c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b0a1f2e3d4c5b6a7f8e9d0c1b2'),
(N'AUD-2026-007', @U_Priyanka, N'System Admin', N'ADMIN', N'Rule Modified', N'Velocity threshold updated: ₹5L → ₹3L', N'RULE-VEL-004', N'SUCCESS', N'Rule Modification', N'd4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3'),
(N'AUD-2026-008', @U_Priyanka, N'Priyanka Iyer', N'ADMIN', N'Batch Data Export', N'Q4-2025 AML audit export — encrypted zip', N'BATCH-Q4-2025', N'SUCCESS', N'Data Export', N'e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4');

GO
PRINT 'Seed demo data inserted successfully into FraudGuardAI_DB.'
