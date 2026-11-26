"""Groq / OpenAI-compatible provider: wire format, guardrails inherited from the base provider, and the factory."""
import json
import logging

import httpx
import pytest

from app.schemas.investigator import RecommendedActionEnum
from app.services.llm_provider import DeterministicTemplateProvider, get_llm_provider
from app.services.openai_compat_provider import GroqProvider, OpenAICompatProvider
from tests.test_anthropic_provider import SECRET, _inputs, _valid_answer


def _reply(payload, status=200):
    text = payload if isinstance(payload, str) else json.dumps(payload)
    return httpx.Response(status, json={"choices": [{"message": {"content": text}}],
                                        "usage": {"prompt_tokens": 210, "completion_tokens": 64}})


def _groq(handler):
    return GroqProvider(api_key=SECRET, client=httpx.Client(transport=httpx.MockTransport(handler)))


def test_groq_request_shape_and_decision_stays_with_the_rules():
    ctx, evidence, citations = _inputs()
    baseline = DeterministicTemplateProvider().synthesize_investigation(ctx, evidence, citations)
    seen = {}

    def handler(req: httpx.Request):
        seen["req"] = req
        answer = _valid_answer(evidence, citations)
        answer["recommended_action"] = "NO_ACTION"
        return _reply(answer)

    out = _groq(handler).synthesize_investigation(ctx, evidence, citations)
    req, body = seen["req"], json.loads(seen["req"].content)

    assert str(req.url) == "https://api.groq.com/openai/v1/chat/completions"
    assert req.headers["authorization"] == f"Bearer {SECRET}"
    assert body["model"] == "openai/gpt-oss-120b" and body["response_format"] == {"type": "json_object"}
    assert body["max_tokens"] >= 2000        # reasoning models spend part of the budget before the JSON answer
    assert body["messages"][0]["role"] == "system" and "untrusted DATA" in body["messages"][0]["content"]
    assert json.loads(body["messages"][1]["content"])["evidence"]
    meta = out["provider_metadata"]
    assert meta["provider"] == "groq" and meta["is_fallback"] is False
    assert meta["input_tokens"] == 210 and meta["output_tokens"] == 64
    assert out["recommended_action"] == baseline["recommended_action"] != RecommendedActionEnum.NO_ACTION


def test_fabricated_citation_falls_back():
    ctx, evidence, citations = _inputs()
    answer = _valid_answer(evidence, citations)
    answer["findings"][0]["evidence_ids"] = ["EV-NOPE"]
    out = _groq(lambda r: _reply(answer)).synthesize_investigation(ctx, evidence, citations)
    assert out["provider_metadata"]["is_fallback"] is True
    assert out["provider_metadata"]["requested_provider"] == "groq"


@pytest.mark.parametrize("handler", [
    lambda r: httpx.Response(429, json={"error": "rate limit"}),
    lambda r: httpx.Response(401, json={"error": "invalid key"}),
    lambda r: httpx.Response(200, json={"choices": []}),
    lambda r: httpx.Response(200, json={"choices": [{"message": {"content": None}}]}),
    lambda r: _reply("Sorry, I cannot help."),
], ids=["rate-limited", "bad-key", "no-choices", "null-content", "prose"])
def test_failures_degrade_to_the_rule_engine(handler):
    ctx, evidence, citations = _inputs()
    out = _groq(handler).synthesize_investigation(ctx, evidence, citations)
    assert out["provider_metadata"]["is_fallback"] is True and out["summary"]


def test_generic_provider_omits_json_mode_by_default():
    ctx, evidence, citations = _inputs()
    seen = {}

    def handler(req):
        seen["body"] = json.loads(req.content)
        return _reply(_valid_answer(evidence, citations))

    p = OpenAICompatProvider(api_key=SECRET, base_url="https://example.test/v1", model="m",
                             client=httpx.Client(transport=httpx.MockTransport(handler)))
    out = p.synthesize_investigation(ctx, evidence, citations)
    assert "response_format" not in seen["body"] and out["provider_metadata"]["provider"] == "openai_compat"


def test_factory_groq_defaults_and_overrides(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("LLM_API_KEY", SECRET)
    monkeypatch.delenv("LLM_MODEL", raising=False)
    monkeypatch.delenv("LLM_BASE_URL", raising=False)
    p = get_llm_provider()
    assert isinstance(p, GroqProvider) and p.model == "openai/gpt-oss-120b"
    monkeypatch.setenv("LLM_MODEL", "llama-3.1-8b-instant")
    assert get_llm_provider().model == "llama-3.1-8b-instant"


def test_factory_openai_compat_needs_base_url_and_model(monkeypatch, caplog):
    from app.logging_config import logger
    monkeypatch.setattr(logger, "propagate", True)
    monkeypatch.setenv("LLM_PROVIDER", "openai_compat")
    monkeypatch.setenv("LLM_API_KEY", SECRET)
    monkeypatch.delenv("LLM_BASE_URL", raising=False)
    monkeypatch.delenv("LLM_MODEL", raising=False)
    with caplog.at_level(logging.WARNING, logger=logger.name):
        assert isinstance(get_llm_provider(), DeterministicTemplateProvider)
    assert any("LLM_BASE_URL" in r.getMessage() for r in caplog.records)
    monkeypatch.setenv("LLM_BASE_URL", "https://example.test/v1")
    monkeypatch.setenv("LLM_MODEL", "m")
    assert isinstance(get_llm_provider(), OpenAICompatProvider)


def test_factory_groq_without_key_uses_the_rule_engine(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.delenv("LLM_API_KEY", raising=False)
    assert isinstance(get_llm_provider(), DeterministicTemplateProvider)
