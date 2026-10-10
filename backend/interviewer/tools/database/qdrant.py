# tools/database/qdrant.py

from typing import Any, Dict, List, Optional
import uuid

from qdrant_client import QdrantClient, models

from .config import (
    QDRANT_URL,
    QDRANT_API_KEY,
    QDRANT_EMBEDDING_MODEL,
    QDRANT_COLLECTION_RESUME,
    QDRANT_COLLECTION_QUESTIONS,
    QDRANT_COLLECTION_KNOWLEDGE,
)


# =========================================================
# QDRANT CLIENT
# =========================================================

client = QdrantClient(
    url=QDRANT_URL,
    api_key=QDRANT_API_KEY,
    cloud_inference=True,
    timeout=10,
    check_compatibility=False,
)


# =========================================================
# INTERNAL HELPERS
# =========================================================

def _make_id(value: Optional[str] = None) -> str:
    """
    Generate a Qdrant point ID.

    If value is provided, use it as a stable UUID when possible.
    Otherwise generate a random UUID.
    """

    if value:
        try:
            return str(uuid.UUID(value))
        except ValueError:
            return str(uuid.uuid5(
                uuid.NAMESPACE_URL,
                value
            ))

    return str(uuid.uuid4())


def _search(
    collection_name: str,
    query: str,
    limit: int = 5,
    query_filter: Optional[models.Filter] = None,
) -> List[Dict[str, Any]]:
    """
    Generic semantic search using Qdrant Cloud Inference.
    """

    if not query or not query.strip():
        return []

    limit = max(1, min(limit, 20))

    response = client.query_points(
        collection_name=collection_name,

        query=models.Document(
            text=query,
            model=QDRANT_EMBEDDING_MODEL,
        ),

        with_payload=True,

        query_filter=query_filter,

        limit=limit,
    )

    results = []

    for point in response.points:
        results.append({
            "id": point.id,
            "score": point.score,
            "payload": point.payload or {},
        })

    return results


# =========================================================
# RESUME
# =========================================================

def store_resume_chunk(
    point_id: Optional[str],
    candidate_id: str,
    text: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Store one resume chunk.

    Qdrant Cloud generates the embedding.
    """

    if not candidate_id:
        raise ValueError("candidate_id is required")

    if not text or not text.strip():
        raise ValueError("text is required")

    final_id = _make_id(point_id)

    payload = {
        "candidate_id": candidate_id,
        "text": text,
        "type": "resume_chunk",
    }

    if metadata:
        payload.update(metadata)

    client.upsert(
        collection_name=QDRANT_COLLECTION_RESUME,
        points=[
            models.PointStruct(
                id=final_id,

                vector=models.Document(
                    text=text,
                    model=QDRANT_EMBEDDING_MODEL,
                ),

                payload=payload,
            )
        ],
    )

    return final_id


def search_candidate_resume(
    candidate_id: str,
    query: str,
    limit: int = 5,
) -> List[Dict[str, Any]]:
    """
    Semantically search a candidate's resume.
    """

    if not candidate_id:
        raise ValueError("candidate_id is required")

    query_filter = models.Filter(
        must=[
            models.FieldCondition(
                key="candidate_id",
                match=models.MatchValue(
                    value=candidate_id
                ),
            )
        ]
    )

    return _search(
        collection_name=QDRANT_COLLECTION_RESUME,
        query=query,
        limit=limit,
        query_filter=query_filter,
    )


# =========================================================
# INTERVIEW QUESTIONS
# =========================================================

def store_interview_question(
    point_id: Optional[str],
    question: str,
    role: Optional[str] = None,
    topic: Optional[str] = None,
    difficulty: Optional[str] = None,
    stage: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Store an interview question in Qdrant.
    """

    if not question or not question.strip():
        raise ValueError("question is required")

    final_id = _make_id(point_id)

    payload = {
        "question": question,
        "type": "interview_question",
    }

    if role:
        payload["role"] = role

    if topic:
        payload["topic"] = topic

    if difficulty:
        payload["difficulty"] = difficulty

    if stage:
        payload["stage"] = stage

    if metadata:
        payload.update(metadata)

    client.upsert(
        collection_name=QDRANT_COLLECTION_QUESTIONS,
        points=[
            models.PointStruct(
                id=final_id,

                vector=models.Document(
                    text=question,
                    model=QDRANT_EMBEDDING_MODEL,
                ),

                payload=payload,
            )
        ],
    )

    return final_id


def search_similar_questions(
    query: str,
    limit: int = 5,
    difficulty: Optional[str] = None,
    role: Optional[str] = None,
    topic: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Find semantically similar interview questions.
    """

    conditions = []

    if difficulty:
        conditions.append(
            models.FieldCondition(
                key="difficulty",
                match=models.MatchValue(
                    value=difficulty
                ),
            )
        )

    if role:
        conditions.append(
            models.FieldCondition(
                key="role",
                match=models.MatchValue(
                    value=role
                ),
            )
        )

    if topic:
        conditions.append(
            models.FieldCondition(
                key="topic",
                match=models.MatchValue(
                    value=topic
                ),
            )
        )

    query_filter = None

    if conditions:
        query_filter = models.Filter(
            must=conditions
        )

    return _search(
        collection_name=QDRANT_COLLECTION_QUESTIONS,
        query=query,
        limit=limit,
        query_filter=query_filter,
    )


# =========================================================
# INTERVIEW KNOWLEDGE
# =========================================================

def store_interview_knowledge(
    point_id: Optional[str],
    text: str,
    topic: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Store interview-related knowledge.
    """

    if not text or not text.strip():
        raise ValueError("text is required")

    final_id = _make_id(point_id)

    payload = {
        "text": text,
        "type": "interview_knowledge",
    }

    if topic:
        payload["topic"] = topic

    if metadata:
        payload.update(metadata)

    client.upsert(
        collection_name=QDRANT_COLLECTION_KNOWLEDGE,
        points=[
            models.PointStruct(
                id=final_id,

                vector=models.Document(
                    text=text,
                    model=QDRANT_EMBEDDING_MODEL,
                ),

                payload=payload,
            )
        ],
    )

    return final_id


def search_interview_knowledge(
    query: str,
    limit: int = 5,
    topic: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Search general interview knowledge.
    """

    query_filter = None

    if topic:
        query_filter = models.Filter(
            must=[
                models.FieldCondition(
                    key="topic",
                    match=models.MatchValue(
                        value=topic
                    ),
                )
            ]
        )

    return _search(
        collection_name=QDRANT_COLLECTION_KNOWLEDGE,
        query=query,
        limit=limit,
        query_filter=query_filter,
    )


# =========================================================
# HEALTH CHECK
# =========================================================

def qdrant_health_check() -> Dict[str, Any]:
    """
    Verify Qdrant connection and collections.
    """
    try:
        collections = client.get_collections()
    except Exception as exc:
        return {
            "connected": False,
            "error": str(exc),
            "required_collections": [
                QDRANT_COLLECTION_RESUME,
                QDRANT_COLLECTION_QUESTIONS,
                QDRANT_COLLECTION_KNOWLEDGE,
            ],
        }

    names = [
        collection.name
        for collection in collections.collections
    ]

    required = [
        QDRANT_COLLECTION_RESUME,
        QDRANT_COLLECTION_QUESTIONS,
        QDRANT_COLLECTION_KNOWLEDGE,
    ]

    return {
        "connected": True,
        "collections": names,
        "required_collections": required,
        "all_required_collections_exist": all(
            name in names
            for name in required
        ),
    }
