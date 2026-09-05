import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from app.services.model_service import ModelService, ModelIntegrityError
from app.config import settings

def test_health_is_public_without_secret(unauthenticated_client: TestClient):
    """Verify /health endpoint remains accessible without X-Internal-Secret."""
    res = unauthenticated_client.get("/health")
    assert res.status_code == 200

def test_predict_rejected_without_secret(unauthenticated_client: TestClient):
    """Verify /predict rejects requests lacking X-Internal-Secret with HTTP 401."""
    res = unauthenticated_client.post("/predict", json={
        "TransactionAmt": 100.0,
        "ProductCD": "W",
        "card1": 10000
    })
    assert res.status_code == 401
    assert "X-Internal-Secret" in res.json().get("detail", "")

def test_predict_rejected_with_invalid_secret(unauthenticated_client: TestClient):
    """Verify /predict rejects invalid microservice secrets."""
    res = unauthenticated_client.post(
        "/predict",
        headers={"X-Internal-Secret": "WrongBadSecretValue123"},
        json={"TransactionAmt": 100.0, "ProductCD": "W", "card1": 10000}
    )
    assert res.status_code == 401

def test_model_info_rejected_without_secret(unauthenticated_client: TestClient):
    """Verify /model-info rejects unauthenticated requests."""
    res = unauthenticated_client.get("/model-info")
    assert res.status_code == 401

def test_model_integrity_verification_success():
    """Verify that pristine model passes SHA-256 integrity checks."""
    service = ModelService()
    service.load()
    assert service.is_loaded is True

def test_tampered_model_integrity_failure(tmp_path: Path, monkeypatch):
    """Verify that modifying a single byte in model causes SHA-256 mismatch and aborts load."""
    fake_model = tmp_path / "fraud_model.pkl"
    fake_model.write_bytes(b"tampered-binary-data")
    
    monkeypatch.setattr(settings, "MODEL_PATH", str(fake_model))
    
    tampered_service = ModelService()
    with pytest.raises(ModelIntegrityError) as exc_info:
        tampered_service.load()
    assert "SHA-256 mismatch" in str(exc_info.value)
