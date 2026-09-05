import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.model_service import model_service


@pytest.fixture(scope="module")
def client():
    # Trigger startup lifespan to load model
    with TestClient(app) as test_client:
        yield test_client


def test_health_endpoint(client: TestClient):
    """Verify that GET /health returns HTTP 200 and reports model is loaded."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "FraudGuard AI Engine"
    assert data["model_loaded"] is True
    assert "timestamp" in data
