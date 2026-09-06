"""
stt.py

Agora Conversational AI Speech-To-Text (STT) integration.
Requirement 33:
Handles Agora STT/transcription integration with a clean internal interface for:
- speech_started
- transcript_partial
- transcript_final
- speech_finished
"""
from __future__ import annotations

import logging
from typing import Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


class AgoraSTT:
    """
    Manages live candidate transcription and audio speech lifecycle events
    from the Agora RTC audio stream.
    """

    def __init__(self) -> None:
        self.transcripts: Dict[str, List[str]] = {}
        self.active_speakers: Dict[str, bool] = {}
        self._speech_started_cbs: List[Callable[[str], None]] = []
        self._transcript_partial_cbs: List[Callable[[str, str], None]] = []
        self._transcript_final_cbs: List[Callable[[str, str], None]] = []
        self._speech_finished_cbs: List[Callable[[str, str], None]] = []

    def on_speech_started(self, callback: Callable[[str], None]) -> None:
        self._speech_started_cbs.append(callback)

    def on_transcript_partial(self, callback: Callable[[str, str], None]) -> None:
        self._transcript_partial_cbs.append(callback)

    def on_transcript_final(self, callback: Callable[[str, str], None]) -> None:
        self._transcript_final_cbs.append(callback)

    def on_speech_finished(self, callback: Callable[[str, str], None]) -> None:
        self._speech_finished_cbs.append(callback)

    def handle_speech_started(self, interview_id: str) -> None:
        """Invoked when user speech begins on the Agora RTC channel."""
        self.active_speakers[interview_id] = True
        logger.info("Candidate speech started on interview %s", interview_id)
        for cb in self._speech_started_cbs:
            try:
                cb(interview_id)
            except Exception as exc:
                logger.warning("Error in speech_started callback: %s", exc)

    def handle_partial_transcript(self, interview_id: str, text: str) -> None:
        """Invoked on intermediate STT recognition results."""
        clean = (text or "").strip()
        if not clean:
            return
        for cb in self._transcript_partial_cbs:
            try:
                cb(interview_id, clean)
            except Exception as exc:
                logger.warning("Error in transcript_partial callback: %s", exc)

    def handle_final_transcript(self, interview_id: str, text: str) -> str:
        """Invoked when an utterance chunk reaches final recognition."""
        clean = (text or "").strip()
        if not clean:
            return ""
        if interview_id not in self.transcripts:
            self.transcripts[interview_id] = []
        self.transcripts[interview_id].append(clean)

        for cb in self._transcript_final_cbs:
            try:
                cb(interview_id, clean)
            except Exception as exc:
                logger.warning("Error in transcript_final callback: %s", exc)

        return clean

    def handle_speech_finished(self, interview_id: str, final_text: Optional[str] = None) -> str:
        """
        Invoked when candidate speech concludes.
        Aggregates collected transcript chunks and resets active speaker state.
        """
        self.active_speakers[interview_id] = False
        chunks = self.transcripts.pop(interview_id, [])
        if final_text and final_text.strip():
            chunks.append(final_text.strip())

        full_transcript = " ".join(chunks).strip()
        logger.info("Candidate speech finished on interview %s: %s", interview_id, full_transcript)

        for cb in self._speech_finished_cbs:
            try:
                cb(interview_id, full_transcript)
            except Exception as exc:
                logger.warning("Error in speech_finished callback: %s", exc)

        return full_transcript
