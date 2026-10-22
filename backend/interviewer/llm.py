"""Shared LangChain interface for Gemini-backed application prompts."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Dict, Optional, Sequence

from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv
from langchain_core.prompts import PromptTemplate

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
DEFAULT_MAX_OUTPUT_TOKENS = int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "2048"))


@lru_cache(maxsize=8)
def _text_chain(max_output_tokens: int):
    """Build a reusable LCEL chain using the single configured Gemini key."""
    from langchain_google_genai import ChatGoogleGenerativeAI

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is required for Gemini model calls.")

    model = ChatGoogleGenerativeAI(
        model=DEFAULT_MODEL,
        google_api_key=api_key,
        max_output_tokens=max_output_tokens,
        temperature=0.2,
    )
    return PromptTemplate.from_template("{prompt}") | model | StrOutputParser()


def ask_llm(prompt: str, max_output_tokens: Optional[int] = None) -> str:
    """Generate a text response from Gemini through a LangChain runnable."""
    if not isinstance(prompt, str):
        raise TypeError("prompt must be a string")
    if not prompt.strip():
        raise ValueError("prompt cannot be empty")
    token_limit = DEFAULT_MAX_OUTPUT_TOKENS if max_output_tokens is None else int(max_output_tokens)
    if token_limit < 1:
        raise ValueError("max_output_tokens must be >= 1")
    response = _text_chain(token_limit).invoke({"prompt": prompt})
    if not response or not response.strip():
        raise RuntimeError("Gemini returned an empty response.")
    return response.strip()


def ask_llm_chat(messages: Sequence[Dict[str, str]], max_output_tokens: Optional[int] = None) -> str:
    """Compatibility helper that converts role/content messages to one prompt."""
    if not messages:
        raise ValueError("messages cannot be empty")
    prompt_parts = []
    for message in messages:
        if not isinstance(message, dict):
            raise TypeError("Each message must be a dictionary.")
        prompt_parts.append(f"{message.get('role', 'user')}: {message.get('content', '')}")
    return ask_llm("\n".join(prompt_parts), max_output_tokens)


def analyze_image(prompt: str, image_base64: str, mime_type: str = "image/png") -> str:
    """Send a text prompt and image to Gemini Vision through LangChain."""
    from langchain_google_genai import ChatGoogleGenerativeAI

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is required for Gemini model calls.")
    model = ChatGoogleGenerativeAI(
        model=DEFAULT_MODEL,
        google_api_key=api_key,
        max_output_tokens=DEFAULT_MAX_OUTPUT_TOKENS,
        temperature=0.1,
    )
    message = HumanMessage(content=[
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": f"data:{mime_type};base64,{image_base64}"},
    ])
    response = model.invoke([message])
    content = response.content
    if isinstance(content, str):
        return content.strip()
    return "".join(part.get("text", "") for part in content if isinstance(part, dict)).strip()


def get_model() -> str:
    return DEFAULT_MODEL


def get_last_provider() -> str:
    return "GEMINI"


def reset_routers() -> None:
    """Clear cached model chains after environment configuration changes."""
    _text_chain.cache_clear()


askllm = ask_llm
