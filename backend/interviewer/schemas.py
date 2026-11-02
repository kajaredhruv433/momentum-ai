"""
schemas.py

Pydantic data models for the Momentum AI Interview Platform API requests,
responses, state serialization, candidate answers, and final evaluation reports.
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field


class CompanyDetails(BaseModel):
    company_name: str = Field(..., min_length=1, description="Target company name")
    role: str = Field(..., min_length=1, description="Target job title/role")
    required_skills: Union[str, List[str]] = Field(
        ..., description="List or comma-separated string of required skills"
    )
    required_experience: str = Field(..., description="Years or description of experience required")
    required_qualification: str = Field(..., description="Education/qualification criteria")
    salary: Optional[str] = Field("Not Disclosed", description="Offered compensation")
    role_description: str = Field(..., description="Overview and responsibilities of the role")
    employee_qualities: Union[str, List[str]] = Field(
        ..., description="Desired behavioral qualities and soft skills"
    )


class CreateInterviewRequest(BaseModel):
    company_details: CompanyDetails
    resume_text: str = Field(..., min_length=20, description="Raw text of the candidate's resume")
    base_time: Optional[int] = Field(1800, description="Base interview duration in seconds (default: 30m)")
    extended_time: Optional[int] = Field(2700, description="Extended interview threshold in seconds (default: 45m)")
    candidate_id: Optional[str] = Field(None, description="Candidate ID / Firebase UID")
    candidate_email: Optional[str] = Field(None, description="Candidate email address")
    candidate_name: Optional[str] = Field(None, description="Candidate full name")
    job_id: Optional[str] = Field(None, description="MongoDB job ID")
    application_id: Optional[str] = Field(None, description="MongoDB application ID")
    selected_repository: Optional[Dict[str, Any]] = Field(
        None, description="GitHub repository metadata selected for this interview; no source files"
    )


class CandidateAnswerRequest(BaseModel):
    answer: str = Field(..., min_length=1, description="Transcript of spoken answer or typed text")
    input_method: Literal["voice", "text"] = Field(
        "text", description="Input method used: 'voice' (ElevenLabs STT) or 'text' (Typing)"
    )
    question_id: Optional[str] = Field(None, description="Optional ID of the question being answered")



class EvaluationReportSchema(BaseModel):
    overall_match_percentage: int = Field(ge=0, le=100)
    job_role_match: int = Field(ge=0, le=100)
    skills_match: int = Field(ge=0, le=100)
    experience_match: int = Field(ge=0, le=100)
    qualification_match: int = Field(ge=0, le=100)
    technical_score: int = Field(ge=0, le=100)
    communication_score: int = Field(ge=0, le=100)
    problem_solving_score: int = Field(ge=0, le=100)
    strengths: List[str] = Field(default_factory=list)
    concerns: List[str] = Field(default_factory=list)
    hire_reasons: List[str] = Field(default_factory=list)
    reject_reasons: List[str] = Field(default_factory=list)
    final_recommendation: Literal["Strong Hire", "Hire", "Consider", "Do Not Hire"]


class CanvasSubmitRequest(BaseModel):
    question_id: Optional[str] = Field(None, description="Identifier of the question the diagram relates to")
    image_data: str = Field(..., description="Base64-encoded PNG of the canvas drawing")


class DiagramAnalysis(BaseModel):
    components: List[str] = Field(default_factory=list, description="Identified system components in the diagram")
    relationships: List[str] = Field(default_factory=list, description="Identified relationships / data flows between components")
    design_notes: str = Field("", description="Overall assessment of the diagram's design quality")
    suggestions: List[str] = Field(default_factory=list, description="Improvement suggestions for the diagram")


class InterviewPublicState(BaseModel):
    interview_id: str
    stage: str
    status: str
    current_stage: str
    interview_phase: str
    panel: Dict[str, Any] = Field(default_factory=dict)
    areas_to_cover: List[str] = Field(default_factory=list)
    covered_areas: List[str] = Field(default_factory=list)
    selected_panel_member: Optional[str] = None
    panel_member_details: Optional[Dict[str, Any]] = None
    current_question: Optional[str] = None
    question_pattern: Optional[str] = None
    greeting_question: Optional[str] = None
    timer_started: bool = False
    elapsed_time: int = 0
    base_time: int = 1800
    extended_time: int = 2700
    report_ready: bool = False
    report: Optional[Dict[str, Any]] = None
    history: List[Dict[str, Any]] = Field(default_factory=list)
