from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List, Optional


INTERVIEW_VOICES: Dict[str, Dict[str, Any]] = {
    "bella": {
        "name": "Bella",
        "voice_id": "hpp4J3VqNfWAUOO0d1Us",
        "elevenlabs_voice_id": "hpp4J3VqNfWAUOO0d1Us",
        "gender": "female",
        "accent": "American",
        "personality": ["professional", "bright", "warm"],
        "best_for": ["HR", "Recruiter", "Candidate Support"],
        "interview_style": "friendly_professional",
    },
    "roger": {
        "name": "Roger",
        "voice_id": "CwhRBWXzGAHq8TQ4Fs17",
        "elevenlabs_voice_id": "CwhRBWXzGAHq8TQ4Fs17",
        "gender": "male",
        "accent": "American",
        "personality": ["laid-back", "casual", "resonant"],
        "best_for": ["Hiring Manager", "Behavioral Interviewer"],
        "interview_style": "relaxed_professional",
    },
    "sarah": {
        "name": "Sarah",
        "voice_id": "EXAVITQu4vr4xnSDxMaL",
        "elevenlabs_voice_id": "EXAVITQu4vr4xnSDxMaL",
        "gender": "female",
        "accent": "American",
        "personality": ["mature", "reassuring", "confident"],
        "best_for": ["HR", "Senior Recruiter", "Behavioral Interviewer"],
        "interview_style": "confident_reassuring",
    },
    "laura": {
        "name": "Laura",
        "voice_id": "FGY2WhTYpPnrIDTdsKH5",
        "elevenlabs_voice_id": "FGY2WhTYpPnrIDTdsKH5",
        "gender": "female",
        "accent": "American",
        "personality": ["enthusiastic", "quirky"],
        "best_for": ["Product Manager", "Culture Interviewer", "Creative Roles"],
        "interview_style": "energetic_conversational",
    },
    "charlie": {
        "name": "Charlie",
        "voice_id": "IKne3meq5aSn9XLyUdCD",
        "elevenlabs_voice_id": "IKne3meq5aSn9XLyUdCD",
        "gender": "male",
        "accent": "Australian",
        "personality": ["deep", "confident", "energetic"],
        "best_for": ["Technical Interviewer", "Engineering Manager", "Hiring Manager"],
        "interview_style": "confident_direct",
    },
    "george": {
        "name": "George",
        "voice_id": "JBFqnCBsd6RMkjVDRZzb",
        "elevenlabs_voice_id": "JBFqnCBsd6RMkjVDRZzb",
        "gender": "male",
        "accent": "British",
        "personality": ["warm", "captivating", "storyteller"],
        "best_for": ["Hiring Manager", "Behavioral Interviewer", "Leadership Interviewer"],
        "interview_style": "warm_authoritative",
    },
    "callum": {
        "name": "Callum",
        "voice_id": "N2lVS1w4EtoT3dr4eOWO",
        "elevenlabs_voice_id": "N2lVS1w4EtoT3dr4eOWO",
        "gender": "male",
        "accent": "American",
        "personality": ["husky", "trickster"],
        "best_for": ["Stress Interviewer", "Behavioral Interviewer", "Challenging Interviewer"],
        "interview_style": "challenging_playful",
    },
    "river": {
        "name": "River",
        "voice_id": "SAz9YHcvj6GT2YYXdXww",
        "elevenlabs_voice_id": "SAz9YHcvj6GT2YYXdXww",
        "gender": "neutral",
        "accent": "American",
        "personality": ["relaxed", "neutral", "informative"],
        "best_for": ["Technical Interviewer", "Assessment Interviewer", "General Interviewer"],
        "interview_style": "neutral_objective",
    },
    "harry": {
        "name": "Harry",
        "voice_id": "SOYHLrjzK2X1ezoPC6cr",
        "elevenlabs_voice_id": "SOYHLrjzK2X1ezoPC6cr",
        "gender": "male",
        "accent": "American",
        "personality": ["fierce", "strong"],
        "best_for": ["Stress Interviewer", "Technical Interviewer", "Leadership Interviewer"],
        "interview_style": "intense_direct",
    },
    "liam": {
        "name": "Liam",
        "voice_id": "TX3LPaxmHKxFdv7VOQHJ",
        "elevenlabs_voice_id": "TX3LPaxmHKxFdv7VOQHJ",
        "gender": "male",
        "accent": "American",
        "personality": ["energetic", "social", "expressive"],
        "best_for": ["Product Manager", "Culture Interviewer", "HR"],
        "interview_style": "energetic_conversational",
    },
    "alice": {
        "name": "Alice",
        "voice_id": "Xb7hH8MSUJpSbSDYk0k2",
        "elevenlabs_voice_id": "Xb7hH8MSUJpSbSDYk0k2",
        "gender": "female",
        "accent": "British",
        "personality": ["clear", "engaging", "educational"],
        "best_for": ["Technical Interviewer", "Technical Mentor", "Assessment Interviewer"],
        "interview_style": "clear_structured",
    },
    "matilda": {
        "name": "Matilda",
        "voice_id": "XrExE9yKIg1WjnnlVkGX",
        "elevenlabs_voice_id": "XrExE9yKIg1WjnnlVkGX",
        "gender": "female",
        "accent": "American",
        "personality": ["knowledgeable", "professional"],
        "best_for": ["Technical Interviewer", "Senior Interviewer", "Hiring Manager"],
        "interview_style": "professional_authoritative",
    },
    "will": {
        "name": "Will",
        "voice_id": "bIHbv24MWmeRgasZH58o",
        "elevenlabs_voice_id": "bIHbv24MWmeRgasZH58o",
        "gender": "male",
        "accent": "American",
        "personality": ["relaxed", "optimistic"],
        "best_for": ["HR", "Culture Interviewer", "Behavioral Interviewer"],
        "interview_style": "friendly_relaxed",
    },
    "jessica": {
        "name": "Jessica",
        "voice_id": "cgSgspJ2msm6clMCkdW9",
        "elevenlabs_voice_id": "cgSgspJ2msm6clMCkdW9",
        "gender": "female",
        "accent": "American",
        "personality": ["playful", "bright", "warm"],
        "best_for": ["HR", "Culture Interviewer", "Junior Candidate Interviewer"],
        "interview_style": "friendly_energetic",
    },
    "eric": {
        "name": "Eric",
        "voice_id": "cjVigY5qzO86Huf0OWal",
        "elevenlabs_voice_id": "cjVigY5qzO86Huf0OWal",
        "gender": "male",
        "accent": "American",
        "personality": ["smooth", "trustworthy"],
        "best_for": ["HR", "Hiring Manager", "Senior Recruiter"],
        "interview_style": "calm_authoritative",
    },
    "chris": {
        "name": "Chris",
        "voice_id": "iP95p4xoKVk53GoZ742B",
        "elevenlabs_voice_id": "iP95p4xoKVk53GoZ742B",
        "gender": "male",
        "accent": "American",
        "personality": ["charming", "down-to-earth"],
        "best_for": ["Behavioral Interviewer", "Culture Interviewer", "Hiring Manager"],
        "interview_style": "natural_conversational",
    },
    "brian": {
        "name": "Brian",
        "voice_id": "nPczCjzI2devNBz1zQrb",
        "elevenlabs_voice_id": "nPczCjzI2devNBz1zQrb",
        "gender": "male",
        "accent": "American",
        "personality": ["deep", "resonant", "comforting"],
        "best_for": ["Hiring Manager", "Leadership Interviewer", "Senior Interviewer"],
        "interview_style": "calm_authoritative",
    },
    "daniel": {
        "name": "Daniel",
        "voice_id": "onwK4e9ZLuTAKqWW03F9",
        "elevenlabs_voice_id": "onwK4e9ZLuTAKqWW03F9",
        "gender": "male",
        "accent": "British",
        "personality": ["steady", "broadcast-style"],
        "best_for": ["Hiring Manager", "Technical Interviewer", "Senior Interviewer"],
        "interview_style": "formal_structured",
    },
    "lily": {
        "name": "Lily",
        "voice_id": "pFZP5JQG7iQjIQuC4Bku",
        "elevenlabs_voice_id": "pFZP5JQG7iQjIQuC4Bku",
        "gender": "female",
        "accent": "British",
        "personality": ["velvety", "expressive", "actress-like"],
        "best_for": ["HR", "Behavioral Interviewer", "Culture Interviewer"],
        "interview_style": "warm_expressive",
    },
    "adam": {
        "name": "Adam",
        "voice_id": "pNInz6obpgDQGcFmaJgB",
        "elevenlabs_voice_id": "pNInz6obpgDQGcFmaJgB",
        "gender": "male",
        "accent": "American",
        "personality": ["dominant", "firm"],
        "best_for": ["Stress Interviewer", "Technical Interviewer", "Leadership Interviewer"],
        "interview_style": "firm_challenging",
    },
    "bill": {
        "name": "Bill",
        "voice_id": "pqHfZKP75CvOlQylNhV4",
        "elevenlabs_voice_id": "pqHfZKP75CvOlQylNhV4",
        "gender": "male",
        "accent": "American",
        "personality": ["wise", "mature", "balanced"],
        "best_for": ["Senior Hiring Manager", "Leadership Interviewer", "Executive Interviewer"],
        "interview_style": "wise_balanced",
    },
}

VOICE_CATALOG: List[Dict[str, Any]] = [
    {
        "name": v["name"],
        "voice_id": v["voice_id"],
        "elevenlabs_voice_id": v["voice_id"],
        "gender": v["gender"].capitalize(),
        "accent": v["accent"],
        "tone": v.get("interview_style", "").replace("_", " ").title(),
        "personality": list(v.get("personality", [])),
        "best_for": list(v.get("best_for", [])),
        "interview_style": v.get("interview_style", ""),
    }
    for v in INTERVIEW_VOICES.values()
]

ROLE_PREFERENCES: Dict[str, List[str]] = {
    "hr": [
        "warm",
        "empathetic",
        "conversational",
        "supportive",
        "polished",
        "bright",
        "reassuring",
    ],
    "technical": [
        "analytical",
        "technical",
        "precise",
        "methodical",
        "rigorous",
        "logical",
        "deep",
        "direct",
    ],
    "engineering": [
        "authoritative",
        "technical",
        "systems",
        "strategic",
        "methodical",
        "confident",
    ],
    "project": [
        "pragmatic",
        "communicative",
        "structured",
        "collaborative",
        "energetic",
    ],
    "product": [
        "articulate",
        "business-minded",
        "visionary",
        "clear",
        "strategic",
        "conversational",
    ],
    "domain": [
        "analytical",
        "rigorous",
        "logical",
        "inquisitive",
        "knowledgeable",
    ],
}


def get_voice_catalog() -> List[Dict[str, Any]]:
    return deepcopy(VOICE_CATALOG)


def _role_category(role: str) -> str:
    role_lower = str(role or "").lower()
    if "hr" in role_lower or "recruiter" in role_lower or "people" in role_lower:
        return "hr"
    if (
        "software engineer" in role_lower
        or "technical" in role_lower
        or "developer" in role_lower
        or "architect" in role_lower
    ):
        return "technical"
    if "engineering manager" in role_lower or "lead" in role_lower:
        return "engineering"
    if "project manager" in role_lower or "scrum" in role_lower:
        return "project"
    if "product manager" in role_lower or "product" in role_lower:
        return "product"
    if "domain" in role_lower or "senior" in role_lower or "executive" in role_lower:
        return "domain"
    return "technical"


def _score_voice(member: Dict[str, Any], voice: Dict[str, Any]) -> int:
    score = 0
    member_gender = str(member.get("gender", "")).lower().strip()
    voice_gender = str(voice.get("gender", "")).lower().strip()

    # Gender matching
    if voice_gender == "neutral" or member_gender == voice_gender:
        score += 100
        if member_gender == voice_gender:
            score += 25
    else:
        return -1000

    role = str(member.get("role", "")).lower()
    best_for = [b.lower() for b in voice.get("best_for", [])]
    for b in best_for:
        if any(term in role for term in b.split()):
            score += 30

    category = _role_category(member.get("role", ""))
    preferences = ROLE_PREFERENCES.get(category, [])
    voice_text = " ".join([
        str(voice.get("tone", "")),
        str(voice.get("interview_style", "")),
        *voice.get("personality", []),
        *voice.get("best_for", []),
    ]).lower()

    for preference in preferences:
        if preference.lower() in voice_text:
            score += 15

    persona_text = " ".join([
        str(member.get("persona", "")),
        str(member.get("interview_stage", "")),
        " ".join(member.get("evaluation_focus", []) if isinstance(member.get("evaluation_focus"), list) else []),
    ]).lower()

    for p in voice.get("personality", []):
        if p.lower() in persona_text:
            score += 8

    if "conversational" in voice_text:
        score += 5
    if "warm" in voice_text:
        score += 3
    if "professional" in voice_text:
        score += 3

    return score


def assign_voices_to_panel(panel_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Assign a unique natural ElevenLabs voice to every panel member.
    """
    if not isinstance(panel_dict, dict):
        raise ValueError("panel_dict must be a dictionary.")

    result: Dict[str, Any] = {}
    used_voice_ids = set()

    for panel_id, member in panel_dict.items():
        if not isinstance(member, dict):
            raise ValueError(f"{panel_id} must be a dictionary.")

        raw_gender = str(member.get("gender", "Female")).strip()
        gender_normalized = raw_gender.capitalize()
        role = member.get("role", "Interviewer")

        candidates = []
        for voice in VOICE_CATALOG:
            v_gender = voice["gender"].lower()
            m_gender = gender_normalized.lower()
            if v_gender != m_gender and v_gender != "neutral":
                continue
            if voice["voice_id"] in used_voice_ids:
                continue
            candidates.append(voice)

        # Fallback if all matching-gender voices are used
        if not candidates:
            for voice in VOICE_CATALOG:
                if voice["voice_id"] not in used_voice_ids:
                    candidates.append(voice)

        # Extreme fallback
        if not candidates:
            candidates = VOICE_CATALOG

        selected_voice = max(candidates, key=lambda v: _score_voice(member, v))
        used_voice_ids.add(selected_voice["voice_id"])

        voice = deepcopy(selected_voice)
        output_member = deepcopy(member)

        # Populate top-level voice fields
        output_member["voice"] = voice["name"]
        output_member["voiceId"] = voice["voice_id"]
        output_member["voice_id"] = voice["voice_id"]
        output_member["elevenlabs_voice_id"] = voice["voice_id"]
        output_member["voiceName"] = voice["name"]
        output_member["voiceGender"] = voice["gender"]
        output_member["voiceAccent"] = voice["accent"]
        output_member["voiceTone"] = voice.get("tone", "")
        output_member["voice_personality"] = voice.get("personality", [])
        output_member["best_for"] = voice.get("best_for", [])
        output_member["interview_style"] = voice.get("interview_style", "")

        # Handoff metadata
        output_member["handoff"] = {
            "can_handoff": True,
            "next_panel_member": None,
            "handoff_reason": "Transfer when this interviewer's evaluation responsibility is complete.",
        }

        result[panel_id] = output_member

    # Deterministic handoffs
    panel_ids = list(result.keys())
    for index, panel_id in enumerate(panel_ids):
        if index + 1 < len(panel_ids):
            result[panel_id]["handoff"]["next_panel_member"] = panel_ids[index + 1]

    return result


if __name__ == "__main__":
    sample_panel = {
        "panel1": {
            "name": "Bella",
            "gender": "Female",
            "role": "HR Manager",
            "seniority": "Manager",
            "interview_stage": "HR Round",
            "evaluation_focus": ["Communication", "Behavior"],
            "reason_for_inclusion": "Evaluates communication and behavioral fit.",
            "persona": "Warm, professional and perceptive.",
            "behavior": ["Ask clear behavioral questions.", "Probe vague answers.", "Remain encouraging."],
        },
        "panel2": {
            "name": "Charlie",
            "gender": "Male",
            "role": "Senior Software Engineer",
            "seniority": "Senior",
            "interview_stage": "Technical Round",
            "evaluation_focus": ["Python", "System Design", "Backend Engineering"],
            "reason_for_inclusion": "Evaluates backend technical depth.",
            "persona": "Analytical, precise and technically rigorous.",
            "behavior": ["Ask technical questions.", "Probe weak reasoning.", "Ask relevant follow-ups."],
        },
    }

    final_panel = assign_voices_to_panel(sample_panel)
    import json
    print(json.dumps(final_panel, indent=2, ensure_ascii=False))
