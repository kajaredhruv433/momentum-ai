from copy import deepcopy


VOICE_CATALOG = [
    {
        "name": "Marcus",
        "gender": "Male",
        "accent": "American",
        "tone": "Calm & Technical",
        "personality": [
            "analytical",
            "deep",
            "authoritative",
            "methodical"
        ],
        "minimax_voice_id": "English_expressive_male1",
        "elevenlabs_voice_id": "pNInz6obpgDQGcFmaJgB"
    },
    {
        "name": "Sarah",
        "gender": "Female",
        "accent": "American",
        "tone": "Energetic & Pragmatic",
        "personality": [
            "decisive",
            "encouraging",
            "structured",
            "outcome-focused"
        ],
        "minimax_voice_id": "English_captivating_female1",
        "elevenlabs_voice_id": "21m00Tcm4TlvDq8ikWAM"
    },
    {
        "name": "Elena",
        "gender": "Female",
        "accent": "British",
        "tone": "Warm & Empathetic",
        "personality": [
            "perceptive",
            "warm",
            "reflective",
            "conversational"
        ],
        "minimax_voice_id": "English_expressive_female1",
        "elevenlabs_voice_id": "EXAVITQu4vr4xnSDxMaLx"
    },
    {
        "name": "Alexander",
        "gender": "Male",
        "accent": "British",
        "tone": "Deep & Measured",
        "personality": [
            "probing",
            "intellectual",
            "deliberate",
            "rigorous"
        ],
        "minimax_voice_id": "English_profound_male1",
        "elevenlabs_voice_id": "ErXwobaYiN019PkySvjV"
    },
    {
        "name": "Priya",
        "gender": "Female",
        "accent": "Indian/Global",
        "tone": "Sharp & Inquisitive",
        "personality": [
            "sharp",
            "fast-paced",
            "insightful",
            "encouraging"
        ],
        "minimax_voice_id": "English_captivating_female2",
        "elevenlabs_voice_id": "ThT5KcBeYPX3keUQqHPh"
    },
    {
        "name": "David",
        "gender": "Male",
        "accent": "American",
        "tone": "Methodical",
        "personality": [
            "quietly confident",
            "systems-oriented",
            "precise"
        ],
        "minimax_voice_id": "English_expressive_male2",
        "elevenlabs_voice_id": "VR6AewLTigWG4xSOukaG"
    },
    {
        "name": "Aria",
        "gender": "Female",
        "accent": "American",
        "tone": "Crisp & Direct",
        "personality": [
            "articulate",
            "visionary",
            "business-minded",
            "clear"
        ],
        "minimax_voice_id": "English_captivating_female1",
        "elevenlabs_voice_id": "MF3mGyEYCl7XYWbV9V6O"
    },
    {
        "name": "James",
        "gender": "Male",
        "accent": "Australian",
        "tone": "Friendly & Direct",
        "personality": [
            "pragmatic",
            "personable",
            "ownership",
            "humility"
        ],
        "minimax_voice_id": "English_expressive_male1",
        "elevenlabs_voice_id": "yoZ06aMxZJJ28mfd3POQ"
    },
    {
        "name": "Chloe",
        "gender": "Female",
        "accent": "Canadian",
        "tone": "Clear & Focused",
        "personality": [
            "vigilant",
            "systematic",
            "detail-oriented"
        ],
        "minimax_voice_id": "English_expressive_female2",
        "elevenlabs_voice_id": "AZnzlk1XvdvUeBnXmlld"
    },
    {
        "name": "Liam",
        "gender": "Male",
        "accent": "Irish",
        "tone": "Expressive",
        "personality": [
            "supportive",
            "communicative",
            "team-focused"
        ],
        "minimax_voice_id": "English_profound_male1",
        "elevenlabs_voice_id": "TxGEqnHWrfWFTfGW9XjX"
    },
    {
        "name": "Zara",
        "gender": "Female",
        "accent": "Global English",
        "tone": "Analytical",
        "personality": [
            "mathematical",
            "curious",
            "cutting-edge"
        ],
        "minimax_voice_id": "English_captivating_female2",
        "elevenlabs_voice_id": "piTKgcLEGmPE4e6mEKli"
    },
    {
        "name": "Nathan",
        "gender": "Male",
        "accent": "American",
        "tone": "Pragmatic",
        "personality": [
            "steady",
            "resilient",
            "uptime",
            "simplicity"
        ],
        "minimax_voice_id": "English_expressive_male2",
        "elevenlabs_voice_id": "flq6f7yk4E4fJM5XTYuZ"
    },
    {
        "name": "Maya",
        "gender": "Female",
        "accent": "American",
        "tone": "Creative & Observant",
        "personality": [
            "human-centered",
            "expressive",
            "inquisitive"
        ],
        "minimax_voice_id": "English_expressive_female1",
        "elevenlabs_voice_id": "oWAxZDxUJAwQ20xdnAcU"
    },
    {
        "name": "Viktor",
        "gender": "Male",
        "accent": "European English",
        "tone": "Deep & Technical",
        "personality": [
            "logical",
            "rigorous",
            "complexity-focused"
        ],
        "minimax_voice_id": "English_profound_male1",
        "elevenlabs_voice_id": "SOYHLrjzK2X1ezoYCXwu"
    },
    {
        "name": "Olivia",
        "gender": "Female",
        "accent": "American",
        "tone": "Polished",
        "personality": [
            "poised",
            "strategic",
            "comprehensive"
        ],
        "minimax_voice_id": "English_captivating_female1",
        "elevenlabs_voice_id": "pFZP5JQG7iQjIQuC4Bku"
    },
    {
        "name": "Ethan",
        "gender": "Male",
        "accent": "American",
        "tone": "Collaborative",
        "personality": [
            "enthusiastic",
            "approachable",
            "balanced"
        ],
        "minimax_voice_id": "English_expressive_male1",
        "elevenlabs_voice_id": "z9fAnlkOXvlPByrmIdgu"
    }
]


ROLE_PREFERENCES = {
    "hr": [
        "warm",
        "empathetic",
        "conversational",
        "supportive",
        "polished"
    ],

    "technical": [
        "analytical",
        "technical",
        "precise",
        "methodical",
        "rigorous",
        "logical"
    ],

    "engineering": [
        "authoritative",
        "technical",
        "systems",
        "strategic",
        "methodical"
    ],

    "project": [
        "pragmatic",
        "communicative",
        "structured",
        "collaborative"
    ],

    "product": [
        "articulate",
        "business-minded",
        "visionary",
        "clear",
        "strategic"
    ],

    "domain": [
        "analytical",
        "rigorous",
        "logical",
        "inquisitive"
    ]
}


def get_voice_catalog():
    return deepcopy(VOICE_CATALOG)


def _role_category(role):
    role_lower = role.lower()

    if "hr" in role_lower:
        return "hr"

    if (
        "software engineer" in role_lower
        or "technical" in role_lower
        or "developer" in role_lower
    ):
        return "technical"

    if "engineering manager" in role_lower:
        return "engineering"

    if "project manager" in role_lower:
        return "project"

    if "product manager" in role_lower:
        return "product"

    if "domain" in role_lower:
        return "domain"

    return "technical"


def _score_voice(member, voice):
    score = 0

    # Gender is a hard preference.
    if member["gender"] == voice["gender"]:
        score += 100
    else:
        return -1000

    category = _role_category(member["role"])
    preferences = ROLE_PREFERENCES.get(category, [])

    voice_text = " ".join([
        voice["tone"],
        *voice["personality"]
    ]).lower()

    for preference in preferences:
        if preference.lower() in voice_text:
            score += 10

    # Natural conversational voices get a slight preference.
    if "conversational" in voice_text:
        score += 5

    if "warm" in voice_text:
        score += 3

    if "approachable" in voice_text:
        score += 3

    return score


def assign_voices_to_panel(panel_dict):
    """
    Assign a unique natural voice to every panel member.

    Input:
        {
            "panel1": {...},
            "panel2": {...}
        }

    Output:
        Same panel structure with voice + persona metadata.
    """

    if not isinstance(panel_dict, dict):
        raise ValueError("panel_dict must be a dictionary.")

    result = {}
    used_voice_ids = set()

    for panel_id, member in panel_dict.items():

        if not isinstance(member, dict):
            raise ValueError(f"{panel_id} must be a dictionary.")

        gender = member.get("gender")
        role = member.get("role")

        if gender not in {"Male", "Female"}:
            raise ValueError(
                f"{panel_id} has invalid gender: {gender}"
            )

        if not role:
            raise ValueError(
                f"{panel_id} is missing role."
            )

        candidates = []

        for voice in VOICE_CATALOG:

            if voice["gender"] != gender:
                continue

            voice_id = voice["elevenlabs_voice_id"]

            if voice_id in used_voice_ids:
                continue

            candidates.append(voice)

        if not candidates:
            raise RuntimeError(
                f"No unused {gender} voice available for {panel_id}."
            )

        selected_voice = max(
            candidates,
            key=lambda v: _score_voice(member, v)
        )

        used_voice_ids.add(
            selected_voice["elevenlabs_voice_id"]
        )

        voice = deepcopy(selected_voice)

        output_member = deepcopy(member)

        # Keep useful top-level fields.
        output_member["voice"] = voice["name"]
        output_member["voiceId"] = voice["elevenlabs_voice_id"]
        output_member["voiceName"] = voice["name"]
        output_member["voiceGender"] = voice["gender"]
        output_member["voiceAccent"] = voice["accent"]
        output_member["voiceTone"] = voice["tone"]

        output_member["minimax_voice_id"] = (
            voice["minimax_voice_id"]
        )

        output_member["elevenlabs_voice_id"] = (
            voice["elevenlabs_voice_id"]
        )

        # Voice personality for the conversational agent.
        output_member["voice_personality"] = (
            voice["personality"]
        )

        # Handoff metadata.
        output_member["handoff"] = {
            "can_handoff": True,
            "next_panel_member": None,
            "handoff_reason": (
                "Transfer when this interviewer's evaluation "
                "responsibility is complete."
            )
        }

        result[panel_id] = output_member

    # Establish deterministic panel order for handoffs.
    panel_ids = list(result.keys())

    for index, panel_id in enumerate(panel_ids):
        if index + 1 < len(panel_ids):
            result[panel_id]["handoff"]["next_panel_member"] = (
                panel_ids[index + 1]
            )

    return result


if __name__ == "__main__":
    sample_panel = {
        "panel1": {
            "name": "Juhi",
            "gender": "Female",
            "role": "HR Manager",
            "seniority": "Manager",
            "interview_stage": "HR Round",
            "evaluation_focus": [
                "Communication",
                "Behavior"
            ],
            "reason_for_inclusion": (
                "Evaluates communication and behavioral fit."
            ),
            "persona": (
                "Warm, professional and perceptive."
            ),
            "behavior": [
                "Ask clear behavioral questions.",
                "Probe vague answers.",
                "Remain encouraging."
            ]
        },

        "panel2": {
            "name": "Dhruv",
            "gender": "Male",
            "role": "Senior Software Engineer",
            "seniority": "Senior",
            "interview_stage": "Technical Round",
            "evaluation_focus": [
                "Python",
                "System Design",
                "Backend Engineering"
            ],
            "reason_for_inclusion": (
                "Evaluates backend technical depth."
            ),
            "persona": (
                "Analytical, precise and technically rigorous."
            ),
            "behavior": [
                "Ask technical questions.",
                "Probe weak reasoning.",
                "Ask relevant follow-ups."
            ]
        }
    }

    final_panel = assign_voices_to_panel(sample_panel)

    import json

    print(
        json.dumps(
            final_panel,
            indent=4,
            ensure_ascii=False
        )
    )
