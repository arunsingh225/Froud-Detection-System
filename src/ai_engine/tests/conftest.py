import os
import pytest
from fastapi.testclient import TestClient
from app.config import settings

TEST_SECRET = "TestInternalSecret_2026_HMAC_Microservice!"
os.environ["FASTAPI_INTERNAL_SECRET"] = TEST_SECRET
settings.FASTAPI_INTERNAL_SECRET = TEST_SECRET

from app.main import app

@pytest.fixture(scope="session")
def client():
    with TestClient(app, headers={"X-Internal-Secret": TEST_SECRET}) as test_client:
        yield test_client

@pytest.fixture(scope="session")
def unauthenticated_client():
    with TestClient(app) as test_client:
        yield test_client
