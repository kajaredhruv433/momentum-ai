"""
Lowest-level Gemini response module.

Input:
    api_key
    prompt

Output:
    response as a plain string

This module does NOT select Gemini keys.
geminirouter.py is responsible for key routing.
"""

from __future__ import annotations

import os

from google import genai
from google.genai import types


GEMINI_MODEL = "gemini-3.8-flash"

GEMINI_MAX_OUTPUT_TOKENS = int(
    os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "1000")
)


def _extract_text(response) -> str:
    """
    Extract generated text from a Gemini response.

    We first try the SDK's response.text convenience property,
    then inspect candidate parts manually.

    Non-text parts such as function calls are ignored.
    """

    # ------------------------------------------------------------
    # 1. SDK convenience property
    # ------------------------------------------------------------

    try:
        text = response.text

        if text:
            return str(text).strip()

    except Exception:
        pass

    # ------------------------------------------------------------
    # 2. Manually inspect candidates / parts
    # ------------------------------------------------------------

    candidates = getattr(
        response,
        "candidates",
        None,
    )

    if candidates:

        text_parts = []

        for candidate in candidates:

            content = getattr(
                candidate,
                "content",
                None,
            )

            if content is None:
                continue

            parts = getattr(
                content,
                "parts",
                None,
            )

            if not parts:
                continue

            for part in parts:

                text = getattr(
                    part,
                    "text",
                    None,
                )

                if text:
                    text_parts.append(
                        str(text)
                    )

        if text_parts:

            return "".join(
                text_parts
            ).strip()

    # ------------------------------------------------------------
    # 3. No text
    # ------------------------------------------------------------

    raise RuntimeError(
        "Gemini returned no text content."
    )


def generate_gemini_response(
    api_key: str,
    prompt: str,
    max_output_tokens: int | None = None,
) -> str:

    if not api_key:
        raise ValueError(
            "api_key cannot be empty"
        )

    if not isinstance(prompt, str):
        raise TypeError(
            "prompt must be a string"
        )

    if not prompt.strip():
        raise ValueError(
            "prompt cannot be empty"
        )

    if max_output_tokens is None:
        max_output_tokens = (
            GEMINI_MAX_OUTPUT_TOKENS
        )

    max_output_tokens = int(
        max_output_tokens
    )

    if max_output_tokens < 1:
        raise ValueError(
            "max_output_tokens must be >= 1"
        )

    # ------------------------------------------------------------
    # Create Gemini client using the key supplied by router.
    # ------------------------------------------------------------

    client = genai.Client(
        api_key=api_key
    )

    # ------------------------------------------------------------
    # Generate response.
    # ------------------------------------------------------------

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            max_output_tokens=max_output_tokens,
            response_modalities=["TEXT"],
        ),
    )

    # ------------------------------------------------------------
    # Return ONLY a string.
    # ------------------------------------------------------------

    return _extract_text(response)