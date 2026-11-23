"""Zero-downtime rotation of the shared X-Internal-Secret."""
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

CURRENT = "CurrentSecret_2026_rotation_test_value"
PREVIOUS = "PreviousSecret_2026_rotation_test_value"
PAYLOAD = {"TransactionAmt": 25.0}


def _post(secret):
    headers = {"X-Internal-Secret": secret} if secret is not None else {}
    with TestClient(app) as c:
        return c.post("/predict", json=PAYLOAD, headers=headers).status_code


def test_current_secret_is_accepted(monkeypatch):
    monkeypatch.setattr(settings, "FASTAPI_INTERNAL_SECRET", CURRENT)
    monkeypatch.setattr(settings, "FASTAPI_INTERNAL_SECRET_PREVIOUS", PREVIOUS)
    assert _post(CURRENT) == 200


def test_previous_secret_is_accepted_during_rotation_and_logs_a_warning(monkeypatch, caplog):
    import logging
    from app.logging_config import logger
    monkeypatch.setattr(settings, "FASTAPI_INTERNAL_SECRET", CURRENT)
    monkeypatch.setattr(settings, "FASTAPI_INTERNAL_SECRET_PREVIOUS", PREVIOUS)
    monkeypatch.setattr(logger, "propagate", True)
    with caplog.at_level(logging.WARNING, logger=logger.name):
        assert _post(PREVIOUS) == 200
    assert any("PREVIOUS internal secret" in r.getMessage() for r in caplog.records)


def test_previous_secret_is_rejected_once_rotation_is_finished(monkeypatch):
    monkeypatch.setattr(settings, "FASTAPI_INTERNAL_SECRET", CURRENT)
    monkeypatch.setattr(settings, "FASTAPI_INTERNAL_SECRET_PREVIOUS", "")
    assert _post(PREVIOUS) == 401


def test_unknown_and_missing_secrets_are_rejected(monkeypatch):
    monkeypatch.setattr(settings, "FASTAPI_INTERNAL_SECRET", CURRENT)
    monkeypatch.setattr(settings, "FASTAPI_INTERNAL_SECRET_PREVIOUS", PREVIOUS)
    assert _post("not-a-secret") == 401
    assert _post(None) == 401
    assert _post("") == 401


def test_empty_previous_secret_never_matches_an_empty_header(monkeypatch):
    """An unset PREVIOUS must not turn an empty X-Internal-Secret into a valid credential."""
    monkeypatch.setattr(settings, "FASTAPI_INTERNAL_SECRET", CURRENT)
    monkeypatch.setattr(settings, "FASTAPI_INTERNAL_SECRET_PREVIOUS", "")
    assert _post("") == 401
