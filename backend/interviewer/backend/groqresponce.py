"""
Lowest-level Groq response module.

Input:
    api_key: selected Groq API key
    prompt: prompt string

Output:
    response string

This module does NOT select keys.
groqrouter.py is responsible for key selection.
"""

from __future__ import annotations

import os

from groq import Groq


GROQ_MODEL = "openai/gpt-oss-120b"
GROQ_REASONING_EFFORT = os.getenv("GROQ_REASONING_EFFORT", "medium").lower()
GROQ_MAX_OUTPUT_TOKENS = int(os.getenv("GROQ_MAX_OUTPUT_TOKENS", "1000"))


def generate_groq_response(
    api_key: str,
    prompt: str,
    max_output_tokens: int | None = None,
) -> str:
    if not api_key:
        raise ValueError("api_key cannot be empty")

    if not isinstance(prompt, str):
        raise TypeError("prompt must be a string")

    if not prompt.strip():
        raise ValueError("prompt cannot be empty")

    if max_output_tokens is None:
        max_output_tokens = GROQ_MAX_OUTPUT_TOKENS

    client = Groq(api_key=api_key)

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
        max_completion_tokens=int(max_output_tokens),
        reasoning_effort=GROQ_REASONING_EFFORT,
    )

    if not response.choices:
        return ""

    content = getattr(response.choices[0].message, "content", None)

    return "" if content is None else str(content)
