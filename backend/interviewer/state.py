"""
state.py

Canonical state machine definitions for the Momentum AI Interview Platform.
The interview controller owns the authoritative state machine; the frontend is never the source of truth.
"""
from __future__ import annotations

from enum import Enum
from typing import Set


class InterviewState(str, Enum):
    PREPARING = "PREPARING"
    PANEL_READY = "PANEL_READY"
    STARTING = "STARTING"
    WAITING_FOR_FIRST_QUESTION = "WAITING_FOR_FIRST_QUESTION"
    NORMAL = "NORMAL"
    EXTENDED = "EXTENDED"
    FINAL = "FINAL"
    CONCLUDING = "CONCLUDING"
    WAITING_FOR_CLOSING_SPEECH = "WAITING_FOR_CLOSING_SPEECH"
    REPORTING = "REPORTING"
    COMPLETED = "COMPLETED"
    ERROR = "ERROR"


# String constants for easy direct imports
PREPARING = InterviewState.PREPARING.value
PANEL_READY = InterviewState.PANEL_READY.value
STARTING = InterviewState.STARTING.value
WAITING_FOR_FIRST_QUESTION = InterviewState.WAITING_FOR_FIRST_QUESTION.value
NORMAL = InterviewState.NORMAL.value
EXTENDED = InterviewState.EXTENDED.value
FINAL = InterviewState.FINAL.value
CONCLUDING = InterviewState.CONCLUDING.value
WAITING_FOR_CLOSING_SPEECH = InterviewState.WAITING_FOR_CLOSING_SPEECH.value
REPORTING = InterviewState.REPORTING.value
COMPLETED = InterviewState.COMPLETED.value
ERROR = InterviewState.ERROR.value

ACTIVE_INTERVIEW_STATES: Set[str] = {
    NORMAL,
    EXTENDED,
    FINAL,
    WAITING_FOR_FIRST_QUESTION,
}

ANSWERABLE_STATES: Set[str] = {
    WAITING_FOR_FIRST_QUESTION,
    NORMAL,
    EXTENDED,
    FINAL,
}
