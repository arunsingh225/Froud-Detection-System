import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app




def test_predict_normal_transaction(client: TestClient):
    """Test inference on a standard low-risk everyday retail transaction."""
    payload = {
        "TransactionAmt": 45.20,
        "ProductCD": "W",
        "card1": 10000,
        "card2": 111.0,
        "card3": 150.0,
        "card4": "visa",
        "card5": 226.0,
        "card6": "debit",
        "addr1": 315.0,
        "addr2": 87.0,
        "P_emaildomain": "gmail.com",
        "TransactionDT": 86400
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()

    # Structural assertions
    assert "request_id" in data
    uuid.UUID(data["request_id"])  # Validates UUID format
    assert 0.0 <= data["fraud_probability"] <= 1.0
    assert data["risk_level"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    assert isinstance(data["is_fraud"], bool)
    assert data["threshold"] == 0.80
    assert "LightGBM" in data["model_name"]
    assert "prediction_timestamp" in data


def test_predict_suspicious_transaction(client: TestClient):
    """Test inference on a suspicious transaction with high-risk attributes."""
    payload = {
        "TransactionAmt": 4500.00,
        "ProductCD": "C",  # Known 11.6% fraud rate
        "card1": 9500,
        "card4": "visa",
        "card6": "credit",
        "P_emaildomain": "protonmail.com",  # Known 40.8% fraud rate
        "R_emaildomain": "protonmail.com",
        "TransactionDT": 18000,  # 05:00 AM diurnal spike
        "C13": 25.0
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert 0.0 <= data["fraud_probability"] <= 1.0
    assert data["risk_level"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    assert isinstance(data["is_fraud"], bool)


def test_predict_minimal_payload(client: TestClient):
    """Test inference with only mandatory TransactionAmt; all optional fields omitted."""
    payload = {
        "TransactionAmt": 100.00
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "request_id" in data
    assert 0.0 <= data["fraud_probability"] <= 1.0
    assert data["threshold"] == 0.80


def test_predict_invalid_amount(client: TestClient):
    """Test validation rejection on non-positive or negative transaction amount."""
    payload = {
        "TransactionAmt": -50.00
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422  # Pydantic validation error


def test_predict_invalid_data_type(client: TestClient):
    """Test validation rejection on invalid data type for numeric field."""
    payload = {
        "TransactionAmt": "not_a_number"
    }
    response = client.post("/predict", json=payload)
    assert response.status_code == 422
