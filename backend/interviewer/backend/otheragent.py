"""
Top-level AI router.

Application code only needs:
    from otheragent import ask_groq
    response = ask_groq(prompt)

Routing rule:
    prompt tokens <= 7,500  -> Groq
    prompt tokens >  7,500  -> Gemini

The caller never needs to know which provider was selected.
"""

from __future__ import annotations

from typing import Optional, Sequence, Dict

try:
    from .groqrouter import route_groq
    from .geminirouter import route_gemini
except ImportError as package_error:
    if __package__:
        raise package_error
    from groqrouter import route_groq
    from geminirouter import route_gemini

ROUTING_TOKEN_LIMIT = 7500


def _get_tokenizer():
    try:
        import tiktoken
        return tiktoken.get_encoding("cl100k_base")
    except Exception:
        return None


_TOKENIZER = _get_tokenizer()


def estimate_tokens(text: str) -> int:
    """Estimate input/prompt tokens only."""
    if not text:
        return 0

    if _TOKENIZER is not None:
        try:
            return len(_TOKENIZER.encode(text))
        except Exception:
            pass

    # Conservative local fallback.
    return max(1, (len(text) + 3) // 4)


def _route(prompt: str, max_output_tokens: Optional[int]) -> str:
    if not isinstance(prompt, str):
        raise TypeError("prompt must be a string")

    if not prompt.strip():
        raise ValueError("prompt cannot be empty")

    prompt_tokens = estimate_tokens(prompt)

    # IMPORTANT:
    # This decision uses INPUT/PROMPT tokens only.
    if prompt_tokens <= ROUTING_TOKEN_LIMIT:
        return route_groq(
            prompt=prompt,
            max_output_tokens=max_output_tokens,
        )

    return route_gemini(
        prompt=prompt,
        max_output_tokens=max_output_tokens,
    )


def ask_groq(
    prompt: str,
    max_output_tokens: Optional[int] = None,
) -> str:
    """
    Public compatibility function.

    Despite its historical name, this is now the application's
    single AI entry point. It routes internally to Groq or Gemini.
    """
    return _route(prompt, max_output_tokens)


def ask_groq_chat(
    messages: Sequence[Dict[str, str]],
    max_output_tokens: Optional[int] = None,
) -> str:
    """
    Compatibility helper for callers that already use chat messages.

    The messages are converted into one routing prompt. The routing
    threshold is calculated from the resulting prompt only.
    """
    if not messages:
        raise ValueError("messages cannot be empty")

    parts = []
    for message in messages:
        if not isinstance(message, dict):
            raise TypeError("Each message must be a dictionary.")

        role = str(message.get("role", "user"))
        content = str(message.get("content", ""))
        parts.append(f"{role}: {content}")

    return _route("\n".join(parts), max_output_tokens)


def get_model() -> str:
    """
    Historical compatibility helper.

    The actual model depends on the prompt size, so this returns
    a routing description rather than pretending one model is always used.
    """
    return "Groq: openai/gpt-oss-120b | Gemini: gemini-3.8-flash"


def get_last_provider() -> Optional[str]:
    """Compatibility/debug helper. Metadata is maintained by the routers."""
    if __package__:
        from .groqrouter import get_last_provider as _groq_last
        from .geminirouter import get_last_provider as _gemini_last
    else:
        from groqrouter import get_last_provider as _groq_last
        from geminirouter import get_last_provider as _gemini_last

    # These are process-local helpers; whichever provider completed
    # most recently wins.
    g = _groq_last()
    m = _gemini_last()

    if g is None and m is None:
        return None

    if g is None:
        return "GEMINI"
    if m is None:
        return "GROQ"

    return "GROQ" if g["timestamp"] >= m["timestamp"] else "GEMINI"


def reset_routers() -> None:
    """Reset both provider routers after .env changes."""
    if __package__:
        from .groqrouter import reset_pool as reset_groq_pool
        from .geminirouter import reset_pool as reset_gemini_pool
    else:
        from groqrouter import reset_pool as reset_groq_pool
        from geminirouter import reset_pool as reset_gemini_pool

    reset_groq_pool()
    reset_gemini_pool()
