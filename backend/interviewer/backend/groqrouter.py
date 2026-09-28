"""
Groq key router.

Responsibilities:
- Load GROQ_API_KEY / GROQ_API_KEY_1 ... from .env.
- Maintain per-key token usage.
- Respect the Groq TPM budget.
- Use round-robin selection.
- Skip keys that do not have enough available token budget.
- Cool down keys after rate/server/auth failures.
- Pass the selected key + prompt to groqresponce.py.
"""

from __future__ import annotations

import os
import re
import time
import threading
from dataclasses import dataclass
from typing import List, Optional

from dotenv import load_dotenv

try:
    from .groqresponce import generate_groq_response
except ImportError:
    from groqresponce import generate_groq_response

load_dotenv()

GROQ_MODEL = "openai/gpt-oss-120b"
GROQ_TPM_LIMIT = int(os.getenv("GROQ_TPM_LIMIT", "8000"))
GROQ_TOKEN_SAFETY_MARGIN = float(os.getenv("GROQ_TOKEN_SAFETY_MARGIN", "0.90"))
GROQ_MAX_OUTPUT_TOKENS = int(os.getenv("GROQ_MAX_OUTPUT_TOKENS", "2000"))
GROQ_MAX_WAIT_SECONDS = int(os.getenv("GROQ_MAX_WAIT_SECONDS", "90"))

# These are intentionally small so one bad key is moved out of rotation.
GROQ_429_COOLDOWN = float(os.getenv("GROQ_429_COOLDOWN", "5"))
GROQ_5XX_COOLDOWN = float(os.getenv("GROQ_5XX_COOLDOWN", "2"))
GROQ_AUTH_COOLDOWN = float(os.getenv("GROQ_AUTH_COOLDOWN", "300"))


def _load_api_keys() -> List[str]:
    keys: List[str] = []

    for i in range(1, 21):
        key = os.getenv(f"GROQ_API_KEY_{i}", "").strip()
        if key:
            keys.append(key)

    fallback = os.getenv("GROQ_API_KEY", "").strip()
    if fallback and fallback not in keys:
        keys.append(fallback)

    return keys


def _parse_reset_seconds(value: Optional[str]) -> Optional[float]:
    if not value:
        return None

    value = str(value).strip().lower()

    try:
        return float(value)
    except ValueError:
        pass

    total = 0.0
    found = False

    for pattern, multiplier in (
        (r"([\d.]+)\s*ms", 0.001),
        (r"([\d.]+)\s*s", 1.0),
        (r"([\d.]+)\s*m", 60.0),
    ):
        match = re.search(pattern, value)
        if match:
            total += float(match.group(1)) * multiplier
            found = True

    return total if found else None


@dataclass
class KeyState:
    key: str
    used_tokens: int = 0
    provider_remaining_tokens: Optional[int] = None
    reset_at: float = 0.0
    cooldown_until: float = 0.0
    last_request_at: float = 0.0


class GroqKeyRouter:
    def __init__(self, api_keys: List[str]):
        if not api_keys:
            raise RuntimeError(
                "No Groq API key found. Set GROQ_API_KEY or "
                "GROQ_API_KEY_1 ... GROQ_API_KEY_20 in .env."
            )

        self.states = [KeyState(key=k) for k in api_keys]
        self.index = 0
        self.lock = threading.Lock()

    def _refresh_window(self, state: KeyState) -> None:
        now = time.time()

        if state.reset_at and now >= state.reset_at:
            state.used_tokens = 0
            state.provider_remaining_tokens = None
            state.reset_at = 0.0

    def _remaining(self, state: KeyState) -> int:
        self._refresh_window(state)

        local_remaining = max(0, GROQ_TPM_LIMIT - state.used_tokens)

        if state.provider_remaining_tokens is not None:
            return min(local_remaining, state.provider_remaining_tokens)

        return local_remaining

    def _usable_remaining(self, state: KeyState) -> int:
        return int(self._remaining(state) * GROQ_TOKEN_SAFETY_MARGIN)

    def _select_key(self, required_tokens: int) -> Optional[KeyState]:
        """
        Atomic selection + reservation.

        The reservation prevents concurrent requests from selecting the
        same apparent free budget before either request reaches the API.
        """
        with self.lock:
            now = time.time()
            count = len(self.states)

            candidates = []

            for offset in range(count):
                idx = (self.index + offset) % count
                state = self.states[idx]

                self._refresh_window(state)

                if now < state.cooldown_until:
                    continue

                usable = self._usable_remaining(state)
                if required_tokens <= usable:
                    candidates.append((offset, idx, state))

            if not candidates:
                return None

            _, selected_idx, selected = candidates[0]

            # Advance round-robin pointer immediately.
            self.index = (selected_idx + 1) % count

            # Reserve the estimated request budget.
            selected.used_tokens += required_tokens
            selected.last_request_at = now

            return selected

    def _refund_reservation(self, state: KeyState, reserved_tokens: int) -> None:
        with self.lock:
            state.used_tokens = max(0, state.used_tokens - reserved_tokens)

    def _cooldown(self, state: KeyState, seconds: float) -> None:
        with self.lock:
            state.cooldown_until = max(
                state.cooldown_until,
                time.time() + seconds,
            )

    def _update_headers(self, state: KeyState, response) -> None:
        headers = getattr(response, "headers", None)
        if not headers:
            return

        remaining = headers.get("x-ratelimit-remaining-tokens")
        reset_value = headers.get("x-ratelimit-reset-tokens")

        with self.lock:
            if remaining is not None:
                try:
                    state.provider_remaining_tokens = int(remaining)
                except (ValueError, TypeError):
                    pass

            reset_seconds = _parse_reset_seconds(reset_value)
            if reset_seconds is not None:
                state.reset_at = time.time() + reset_seconds

    def _replace_reservation_with_actual(
        self,
        state: KeyState,
        reserved_tokens: int,
        actual_tokens: Optional[int],
    ) -> None:
        if actual_tokens is None:
            return

        with self.lock:
            state.used_tokens = max(
                0,
                state.used_tokens - reserved_tokens + int(actual_tokens),
            )

    @staticmethod
    def _status_code(exc) -> Optional[int]:
        value = getattr(exc, "status_code", None)
        try:
            return int(value) if value is not None else None
        except (ValueError, TypeError):
            return None

    def route(
        self,
        prompt: str,
        max_output_tokens: Optional[int] = None,
    ) -> str:
        if max_output_tokens is None:
            max_output_tokens = GROQ_MAX_OUTPUT_TOKENS

        max_output_tokens = int(max_output_tokens)
        if max_output_tokens < 1:
            raise ValueError("max_output_tokens must be >= 1")

        # This local estimate is only for rate-budget selection.
        # The top-level routing decision is made in otheragent.py.
        if __package__:
            from .otheragent import estimate_tokens
        else:
            from otheragent import estimate_tokens
        estimated_prompt_tokens = estimate_tokens(prompt)
        estimated_required = estimated_prompt_tokens + max_output_tokens

        attempts = len(self.states)
        last_error = None

        for _ in range(attempts):
            state = self._select_key(estimated_required)

            if state is None:
                break

            try:
                response = generate_groq_response(
                    api_key=state.key,
                    prompt=prompt,
                    max_output_tokens=max_output_tokens,
                )

                # Read provider headers if the response object is available.
                # groqresponce.py intentionally returns only str, so actual
                # token reconciliation is not possible here. The reservation
                # therefore remains the local budget estimate.
                return response

            except Exception as exc:
                last_error = exc
                status = self._status_code(exc)

                if status == 429:
                    self._refund_reservation(state, estimated_required)
                    self._cooldown(state, GROQ_429_COOLDOWN)
                    continue

                if status is not None and status >= 500:
                    self._refund_reservation(state, estimated_required)
                    self._cooldown(state, GROQ_5XX_COOLDOWN)
                    continue

                if status in (401, 403):
                    self._refund_reservation(state, estimated_required)
                    self._cooldown(state, GROQ_AUTH_COOLDOWN)
                    continue

                self._refund_reservation(state, estimated_required)
                raise

        if last_error is not None:
            raise last_error

        raise RuntimeError(
            "No Groq key currently has enough available token budget "
            "for this request."
        )


_POOL: Optional[GroqKeyRouter] = None
_POOL_LOCK = threading.Lock()

_LAST = None
_LAST_LOCK = threading.Lock()


def _get_pool() -> GroqKeyRouter:
    global _POOL

    with _POOL_LOCK:
        if _POOL is None:
            _POOL = GroqKeyRouter(_load_api_keys())
        return _POOL


def route_groq(
    prompt: str,
    max_output_tokens: Optional[int] = None,
) -> str:
    if not isinstance(prompt, str):
        raise TypeError("prompt must be a string")

    result = _get_pool().route(prompt, max_output_tokens)

    global _LAST
    with _LAST_LOCK:
        _LAST = {
            "timestamp": time.time(),
            "provider": "GROQ",
            "model": GROQ_MODEL,
        }

    return result


def get_last_provider():
    with _LAST_LOCK:
        return dict(_LAST) if _LAST else None


def reset_pool() -> None:
    global _POOL

    with _POOL_LOCK:
        _POOL = None
