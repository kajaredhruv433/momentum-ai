"""
geminirouter.py

Responsibilities:
    - Load Gemini API keys from .env
    - Round-robin API key selection
    - Track RPM, RPD and TPM
    - Skip keys that have exhausted their local limits
    - Call geminiresponce.py
    - Return the response string unchanged

IMPORTANT:
    This file does NOT generate Gemini responses.
    It does NOT modify/truncate Gemini responses.
    It does NOT fall back to Groq.
"""

import os
import time
import threading

from dotenv import load_dotenv

try:
    from .geminiresponce import generate_gemini_response
except ImportError:
    from geminiresponce import generate_gemini_response


# ============================================================
# ENV
# ============================================================

load_dotenv()


# ============================================================
# CONFIG
# ============================================================

GEMINI_MODEL = "gemini-3.8-flash"

GEMINI_RPM_LIMIT = int(
    os.getenv("GEMINI_RPM_LIMIT", "5")
)

GEMINI_RPD_LIMIT = int(
    os.getenv("GEMINI_RPD_LIMIT", "20")
)

GEMINI_TPM_LIMIT = int(
    os.getenv("GEMINI_TPM_LIMIT", "1000000")
)

GEMINI_TOKEN_SAFETY_MARGIN = float(
    os.getenv(
        "GEMINI_TOKEN_SAFETY_MARGIN",
        "0.90"
    )
)

GEMINI_MAX_OUTPUT_TOKENS = int(
    os.getenv(
        "GEMINI_MAX_OUTPUT_TOKENS",
        "1000"
    )
)


# ============================================================
# KEY LOADING
# ============================================================

def load_gemini_keys():
    """
    Loads:

        GEMINI_API_KEY_1
        GEMINI_API_KEY_2
        GEMINI_API_KEY_3
        ...

    Also supports:

        GEMINI_API_KEY
    """

    keys = []

    for i in range(1, 101):

        key = os.getenv(
            f"GEMINI_API_KEY_{i}"
        )

        if key:
            key = key.strip()

            if key:
                keys.append(key)

    # Optional unnumbered key
    key = os.getenv("GEMINI_API_KEY")

    if key:
        key = key.strip()

        if key:
            keys.append(key)

    # Remove duplicates
    return list(dict.fromkeys(keys))


GEMINI_KEYS = load_gemini_keys()


# ============================================================
# TOKEN ESTIMATION
# ============================================================

def estimate_tokens(text: str) -> int:
    """
    Estimate input tokens.
    """

    if not text:
        return 0

    try:

        import tiktoken

        encoder = tiktoken.get_encoding(
            "cl100k_base"
        )

        return len(
            encoder.encode(
                text,
                disallowed_special=()
            )
        )

    except Exception:

        # Approximate fallback
        return max(
            1,
            (len(text) + 3) // 4
        )


# ============================================================
# STATE
# ============================================================

class KeyState:

    def __init__(self):

        self.rpm_count = 0
        self.rpd_count = 0
        self.tpm_tokens = 0

        self.rpm_start = time.monotonic()
        self.rpd_start = time.monotonic()
        self.tpm_start = time.monotonic()

        self.cooldown_until = 0.0


_KEY_STATES = {
    key: KeyState()
    for key in GEMINI_KEYS
}


# ============================================================
# ROUND ROBIN
# ============================================================

_round_robin_index = 0

_lock = threading.Lock()


# ============================================================
# WINDOWS
# ============================================================

def reset_windows(state):

    now = time.monotonic()

    # RPM
    if now - state.rpm_start >= 60:

        state.rpm_count = 0
        state.rpm_start = now

    # RPD
    if now - state.rpd_start >= 86400:

        state.rpd_count = 0
        state.rpd_start = now

    # TPM
    if now - state.tpm_start >= 60:

        state.tpm_tokens = 0
        state.tpm_start = now


# ============================================================
# TPM LIMIT
# ============================================================

def effective_tpm_limit():

    return int(
        GEMINI_TPM_LIMIT
        * GEMINI_TOKEN_SAFETY_MARGIN
    )


# ============================================================
# KEY AVAILABLE?
# ============================================================

def key_available(
    key,
    estimated_input_tokens
):

    state = _KEY_STATES[key]

    reset_windows(state)

    now = time.monotonic()

    # Cooldown
    if now < state.cooldown_until:
        return False

    # RPM
    if state.rpm_count >= GEMINI_RPM_LIMIT:
        return False

    # RPD
    if state.rpd_count >= GEMINI_RPD_LIMIT:
        return False

    # TPM
    if (
        state.tpm_tokens
        + estimated_input_tokens
        > effective_tpm_limit()
    ):
        return False

    return True


# ============================================================
# SELECT KEY
# ============================================================

def select_key(
    estimated_input_tokens
):

    global _round_robin_index

    if not GEMINI_KEYS:

        raise RuntimeError(
            "No Gemini API keys found.\n"
            "Add GEMINI_API_KEY_1, "
            "GEMINI_API_KEY_2, etc. to .env"
        )

    with _lock:

        total = len(
            GEMINI_KEYS
        )

        for offset in range(total):

            index = (
                _round_robin_index
                + offset
            ) % total

            key = GEMINI_KEYS[index]

            if not key_available(
                key,
                estimated_input_tokens
            ):
                continue

            # Move round-robin pointer
            _round_robin_index = (
                index + 1
            ) % total

            return key

    raise RuntimeError(
        "No Gemini API key currently has "
        "available RPM/RPD/TPM capacity."
    )


# ============================================================
# RESERVE USAGE
# ============================================================

def reserve_usage(
    key,
    estimated_input_tokens
):

    with _lock:

        state = _KEY_STATES[key]

        reset_windows(state)

        state.rpm_count += 1

        state.rpd_count += 1

        state.tpm_tokens += (
            estimated_input_tokens
        )


# ============================================================
# ERROR STATUS
# ============================================================

def get_status_code(error):

    value = getattr(
        error,
        "status_code",
        None
    )

    if isinstance(value, int):
        return value

    value = getattr(
        error,
        "code",
        None
    )

    if isinstance(value, int):
        return value

    response = getattr(
        error,
        "response",
        None
    )

    if response:

        value = getattr(
            response,
            "status_code",
            None
        )

        if isinstance(value, int):
            return value

    message = str(error)

    for code in [
        401,
        403,
        429,
        500,
        502,
        503,
        504,
    ]:

        if str(code) in message:
            return code

    return None


# ============================================================
# COOLDOWN
# ============================================================

def cooldown_key(
    key,
    status_code
):

    state = _KEY_STATES[key]

    if status_code == 429:

        seconds = 60

    elif status_code == 503:

        seconds = 30

    elif status_code in (
        500,
        502,
        504
    ):

        seconds = 30

    elif status_code in (
        401,
        403
    ):

        seconds = 300

    else:

        return

    state.cooldown_until = (
        time.monotonic()
        + seconds
    )


# ============================================================
# MAIN ROUTER
# ============================================================

def route_gemini(
    prompt: str,
    max_output_tokens: int = GEMINI_MAX_OUTPUT_TOKENS
) -> str:
    """
    Send prompt to Gemini using the next available key.

    Returns the COMPLETE response string from
    geminiresponce.py unchanged.
    """

    if not isinstance(
        prompt,
        str
    ):

        raise TypeError(
            "prompt must be a string"
        )

    if not prompt.strip():

        raise ValueError(
            "prompt cannot be empty"
        )

    # --------------------------------------------------------
    # Estimate INPUT tokens only
    # --------------------------------------------------------

    input_tokens = estimate_tokens(
        prompt
    )

    # --------------------------------------------------------
    # Select key
    # --------------------------------------------------------

    api_key = select_key(
        input_tokens
    )

    # --------------------------------------------------------
    # Reserve usage
    # --------------------------------------------------------

    reserve_usage(
        api_key,
        input_tokens
    )

    # --------------------------------------------------------
    # CALL GEMINI RESPONSE MODULE
    # --------------------------------------------------------

    try:

        response = generate_gemini_response(
            api_key=api_key,
            prompt=prompt,
            max_output_tokens=max_output_tokens
        )

        # ----------------------------------------------------
        # DO NOT MODIFY RESPONSE
        # ----------------------------------------------------

        if response is None:

            raise RuntimeError(
                "geminiresponce.py returned None."
            )

        if not isinstance(
            response,
            str
        ):

            raise RuntimeError(
                "geminiresponce.py returned "
                f"{type(response).__name__}, "
                "expected str."
            )

        if not response:

            raise RuntimeError(
                "geminiresponce.py returned "
                "an empty string."
            )

        return response

    except Exception as error:

        status_code = get_status_code(
            error
        )

        cooldown_key(
            api_key,
            status_code
        )

        raise


# ============================================================
# STATUS
# ============================================================

def get_gemini_key_status():

    result = []

    now = time.monotonic()

    for index, key in enumerate(
        GEMINI_KEYS,
        start=1
    ):

        state = _KEY_STATES[key]

        reset_windows(state)

        cooldown = max(
            0,
            state.cooldown_until - now
        )

        result.append(
            {
                "key_number": index,
                "rpm_used": state.rpm_count,
                "rpm_limit": GEMINI_RPM_LIMIT,
                "tpm_used": state.tpm_tokens,
                "tpm_limit": effective_tpm_limit(),
                "rpd_used": state.rpd_count,
                "rpd_limit": GEMINI_RPD_LIMIT,
                "cooldown_seconds": round(
                    cooldown,
                    2
                )
            }
        )

    return result


# ============================================================
# END
# ============================================================