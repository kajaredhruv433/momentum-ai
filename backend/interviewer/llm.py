"""Shared interface for Baseten-backed application prompts."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, Optional, Sequence
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DEFAULT_BASE_URL = os.getenv("BASETEN_BASE_URL", "https://inference.baseten.co/v1")
DEFAULT_MODEL = os.getenv("BASETEN_MODEL", "meta-models/muse-spark-open-1026")
DEFAULT_MAX_OUTPUT_TOKENS = int(os.getenv("BASETEN_MAX_OUTPUT_TOKENS", "2048"))


def get_baseten_client() -> OpenAI:
    """Return an OpenAI client configured for Baseten."""
    api_key = os.getenv("BASETEN_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("BASETEN_API_KEY is required for Baseten model calls.")
    base_url = os.getenv("BASETEN_BASE_URL", DEFAULT_BASE_URL).strip()
    return OpenAI(base_url=base_url, api_key=api_key)


def ask_llm(prompt: str, max_output_tokens: Optional[int] = None) -> str:
    """Generate a text response from Baseten through OpenAI-compatible client."""
    if not isinstance(prompt, str):
        raise TypeError("prompt must be a string")
    if not prompt.strip():
        raise ValueError("prompt cannot be empty")
    token_limit = DEFAULT_MAX_OUTPUT_TOKENS if max_output_tokens is None else int(max_output_tokens)
    if token_limit < 1:
        raise ValueError("max_output_tokens must be >= 1")

    client = get_baseten_client()
    model = os.getenv("BASETEN_MODEL", DEFAULT_MODEL)

    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=token_limit,
        temperature=0.2,
    )
    content = response.choices[0].message.content
    if not content or not content.strip():
        raise RuntimeError("Baseten returned an empty response.")
    return content.strip()


def ask_llm_chat(messages: Sequence[Dict[str, str]], max_output_tokens: Optional[int] = None) -> str:
    """Helper that passes role/content messages directly to Baseten chat completion."""
    if not messages:
        raise ValueError("messages cannot be empty")
    token_limit = DEFAULT_MAX_OUTPUT_TOKENS if max_output_tokens is None else int(max_output_tokens)

    client = get_baseten_client()
    model = os.getenv("BASETEN_MODEL", DEFAULT_MODEL)

    formatted_messages = []
    for message in messages:
        if not isinstance(message, dict):
            raise TypeError("Each message must be a dictionary.")
        formatted_messages.append({
            "role": message.get("role", "user"),
            "content": message.get("content", "")
        })

    response = client.chat.completions.create(
        model=model,
        messages=formatted_messages,
        max_tokens=token_limit,
        temperature=0.2,
    )
    content = response.choices[0].message.content
    if not content or not content.strip():
        raise RuntimeError("Baseten returned an empty response.")
    return content.strip()


def analyze_image(prompt: str, image_base64: str, mime_type: str = "image/png") -> str:
    """Send text prompt and optional image to Baseten Vision / multimodal or fallback."""
    client = get_baseten_client()
    model = os.getenv("BASETEN_MODEL", DEFAULT_MODEL)

    try:
        response = client.chat.completions.create(
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
            max_tokens=DEFAULT_MAX_OUTPUT_TOKENS,
            temperature=0.1,
        )
        content = response.choices[0].message.content
        if content and content.strip():
            return content.strip()
    except Exception:
        # Fall back to text prompt if the current model does not accept image_url
        pass

    return ask_llm(prompt)


def get_model() -> str:
    return os.getenv("BASETEN_MODEL", DEFAULT_MODEL)


def get_last_provider() -> str:
    return "BASETEN"


def reset_routers() -> None:
    """Clear any cached configuration."""
    pass
