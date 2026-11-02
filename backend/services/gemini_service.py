"""Compatibility shim redirecting legacy gemini_service calls to baseten_service."""

from backend.services.baseten_service import (
    BASETEN_API_KEY,
    BASETEN_BASE_URL,
    BASETEN_MODEL,
    GEMINI_API_KEY,
    get_client,
    get_model,
    safe_parse_json,
    generate_mock_problems,
    generate_problems_ai,
    generate_job_description,
    evaluate_resume,
    generate_interview_questions,
    evaluate_interview_report,
)
