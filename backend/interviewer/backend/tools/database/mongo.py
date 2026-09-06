from datetime import datetime, timezone

from pymongo import MongoClient

from .config import (
    MONGODB_URI,
    MONGODB_DATABASE,
    MONGODB_INTERVIEW_COLLECTION
)


# ============================================================
# CONNECTION
# ============================================================

_client = MongoClient(
    MONGODB_URI,
    serverSelectionTimeoutMS=5000
)

_db = _client[MONGODB_DATABASE]


# ============================================================
# COLLECTIONS
# ============================================================

interview_collection = _db[
    MONGODB_INTERVIEW_COLLECTION
]

candidates = _db["candidates"]
jobs = _db["jobs"]
panels = _db["panels"]
interviews = _db["interviews"]
questions = _db["interview_questions"]
answers = _db["interview_answers"]
events = _db["interview_events"]
evaluations = _db["evaluations"]
applications = _db["applications"]
resumes = _db["resumes"]
interview_sessions = _db["interview_sessions"]


# ============================================================
# HELPERS
# ============================================================

def _now():
    return datetime.now(timezone.utc)


def _serialize(document):

    if document is None:
        return None

    if "_id" in document:
        document["_id"] = str(
            document["_id"]
        )

    return document


# ============================================================
# GET CANDIDATE
# ============================================================

def get_candidate(
    candidate_id: str
):

    document = candidates.find_one({
        "_id": candidate_id
    })

    return _serialize(document)


# ============================================================
# GET JOB
# ============================================================

def get_job(
    job_id: str
):

    document = jobs.find_one({
        "_id": job_id
    })

    return _serialize(document)


# ============================================================
# GET PANEL
# ============================================================

def get_panel(
    panel_id: str
):

    document = panels.find_one({
        "_id": panel_id
    })

    return _serialize(document)


# ============================================================
# GET INTERVIEW
# ============================================================

def get_interview(
    interview_id: str
):

    document = interviews.find_one({
        "_id": interview_id
    })

    return _serialize(document)


# ============================================================
# GET CURRENT INTERVIEW STATE
# ============================================================

def get_interview_state(
    interview_id: str
):

    document = interviews.find_one(
        {
            "_id": interview_id
        },
        {
            "_id": 1,
            "candidate_id": 1,
            "job_id": 1,
            "panel_id": 1,
            "status": 1,
            "current_stage": 1,
            "current_panel_member": 1,
            "current_question_id": 1,
            "question_number": 1,
            "state": 1
        }
    )

    return _serialize(document)


# ============================================================
# CREATE / INITIALIZE INTERVIEW
# ============================================================

def create_interview(
    interview_id: str,
    candidate_id: str,
    job_id: str,
    panel_id: str
):

    document = {
        "_id": interview_id,

        "candidate_id": candidate_id,
        "job_id": job_id,
        "panel_id": panel_id,

        "status": "not_started",

        "current_stage": None,
        "current_panel_member": None,
        "current_question_id": None,

        "question_number": 0,

        "state": {
            "questions_asked": 0,
            "questions_answered": 0,
            "topics_covered": [],
            "topics_to_probe": [],
            "followups_asked": 0
        },

        "created_at": _now(),
        "updated_at": _now()
    }

    interviews.replace_one(
        {"_id": interview_id},
        document,
        upsert=True
    )

    return {
        "success": True,
        "interview_id": interview_id
    }


# ============================================================
# UPDATE INTERVIEW STATE
# ============================================================

def update_interview_state(
    interview_id: str,
    status=None,
    current_stage=None,
    current_panel_member=None,
    current_question_id=None,
    question_number=None,
    state_updates=None
):

    updates = {
        "updated_at": _now()
    }

    if status is not None:
        updates["status"] = status

    if current_stage is not None:
        updates["current_stage"] = current_stage

    if current_panel_member is not None:
        updates[
            "current_panel_member"
        ] = current_panel_member

    if current_question_id is not None:
        updates[
            "current_question_id"
        ] = current_question_id

    if question_number is not None:
        updates[
            "question_number"
        ] = question_number

    if state_updates:

        for key, value in state_updates.items():

            updates[
                f"state.{key}"
            ] = value

    result = interviews.update_one(
        {
            "_id": interview_id
        },
        {
            "$set": updates
        }
    )

    return {
        "success": True,
        "matched": result.matched_count,
        "modified": result.modified_count
    }


# ============================================================
# SAVE QUESTION
# ============================================================

def save_question(
    question_id: str,
    interview_id: str,
    panel_id: str,
    question: str,
    stage: str,
    evaluation_focus: list,
    question_type: str = "primary",
    parent_question_id=None,
    sequence=None
):

    document = {
        "_id": question_id,

        "interview_id": interview_id,
        "panel_id": panel_id,

        "question": question,

        "stage": stage,

        "evaluation_focus":
            evaluation_focus,

        "question_type":
            question_type,

        "parent_question_id":
            parent_question_id,

        "follow_up":
            parent_question_id is not None,

        "sequence":
            sequence,

        "asked_at": _now(),

        "status": "asked"
    }

    questions.replace_one(
        {"_id": question_id},
        document,
        upsert=True
    )

    return {
        "success": True,
        "question_id": question_id
    }


# ============================================================
# GET PREVIOUS QUESTIONS
# ============================================================

def get_previous_questions(
    interview_id: str,
    limit: int = 20
):

    cursor = (
        questions
        .find({
            "interview_id":
                interview_id
        })
        .sort(
            "sequence",
            1
        )
        .limit(limit)
    )

    return [
        _serialize(document)
        for document in cursor
    ]


# ============================================================
# SAVE ANSWER
# ============================================================

def save_answer(
    answer_id: str,
    interview_id: str,
    question_id: str,
    candidate_id: str,
    panel_id: str,
    transcript: str,
    duration_seconds=None
):

    document = {
        "_id": answer_id,

        "interview_id": interview_id,
        "question_id": question_id,
        "candidate_id": candidate_id,
        "panel_id": panel_id,

        "transcript": transcript,

        "duration_seconds":
            duration_seconds,

        "created_at": _now()
    }

    answers.replace_one(
        {"_id": answer_id},
        document,
        upsert=True
    )

    return {
        "success": True,
        "answer_id": answer_id
    }


# ============================================================
# GET PREVIOUS ANSWERS
# ============================================================

def get_previous_answers(
    interview_id: str,
    limit: int = 20
):

    cursor = (
        answers
        .find({
            "interview_id":
                interview_id
        })
        .sort(
            "created_at",
            1
        )
        .limit(limit)
    )

    return [
        _serialize(document)
        for document in cursor
    ]


# ============================================================
# SAVE ANSWER EVALUATION
# ============================================================

def save_answer_evaluation(
    answer_id: str,
    evaluation: dict
):

    result = answers.update_one(
        {
            "_id": answer_id
        },
        {
            "$set": {
                "evaluation":
                    evaluation,

                "evaluated_at":
                    _now()
            }
        }
    )

    return {
        "success": True,
        "matched": result.matched_count,
        "modified": result.modified_count
    }


# ============================================================
# SAVE EVENT
# ============================================================

def save_interview_event(
    interview_id: str,
    event_type: str,
    data=None
):

    document = {
        "interview_id":
            interview_id,

        "timestamp":
            _now(),

        "type":
            event_type,

        "data":
            data or {}
    }

    result = events.insert_one(
        document
    )

    return {
        "success": True,
        "event_id":
            str(result.inserted_id)
    }


# ============================================================
# SAVE FINAL EVALUATION
# ============================================================

def save_final_evaluation(
    interview_id: str,
    evaluation: dict
):

    document = {
        "interview_id":
            interview_id,

        **evaluation,

        "created_at":
            _now()
    }

    evaluations.update_one(
        {
            "interview_id":
                interview_id
        },
        {
            "$set":
                document
        },
        upsert=True
    )

    return {
        "success": True,
        "interview_id":
            interview_id
    }


# ============================================================
# DATABASE HEALTH
# ============================================================

def mongo_health_check():

    try:

        _client.admin.command(
            "ping"
        )

        return {
            "connected": True,
            "database":
                MONGODB_DATABASE
        }

    except Exception as e:

        return {
            "connected": False,
            "error": str(e)
        }