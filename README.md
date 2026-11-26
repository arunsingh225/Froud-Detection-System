# FraudGuard AI — Agentic Financial Fraud Investigation & Risk Intelligence Platform

FraudGuard AI is an enterprise-grade platform for financial fraud detection, automated alert triage, and risk intelligence.

---

## System Architecture

```
[ Angular 17 Frontend ] (Port 3000)
        │
        ▼  (HTTP REST)
[ ASP.NET Core 8 Web API ] (Port 5000)
        │
        ├──► [ SQL Server 2022 ] (Transactions, Alerts, Predictions, Audit Logs)
        │
        └──► [ FastAPI AI Engine ] (Port 8000)
                    │  (single-row, in-process: p50 ~12 ms, p95 ~16 ms)
                    ▼
             [ LightGBM Classifier ] (464 features, 0.80 operating threshold)
```

---

## Scope and Known Limitations (read this first)

This is an **end-to-end demo platform**, not a production fraud system.

- **Model:** LightGBM trained on the public IEEE-CIS (Vesta e-commerce) dataset, chronological split. Reproduce the evaluation with `python ml/calibrate_and_evaluate.py` (writes `models/holdout_evaluation.json`).
  - Protocol: the chronologically *later* half of the validation set (59,054 rows) is held out as TEST; only the calibrator is fitted, on the earlier half.
  - **Held-out TEST (raw score, threshold 0.80):** ROC-AUC 0.917 (95% CI 0.911-0.922), PR-AUC 0.550 (0.530-0.569), precision 0.560, **recall 0.473** (0.455-0.492). Roughly half of fraud is missed at the shipped operating point.
  - **Calibration:** the raw score is *not* a probability (mean score 0.21 vs 3.7% real fraud rate; ECE 0.168). Isotonic calibration cuts TEST ECE to 0.002 and Brier from 0.0746 to 0.0235. `/predict` returns `calibrated_probability` alongside the raw `fraud_probability`; tiers and decisions still use the raw score so existing behaviour is unchanged.
  - Caveats: model-family selection and the 0.80 threshold were chosen on the full validation set (including TEST), so TEST is held out for calibration and reporting, not a pristine estimate for those choices. A fully clean 3-way split with retraining is still open.
- **Threshold is a business choice, not 0.80 by nature.** `python ml/cost_threshold_analysis.py` (assumption: a missed fraud costs its amount, each alert costs `review_cost`) shows on held-out data that 0.80 is cost-optimal only when an alert costs about $50 of analyst time; at $5 the optimal threshold is about 0.37 (recall 0.82 instead of 0.49, cost $76k vs $142k per 39k transactions, at the price of about 5x more alerts). Override without code changes via `DECISION_THRESHOLD` (default: 0.80). See `models/cost_threshold_analysis.json`.
- **Retrain experiment (`ml/train_challenger.py`):** a challenger with early stopping on a separate chunk (689 trees vs 300) did **not** beat the champion on a clean TEST third (ROC-AUC 0.915 vs 0.920, overlapping 95% CIs), so the model was not promoted. Evidence: `ml/results/challenger_evaluation.json`.
- **Explanations:** `POST /predict?explain=true&top_k=5` returns the top feature attributions (LightGBM TreeSHAP, log-odds of the raw score; `base_value` + all contributions equals the model margin, which `tests/test_explanations.py` asserts). Opt-in because it adds ~8-11 ms.
- **Latency (measured, 12-core laptop, 300 calls after warm-up, in-process, excluding HTTP):** p50 12.2 ms / p95 16.4 ms (p50 20.4 ms with explanations). About 6.8 ms is preprocessing (single-row pandas, 464 features), 3.7 ms is LightGBM. The old "sub-10 ms" claim was never true.
- **Drift monitoring:** `GET /model/drift` reports the Population Stability Index of the 20 most important features over a rolling window of recent `/predict` requests (default 2,000; at least 200 before reporting) against `models/drift_reference.json` (built by `ml/build_drift_reference.py` from the earlier half of the validation set). Stable < 0.1, moderate 0.1-0.25, significant > 0.25. Traffic from the API's approximate transaction mapping will legitimately show drift against IEEE-CIS data.
- **Secret rotation:** the engine accepts `FASTAPI_INTERNAL_SECRET_PREVIOUS` in addition to the current secret and logs a warning while the old one is still used: set new + previous on the engine, switch the API to the new secret, then remove previous.
- **Surfaced through the API and UI:** `POST /api/fraud/predict` now also returns `calibratedProbability` and `topFactors`; `GET /api/fraud/model-drift` (ADMIN/COMPLIANCE) proxies the engine's PSI report; Transaction Detail has an "AI Score Explanation" panel (investigators and admins: "Re-score & explain" shows the calibrated probability, the model score and the top factors); the Model Monitoring tab's drift status is the measured PSI status, or UNAVAILABLE / INSUFFICIENT DATA, never an assumed STABLE. Re-scoring updates the stored prediction for that transaction.
- **Input provenance:** every attribution returned for a score is tagged `transaction` (really from the transaction), `approximated` (heuristic proxy such as a hash or modulo time), `placeholder` (a constant the mapper always sends, e.g. `card2=111`) or `not_provided`. The Transaction Detail panel shows these tags and always carries a "demo model" notice; the explanation stored with the prediction is shown as soon as the page opens. A unit test maps different transactions and fails if the placeholder list drifts from what `FraudPredictionMapper` really sends.
- **Feature mapping:** the app's transactions are synthetic and do not carry IEEE-CIS features. `FraudPredictionMapper` derives a handful of them and fills the rest with constants, so scores shown in the UI are **relative risk indicators for the demo**, not validated probabilities for these transactions.
- **"AI Investigator":** a deterministic, evidence-grounded rule engine with TF-IDF policy retrieval and cited knowledge-base chunks decides the risk tier and recommended action. Optional LLM narrative (`LLM_PROVIDER=anthropic`, `groq` (free tier) or `openai_compat` (needs `LLM_BASE_URL` and `LLM_MODEL`), plus `LLM_API_KEY`, optional `LLM_MODEL` and `LLM_TIMEOUT_SECONDS`; put the key in the git-ignored `.env`, never in tracked files): **the LLM explains, the rules decide**. The model only writes the summary and finding explanations; it cannot change the action or confidence; every evidence ID and policy chunk it cites must be one the engine supplied (one fabricated ID rejects the whole answer); untrusted text is sent as JSON data; any failure falls back to the rule engine with `is_fallback=true` and a reason. The HTTP layer is tested with a mock transport; **live-verified once with Groq (`openai/gpt-oss-120b`, 6 test cases, 0 fallbacks, median 2.2 s per narrative, a prompt-injection case kept its decision); re-run `scripts/ops/live_llm_check.py` after changing provider or model**. Without a key, `anthropic` logs a warning and uses the rule engine. `confidence` is a heuristic corroboration score, and when no ML score is supplied the result says so (`ml_score_available=false`) instead of inventing one.
- **Single-instance state:** token revocation, rate limits and the analytics cache are in memory.

---

## Quick Start with Docker

Notes: the database is created only once and **kept across restarts** (`docker compose down -v` resets it on purpose). After the first start with `SEED_DEMO_DATA=true`, create your own accounts with `python scripts/ops/setup_accounts.py --admin-email ... --user-email ...` (it deactivates the demo users). Measured through the full stack on a laptop (`scripts/ops/bench_predict.py`, 25 requests): median 70 ms, p95 173 ms for `POST /api/fraud/predict`; the endpoint is rate limited (HTTP 429).

```bash
cp .env.example .env      # set JWT_SECRET_KEY (>=32 chars), FASTAPI_INTERNAL_SECRET, SQL_SA_PASSWORD
# optional, LOCAL DEMO ONLY (creates users with the known demo password below):
#   set SEED_DEMO_DATA=true in .env
docker compose up --build
# Web: http://localhost:3000   API: http://localhost:5000
```

---

## How to Run the Services

### Terminal 1: FastAPI AI Inference Engine
Serves real-time inference using the pre-trained LightGBM model.
```bash
# Navigate to project root
# Swagger UI is off by default; add ENABLE_DOCS=true for local development
ENABLE_DOCS=true python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir src/ai_engine
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
# Runs on http://localhost:3000
```

---

## Testing & Verification

### Demo Credentials (local demo seed only)

> **Warning:** `02_seed_demo_data.sql` creates these users with one shared, publicly documented password. Never run the seed against a shared or production database; create real users via the admin API instead.

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `priyanka.iyer@fraudguard.enterprise.io` | `password123` | Full access, user management, audit logs, system telemetry |
| **INVESTIGATOR** | `riya.desai@fraudguard.enterprise.io` | `password123` | Transactions, fraud alerts, case investigations, AI scoring |
| **ANALYST** | `amit.bose@fraudguard.enterprise.io` | `password123` | Alert review and analytics dashboards (no audit-log access; audit logs are ADMIN/COMPLIANCE) |

---

## Testing & Verification

### ASP.NET Core xUnit Test Suite (70 tests + 4 SQL Server integration tests)
```bash
# Run backend security, JWT, and authorization unit tests
dotnet test src/backend/FraudGuard.Api.Tests

# Optional: real SQL Server integration tests (skipped unless set). Use a THROWAWAY database that already
# has sql/01, 02 (seed, -v ALLOW_DEMO_SEED=YES), 05 and 06 applied; the tests modify data.
FG_TEST_SQL="Server=(localdb)\X;Database=Y;Trusted_Connection=True;TrustServerCertificate=True" dotnet test src/backend/FraudGuard.Api.Tests
```

> **Upgrading an existing database:** run `src/backend/sql/05_security_hardening_migration.sql` and `06_alert_category.sql` once (both idempotent).

### Full Backend API Test Suite (35 endpoints)
```bash
# Run automated test suite with Bearer token authentication
powershell -ExecutionPolicy Bypass -File src/backend/FraudGuard.Api/test_endpoints.ps1
```

### Phase 8 Security & RBAC Verification Suite (27 security checks)
```bash
# Verify 401 unauth, 403 RBAC matrix, tampered JWT, admin safety, security headers
powershell -ExecutionPolicy Bypass -File scripts/e2e/test_phase8_security.ps1
```

### Full-Stack Phase 7 Regression E2E Test Suite (11 checkpoints)
```bash
# Run end-to-end integration test
powershell -ExecutionPolicy Bypass -File scripts/e2e/test_phase7_e2e.ps1
```

### Phase 9 Agentic AI & RAG Verification Suite (31 checks)
```bash
# Verify FastAPI RAG, agentic synthesis, prompt injection, DB persistence & timeline
powershell -ExecutionPolicy Bypass -File scripts/e2e/test_phase9_agentic_ai.ps1
```

### FastAPI AI Engine Pytest Suite (34 tests)
```bash
# Verify RAG indexing, chunking, retrieval, citation integrity, model inference
# Python 3.13 and the exact pins in requirements.txt are required (the model is a pickle)
pip install -r src/ai_engine/requirements-dev.txt
python -m pytest src/ai_engine/tests -v
```

### Phase 10 Advanced Analytics & Real-Time Monitoring Suite (43 checks)
```bash
# Verify real SQL KPIs, multi-period trends, probability histogram, RBAC export, real-time sync
powershell -ExecutionPolicy Bypass -File scripts/e2e/test_phase10_analytics.ps1
```

### Angular Production Build
```bash
npm run lint     # ESLint (errors fail CI; the explicit-any warning count is pinned and may not grow)
npm test         # unit tests: Karma + Jasmine, headless Chrome (set CHROME_BIN if not auto-detected)
# Compile Angular 17 AOT production bundle
npm run build
```


