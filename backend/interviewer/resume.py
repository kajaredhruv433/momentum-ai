"""
resume.py

Provides structured candidate resume extraction and parsing.
Reuses the extraction primitives from pdf.py and exposes parse_resume_text
and extract_resume functions.
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

try:
    from . import pdf
except ImportError:
    import pdf


def parse_resume_text(text: str) -> Dict[str, Any]:
    """
    Parse raw resume text into structured candidate information:
    - candidate basic info (name, email, phone, links)
    - professional details (summary, skills, experience)
    - education / qualifications
    - projects (names, descriptions, technologies)
    - achievements
    - publications
    - certifications
    """
    sections = pdf.split_sections(text)
    name = pdf.extract_name(text)
    email = pdf.extract_email(text)
    phone = pdf.extract_phone(text)
    links = pdf.extract_links(text)
    skills = pdf.extract_skills(text)
    years_experience = pdf.extract_years_of_experience(text)
    education = pdf.extract_education(text)
    projects = pdf.extract_projects(sections)
    if not projects and sections.get("projects"):
        lines = [line.strip() for line in sections["projects"].splitlines() if line.strip()]
        for line in lines:
            if ":" in line:
                parts = line.split(":", 1)
                projects.append({"title": parts[0].strip(), "description": parts[1].strip()})
            elif len(line.split()) <= 12:
                projects.append({"title": line, "description": ""})

    # Augment projects with matched technologies/skills
    for proj in projects:
        desc = proj.get("description", "")
        title = proj.get("title", "")
        combined = f"{title} {desc}".lower()
        proj_tech = [s for s in skills if s.lower() in combined]
        proj["technologies"] = proj_tech

    return {
        "candidate": {
            "name": name,
            "email": email,
            "phone": phone,
            "linkedin": links.get("linkedin"),
            "github": links.get("github"),
            "portfolio": links.get("portfolio", []),
        },
        "professional": {
            "summary": sections.get("summary", ""),
            "years_of_experience": years_experience,
            "skills": skills,
            "experience": sections.get("experience", ""),
        },
        "education": education,
        "qualifications": education,
        "projects": projects,
        "certifications": sections.get("certifications", ""),
        "achievements": sections.get("achievements", ""),
        "publications": sections.get("publications", ""),
        "raw_text": text,
    }


def extract_resume(file_path_or_text: str) -> Dict[str, Any]:
    """
    Extract structured resume data from either a file path (PDF/DOCX/TXT)
    or raw resume text.
    """
    if os.path.exists(file_path_or_text):
        return pdf.extract_resume(file_path_or_text)
    return parse_resume_text(file_path_or_text)


# Re-export helper functions from pdf.py for downstream reuse
extract_text = pdf.extract_text
split_sections = pdf.split_sections
extract_name = pdf.extract_name
extract_email = pdf.extract_email
extract_phone = pdf.extract_phone
extract_links = pdf.extract_links
extract_skills = pdf.extract_skills
extract_years_of_experience = pdf.extract_years_of_experience
extract_education = pdf.extract_education
extract_projects = pdf.extract_projects
