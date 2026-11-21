"""The investigator must never invent an ML score or silently pretend an LLM ran."""
import logging

from app.schemas.investigator import InvestigationContext, RecommendedActionEnum
from app.services.investigator_service import investigator_service
from app.services.llm_provider import DeterministicTemplateProvider, get_llm_provider


def _ctx(**kw):
    kw.setdefault("amount_inr", 1000.0)
    return InvestigationContext(transaction_id="TXN-HONEST-1", **kw)


def test_missing_ml_score_is_not_fabricated():
    result = investigator_service.investigate(_ctx())
    assert result.ml_score_available is False
    assert result.fraud_probability == 0.0
    assert result.fraud_probability != 82.4
    assert "No ML fraud score was available" in result.summary


def test_missing_score_never_recommends_no_action():
    result = investigator_service.investigate(_ctx())
    assert result.recommended_action != RecommendedActionEnum.NO_ACTION


def test_supplied_score_is_used_verbatim():
    result = investigator_service.investigate(_ctx(model_fraud_probability=12.5))
    assert result.ml_score_available is True
    assert result.fraud_probability == 12.5


def test_confidence_is_computed_not_constant():
    low = investigator_service.investigate(_ctx(model_fraud_probability=5.0))
    high = investigator_service.investigate(_ctx(
        amount_inr=900000.0, customer_baseline_avg_amount=20000.0, city="Tbilisi",
        distance_from_typical_km=5000.0, is_rooted_or_jailbroken=True,
        vpn_or_proxy_detected=True, model_fraud_probability=95.0))
    assert high.confidence > low.confidence
    assert high.provider_metadata["confidence_basis"].startswith("heuristic")


def test_unimplemented_provider_warns_and_falls_back(monkeypatch, caplog):
    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("LLM_API_KEY", "dummy")
    from app.logging_config import logger
    monkeypatch.setattr(logger, "propagate", True)  # app logger does not propagate by default
    with caplog.at_level(logging.WARNING, logger=logger.name):
        provider = get_llm_provider()
    assert isinstance(provider, DeterministicTemplateProvider)
    assert any("not implemented" in r.getMessage() for r in caplog.records)
