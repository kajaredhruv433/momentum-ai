"""
llm.py

Agora Conversational AI LLM module for interview question generation.
Requirement 14 & 34:
Groq: "What should be asked?" -> produces question_pattern
Agora LLM: "How should that become the natural spoken question?" -> produces actual_question

Transforms the reasoning agent's high-level instruction into natural, conversational,
first-person speech delivered by the selected panel member.
"""
from __future__ import annotations

import logging
import os
import re
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Import Groq gateway from otheragent.py
try:
    from ..otheragent import ask_groq
except ImportError:
    try:
        from backend.otheragent import ask_groq
    except ImportError:
        from otheragent import ask_groq

# Optional Agora Agent / OpenAI imports
try:
    from agora_agent import OpenAI as AgoraOpenAI
except ImportError:
    AgoraOpenAI = None


class AgoraLLM:
    """
    Agora Conversational AI LLM responsible for converting Groq question patterns
    into pure, natural spoken interview questions without negative commentary or meta-critique.
    """

    def __init__(self) -> None:
        self.openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
        self.agora_llm_model = os.getenv("AGORA_LLM_MODEL", "gpt-4o-mini").strip()

    def generate_question(
        self,
        question_pattern: str,
        stage: str = "normal",
        panel_member: Optional[str] = None,
        panel_details: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        Produce the actual spoken question from the Groq pattern using Agora LLM.
        Transforms reasoning directions into pure, direct, conversational questions
        spoken directly to the candidate as 'you', completely eliminating negative
        meta-critiques or evaluation notes.
        """
        pattern = (question_pattern or "").strip().strip('"`')
        if not pattern:
            return "Could you tell me more about your recent technical work?"

        speaker = panel_member or "Interviewer"
        role = (panel_details or {}).get("role", "Technical Interviewer")

        llm_prompt = f"""You are {speaker} ({role}), speaking directly to a candidate in a live technical interview.

Internal interviewer note from reasoning engine:
\"{pattern}\"

Formulate the actual, pure interview question you will speak aloud to the candidate.

CRITICAL INSTRUCTIONS:
1. Address the candidate directly using second person ("you" / "your").
2. The question must be a PURE, direct, professional interview question.
3. NEVER include internal evaluation notes, meta-criticisms, or negative remarks such as:
   - "As you were not able to..."
   - "Since you haven't addressed..."
   - "Because you failed to..."
   - "As the candidate didn't mention..."
   - "Ask the candidate to..."
4. Never tell the candidate what they did or did not fail to answer in previous turns. Turn the technical topic or scenario directly into an engaging, natural interview question.
5. Return ONLY the single spoken question. Do NOT include quotes, intros, or labels.
"""

        # 1. Primary engine: Groq AI gateway via otheragent
        try:
            raw_question = ask_groq(llm_prompt, max_output_tokens=250)
            cleaned = self._clean_llm_question(raw_question)
            if cleaned:
                logger.info("Agora LLM generated pure question via Groq: %s", cleaned)
                return cleaned
        except Exception as exc:
            logger.warning("Groq question formulation attempt exception (%s); checking fallback", exc)

        # 2. Secondary engine: OpenAI / Agora Cloud if configured
        if self.openai_api_key:
            try:
                import httpx
                headers = {
                    "Authorization": f"Bearer {self.openai_api_key}",
                    "Content-Type": "application/json",
                }
                payload = {
                    "model": self.agora_llm_model,
                    "messages": [
                        {"role": "user", "content": llm_prompt},
                    ],
                    "temperature": 0.5,
                    "max_tokens": 200,
                }
                with httpx.Client(timeout=8.0) as client:
                    resp = client.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        text = data["choices"][0]["message"]["content"].strip()
                        cleaned = self._clean_llm_question(text)
                        if cleaned:
                            return cleaned
            except Exception as exc:
                logger.warning("OpenAI fallback question formulation failed (%s)", exc)

        # 3. Emergency heuristic fallback if external network is completely down
        return self._clean_fallback_question(pattern)

    @staticmethod
    def _clean_llm_question(text: str) -> str:
        """Strip surrounding labels, quotes, and ensure single trailing question mark."""
        if not text:
            return ""
        # Strip prefixes like 'Question:', 'Interviewer:', 'Sarah:', 'Marcus:'
        clean = re.sub(r"^(?:Question|Interviewer|[A-Z][a-z]+):\s*", "", text.strip(), flags=re.IGNORECASE)
        clean = clean.strip('"`\' \n')
        # Eliminate any accidental double-punct like .?
        clean = re.sub(r"\.+\?*$", "", clean).rstrip(".?")
        if clean:
            clean += "?"
        return clean

    @staticmethod
    def _clean_fallback_question(pattern: str) -> str:
        """
        Safety fallback to ensure no negative meta-critiques leak even if LLM call failed.
        """
        text = pattern.strip()

        # Strip negative meta-preambles
        text = re.sub(r"^(?:Since|As)\s+the\s+candidate\s+(?:was\s+not\s+able\s+to|hasn'?t\s+addressed|didn'?t\s+mention)[^,]*,\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"^Ask\s+(?:the\s+candidate\s+)?(?:how|to\s+explain|to\s+describe)\s+", "Could you walk me through ", text, flags=re.IGNORECASE)
        text = re.sub(r"^Ask\s+(?:the\s+candidate\s+)?", "Could you explain ", text, flags=re.IGNORECASE)

        # Ensure direct second-person address
        text = re.sub(r"\bthey\b", "you", text, flags=re.IGNORECASE)
        text = re.sub(r"\btheir\b", "your", text, flags=re.IGNORECASE)
        text = re.sub(r"\bthem\b", "you", text, flags=re.IGNORECASE)

        clean = text.rstrip(".?") + "?"
        return clean[0].upper() + clean[1:] if clean else "Could you elaborate on your approach?"
