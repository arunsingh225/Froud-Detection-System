"""
LLM narrative over any OpenAI-compatible chat-completions endpoint (Groq, OpenRouter, Gemini's compat API, ...).

It reuses every guardrail of ``AnthropicProvider`` (rules decide, citation IDs validated, JSON-as-data prompt,
deterministic fallback); only the wire format differs. Free models are less reliable at strict JSON than Claude, so
expect the fallback (``is_fallback=True`` with a reason) to trigger now and then; that is the designed behaviour.
"""
from typing import Any, Dict, Optional

import httpx

from app.services.anthropic_provider import AnthropicProvider, LLMResponseRejected, SYSTEM_PROMPT

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
# Groq retires models over time (llama-3.3-70b-versatile returned 404 in Nov 2026); check console.groq.com/docs/models.
# gpt-oss-120b spends part of max_tokens on hidden reasoning, hence the larger default budget below.
GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b"


class OpenAICompatProvider(AnthropicProvider):
    PROVIDER_NAME = "openai_compat"

    def __init__(
        self,
        api_key: str,
        base_url: str,
        model: str,
        timeout_seconds: float = 20.0,
        max_tokens: int = 1200,
        json_mode: bool = False,
        client: Optional[httpx.Client] = None,
    ):
        super().__init__(api_key=api_key, model=model, base_url=base_url, timeout_seconds=timeout_seconds,
                         max_tokens=max_tokens, client=client)
        self._url = base_url.rstrip("/") + "/chat/completions"
        self._json_mode = json_mode

    def _call(self, user_message: str) -> "tuple[str, Dict[str, Any]]":
        payload: Dict[str, Any] = {
            "model": self.model,
            "max_tokens": self._max_tokens,
            "temperature": 0,
            "messages": [{"role": "system", "content": SYSTEM_PROMPT},
                         {"role": "user", "content": user_message}],
        }
        if self._json_mode:
            payload["response_format"] = {"type": "json_object"}
        response = self._client.post(
            self._url,
            headers={"Authorization": f"Bearer {self._api_key}", "content-type": "application/json"},
            json=payload,
        )
        response.raise_for_status()
        body = response.json()
        text = body["choices"][0]["message"].get("content") or ""
        if not text:
            raise LLMResponseRejected("empty model response")
        usage = body.get("usage", {})
        return text, {"input_tokens": usage.get("prompt_tokens"), "output_tokens": usage.get("completion_tokens")}


class GroqProvider(OpenAICompatProvider):
    PROVIDER_NAME = "groq"

    def __init__(self, api_key: str, model: str = GROQ_DEFAULT_MODEL, base_url: str = GROQ_BASE_URL, **kw: Any):
        kw.setdefault("json_mode", True)
        kw.setdefault("max_tokens", 2500)
        super().__init__(api_key=api_key, base_url=base_url, model=model, **kw)
