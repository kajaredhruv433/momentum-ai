"""
interview_controller.py

Coordinates the complete multi-panel AI interview lifecycle:
- State machine: PREPARING -> PANEL_READY -> STARTING -> WAITING_FOR_FIRST_QUESTION
  -> NORMAL -> EXTENDED -> FINAL -> CONCLUDING -> WAITING_FOR_CLOSING_SPEECH
  -> REPORTING -> COMPLETED
- Server-authoritative timer (starts when the client begins playing the opening question)
- Gemini reasoning chain (via llm.py - IMMUTABLE)
- Existing panel.py, resume.py, voice.py, and MongoDB persistence
- Uniform candidate answer pipeline (voice & typing)
- Gated report generation strictly after closing speech completion
"""
from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

try:
    from . import resume
    from .conclude import create_conclusion
    from .extended_stage import next_extended_action
    from .final_stage import final_action
    from .normal_stage import next_normal_action
    from .llm import ask_llm
    from .panel import create_interview_panel
    from .prompts import INTERVIEW_PREP_PROMPT
    from .report import generate_report
    from .stage_utils import as_json, parse_json_array
    from .start_stage import create_start_action
    from .state import (
        COMPLETED,
        CONCLUDING,
        ERROR,
        EXTENDED,
        FINAL,
        NORMAL,
        PANEL_READY,
        PREPARING,
        REPORTING,
        STARTING,
        WAITING_FOR_CLOSING_SPEECH,
        WAITING_FOR_FIRST_QUESTION,
    )
    from .timer import InterviewTimer
    from .tools.database import mongo
    from .voice import assign_voices_to_panel
except ImportError:
    import resume
    from conclude import create_conclusion
    from extended_stage import next_extended_action
    from final_stage import final_action
    from normal_stage import next_normal_action
    from llm import ask_llm
    from panel import create_interview_panel
    from prompts import INTERVIEW_PREP_PROMPT
    from report import generate_report
    from stage_utils import as_json, parse_json_array
    from start_stage import create_start_action
    from state import (
        COMPLETED,
        CONCLUDING,
        ERROR,
        EXTENDED,
        FINAL,
        NORMAL,
        PANEL_READY,
        PREPARING,
        REPORTING,
        STARTING,
        WAITING_FOR_CLOSING_SPEECH,
        WAITING_FOR_FIRST_QUESTION,
    )
    from timer import InterviewTimer
    from tools.database import mongo
    from voice import assign_voices_to_panel

logger = logging.getLogger(__name__)


class InterviewController:
    """
    Authoritative state machine and lifecycle coordinator for interviews.
    """

    def __init__(
        self,
        base_time_seconds: int = 1800,
        extended_time_seconds: int = 2700,
    ) -> None:
        self.base_time_seconds = base_time_seconds
        self.extended_time_seconds = extended_time_seconds
        self.event_subscribers: List[Callable[[str, str, Dict[str, Any]], None]] = []

    def subscribe(self, callback: Callable[[str, str, Dict[str, Any]], None]) -> None:
        """Subscribe WebSocket broadcast handlers to interview events."""
        if callback not in self.event_subscribers:
            self.event_subscribers.append(callback)

    def _broadcast(self, interview_id: str, event_name: str, payload: Optional[Dict[str, Any]] = None) -> None:
        data = payload or {}
        for sub in self.event_subscribers:
            try:
                sub(interview_id, event_name, data)
            except Exception as exc:
                logger.warning("Error in event subscriber: %s", exc)

    @staticmethod
    def _now() -> datetime:
        return datetime.now(timezone.utc)

    def _save_state(self, state: Dict[str, Any]) -> None:
        state["updated_at"] = self._now()
        mongo.interviews.replace_one({"_id": state["_id"]}, state, upsert=True)

    def _get_state(self, interview_id: str) -> Dict[str, Any]:
        state = mongo.interviews.find_one({"_id": interview_id})
        if not state:
            raise KeyError(f"Interview {interview_id} not found.")
        return state

    def _get_timer(self, state: Dict[str, Any]) -> InterviewTimer:
        return InterviewTimer(
            base_time=state.get("base_time", self.base_time_seconds),
            extended_time=state.get("extended_time", self.extended_time_seconds),
            interview_start_time=state.get("interview_start_timestamp"),
            paused_at=state.get("interview_timer_paused_at"),
            paused_seconds=state.get("interview_timer_paused_seconds", 0),
        )

    def _public(self, state: Dict[str, Any]) -> Dict[str, Any]:
        timer = self._get_timer(state)
        current_q = state.get("current_question") or {}
        closing_msg = state.get("closing") or {}

        panel_member = current_q.get("panel_member") or closing_msg.get("panel_member")
        question_text = current_q.get("question") or closing_msg.get("message")

        # Find panel member voice details
        panel = state.get("panel", {})
        member_details = None
        for _, member in panel.items():
            if isinstance(member, dict) and member.get("name") == panel_member:
                member_details = member
                break

        report = state.get("report") or None
        candidate_report = None
        if isinstance(report, dict):
            # Candidates may see assessment insights and scores, but never the
            # hiring recommendation or recruiter-only rationale.
            candidate_report = {
                key: value for key, value in report.items()
                if key not in {"final_recommendation", "hire_reasons", "reject_reasons"}
            }

        return {
            "interview_id": state["_id"],
            "status": state.get("status", "in_progress"),
            "stage": state.get("stage", PREPARING),
            "current_stage": state.get("stage", PREPARING),
            "interview_phase": state.get("interview_phase", "preparing"),
            "panel": state.get("panel", {}),
            "areas_to_cover": state.get("areas_to_cover", []),
            "covered_areas": state.get("covered_areas", []),
            "selected_panel_member": panel_member,
            "panel_member_details": member_details,
            "current_question": question_text,
            "question_pattern": current_q.get("question_pattern"),
            "greeting_question": state.get("greeting_question"),
            "timer_started": timer.is_started,
            "elapsed_time": timer.elapsed_time,
            "base_time": timer.base_time,
            "extended_time": timer.extended_time,
            # Evaluation reports are recruiter-only data. Candidate-facing state
            # exposes completion without ever returning the report payload.
            "report_ready": bool(candidate_report),
            "report": candidate_report,
            "candidate_profile": state.get("candidate_profile"),
            "company_details": state.get("company_details"),
            "selected_repository": state.get("selected_repository"),
            "repository_evaluation": {
                key: (state.get("repository_evaluation") or {}).get(key)
                for key in ("id", "repo", "status", "progress")
            } if state.get("repository_evaluation") else None,
            "repository_assessment_completed": bool(state.get("repository_assessment_completed")),
            "closing": state.get("closing"),
            "history": state.get("history", []),
            "requires_canvas": bool(current_q.get("requires_canvas")) if isinstance(current_q, dict) else False,
            "current_question_kind": current_q.get("question_kind") if isinstance(current_q, dict) else None,
            "canvas_submissions": [
                {
                    "question_id": s.get("question_id"),
                    "question": s.get("question"),
                    "analysis": s.get("analysis"),
                    "submitted_at": s.get("submitted_at"),
                }
                for s in state.get("canvas_submissions", [])
            ],
        }

    # ========================================================================
    # INTERVIEW INITIALIZATION
    # ========================================================================

    def start(
        self,
        company_details: Dict[str, Any],
        resume_text: str,
        base_time: Optional[int] = None,
        extended_time: Optional[int] = None,
        candidate_id: Optional[str] = None,
        candidate_email: Optional[str] = None,
        candidate_name: Optional[str] = None,
        job_id: Optional[str] = None,
        application_id: Optional[str] = None,
        selected_repository: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Execute full preparation and start pipeline:
        1. Extract resume profile via existing resume.py.
        2. Persist interview and candidate context in MongoDB.
        3. Identify evaluation areas via INTERVIEW_PREP_PROMPT -> Gemini.
        4. Generate interview panel via existing panel.py.
        5. Assign unique voices via existing voice.py.
        6. Generate opening question + select panel speaker via start_stage.py.
        7. Set up ElevenLabs channel & tokens.
        8. Deliver opening question to ElevenLabs TTS.
        Note: Timer starts ONLY when ElevenLabs begins speaking the opening question!
        """
        interview_id = str(uuid.uuid4())
        cid = candidate_id or str(uuid.uuid4())
        jid = job_id or str(uuid.uuid4())
        panel_id = str(uuid.uuid4())

        base_sec = base_time or self.base_time_seconds
        ext_sec = extended_time or self.extended_time_seconds

        # 1. Candidate Resume Parsing
        profile = resume.parse_resume_text(resume_text)
        if candidate_name and isinstance(profile, dict) and not profile.get("name"):
            profile["name"] = candidate_name

        # Initial interview state
        state = {
            "_id": interview_id,
            "interview_id": interview_id,
            "candidate_id": cid,
            "candidate_email": candidate_email,
            "candidate_name": candidate_name or (profile.get("name") if isinstance(profile, dict) else None),
            "job_id": jid,
            "application_id": application_id,
            "selected_repository": selected_repository,
            "repository_intake_pending": bool(selected_repository),
            "repository_intake_attempts": 0,
            "repository_evaluation": None,
            "panel_id": panel_id,
            "company_details": company_details,
            "candidate_profile": profile,
            "resume_text": resume_text,
            "status": "preparing",
            "stage": PREPARING,
            "interview_phase": "preparing",
            "history": [],
            "areas_to_cover": [],
            "covered_areas": [],
            "base_time": base_sec,
            "extended_time": ext_sec,
            "interview_start_timestamp": None,
            "final_question_asked": False,
            "created_at": self._now(),
        }
        self._save_state(state)
        self._broadcast(interview_id, "interview_created", {"interview_id": interview_id})

        # Save to MongoDB
        try:
            mongo.candidates.replace_one(
                {"_id": candidate_id},
                {"_id": candidate_id, "profile": profile, "created_at": self._now()},
                upsert=True,
            )
            mongo.jobs.replace_one(
                {"_id": job_id},
                {"_id": job_id, "details": company_details, "created_at": self._now()},
                upsert=True,
            )
        except Exception as exc:
            logger.warning("MongoDB initial persistence warning: %s", exc)

        # 2. Areas to cover (Gemini via llm.py)
        prep_prompt = INTERVIEW_PREP_PROMPT.format(
            role=company_details.get("role", "Developer"),
            company_requirements=as_json(company_details),
            candidate_profile=as_json(profile),
        )
        areas = parse_json_array(prep_prompt)
        state["areas_to_cover"] = areas
        self._broadcast(interview_id, "direction_selected", {"areas_to_cover": areas})

        # 3. Generate Interview Panel
        raw_panel = create_interview_panel(company_details)

        # 4. Assign Distinct Voices
        panel_with_voices = assign_voices_to_panel(raw_panel)
        state["panel"] = panel_with_voices
        state["stage"] = PANEL_READY
        self._save_state(state)
        self._broadcast(interview_id, "panel_selected", {"panel": panel_with_voices})

        # Save panel to MongoDB
        try:
            mongo.panels.replace_one(
                {"_id": panel_id},
                {"_id": panel_id, "members": panel_with_voices, "created_at": self._now()},
                upsert=True,
            )
        except Exception as exc:
            logger.warning("MongoDB panel save warning: %s", exc)

        # 6. Start Stage: Opening question + panel speaker
        if selected_repository:
            selected_member = next(
                (member for member in panel_with_voices.values()
                 if isinstance(member, dict) and any(term in str(member.get("role", "")).lower() for term in ("technical", "engineer", "software"))),
                next((member for member in panel_with_voices.values() if isinstance(member, dict)), {}),
            )
            start_action = {
                "panel_member": selected_member.get("name", "Interviewer"),
                "panel_member_details": selected_member,
                "question": "",
            }
            start_action["question"] = (
                f"To begin, please walk us through your role in {selected_repository.get('full_name', 'this project')}. "
                "What did you personally implement, how did you implement it, what technologies did you use, "
                "and which AI tools, if any, were part of your work? Please be specific about the components or files you owned."
            )
            start_action["question_pattern"] = "Candidate's project role, implementation, stack, AI tool use, and claimed ownership."
            start_action["selected_area"] = "repository_intake"
            start_action["question_kind"] = "repository_intake"
        else:
            start_action = create_start_action(company_details, profile, panel_with_voices, areas)
        state["greeting_question"] = start_action.get("question")
        state["current_question"] = start_action
        state["stage"] = WAITING_FOR_FIRST_QUESTION
        state["interview_phase"] = "starting"

        self._save_state(state)
        member_gender = (start_action.get("panel_member_details") or {}).get("gender") or "Female"
        self._broadcast(interview_id, "speaker_changed", {
            "panel_member": start_action["panel_member"],
            "question": start_action["question"],
            "gender": member_gender,
            "panel_member_details": start_action.get("panel_member_details"),
        })
        self._broadcast(interview_id, "stage_changed", {"stage": state["stage"]})

        logger.info("Interview %s started. Waiting for opening speech to begin timer.", interview_id)
        return self._public(state)

    # ========================================================================
    # TIMER START (TRIGGERED STRICTLY BY ElevenLabs SPEECH-START EVENT)
    # ========================================================================

    def on_question_started(self, interview_id: str, is_first: bool = False) -> Dict[str, Any]:
        """
        Invoked when ElevenLabs begins speaking an interview question.
        Requirement 8: For the opening question, this starts the server-authoritative timer.
        """
        state = self._get_state(interview_id)
        timer = self._get_timer(state)

        if not timer.is_started:
            start_ts = timer.start()
            state["interview_start_timestamp"] = start_ts
            state["status"] = "in_progress"
            state["stage"] = NORMAL
            state["interview_phase"] = "normal"
            self._save_state(state)

            self._broadcast(interview_id, "timer_started", {"start_time": start_ts})
            self._broadcast(interview_id, "stage_changed", {"stage": NORMAL})
            mongo.save_interview_event(interview_id, "timer_started", {"timestamp": start_ts})
            logger.info("🔥 Authoritative timer started for interview %s at %s", interview_id, start_ts)
        else:
            self._broadcast(interview_id, "question_started", {
                "panel_member": (state.get("current_question") or {}).get("panel_member")
            })

        return self._public(state)

    # ========================================================================
    # CANDIDATE ANSWER PROCESSING (VOICE OR TYPING)
    # ========================================================================

    def answer(
        self,
        interview_id: str,
        answer_text: str,
        input_method: str = "text",
        question_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Process candidate response (from either ElevenLabs STT or typing textarea).
        Evaluates stage transitions authoritatively based on server elapsed time.
        """
        state = self._get_state(interview_id)
        clean_ans = (answer_text or "").strip()
        if not clean_ans:
            raise ValueError("Candidate answer cannot be empty.")

        # If not started yet, ensure timer starts now
        if not state.get("interview_start_timestamp"):
            self.on_question_started(interview_id, is_first=True)
            state = self._get_state(interview_id)

        current_q = state.get("current_question") or {}
        q_id = question_id or str(uuid.uuid4())
        ans_id = str(uuid.uuid4())
        timer = self._get_timer(state)
        elapsed = timer.elapsed_time

        # Save question and answer to state history
        history_entry = {
            "question_id": q_id,
            "question": current_q.get("question", ""),
            "candidate_answer": clean_ans,
            "input_method": input_method,
            "panel_member": current_q.get("panel_member"),
            "selected_area": current_q.get("selected_area"),
            "stage": current_q.get("stage", state.get("stage")),
            "elapsed_time": elapsed,
            "timestamp": self._now(),
        }
        state["history"].append(history_entry)

        area = history_entry.get("selected_area")
        if area and area not in state["covered_areas"]:
            state["covered_areas"].append(area)

        # MongoDB persistence using existing helpers
        try:
            mongo.save_question(
                question_id=q_id,
                interview_id=interview_id,
                panel_id=state["panel_id"],
                question=history_entry["question"],
                stage=history_entry["stage"],
                evaluation_focus=[history_entry.get("selected_area") or "General"],
                sequence=len(state["history"]),
            )
            mongo.save_answer(
                answer_id=ans_id,
                interview_id=interview_id,
                question_id=q_id,
                candidate_id=state["candidate_id"],
                panel_id=state["panel_id"],
                transcript=clean_ans,
                duration_seconds=None,
            )
        except Exception as exc:
            logger.warning("MongoDB QA save warning: %s", exc)

        self._broadcast(interview_id, "candidate_answer", {
            "answer": clean_ans,
            "input_method": input_method,
            "turn": len(state["history"]),
        })
        self._broadcast(interview_id, "decision_processing", {})

        repository_intake_complete = False
        if state.get("repository_intake_pending"):
            from .github_evaluator.intake import extract_project_claims
            attempts = int(state.get("repository_intake_attempts", 0)) + 1
            state["repository_intake_attempts"] = attempts
            selected_repo = state.get("selected_repository") or {}
            try:
                project_claims = extract_project_claims(clean_ans, selected_repo.get("full_name", "the selected repository"))
            except Exception as exc:
                logger.warning("Meta repository intake unavailable for interview %s: %s", interview_id, exc)
                project_claims = {
                    "candidate_role": "", "implementation_summary": clean_ans[:1500],
                    "implementation_details": clean_ans[:3500], "tech_stack": [],
                    "ai_tools_used": "", "claimed_files_or_components": [],
                    "clear_enough_to_analyze": False,
                    "clarification_question": "Could you clarify your personal contribution, the specific parts you implemented, and the technologies you used?",
                }
            state["repository_candidate_claims"] = project_claims
            if not project_claims.get("clear_enough_to_analyze") and attempts < 2:
                member = (current_q.get("panel_member") or next(iter(state.get("panel", {}).values()), {}).get("name"))
                details = next((m for m in state.get("panel", {}).values() if isinstance(m, dict) and m.get("name") == member), {})
                action = {
                    "action": "ASK_QUESTION", "panel_member": member,
                    "panel_member_details": details,
                    "question": project_claims.get("clarification_question") or "Could you give a more specific example of what you personally implemented and how it worked?",
                    "question_pattern": "Clarify contribution, implementation, technology stack, or AI tool use.",
                    "selected_area": "repository_intake", "stage": "NORMAL", "question_kind": "repository_intake",
                }
                state["current_question"] = action
                state["interview_phase"] = "normal"
                self._save_state(state)
                self._broadcast(interview_id, "speaker_changed", {
                    "panel_member": member, "question": action["question"],
                    "question_pattern": action["question_pattern"], "selected_area": action["selected_area"],
                    "question_kind": action["question_kind"], "gender": details.get("gender", "Female"),
                    "panel_member_details": details,
                })
                return {**self._public(state), **action}
            state["repository_intake_pending"] = False
            repository_intake_complete = True

        # ====================================================================
        # AUTHORITATIVE STAGE ROUTING
        # ====================================================================
        base_time = timer.base_time
        extended_time = timer.extended_time

        if state.get("final_question_asked"):
            # Exactly one final question was asked -> FORCE CONCLUDE
            action = {"action": "CONCLUDE"}
            logger.info("Final question answered for %s -> FORCING CONCLUDE", interview_id)

        elif elapsed < base_time:
            # NORMAL STAGE
            state["stage"] = NORMAL
            action = next_normal_action(
                history=state["history"],
                answer=clean_ans,
                profile=state["candidate_profile"],
                panel=state["panel"],
                areas_to_cover=state["areas_to_cover"],
                covered_areas=state["covered_areas"],
                interview_id=interview_id,
                repo_assessment_ready=self._repository_assessment_ready(state),
            )

        elif elapsed < extended_time:
            # EXTENDED STAGE
            state["stage"] = EXTENDED
            action = next_extended_action(
                history=state["history"],
                answer=clean_ans,
                profile=state["candidate_profile"],
                panel=state["panel"],
                areas_to_cover=state["areas_to_cover"],
                base_time=base_time,
                elapsed_time=elapsed,
                interview_id=interview_id,
            )

        else:
            # FINAL STAGE
            state["stage"] = FINAL
            action = final_action(
                history=state["history"],
                answer=clean_ans,
                profile=state["candidate_profile"],
                panel=state["panel"],
                areas_to_cover=state["areas_to_cover"],
                covered_areas=state["covered_areas"],
                base_time=base_time,
                elapsed_time=elapsed,
                interview_id=interview_id,
            )
            if action.get("action") == "ASK_QUESTION":
                state["final_question_asked"] = True

        # ====================================================================
        # ACTION DISPATCH: CONCLUDE vs NEXT QUESTION
        # ====================================================================
        if action.get("action") == "START_REPO_ASSESSMENT":
            state["interview_timer_paused_at"] = self._now().timestamp()
            state["repository_evaluation"] = {**(state.get("repository_evaluation") or {}), "status": "ready"}
            state["repository_assessment_started"] = True
            state["current_question"] = action
            state["interview_phase"] = "normal"
            self._save_state(state)
            member_details = action.get("panel_member_details") or {}
            self._broadcast(interview_id, "speaker_changed", {
                "panel_member": action.get("panel_member"), "question": action.get("question"),
                "question_pattern": action.get("question_pattern"), "selected_area": "repo_assessment",
                "question_kind": "repo_assessment", "gender": member_details.get("gender", "Female"),
                "panel_member_details": member_details,
            })
        elif action.get("action") == "CONCLUDE":
            state["stage"] = CONCLUDING
            state["interview_phase"] = "concluding"
            self._save_state(state)
            self._broadcast(interview_id, "interview_concluding", {})
            self._broadcast(interview_id, "stage_changed", {"stage": CONCLUDING})

            # Generate closing message; the client requests ElevenLabs TTS.
            closing = create_conclusion(state["history"], state["panel"], interview_id=interview_id)
            state["closing"] = closing
            state["current_question"] = None
            state["stage"] = WAITING_FOR_CLOSING_SPEECH
            self._save_state(state)

            closing_gender = (closing.get("panel_member_details") or {}).get("gender") or "Female"
            self._broadcast(interview_id, "closing_started", {
                "panel_member": closing["panel_member"],
                "message": closing["message"],
                "gender": closing_gender,
                "panel_member_details": closing.get("panel_member_details"),
            })

        else:
            state["current_question"] = action
            state["interview_phase"] = action.get("stage", "NORMAL").lower()
            self._save_state(state)

            member_gender = (action.get("panel_member_details") or {}).get("gender") or "Female"
            self._broadcast(interview_id, "speaker_changed", {
                "panel_member": action["panel_member"],
                "question": action["question"],
                "question_pattern": action.get("question_pattern"),
                "selected_area": action.get("selected_area"),
                "gender": member_gender,
                "panel_member_details": action.get("panel_member_details"),
                "requires_canvas": bool(action.get("requires_canvas")),
                "question_kind": action.get("question_kind"),
            })
            self._broadcast(interview_id, "stage_changed", {"stage": state["stage"]})

        self._save_state(state)
        result = {**self._public(state), **action}
        if repository_intake_complete:
            result["repository_intake_complete"] = True
        return result

    @staticmethod
    def _repository_assessment_ready(state: Dict[str, Any]) -> bool:
        assessment_id = (state.get("repository_evaluation") or {}).get("id")
        if not assessment_id:
            return False
        try:
            from .github_evaluator.store import connect
            db = connect()
            row = db.execute("SELECT status FROM assessments WHERE id=?", (assessment_id,)).fetchone()
            db.close()
            return bool(row and row["status"] == "ready")
        except Exception:
            return False

    # ========================================================================
    # CLOSING FINISHED GATE -> REPORT GENERATION
    # ========================================================================

    def conclude_interview(self, interview_id: str) -> Dict[str, Any]:
        """
        Manually trigger interview conclusion.
        Generates closing message, transitions to WAITING_FOR_CLOSING_SPEECH, and broadcasts closing_started.
        """
        state = self._get_state(interview_id)
        if state.get("stage") == COMPLETED and state.get("report"):
            return self._public(state)

        state["stage"] = CONCLUDING
        state["interview_phase"] = "concluding"
        self._save_state(state)
        self._broadcast(interview_id, "interview_concluding", {})
        self._broadcast(interview_id, "stage_changed", {"stage": CONCLUDING})

        # Generate closing message; the client requests ElevenLabs TTS.
        closing = create_conclusion(state.get("history", []), state.get("panel", {}), interview_id=interview_id)
        state["closing"] = closing
        state["current_question"] = None
        state["stage"] = WAITING_FOR_CLOSING_SPEECH
        self._save_state(state)

        closing_gender = (closing.get("panel_member_details") or {}).get("gender") or "Female"
        self._broadcast(interview_id, "closing_started", {
            "panel_member": closing["panel_member"],
            "message": closing["message"],
            "gender": closing_gender,
            "panel_member_details": closing.get("panel_member_details"),
        })
        self._save_state(state)
        return {**self._public(state), "closing": closing}

    def on_closing_speech_finished(self, interview_id: str) -> Dict[str, Any]:
        """
        Triggered strictly when ElevenLabs closing audio has finished.
        Requirement 28 & 50: Report MUST NOT be generated before closing speech finishes.
        """
        state = self._get_state(interview_id)
        if state.get("report"):
            return self._public(state)

        state["stage"] = REPORTING
        state["interview_phase"] = "reporting"
        self._save_state(state)

        self._broadcast(interview_id, "closing_finished", {})
        self._broadcast(interview_id, "report_generating", {})
        self._broadcast(interview_id, "stage_changed", {"stage": REPORTING})

        # Generate evidence-based report via report.py
        report_data = generate_report(
            company_details=state.get("company_details", {}),
            candidate_profile=state.get("candidate_profile", {}),
            history=state.get("history", []),
            interview_id=interview_id,
            canvas_submissions=state.get("canvas_submissions"),
        )

        state["report"] = report_data
        state["stage"] = COMPLETED
        state["status"] = "completed"
        state["interview_phase"] = "completed"
        self._save_state(state)

        self._broadcast(interview_id, "report_ready", {"status": "completed"})
        self._broadcast(interview_id, "stage_changed", {"stage": COMPLETED})
        try:
            mongo.save_interview_event(interview_id, "interview_completed", {"report": report_data})
        except Exception as exc:
            logger.warning("MongoDB save interview event warning: %s", exc)

        # Persist to Momentum applications and interview_sessions collections
        try:
            from bson import ObjectId
            match_score = report_data.get("overall_match_percentage") if isinstance(report_data, dict) else 0
            tech_score = report_data.get("technical_score", 0) if isinstance(report_data, dict) else 0
            comm_score = report_data.get("communication_score", 0) if isinstance(report_data, dict) else 0
            prob_score = report_data.get("problem_solving_score", 0) if isinstance(report_data, dict) else 0
            recommendation = report_data.get("final_recommendation", "Consider") if isinstance(report_data, dict) else "Consider"

            app_id = state.get("application_id")
            c_id = state.get("candidate_id")
            c_email = state.get("candidate_email")
            j_id = state.get("job_id")

            app_update = {
                "status": "Completed",
                "score": match_score,
                "matchScore": match_score,
                "technicalScore": tech_score,
                "communicationScore": comm_score,
                "problemSolvingScore": prob_score,
                "recommendation": recommendation,
                "report": report_data,
                "interviewId": interview_id,
                "interviewCompletedAt": datetime.now(timezone.utc),
            }
            if c_id:
                app_update["candidateId"] = c_id

            updated_app = False
            if app_id:
                try:
                    obj_id = ObjectId(app_id) if len(str(app_id)) == 24 else app_id
                    res = mongo._db["applications"].update_one({"_id": obj_id}, {"$set": app_update})
                    if res.matched_count > 0:
                        updated_app = True
                except Exception as ex_app:
                    logger.warning("Error updating application by _id: %s", ex_app)

            if not updated_app and j_id:
                query_parts = []
                try:
                    j_obj = ObjectId(j_id) if len(str(j_id)) == 24 else j_id
                    query_parts.append({"jobId": j_obj})
                except Exception:
                    query_parts.append({"jobId": j_id})

                user_parts = []
                if c_id:
                    user_parts.append({"applicantUid": c_id})
                if c_email:
                    user_parts.append({"applicantEmail": {"$regex": f"^{c_email}$", "$options": "i"}})

                if query_parts and user_parts:
                    query = {"$and": [query_parts[0], {"$or": user_parts}]}
                    mongo._db["applications"].update_one(query, {"$set": app_update})

            # Save full session report
            mongo._db["interview_sessions"].update_one(
                {"interviewId": interview_id},
                {
                    "$set": {
                        "interviewId": interview_id,
                        "candidateId": c_id,
                        "candidateEmail": c_email,
                        "candidateName": state.get("candidate_name") or (state.get("candidate_profile", {}) or {}).get("name"),
                        "jobId": j_id,
                        "applicationId": app_id,
                        "report": report_data,
                        "matchScore": match_score,
                        "technicalScore": tech_score,
                        "communicationScore": comm_score,
                        "problemSolvingScore": prob_score,
                        "recommendation": recommendation,
                        "status": "completed",
                        "completedAt": datetime.now(timezone.utc),
                    }
                },
                upsert=True
            )
            logger.info("Successfully persisted interview report to MongoDB for candidate: %s, matchScore: %s", c_id or c_email, match_score)
        except Exception as exc_db:
            logger.warning("Failed to persist interview report to MongoDB: %s", exc_db)

        logger.info("🎉 Interview %s finished and report ready.", interview_id)
        return self._public(state)

    # ========================================================================
    # ========================================================================
    # PUBLIC ACCESSORS
    # ========================================================================

    def status(self, interview_id: str) -> Dict[str, Any]:
        """Fetch live public state and authoritative timer values."""
        state = self._get_state(interview_id)
        return self._public(state)

    def report(self, interview_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve final evaluation report once ready."""
        state = self._get_state(interview_id)
        return state.get("report")

    # ========================================================================
    # CANVAS SUBMISSION
    # ========================================================================

    def submit_canvas(
        self,
        interview_id: str,
        question_id: Optional[str],
        image_data: str,
    ) -> Dict[str, Any]:
        """
        Accept a candidate's system-design canvas drawing, run AI diagram analysis,
        store the submission in MongoDB state, and return structured analysis.

        Args:
            interview_id: Active interview identifier
            question_id: Optional question identifier the drawing relates to
            image_data: Base64-encoded PNG data URL from the frontend canvas

        Returns:
            dict with 'success' flag and 'analysis' DiagramAnalysis dict
        """
        state = self._get_state(interview_id)

        # Resolve question context for analysis
        current_q = state.get("current_question") or {}
        question_text = (
            current_q.get("question")
            or state.get("greeting_question")
            or "System design question"
        )
        role = state.get("company_details", {}).get("role", "Software Engineer")

        # Run AI diagram analysis
        try:
            from .canvas_analysis import analyze_canvas_diagram
        except ImportError:
            try:
                from .canvas_analysis import analyze_canvas_diagram
            except ImportError:
                logger.error("canvas_analysis module not found — storing submission without analysis")
                analyze_canvas_diagram = None

        analysis = {}
        if analyze_canvas_diagram:
            try:
                analysis = analyze_canvas_diagram(image_data, question_text, role)
            except Exception as exc:
                logger.warning("Canvas diagram analysis failed: %s", exc)
                analysis = {
                    "components": [],
                    "relationships": [],
                    "design_notes": "Analysis unavailable.",
                    "suggestions": [],
                }

        # Build submission record (store base64 image + analysis)
        submission = {
            "question_id": question_id,
            "question": question_text,
            "image_data": image_data,
            "analysis": analysis,
            "submitted_at": self._now().isoformat(),
        }

        # Append to canvas_submissions list in state
        submissions = state.get("canvas_submissions", [])
        submissions.append(submission)
        state["canvas_submissions"] = submissions
        self._save_state(state)

        logger.info(
            "Canvas submission stored for interview %s, question_id=%s, components_found=%d",
            interview_id,
            question_id,
            len(analysis.get("components", [])),
        )

        return {"success": True, "analysis": analysis}

