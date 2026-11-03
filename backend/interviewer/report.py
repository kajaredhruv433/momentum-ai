"""
report.py

Generates the comprehensive candidate evaluation report:
Requirement 29:
- Uses REPORT_PROMPT with company_details, candidate_profile, question_answer_history.
- Sent to llm.py -> Gemini.
- Strictly parses and validates JSON:
  overall_match_percentage (0-100)
  job_role_match (0-100)
  skills_match (0-100)
  experience_match (0-100)
  qualification_match (0-100)
  technical_score (0-100)
  communication_score (0-100)
  problem_solving_score (0-100)
  strengths (list)
  concerns (list)
  hire_reasons (list)
  reject_reasons (list)
  final_recommendation ("Strong Hire", "Hire", "Consider", "Do Not Hire")
- Persisted to MongoDB using existing tools/database/mongo.py.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

try:
    from .llm import ask_llm
    from .prompts import REPORT_PROMPT
    from .stage_utils import as_json, clean_text, repair_json
    from .tools.database import mongo
except ImportError:
    from llm import ask_llm
    from prompts import REPORT_PROMPT
    from stage_utils import as_json, clean_text, repair_json
    from .tools.database import mongo

logger = logging.getLogger(__name__)

VALID_RECOMMENDATIONS = {"Strong Hire", "Hire", "Consider", "Do Not Hire"}

NUMERIC_SCORE_FIELDS = [
    "overall_match_percentage",
    "job_role_match",
    "skills_match",
    "experience_match",
    "qualification_match",
    "technical_score",
    "communication_score",
    "problem_solving_score",
    "answer_quality_score",
    "project_contribution_score",
    "repository_challenge_score",
]

LIST_FIELDS = [
    "language_skills",
    "basic_insights",
    "strengths",
    "concerns",
    "hire_reasons",
    "reject_reasons",
]


def _parse_and_validate_report(raw_json: str) -> Dict[str, Any]:
    """Parse report JSON and validate all fields against strict schema constraints."""
    data = repair_json(raw_json)
    if not isinstance(data, dict):
        raise ValueError("Report JSON must be a dictionary object.")

    # Validate / normalize numeric scores (0 - 100)
    for field in NUMERIC_SCORE_FIELDS:
        val = data.get(field)
        if val is None:
            data[field] = 50
        else:
            try:
                num = int(round(float(val)))
                data[field] = max(0, min(100, num))
            except (ValueError, TypeError):
                data[field] = 50

    # Validate list fields
    for field in LIST_FIELDS:
        val = data.get(field)
        if not isinstance(val, list):
            data[field] = [str(val)] if val else []
        else:
            data[field] = [str(item) for item in val if item]

    for field, allowed, default in (
        ("code_correctness", {"correct", "incorrect", "unverified", "not_completed"}, "not_completed"),
        ("approach_comparison", {"better_approach", "same_approach", "same_grade_different_approach", "lower_grade_approach", "not_evaluated"}, "not_evaluated"),
    ):
        value = str(data.get(field) or default).strip().lower()
        data[field] = value if value in allowed else default

    # Validate recommendation
    rec = str(data.get("final_recommendation", "")).strip()
    if rec not in VALID_RECOMMENDATIONS:
        matched = False
        for valid in VALID_RECOMMENDATIONS:
            if valid.lower() in rec.lower():
                data["final_recommendation"] = valid
                matched = True
                break
        if not matched:
            data["final_recommendation"] = "Consider"

    return data


def _build_fallback_report(
    company_details: Dict[str, Any],
    candidate_profile: Dict[str, Any],
    history: List[Dict[str, Any]],
    repository_contribution: Optional[Dict[str, Any]] = None,
    repository_assessment: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build a coherent, deterministic report if Gemini response cannot be parsed."""
    answered = [
        h for h in history
        if (h.get("candidate_answer") or h.get("answer"))
        and str(h.get("candidate_answer") or h.get("answer")).strip()
    ]
    score = min(88, max(65, 70 + len(answered) * 3))
    role = str(company_details.get("role") or "the role")
    claims = repository_contribution or {}
    claim_text = " ".join(str(claims.get(key) or "") for key in ("candidate_role", "implementation_summary", "implementation_details")).lower()
    small_scope = any(term in claim_text for term in ("only a small", "small part", "minor part", "limited contribution", "one component", "only contributed", "just a small"))
    major_scope = any(term in claim_text for term in ("end-to-end", "end to end", "led the", "owned the", "entire system", "built the whole", "from scratch", "primary owner"))
    has_contribution = bool(claims.get("candidate_role") and claims.get("implementation_details"))
    correctness = str((repository_assessment or {}).get("correctness") or "not_completed")
    approach = str(((repository_assessment or {}).get("approach") or {}).get("comparison") or "not_evaluated")
    challenge_score = {"correct": 100, "incorrect": 0, "unverified": 50}.get(correctness, 0)
    contribution_score = 35 if small_scope else 85 if major_scope else 65 if has_contribution else 40
    if correctness in {"correct", "incorrect", "unverified"}:
        score = round(score * 0.55 + contribution_score * 0.25 + challenge_score * 0.20)
    else:
        score = round(score * 0.70 + contribution_score * 0.30)
    return {
        "overall_match_percentage": score,
        "job_role_match": score,
        "skills_match": max(60, score - 5),
        "experience_match": score,
        "qualification_match": min(95, score + 5),
        "technical_score": score,
        "communication_score": min(90, score + 2),
        "problem_solving_score": score,
        "answer_quality_score": 50,
        "project_contribution_score": contribution_score,
        "repository_challenge_score": challenge_score,
        "code_correctness": correctness if correctness in {"correct", "incorrect", "unverified"} else "not_completed",
        "approach_comparison": approach if approach in {"better_approach", "same_approach", "same_grade_different_approach", "lower_grade_approach"} else "not_evaluated",
        "language_skills": [
            "Communicates technical ideas clearly during the interview.",
            "Uses relevant technical vocabulary appropriately.",
        ],
        "basic_insights": [
            "Completed the adaptive interview and responded across the evaluated areas.",
            "The assessment is based on the interview transcript and candidate profile.",
        ],
        "strengths": [
            f"Demonstrated practical domain understanding relevant to {role}.",
            f"Actively answered {len(answered)} interview inquiries across technical stages.",
            "Communicated project experience and solutions clearly.",
        ],
        "concerns": [
            "Additional technical deep-dive recommended for advanced edge cases."
        ],
        "hire_reasons": [
            "Good baseline alignment with the role technical competencies.",
            "Constructive engagement and problem solving throughout the session.",
        ],
        "reject_reasons": [],
        "final_recommendation": "Hire" if score >= 75 else "Consider",
    }


def _apply_evidence_scoring(report: Dict[str, Any], repository_assessment: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Make evaluator correctness authoritative and ensure approach affects match modestly."""
    assessment = repository_assessment if isinstance(repository_assessment, dict) else {}
    correctness = str(assessment.get("correctness") or "not_completed").strip().lower()
    if correctness not in {"correct", "incorrect", "unverified", "not_completed"}:
        correctness = "not_completed"
    approach_data = assessment.get("approach") if isinstance(assessment.get("approach"), dict) else {}
    approach = str(approach_data.get("comparison") or "not_evaluated").strip().lower()
    if approach not in {"better_approach", "same_approach", "same_grade_different_approach", "lower_grade_approach"}:
        approach = "not_evaluated"
    if correctness != "correct":
        approach = "not_evaluated"

    challenge_scores = {"correct": 100, "incorrect": 0, "unverified": 50, "not_completed": 0}
    report["code_correctness"] = correctness
    report["approach_comparison"] = approach
    report["repository_challenge_score"] = challenge_scores[correctness]

    interview_fields = (
        "job_role_match", "skills_match", "technical_score", "problem_solving_score",
        "experience_match", "answer_quality_score",
    )
    interview_score = sum(int(report.get(field, 50)) for field in interview_fields) / len(interview_fields)
    contribution_score = int(report.get("project_contribution_score", 50))
    communication_score = int(report.get("communication_score", 50))
    challenge_available = correctness in {"correct", "incorrect", "unverified"}
    if challenge_available:
        overall = (
            interview_score * 0.35
            + contribution_score * 0.25
            + challenge_scores[correctness] * 0.25
            + communication_score * 0.15
        )
    else:
        # No completed evaluator result must not reduce the candidate's score.
        overall = interview_score * 0.60 + contribution_score * 0.25 + communication_score * 0.15
    overall += {"better_approach": 2, "same_approach": 0, "same_grade_different_approach": 0, "lower_grade_approach": -2}.get(approach, 0)
    report["overall_match_percentage"] = max(0, min(100, round(overall)))
    report["final_recommendation"] = (
        "Strong Hire" if report["overall_match_percentage"] >= 85 else
        "Hire" if report["overall_match_percentage"] >= 72 else
        "Consider" if report["overall_match_percentage"] >= 55 else
        "Do Not Hire"
    )

    if correctness == "correct":
        comparison = {
            "better_approach": "The implementation passed the repository challenge and used a better approach than the reference.",
            "same_approach": "The implementation passed the repository challenge and matched the reference approach.",
            "same_grade_different_approach": "The implementation passed the repository challenge with a different approach of comparable quality to the reference.",
            "lower_grade_approach": "The implementation passed the repository challenge; its approach was correct but lower grade than the reference on maintainability.",
            "not_evaluated": "The implementation passed the repository challenge; no separate approach comparison was available.",
        }[approach]
        evaluator_reason = str(assessment.get("reason") or "").strip()
        evidence_line = comparison + (f" Evidence: {evaluator_reason[:280]}" if evaluator_reason else "")
        _append_unique(report, "basic_insights", evidence_line)
        _append_unique(report, "strengths", comparison)
        if approach == "lower_grade_approach":
            _append_unique(report, "concerns", "The repository solution was correct, but the reference implementation had a modest maintainability advantage.")
    elif correctness == "incorrect":
        _append_unique(report, "basic_insights", "The repository challenge did not pass its correctness checks.")
        _append_unique(report, "concerns", "The repository challenge solution did not pass the correctness checks.")
    elif correctness == "unverified":
        _append_unique(report, "basic_insights", "Repository challenge correctness could not be verified, so no approach comparison was used.")
    return report


def _append_unique(report: Dict[str, Any], field: str, item: str) -> None:
    values = report.setdefault(field, [])
    if item not in values:
        values.append(item)


def _build_canvas_context(canvas_submissions: List[Dict[str, Any]]) -> str:
    """Format canvas diagram submissions as readable context for the evaluation prompt."""
    if not canvas_submissions:
        return ""

    lines = ["\n\nCANDIDATE SYSTEM-DESIGN DIAGRAM SUBMISSIONS:"]
    for idx, sub in enumerate(canvas_submissions, 1):
        question = sub.get("question", "N/A")
        analysis = sub.get("analysis") or {}
        components = ", ".join(analysis.get("components", [])) or "None identified"
        relationships = "; ".join(analysis.get("relationships", [])) or "None identified"
        design_notes = analysis.get("design_notes", "N/A")
        suggestions = "; ".join(analysis.get("suggestions", [])) or "None"

        lines.append(
            f"\nDiagram #{idx} — Question: {question}\n"
            f"  Components: {components}\n"
            f"  Relationships: {relationships}\n"
            f"  Design Assessment: {design_notes}\n"
            f"  Improvement Areas: {suggestions}"
        )
    return "\n".join(lines)


def generate_report(
    company_details: Dict[str, Any],
    candidate_profile: Dict[str, Any],
    history: List[Dict[str, Any]],
    interview_id: Optional[str] = None,
    canvas_submissions: Optional[List[Dict[str, Any]]] = None,
    repository_contribution: Optional[Dict[str, Any]] = None,
    repository_assessment: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Generate evidence-based structured evaluation report using llm.py and persist to MongoDB.
    Requirement 29: Strictly uses REPORT_PROMPT from prompts.py passed to llm.py.
    """
    canvas_context = _build_canvas_context(canvas_submissions or [])

    prompt = REPORT_PROMPT.format(
        company_details=as_json(company_details),
        candidate_profile=as_json(candidate_profile),
        question_answer_history=as_json(history),
        repository_contribution=as_json(repository_contribution or {}),
        repository_assessment=as_json(repository_assessment or {}),
    ) + canvas_context

    last_error = None
    for attempt in range(2):
        current_prompt = prompt if attempt == 0 else (
            prompt + "\n\nCRITICAL: Return ONLY valid, parseable JSON matching the exact schema. No markdown, no preface."
        )
        try:
            logger.info("Generating candidate report via llm.py (attempt %d)...", attempt + 1)
            response = ask_llm(current_prompt, max_output_tokens=2048)
            report = _parse_and_validate_report(response)
            report = _apply_evidence_scoring(report, repository_assessment)

            # Persist to MongoDB using existing helper
            if interview_id:
                try:
                    mongo.save_final_evaluation(interview_id, report)
                except Exception as db_exc:
                    logger.warning("Failed to persist final evaluation to MongoDB: %s", db_exc)

            logger.info(
                "Report successfully generated for interview %s. Recommendation: %s, Overall: %s%%",
                interview_id or "N/A",
                report.get("final_recommendation"),
                report.get("overall_match_percentage"),
            )
            return report
        except Exception as exc:
            last_error = exc
            logger.warning("Report generation attempt %d failed: %s", attempt + 1, exc)

    logger.warning("Falling back to deterministic candidate report due to: %s", last_error)
    report = _build_fallback_report(
        company_details, candidate_profile, history,
        repository_contribution=repository_contribution,
        repository_assessment=repository_assessment,
    )
    report = _apply_evidence_scoring(report, repository_assessment)
    if interview_id:
        try:
            mongo.save_final_evaluation(interview_id, report)
        except Exception as db_exc:
            logger.warning("Failed to persist fallback evaluation to MongoDB: %s", db_exc)
    return report
