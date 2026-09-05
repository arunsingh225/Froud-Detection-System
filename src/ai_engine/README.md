# FraudGuard AI — AI Inference Microservice

High-performance, standalone Python FastAPI microservice that serves real-time fraud risk inference using the pre-trained LightGBM model developed during Phase 4 on the IEEE-CIS Fraud Detection dataset.

---

## 1. Overview & Architecture

The **AI Engine** acts as an inference-only decision service within the FraudGuard AI platform:
- **Zero Ingestion at Runtime:** Never loads raw CSV files or retrains models upon startup.
- **Pre-trained LightGBM Engine:** Loads serialized binary tree artifacts (`fraud_model.pkl`) and pre-computed training frequency mappings (`preprocessing.pkl`).
- **Sub-10ms Decision Latency:** Evaluates 464 engineered and point-in-time transaction features on the fly.
- **Calibrated Operational Risk:** Employs optimal decision thresholding (`0.80`) tuned to balance high fraud recall with controlled false positive alerts.

```
[ Angular 17 UI ] 
        │
        ▼  (HTTP REST)
[ ASP.NET Core 8 Web API ]
        │
        ▼  (HTTP POST /predict)
[ FastAPI AI Inference Engine (Port 8000) ]
        │
        ▼  (In-Memory Scoring)
[ LightGBM Classifier (464 features) ]
```

---

## 2. Directory Structure

```
src/ai_engine/
├── app/
│   ├── __init__.py
│   ├── main.py                   # FastAPI application & lifespan lifecycle
│   ├── config.py                 # Pydantic settings & dynamic path resolution
│   ├── logging_config.py         # Privacy-compliant structured logger
│   ├── api/
│   │   ├── __init__.py
│   │   └── routes.py             # /health, /model-info, /predict
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── prediction.py         # Pydantic v2 input validation schema
│   │   └── response.py           # Structured output schemas
│   ├── services/
│   │   ├── __init__.py
│   │   ├── model_service.py      # Model lifecycle & inference manager
│   │   ├── preprocessing_service.py # Feature engineering & encoding
│   │   └── risk_service.py       # Operational risk tiering & decisions
│   └── utils/
│       ├── __init__.py
│       └── request_id.py         # Distributed UUID v4 generator
├── tests/
│   ├── __init__.py
│   ├── test_health.py            # Uptime & readiness tests
│   ├── test_model_info.py        # Model specification & metrics tests
│   └── test_predict.py           # Scenario prediction tests
├── .env.example                  # Environment template
├── requirements.txt              # Pinned Python package dependencies
├── test_api.py                   # Standalone manual verification script
└── README.md                     # Comprehensive service documentation
```

---

## 3. Installation & Setup

Ensure Python 3.10+ is installed:

```bash
# Navigate to the ai_engine directory
cd src/ai_engine

# Install required dependencies
pip install -r requirements.txt
```

---

## 4. Configuration

Copy the sample environment file if customization is required:
```bash
cp .env.example .env
```

Configuration variables in `app/config.py`:
- `MODEL_PATH`: Location of `fraud_model.pkl` (Default: `models/fraud_model.pkl`)
- `PREPROCESSING_PATH`: Location of `preprocessing.pkl` (Default: `models/preprocessing.pkl`)
- `METADATA_PATH`: Location of `model_metadata.json` (Default: `models/model_metadata.json`)
- `HOST`: Host to bind (Default: `0.0.0.0`)
- `PORT`: Port to listen on (Default: `8000`)
- `LOG_LEVEL`: Logging verbosity (Default: `INFO`)

---

## 5. Running the Service

### Start the Uvicorn Server:
```bash
# From workspace root:
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir src/ai_engine

# Or from src/ai_engine:
cd src/ai_engine
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Interactive API documentation will be available at:
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

---

## 6. API Endpoints & Usage

### A. Health & Readiness
`GET /health`
```bash
curl http://localhost:8000/health
```
**Response:**
```json
{
  "status": "healthy",
  "service": "FraudGuard AI Engine",
  "model_loaded": true,
  "timestamp": "2026-09-03T12:00:00Z"
}
```

---

### B. Model Provenance & Metrics
`GET /model-info`
```bash
curl http://localhost:8000/model-info
```
**Response:**
```json
{
  "model_name": "LightGBM_Fraud_Classifier",
  "model_version": "1.0",
  "roc_auc": 0.9168,
  "pr_auc": 0.5393,
  "threshold": 0.80,
  "feature_count": 464,
  "training_date": "2026-09-03 07:11:40 UTC"
}
```

---

### C. Real-time Fraud Scoring
`POST /predict`

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "TransactionAmt": 250.50,
    "ProductCD": "W",
    "card1": 12345,
    "card2": 111,
    "card3": 150,
    "card4": "visa",
    "card5": 226,
    "card6": "credit",
    "addr1": 123,
    "addr2": 87,
    "TransactionDT": 86400,
    "C13": 2,
    "D15": 20
  }'
```

**Response:**
```json
{
  "request_id": "4b689a54-46c5-412f-b492-d61bbbeee9c0",
  "fraud_probability": 0.8412,
  "risk_level": "CRITICAL",
  "is_fraud": true,
  "threshold": 0.80,
  "model_name": "LightGBM_Fraud_Classifier",
  "model_version": "1.0",
  "prediction_timestamp": "2026-09-03T07:25:31.123456+00:00"
}
```

---

## 7. Risk Level Classification Policy

| Probability Range | Risk Tier | Recommended Action |
| :--- | :--- | :--- |
| **0.00 – 0.20** | `LOW` | Auto-approve without friction. |
| **0.20 – 0.50** | `MEDIUM` | Standard transaction monitoring; periodic audit. |
| **0.50 – 0.80** | `HIGH` | Step-up authentication (2FA/SMS challenge) requested. |
| **0.80 – 1.00** | `CRITICAL` | Flagged as Fraud alert; routed to human investigator. |

The binary fraud decision evaluates:
$$\text{is\_fraud} = (\text{fraud\_probability} \ge 0.80)$$

---

## 8. Automated Testing

Run the full pytest suite:
```bash
# Run tests from src/ai_engine
cd src/ai_engine
pytest -v
```

Run the standalone verification test script:
```bash
python test_api.py
```

---

## 9. Security & Governance Standards

1. **No Sensitive Card Logging:** Full payment card PAN numbers, CVV, or PII are strictly excluded from logging statements.
2. **Read-Only Model Storage:** Model binaries are loaded read-only into memory at application boot; no retraining or arbitrary file upload endpoints exist.
3. **Pydantic V2 Type Enforcement:** All requests are rigorously validated against boundary constraints (e.g., `TransactionAmt > 0`).
4. **Distributed Request Correlation:** Every inference invocation generates an immutable UUID v4 `request_id` to ensure complete auditability across ASP.NET Core and Angular.
