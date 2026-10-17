"""LangChain/LangGraph orchestration for semantic job discovery."""

from __future__ import annotations

import asyncio
import os
import uuid
from pathlib import Path
from typing import Any, TypedDict

from dotenv import load_dotenv
from langchain_core.runnables import RunnableLambda
from langgraph.graph import END, START, StateGraph
from qdrant_client import QdrantClient, models

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
QDRANT_COLLECTION = os.getenv("QDRANT_JOBS_COLLECTION", "jobs")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
VECTOR_SIZE = int(os.getenv("QDRANT_VECTOR_SIZE", "384"))
_client: QdrantClient | None = None


def _get_client() -> QdrantClient:
    global _client
    if not QDRANT_URL or not QDRANT_API_KEY:
        raise RuntimeError("QDRANT_URL and QDRANT_API_KEY must be configured")
    if _client is None:
        _client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY,
                               cloud_inference=True, timeout=15,
                               check_compatibility=False)
    return _client


def qdrant_error_summary(exc: Exception) -> str:
    """Expose the useful network/API cause without logging credentials or endpoint URLs."""
    cause = exc
    while cause.__cause__ is not None:
        cause = cause.__cause__
    detail = str(cause)
    if QDRANT_API_KEY:
        detail = detail.replace(QDRANT_API_KEY, "[redacted]")
    if QDRANT_URL:
        detail = detail.replace(QDRANT_URL, "[QDRANT_URL]")
    return f"{type(exc).__name__}: {detail or type(cause).__name__}"


def job_search_text(job: dict[str, Any]) -> str:
    skills = job.get("skillsRequired") or []
    if isinstance(skills, str):
        skills = [part.strip() for part in skills.split(",") if part.strip()]
    return "\n".join(str(value) for value in (
        f"Title: {job.get('title', '')}", f"Role: {job.get('roleRequired', '')}",
        f"Description: {job.get('description', '')}", f"Skills: {', '.join(map(str, skills))}",
        f"Experience: {job.get('experience', '')}", f"Qualification: {job.get('qualification', '')}",
        f"Employee qualities: {job.get('employeeQualities', '')}",
        f"Location: {job.get('location', '')}", f"Employment type: {job.get('type', '')}",
    ) if value)


def _ensure_collection(client: QdrantClient) -> None:
    if not client.collection_exists(QDRANT_COLLECTION):
        client.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=models.VectorParams(size=VECTOR_SIZE, distance=models.Distance.COSINE),
        )


def _upsert_job_sync(job: dict[str, Any], mongo_id: str) -> None:
    client = _get_client()
    _ensure_collection(client)
    text = job_search_text(job)
    if not text.strip():
        return
    point_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"momentum-job:{mongo_id}"))
    client.upsert(collection_name=QDRANT_COLLECTION, points=[models.PointStruct(
        id=point_id,
        vector=models.Document(text=text, model=EMBEDDING_MODEL),
        payload={"mongo_id": mongo_id, "type": "job", "text": text},
    )])


async def index_job(job: dict[str, Any], mongo_id: str) -> None:
    await asyncio.to_thread(_upsert_job_sync, job, mongo_id)


class SearchState(TypedDict, total=False):
    query: str
    limit: int
    matches: list[dict[str, Any]]


def _search_sync(query: str, limit: int) -> list[dict[str, Any]]:
    client = _get_client()
    if not client.collection_exists(QDRANT_COLLECTION):
        return []
    response = client.query_points(
        collection_name=QDRANT_COLLECTION,
        query=models.Document(text=query, model=EMBEDDING_MODEL),
        query_filter=models.Filter(must=[models.FieldCondition(
            key="type", match=models.MatchValue(value="job"))]),
        with_payload=True, limit=max(1, min(limit, 50)),
    )
    return [{"mongo_id": str(point.payload.get("mongo_id", "")),
             "score": float(point.score), "payload": point.payload or {}}
            for point in response.points if point.payload and point.payload.get("mongo_id")]


async def _retrieve(state: SearchState) -> SearchState:
    # RunnableLambda keeps the Qdrant retrieval step in the LangChain pipeline;
    # LangGraph controls the search workflow and returns its state to the API.
    retriever = RunnableLambda(lambda values: _search_sync(values["query"], values["limit"]))
    matches = await asyncio.to_thread(retriever.invoke, {
        "query": state["query"], "limit": state.get("limit", 20)})
    return {"matches": matches}


_workflow = StateGraph(SearchState)
_workflow.add_node("retrieve_jobs", _retrieve)
_workflow.add_edge(START, "retrieve_jobs")
_workflow.add_edge("retrieve_jobs", END)
job_search_graph = _workflow.compile()


async def search_jobs(query: str, limit: int = 20) -> list[dict[str, Any]]:
    result = await job_search_graph.ainvoke({"query": query, "limit": limit})
    return result.get("matches", [])
