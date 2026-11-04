"""
stage_utils.py

Shared defensive utilities for the interview stages.
Ensures machine-readable outputs are strictly parsed and validated,
with defensive retries and fail-safes.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, List, Optional

try:
    from .llm import ask_llm
except ImportError:
    from llm import ask_llm

logger = logging.getLogger(__name__)


def as_json(value: Any) -> str:
    """Format any object as clean, indented JSON string."""
    return json.dumps(value, ensure_ascii=False, default=str, indent=2)


def repair_json(s: Any) -> Any:
    """
    Robustly repairs common JSON syntax errors produced by LLMs:
    1. Markdown code fences (```json ... ```)
    2. Outer text commentary
    3. Missing commas after values (objects, arrays, strings, numbers, booleans, null)
    4. Trailing commas before closing brackets or braces
    5. Single quotes instead of double quotes
    6. Auto-closing of unclosed braces / brackets
    """
    if isinstance(s, (dict, list)):
        return s

    if not isinstance(s, str):
        raise ValueError(f"Expected str, got {type(s)}")

    text = s.strip()

    # Fast direct parse
    try:
        return json.loads(text)
    except Exception:
        pass

    # Strip markdown code fences if present
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if fence_match:
        text = fence_match.group(1).strip()
        try:
            return json.loads(text)
        except Exception:
            pass

    # Find JSON boundaries
    start_brace = text.find("{")
    end_brace = text.rfind("}")
    start_bracket = text.find("[")
    end_bracket = text.rfind("]")

    if start_brace != -1 and end_brace != -1 and (start_bracket == -1 or start_brace < start_bracket):
        candidate = text[start_brace : end_brace + 1]
    elif start_bracket != -1 and end_bracket != -1:
        candidate = text[start_bracket : end_bracket + 1]
    else:
        candidate = text

    # Direct parse of sliced candidate
    try:
        return json.loads(candidate)
    except Exception:
        pass

    # Pass 1: Remove trailing commas before closing brackets/braces
    pass1 = re.sub(r',\s*([\]\}])', r'\1', candidate)
    try:
        return json.loads(pass1)
    except Exception:
        pass

    # Pass 2: Insert missing commas
    # Missing comma after closing bracket/brace followed by next key/item
    pass2 = re.sub(r'([\]\}])\s*\n\s*"', r'\1,\n"', pass1)
    # Missing comma after string/number/bool/null followed by next key
    pass2 = re.sub(r'("(?:[^"\\]|\\.)*"|\d+(?:\.\d+)?|true|false|null)\s*\n\s*"', r'\1,\n"', pass2)
    # Clean any accidental double commas or trailing commas
    pass2 = re.sub(r',\s*,', ',', pass2)
    pass2 = re.sub(r',\s*([\]\}])', r'\1', pass2)
    try:
        return json.loads(pass2)
    except Exception:
        pass

    # Pass 3: Handle single quotes used instead of double quotes
    try:
        single_quoted = pass2.replace("'", '"')
        return json.loads(single_quoted)
    except Exception:
        pass

    # Pass 4: Auto-close truncated braces / brackets if LLM token limit cut it off
    open_braces = pass2.count("{") - pass2.count("}")
    open_brackets = pass2.count("[") - pass2.count("]")
    if open_braces > 0 or open_brackets > 0:
        auto_closed = pass2.rstrip()
        if auto_closed.endswith(","):
            auto_closed = auto_closed[:-1]
        auto_closed += ("]" * max(0, open_brackets)) + ("}" * max(0, open_braces))
        try:
            return json.loads(auto_closed)
        except Exception:
            pass

    raise ValueError(f"Could not parse valid JSON from text: {text[:120]}...")


def clean_text(value: str) -> str:
    """Clean markdown markers, quotes, and whitespace from model responses."""
    if not value:
        return ""
    text = value.strip()
    # Strip markdown code blocks if wrapped
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text.strip().strip('"`').strip()


def prompt_text(prompt: str, *, retries: int = 1) -> str:
    """Execute ask_llm with retry support for empty responses."""
    last_err = None
    for attempt in range(retries + 1):
        try:
            result = ask_llm(prompt)
            cleaned = clean_text(result)
            if cleaned:
                return cleaned
            logger.warning("Empty response from Gemini on attempt %d", attempt + 1)
        except Exception as exc:
            last_err = exc
            logger.warning("Gemini prompt attempt %d failed: %s", attempt + 1, exc)

    if last_err:
        raise last_err
    raise ValueError("The interview generator returned an empty response.")


def validated_decision(prompt: str, allow_draw: bool = False) -> str:
    """
    Ensure the decision is strictly CONTINUE, CONCLUDE (or DRAW if allow_draw=True).
    Normalizes casing and retries if output is invalid.
    """
    valid_words = "CONTINUE, CONCLUDE, or DRAW" if allow_draw else "CONTINUE or CONCLUDE"
    pattern = r"\b(CONTINUE|CONCLUDE|DRAW)\b" if allow_draw else r"\b(CONTINUE|CONCLUDE)\b"

    for attempt in range(2):
        current_prompt = prompt if attempt == 0 else (
            prompt + f"\n\nCRITICAL: Return ONLY the single word {valid_words}. Do not add any explanation."
        )
        raw = prompt_text(current_prompt)
        # Check first token or regex match
        tokens = re.findall(pattern, raw.upper())
        if tokens:
            return tokens[0]
        logger.warning("Invalid decision '%s' on attempt %d; retrying...", raw, attempt + 1)

    raise ValueError(f"Invalid interview decision after retry: '{raw}'")


def validated_followup_kind(prompt: str) -> str:
    """Validate the explicit route chosen after a CONTINUE decision."""
    pattern = r"\b(CLARIFICATION|PROJECT|AREA)\b"
    for attempt in range(2):
        current_prompt = prompt if attempt == 0 else (
            prompt + "\n\nCRITICAL: Return ONLY one word: CLARIFICATION, PROJECT, or AREA."
        )
        raw = prompt_text(current_prompt)
        matches = re.findall(pattern, raw.upper())
        if matches:
            return matches[0]
        logger.warning("Invalid follow-up kind '%s' on attempt %d; retrying...", raw, attempt + 1)
    raise ValueError(f"Invalid follow-up kind after retry: '{raw}'")


def panel_names(panel: dict) -> List[str]:
    """Extract all valid panel member names from the panel dict."""
    names: List[str] = []
    for key, member in panel.items():
        if isinstance(member, dict) and member.get("name"):
            names.append(str(member["name"]).strip())
    return names


def validated_panel_member(prompt: str, panel: dict) -> str:
    """
    Validate that the selected interviewer name strictly exists in the current panel.
    Never allows inventing panel members.
    """
    valid_names = panel_names(panel)
    if not valid_names:
        raise ValueError("Panel has no available members.")

    lookup = {name.casefold(): name for name in valid_names}

    for attempt in range(2):
        current_prompt = prompt if attempt == 0 else (
            f"{prompt}\n\nCRITICAL: You MUST choose exactly one name from this list: {valid_names}. Return ONLY that name."
        )
        raw = prompt_text(current_prompt)
        candidate = clean_text(raw).casefold()

        # Direct match
        if candidate in lookup:
            return lookup[candidate]

        # Partial token match if full string is e.g. "Dhruv (Technical Lead)"
        for name_lower, real_name in lookup.items():
            if re.search(rf"\b{re.escape(name_lower)}\b", candidate):
                return real_name

        logger.warning(
            "Selected panel member '%s' not in %s on attempt %d; retrying...",
            raw, valid_names, attempt + 1
        )

    # Deterministic fallback to first available panel member rather than crashing
    logger.error("Could not validate panel member; falling back to %s", valid_names[0])
    return valid_names[0]


def parse_json_array(prompt: str) -> List[str]:
    """
    Parse a JSON array of strings from Gemini.
    Robustly removes markdown blocks and repairs delimiters / syntax.
    """
    for attempt in range(2):
        current_prompt = prompt if attempt == 0 else (
            f"{prompt}\n\nCRITICAL: Return ONLY a valid JSON array of strings. Example: [\"Area 1\", \"Area 2\"]"
        )
        raw = prompt_text(current_prompt)
        try:
            items = repair_json(raw)
            if isinstance(items, list) and all(isinstance(item, str) and item.strip() for item in items):
                return [str(item).strip() for item in items]
        except Exception as exc:
            logger.warning("Failed to parse JSON array on attempt %d: %s", attempt + 1, exc)

    logger.warning("Returning default evaluation areas due to malformed Gemini JSON response.")
    return ["Core Technical Skills", "System Design & Architecture", "Debugging & Problem Solving", "Behavioral & Collaboration"]


def choose_question_kind(profile: dict, area: str) -> str:
    """
    Determine whether the selected area best aligns with:
    1. A candidate project ('project')
    2. A candidate skill ('skill')
    3. An uncovered role area ('role_area')
    """
    if not area:
        return "skill"

    area_lower = area.casefold()

    # Check projects
    projects = profile.get("projects") or []
    for proj in projects:
        proj_str = as_json(proj).casefold()
        if area_lower in proj_str:
            return "project"

    # Check skills
    skills = (
        profile.get("professional", {}).get("skills", [])
        or profile.get("skills", [])
    )
    for skill in skills:
        if isinstance(skill, str) and (skill.casefold() in area_lower or area_lower in skill.casefold()):
            return "skill"

    return "role_area"
