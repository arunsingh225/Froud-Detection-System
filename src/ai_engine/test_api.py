import sys
import json
import httpx
from pathlib import Path

# Add src/ai_engine to path for standalone execution
current_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(current_dir))

def run_tests():
    print("=" * 60)
    print("FraudGuard AI — AI Engine Manual Verification Test")
    print("=" * 60)

    # Test via TestClient to guarantee standalone testability
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as client:
        # 1. Health Check
        res_health = client.get("/health")
        health_pass = res_health.status_code == 200 and res_health.json().get("model_loaded") is True
        print(f"Health Endpoint:    {'PASS' if health_pass else 'FAIL'} (HTTP {res_health.status_code})")
        print(f"  Response: {res_health.json()}")

        # 2. Model Info
        res_info = client.get("/model-info")
        info_pass = res_info.status_code == 200 and res_info.json().get("feature_count") == 464
        print(f"\\nModel Info:         {'PASS' if info_pass else 'FAIL'} (HTTP {res_info.status_code})")
        print(f"  Model:            {res_info.json().get('model_name')}")
        print(f"  ROC-AUC:          {res_info.json().get('roc_auc')}")
        print(f"  PR-AUC:           {res_info.json().get('pr_auc')}")
        print(f"  Operating Threshold: {res_info.json().get('threshold')}")
        print(f"  Features Scored:  {res_info.json().get('feature_count')}")

        # 3. Predict Endpoint
        payload = {
            "TransactionAmt": 250.50,
            "ProductCD": "W",
            "card1": 12345,
            "card2": 111.0,
            "card3": 150.0,
            "card4": "visa",
            "card5": 226.0,
            "card6": "credit",
            "addr1": 123.0,
            "addr2": 87.0,
            "TransactionDT": 86400,
            "C13": 2.0,
            "D15": 20.0
        }
        res_pred = client.post("/predict", json=payload)
        pred_pass = res_pred.status_code == 200 and 0.0 <= res_pred.json().get("fraud_probability", -1) <= 1.0
        print(f"\\nPrediction Test:    {'PASS' if pred_pass else 'FAIL'} (HTTP {res_pred.status_code})")
        pred_data = res_pred.json()
        print(f"  Request ID:       {pred_data.get('request_id')}")
        print(f"  Fraud Probability:{pred_data.get('fraud_probability')}")
        print(f"  Risk Level:       {pred_data.get('risk_level')}")
        print(f"  Fraud Decision:   {'FRAUD (TRUE)' if pred_data.get('is_fraud') else 'LEGITIMATE (FALSE)'}")
        print(f"  Threshold:        {pred_data.get('threshold')}")
        print(f"  Timestamp:        {pred_data.get('prediction_timestamp')}")

    print("=" * 60)
    if health_pass and info_pass and pred_pass:
        print("ALL TESTS PASSED SUCCESSFULLY!")
        return 0
    else:
        print("SOME TESTS FAILED!")
        return 1

if __name__ == "__main__":
    sys.exit(run_tests())
