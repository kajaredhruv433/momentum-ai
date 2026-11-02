"""Shared interface for Baseten-backed application prompts."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, Optional, Sequence
from dotenv import dotenv_values, load_dotenv
from openai import OpenAI

ENV_FILE = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(ENV_FILE)


def _meta_api_key() -> str:
    """Read the Meta key from the process environment or backend/.env."""
    file_values = dotenv_values(ENV_FILE)
    for name in ("MODEL_API_KEY", "META_API_KEY", "META_AI_API_KEY"):
        value = os.getenv(name, "").strip() or str(file_values.get(name) or "").strip()
        if value:
            return value
    return ""

DEFAULT_BASE_URL = os.getenv("BASETEN_BASE_URL", "https://inference.baseten.co/v1")
DEFAULT_MODEL = os.getenv("BASETEN_MODEL", "meta-models/muse-spark-open-1026")
DEFAULT_MAX_OUTPUT_TOKENS = int(os.getenv("BASETEN_MAX_OUTPUT_TOKENS", "2048"))
DEFAULT_REASONING_EFFORT = os.getenv("BASETEN_REASONING_EFFORT", "low").strip().lower()
META_API_KEY = _meta_api_key()
META_BASE_URL = os.getenv("META_API_BASE_URL", "https://api.meta.ai/v1").strip().rstrip("/")
META_MODEL = os.getenv("META_API_MODEL", "muse-spark-1.3").strip()


def get_baseten_client() -> OpenAI:
    """Return an OpenAI client configured for Baseten."""
    api_key = os.getenv("BASETEN_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("BASETEN_API_KEY is required for Baseten model calls.")
    base_url = os.getenv("BASETEN_BASE_URL", DEFAULT_BASE_URL).strip()
    return OpenAI(base_url=base_url, api_key=api_key)


def get_llm_client() -> tuple[OpenAI, str, str]:
    """Use competition-required Meta Model API when configured; retain Baseten fallback."""
    if META_API_KEY:
        return OpenAI(base_url=META_BASE_URL, api_key=META_API_KEY, timeout=90, max_retries=1), "META", META_MODEL
    return get_baseten_client(), "BASETEN", os.getenv("BASETEN_MODEL", DEFAULT_MODEL)


def _response_text(response) -> str:
    """Extract only user-facing text from an OpenAI-compatible completion."""
    if not response.choices:
        return ""
    content = response.choices[0].message.content
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text")
            else:
                text = getattr(item, "text", None)
            if isinstance(text, str) and text.strip():
                parts.append(text.strip())
        return "\n".join(parts).strip()
    return ""


def _chat_completion(client: OpenAI, model: str, messages, token_limit: int, provider: str = "BASETEN"):
    """Call Muse Spark with a low reasoning budget suited to interview turns."""
    options = dict(
        model=model,
        messages=messages,
        max_tokens=token_limit,
        temperature=0.2,
    )
    if provider == "BASETEN":
        options["extra_body"] = {"reasoning_effort": DEFAULT_REASONING_EFFORT}
    return client.chat.completions.create(**options)


def ask_llm(prompt: str, max_output_tokens: Optional[int] = None) -> str:
    """Generate text through Meta Model API when configured, with Baseten fallback."""
    if not isinstance(prompt, str):
        raise TypeError("prompt must be a string")
    if not prompt.strip():
        raise ValueError("prompt cannot be empty")
    token_limit = DEFAULT_MAX_OUTPUT_TOKENS if max_output_tokens is None else int(max_output_tokens)
    if token_limit < 1:
        raise ValueError("max_output_tokens must be >= 1")

    client, provider, model = get_llm_client()

    messages = [{"role": "user", "content": prompt}]
    response = _chat_completion(client, model, messages, token_limit, provider)
    content = _response_text(response)
    if not content:
        # A reasoning model may spend the entire completion budget thinking.
        # Retry once with a short-answer instruction and a larger answer budget.
        retry_messages = messages + [{
            "role": "user",
            "content": "Return the requested answer now. Keep it concise and include only the answer text.",
        }]
        retry = _chat_completion(client, model, retry_messages, max(token_limit, 1024) * 2, provider)
        content = _response_text(retry)
        if not content:
            choice = retry.choices[0] if retry.choices else None
            finish_reason = choice.finish_reason if choice else "no_choices"
            raise RuntimeError(
                f"{provider} returned no answer text after retry (finish_reason={finish_reason}, "
                f"provider={provider})."
            )
    return content


def ask_llm_chat(messages: Sequence[Dict[str, str]], max_output_tokens: Optional[int] = None) -> str:
    """Helper that passes role/content messages to the configured chat completion API."""
    if not messages:
        raise ValueError("messages cannot be empty")
    token_limit = DEFAULT_MAX_OUTPUT_TOKENS if max_output_tokens is None else int(max_output_tokens)

    client, provider, model = get_llm_client()

    formatted_messages = []
    for message in messages:
        if not isinstance(message, dict):
            raise TypeError("Each message must be a dictionary.")
        formatted_messages.append({
            "role": message.get("role", "user"),
            "content": message.get("content", "")
        })

    response = _chat_completion(client, model, formatted_messages, token_limit, provider)
    content = _response_text(response)
    if not content:
        choice = response.choices[0] if response.choices else None
        finish_reason = choice.finish_reason if choice else "no_choices"
        raise RuntimeError(f"{provider} returned no answer text (finish_reason={finish_reason}).")
    return content


def analyze_image(prompt: str, image_base64: str, mime_type: str = "image/png") -> str:
    """Send text prompt and optional image to Baseten Vision / multimodal or fallback."""
    client, provider, model = get_llm_client()

    try:
        response = _chat_completion(
            client,
            model=model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime_type};base64,{image_base64}"}
                        }
                    ]
                }
            ],
            token_limit=DEFAULT_MAX_OUTPUT_TOKENS,
            provider=provider,
        )
        content = _response_text(response)
        if content:
            return content
    except Exception:
        # Fall back to text prompt if the current model does not accept image_url
        pass

    return ask_llm(prompt)


def get_model() -> str:
    return META_MODEL if META_API_KEY else os.getenv("BASETEN_MODEL", DEFAULT_MODEL)


def get_last_provider() -> str:
    return "META" if META_API_KEY else "BASETEN"


def reset_routers() -> None:
    """Clear any cached configuration."""
    pass
