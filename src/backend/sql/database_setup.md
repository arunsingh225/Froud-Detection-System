# FraudGuard AI — SQL Server 2022 Database Architecture & Setup Guide

This document describes the production-grade relational database architecture for **FraudGuard AI** deployed on **Microsoft SQL Server 2022**.

---

## 1. Architecture & Entity-Relationship Model

The database is named **`FraudGuardAI_DB`** and encompasses **14 domain tables**:

```
Users (Investigators, Admins, Analysts)
   │
   ├── [assigns] ──► FraudAlerts
   ├── [manages] ──► Investigations
   └── [logs]    ──► AuditLogs

Customers ───► Accounts ───► Transactions ───► FraudPredictions (1:1)
   │                             │
   │                             └───► FraudAlerts (1:N)
   │                                      │
   │                                      └───► Investigations (1:1)
   │                                                │
   │                                                ├──► InvestigationEvidence (1:N)
   │                                                ├──► InvestigationTimeline (1:N)
   │                                                └──► Reports (FinCEN SAR Drafts)
   │
   ├── [registers] ──► CustomerDevices (M:N) ◄── Devices
   └── [transacts] ──► Merchants
```

### Table Dictionary

| Table | Primary Key | Description |
| :--- | :--- | :--- |
| **`Users`** | `UserId` (UUID) | Security console users, roles (`ADMIN`, `INVESTIGATOR`, `ANALYST`, `VIEWER`), department, credentials. |
| **`Customers`** | `CustomerId` (UUID) | Customer identity, PAN, KYC status, risk score (0–100), risk tier, 30-day volume, account age. |
| **`Accounts`** | `AccountId` (UUID) | Bank accounts, credit cards, UPI handles, balances, daily limits, operational status. |
| **`Merchants`** | `MerchantId` (UUID) | Commercial vendors, MCC codes (e.g. 6051 Crypto, 4511 Airlines), VASP indicators. |
| **`Devices`** | `DeviceId` (UUID) | Hardware fingerprints, OS, browser, root/jailbreak indicators, emulator flags. |
| **`CustomerDevices`** | `(CustomerId, DeviceId)` | M:N association tracking customer trusted hardware. |
| **`Transactions`** | `TransactionId` (UUID) | Core financial ledger with amounts (INR/USD), IP address, geolocation coordinates, VPN flags. |
| **`FraudPredictions`**| `PredictionId` (UUID) | Inference output from FraudNet v3.1, probability %, SHAP drivers JSON, anomaly narrative. |
| **`FraudAlerts`** | `AlertId` (UUID) | Triaged alert queue with severity (`Critical`, `High`, `Medium`, `Low`), assigned investigator. |
| **`Investigations`** | `InvestigationId` (UUID)| Case management dossier, priority, human decision (`Approved`, `Auto-Flag for Review`, `Escalated`). |
| **`InvestigationEvidence`**| `EvidenceId` (UUID)| 6 evidence pillars (Transaction, Behavioral, Device, Location, ML, Policy). |
| **`InvestigationTimeline`**| `TimelineId` (UUID)| 8-step lifecycle history from real-time ingestion to human sign-off. |
| **`Reports`** | `ReportId` (UUID) | FinCEN Form 111 SAR drafts, AML audit summaries, compliance exports. |
| **`AuditLogs`** | `AuditLogId` (BIGINT) | WORM tamper-evident security audit log with SHA-256 Merkle proof. |

---

## 2. Safety & Compliance Guardrails

* **Auto-Flag for Review**: In alignment with regulatory safety guidelines, the schema enforces that transactions and investigations are marked for human-in-the-loop review (`Auto-Flag for Review`) rather than autonomously freezing accounts.
* **Separation of Concerns**: The operational database stores transactional application state and inference results. Raw ML datasets (such as IEEE-CIS training data) are managed separately in analytical data lakes/warehouses.

---

## 3. Database Setup & Execution Commands

### Prerequisites:
* SQL Server 2022 (Express, Developer, or Enterprise Edition) running locally or remotely.
* `sqlcmd` utility installed.

### Execution Scripts:

1. **Deploy Schema and Tables:**
   ```powershell
   sqlcmd -S "localhost\SQLEXPRESS" -E -i "src\backend\sql\01_create_database_and_schema.sql"
   ```

2. **Seed Baseline Demo Entities (Matching UI):**
   ```powershell
   sqlcmd -S "localhost\SQLEXPRESS" -E -i "src\backend\sql\02_seed_demo_data.sql"
   ```

3. **Generate Synthetic Data for Development:**
   ```powershell
   sqlcmd -S "localhost\SQLEXPRESS" -E -i "src\backend\sql\03_generate_synthetic_data.sql"
   sqlcmd -S "localhost\SQLEXPRESS" -E -Q "EXEC FraudGuardAI_DB.dbo.sp_GenerateSyntheticFraudData @TransactionCount = 200;"
   ```

4. **Verify Database Integrity and Test CRUD Operations:**
   ```powershell
   sqlcmd -S "localhost\SQLEXPRESS" -E -i "src\backend\sql\04_verification_queries.sql"
   ```

---

## 4. Connection Strings

### C# / .NET / Entity Framework Core:
```csharp
"Server=localhost\\SQLEXPRESS;Database=FraudGuardAI_DB;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;"
```

### Python / SQLAlchemy:
```python
"mssql+pyodbc://@localhost\\SQLEXPRESS/FraudGuardAI_DB?driver=ODBC+Driver+18+for+SQL+Server&trusted_connection=yes&TrustServerCertificate=yes"
```

### Node.js / TypeORM:
```typescript
{
  type: "mssql",
  host: "localhost",
  port: 1433,
  database: "FraudGuardAI_DB",
  extra: {
    instanceName: "SQLEXPRESS",
    trustServerCertificate: true
  },
  options: {
    trustedConnection: true
  }
}
```

---

## 5. Migration & Versioning Strategy

1. **Idempotent Versioned Migrations**: Future DDL updates are stored sequentially in `src/backend/sql/migrations/V{Version}__{Description}.sql`.
2. **Backward-Compatible Schema Evolution**: Adding non-breaking columns with `NULL` or explicit `DEFAULT` constraints.
3. **Automated Schema Validation**: CI pipelines run `04_verification_queries.sql` against ephemeral test databases to ensure zero regressions in relational constraints.
