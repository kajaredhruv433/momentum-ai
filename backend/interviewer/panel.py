import json
import re
try:  # Supports both `python -m backend.main` and legacy root execution.
    from .llm import ask_llm
    from .stage_utils import repair_json
    from .prompts import PANEL_PROMPT
except ImportError:  # pragma: no cover
    from llm import ask_llm
    from stage_utils import repair_json
    from prompts import PANEL_PROMPT



def _parse_model_json(response):
    if isinstance(response, dict):
        return response

    if not isinstance(response, str):
        raise ValueError("Gemini response is not a string or dictionary.")

    try:
        return repair_json(response)
    except Exception as exc:
        raise ValueError(f"Could not parse valid JSON from Gemini response: {exc}") from exc


def _normalise_panel_shape(data):
    """Accept the common list form, then use the existing strict validator.

    Gemini sometimes follows the member schema but returns ``[{...}, {...}]``
    instead of the requested keyed object. This conversion is structural only:
    it does not invent or alter a panel member.
    """
    if isinstance(data, dict):
        members = data.get("panel_members") or data.get("members") or data.get("panel")
        if isinstance(members, list):
            data = members

    if isinstance(data, list):
        if not 1 <= len(data) <= 5 or not all(isinstance(member, dict) for member in data):
            raise ValueError("Panel list must contain 1-5 member dictionaries.")
        return {
            "panel_size": len(data),
            **{f"panel{index}": member for index, member in enumerate(data, start=1)},
        }

    return data


def _repair_panel_shape(data, company_requirements):
    """Repair only empty list fields that the model occasionally omits."""
    if not isinstance(data, dict):
        return data

    default_focus = str(company_requirements.get("role") or "Role requirements")
    default_behavior = [
        "Ask clear questions relevant to the interview stage.",
        "Probe vague answers with concise follow-up questions.",
        "Remain professional and do not answer for the candidate.",
    ]
    for key, member in data.items():
        if key == "panel_size" or not isinstance(member, dict):
            continue
        if not isinstance(member.get("evaluation_focus"), list) or not member["evaluation_focus"]:
            member["evaluation_focus"] = [member.get("interview_stage") or default_focus]
        if not isinstance(member.get("behavior"), list) or not member["behavior"]:
            member["behavior"] = list(default_behavior)
    return data


def _validate_panel(data):
    if not isinstance(data, dict):
        raise ValueError("Panel response must be a dictionary.")

    panel_size = data.get("panel_size")

    if not isinstance(panel_size, int):
        raise ValueError("panel_size must be an integer.")

    if not 1 <= panel_size <= 5:
        raise ValueError("panel_size must be between 1 and 5.")

    actual_panel_keys = {
        key for key in data
        if key.startswith("panel") and key != "panel_size"
    }

    expected_panel_keys = {
        f"panel{i}" for i in range(1, panel_size + 1)
    }

    if actual_panel_keys != expected_panel_keys:
        raise ValueError(
            f"Invalid panel keys. Expected {expected_panel_keys}, "
            f"got {actual_panel_keys}"
        )

    required_fields = [
        "name",
        "gender",
        "role",
        "seniority",
        "interview_stage",
        "evaluation_focus",
        "reason_for_inclusion",
        "persona",
        "behavior",
    ]

    names = set()
    roles = set()

    for panel_id in sorted(actual_panel_keys):
        member = data[panel_id]

        if not isinstance(member, dict):
            raise ValueError(f"{panel_id} must be a dictionary.")

        for field in required_fields:
            if field not in member:
                raise ValueError(
                    f"{panel_id} is missing required field: {field}"
                )

        if member["gender"] not in {"Male", "Female"}:
            raise ValueError(
                f"{panel_id} gender must be Male or Female."
            )

        for field in [
            "name",
            "role",
            "seniority",
            "interview_stage",
            "reason_for_inclusion",
            "persona",
        ]:
            if not isinstance(member[field], str) or not member[field].strip():
                raise ValueError(
                    f"{panel_id}.{field} must be a non-empty string."
                )

        if (
            not isinstance(member["evaluation_focus"], list)
            or not member["evaluation_focus"]
        ):
            raise ValueError(
                f"{panel_id}.evaluation_focus must be a non-empty list."
            )

        if (
            not isinstance(member["behavior"], list)
            or not member["behavior"]
        ):
            raise ValueError(
                f"{panel_id}.behavior must be a non-empty list."
            )

        name_key = member["name"].strip().lower()
        role_key = member["role"].strip().lower()

        if name_key in names:
            raise ValueError(f"Duplicate panel member name: {member['name']}")

        if role_key in roles:
            raise ValueError(f"Duplicate panel role: {member['role']}")

        names.add(name_key)
        roles.add(role_key)

    return True


def create_interview_panel(company_requirements):
    """
    Generate a dynamic AI interview panel.

    Input:
        company_requirements: dict

    Output:
        {
            "panel1": {...},
            "panel2": {...}
        }
    """

    if not isinstance(company_requirements, dict):
        raise ValueError("company_requirements must be a dictionary.")

    if not company_requirements:
        raise ValueError("company_requirements cannot be empty.")

    requirements_json = json.dumps(
        company_requirements,
        ensure_ascii=False,
        indent=2
    )

    prompt = (
        PANEL_PROMPT
        + "\n\nCompany / Job Requirements:\n"
        + requirements_json
    )

    response = ask_llm(prompt)

    try:
        data = _repair_panel_shape(_normalise_panel_shape(_parse_model_json(response)), company_requirements)
        _validate_panel(data)

    except Exception:
        # Very compact retry to avoid truncated JSON.
        retry_prompt = f"""
Return ONLY complete valid JSON.

Create a 1-5 member AI interview panel for this job.

Every member MUST contain:
name, gender, role, seniority, interview_stage,
evaluation_focus, reason_for_inclusion, persona, behavior.

Every evaluation_focus MUST be a non-empty JSON array with at least one concise string.
Every behavior MUST be a non-empty JSON array with at least two concise strings.

Rules:
- name is a human first name.
- role is the professional job title.
- gender is Male or Female.
- Use only necessary interviewers.
- Make responsibilities unique.
- Keep every string short.
- Do not use markdown.

Job:
{requirements_json}
"""
        try:
            retry_response = ask_llm(retry_prompt)
            data = _repair_panel_shape(_normalise_panel_shape(_parse_model_json(retry_response)), company_requirements)
            _validate_panel(data)
        except Exception:
            # Fallback deterministic panel derived from company requirements
            role = str(company_requirements.get("role") or "Software Engineer")
            skills = company_requirements.get("required_skills") or ["Technical Problem Solving"]
            if isinstance(skills, str):
                skills = [s.strip() for s in skills.split(",") if s.strip()]

            data = {
                "panel1": {
                    "name": "Juhi Nale",
                    "gender": "Female",
                    "role": "HR Manager",
                    "seniority": "Manager",
                    "interview_stage": "HR Round",
                    "evaluation_focus": ["Communication", "Behavioral Fit"],
                    "reason_for_inclusion": "Evaluates communication and cultural alignment.",
                    "persona": "Warm, professional and perceptive.",
                    "behavior": [
                        "Ask clear behavioral questions.",
                        "Probe candidate experience and motivation."
                    ]
                },
                "panel2": {
                    "name": "Dhruv Kajare",
                    "gender": "Male",
                    "role": f"Senior {role}",
                    "seniority": "Senior",
                    "interview_stage": "Technical Round",
                    "evaluation_focus": skills[:3] or ["Technical Architecture"],
                    "reason_for_inclusion": f"Evaluates technical depth for {role}.",
                    "persona": "Analytical, precise and technically rigorous.",
                    "behavior": [
                        "Ask practical technical questions.",
                        "Probe system trade-offs and real-world debugging."
                    ]
                }
            }

    # Remove internal panel_size before returning.
    data.pop("panel_size", None)

    return data


if __name__ == "__main__":
    company_requirements = {
        "company_name": "TechNova Solutions",
        "role": "Senior Backend Engineer",
        "required_skills": [
            "Python",
            "FastAPI",
            "PostgreSQL",
            "Redis",
            "Docker",
            "REST APIs",
            "System Design",
            "Microservices"
        ],
        "required_experience": "5+ years",
        "required_qualification": (
            "B.Tech / B.E. in Computer Science or equivalent"
        ),
        "salary": "Not Disclosed",
        "role_description": (
            "Design and develop scalable backend services "
            "and APIs for high-traffic applications."
        ),
        "employee_qualities": [
            "Problem solving",
            "Leadership",
            "Communication",
            "Ownership",
            "Team collaboration"
        ]
    }

    panel = create_interview_panel(company_requirements)

    print(json.dumps(
        panel,
        indent=4,
        ensure_ascii=False
    ))
