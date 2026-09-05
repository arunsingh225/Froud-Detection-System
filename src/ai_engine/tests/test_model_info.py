import pytest
from fastapi.testclient import TestClient
from app.main import app




def test_model_info_endpoint(client: TestClient):
    """Verify that GET /model-info returns metadata matching Phase 4 specifications."""
    response = client.get("/model-info")
    assert response.status_code == 200
    data = response.json()
    assert "LightGBM" in data["model_name"]
    assert data["feature_count"] == 464
    assert abs(data["roc_auc"] - 0.9168) < 0.01
    assert abs(data["pr_auc"] - 0.5393) < 0.01
    assert abs(data["threshold"] - 0.80) < 0.01
