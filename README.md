# FraudGuard AI — Agentic Financial Fraud Investigation & Risk Intelligence Platform

FraudGuard AI is an enterprise-grade platform for financial fraud detection, automated alert triage, and risk intelligence.

---

## System Architecture

```
[ Angular 17 Frontend ] (Port 4200)
        │
        ▼  (HTTP REST)
[ ASP.NET Core 8 Web API ] (Port 5000)
        │
        ├──► [ SQL Server 2022 ] (Transactions, Alerts, Predictions, Audit Logs)
        │
        └──► [ FastAPI AI Engine ] (Port 8000)
                    │  (Sub-10ms Inference)
                    ▼
             [ LightGBM Classifier ] (464 features, 0.80 operating threshold)
```

---

## How to Run the Services

### Terminal 1: FastAPI AI Inference Engine
Serves real-time inference using the pre-trained LightGBM model.
```bash
# Navigate to project root
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir src/ai_engine
```
- **FastAPI Swagger:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Health Check:** `http://127.0.0.1:8000/health`

---

### Terminal 2: ASP.NET Core 8 Web API
Main orchestration and enterprise persistence layer.
```bash
cd src/backend/FraudGuard.Api
dotnet run --urls "http://localhost:5000"
```
- **ASP.NET Core Swagger:** [http://localhost:5000/swagger](http://localhost:5000/swagger)
- **Engine Health Endpoint:** `http://localhost:5000/api/fraud/engine-health`
- **Model Info Endpoint:** `http://localhost:5000/api/fraud/model-info`
- **Prediction Endpoint:** `POST http://localhost:5000/api/fraud/predict`

---

### Terminal 3: Angular 17 Frontend
```bash
npm start
# Runs on http://localhost:4200
```

---

## Testing & Verification

### Security & RBAC Credentials (Phase 8)

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `priyanka.iyer@fraudguard.enterprise.io` | `password123` | Full access, user management, audit logs, system telemetry |
| **INVESTIGATOR** | `riya.desai@fraudguard.enterprise.io` | `password123` | Transactions, fraud alerts, case investigations, AI scoring |
| **COMPLIANCE** | `amit.bose@fraudguard.enterprise.io` | `password123` | Audit logs, regulatory SAR reports, alert review, compliance decisions |

---

## Testing & Verification

### ASP.NET Core xUnit Test Suite (21 tests)
```bash
# Run backend security, JWT, and authorization unit tests
dotnet test src/backend/FraudGuard.Api.Tests
```

### Full Backend API Test Suite (35 endpoints)
```bash
# Run automated test suite with Bearer token authentication
powershell -ExecutionPolicy Bypass -File src/backend/FraudGuard.Api/test_endpoints.ps1
```

### Phase 8 Security & RBAC Verification Suite (27 security checks)
```bash
# Verify 401 unauth, 403 RBAC matrix, tampered JWT, admin safety, security headers
powershell -ExecutionPolicy Bypass -File test_phase8_security.ps1
```

### Full-Stack Phase 7 Regression E2E Test Suite (11 checkpoints)
```bash
# Run end-to-end integration test
powershell -ExecutionPolicy Bypass -File test_phase7_e2e.ps1
```

### Phase 9 Agentic AI & RAG Verification Suite (31 checks)
```bash
# Verify FastAPI RAG, agentic synthesis, prompt injection, DB persistence & timeline
powershell -ExecutionPolicy Bypass -File test_phase9_agentic_ai.ps1
```

### FastAPI AI Engine Pytest Suite (14 tests)
```bash
# Verify RAG indexing, chunking, retrieval, citation integrity, model inference
python -m pytest src/ai_engine/tests -v
```

### Phase 10 Advanced Analytics & Real-Time Monitoring Suite (43 checks)
```bash
# Verify real SQL KPIs, multi-period trends, probability histogram, RBAC export, real-time sync
powershell -ExecutionPolicy Bypass -File test_phase10_analytics.ps1
```

### Angular Production Build
```bash
# Compile Angular 17 AOT production bundle (0 errors, 0 warnings)
npm run build
```


