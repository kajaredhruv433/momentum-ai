"""MongoDB storage for commit-scoped repository knowledge and assessment data."""
from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache

from pymongo import AsyncMongoClient, ASCENDING, DESCENDING

from .config import settings


@lru_cache(maxsize=1)
def client() -> AsyncMongoClient:
    return AsyncMongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000, appname="MomentumAssessment")


def database():
    return client()[settings.mongodb_database]


async def initialize() -> None:
    db = database()
    await client().admin.command("ping")
    specs = {
        "candidates": [([("candidate_id", ASCENDING)], {"unique": True}), ([("github_id", ASCENDING)], {})],
        "oauth_states": [([("expires_at", ASCENDING)], {"expireAfterSeconds": 0})],
        "assessments": [([("candidate_id", ASCENDING), ("created_at", DESCENDING)], {}), ([("repo_id", ASCENDING), ("commit_sha", ASCENDING)], {})],
        "assessment_workspace_files": [([("assessment_id", ASCENDING), ("path", ASCENDING)], {"unique": True}), ([ ("candidate_id", ASCENDING), ("assessment_id", ASCENDING)], {})],
        "submissions": [([("assessment_id", ASCENDING), ("created_at", DESCENDING)], {})],
        "challenges": [([("assessment_id", ASCENDING)], {})],
        "repository_challenge_guidance": [([("assessment_id", ASCENDING)], {"unique": True}), ([ ("repo_id", ASCENDING), ("commit_sha", ASCENDING)], {})],
        "repositories": [([("repo_id", ASCENDING), ("commit_sha", ASCENDING)], {"unique": True})],
        "repository_analysis_jobs": [([("repo_id", ASCENDING), ("commit_sha", ASCENDING), ("updated_at", DESCENDING)], {})],
        "repository_files": [([("repo_id", ASCENDING), ("commit_sha", ASCENDING), ("path", ASCENDING)], {"unique": True})],
        "repository_modules": [([("repo_id", ASCENDING), ("commit_sha", ASCENDING), ("path", ASCENDING)], {"unique": True})],
        "repository_symbols": [([("repo_id", ASCENDING), ("commit_sha", ASCENDING), ("path", ASCENDING)], {}), ([("repo_id", ASCENDING), ("commit_sha", ASCENDING), ("name", ASCENDING)], {})],
        "repository_knowledge_sources": [([("repo_id", ASCENDING), ("commit_sha", ASCENDING), ("chunk_id", ASCENDING)], {"unique": True}), ([("repo_id", ASCENDING), ("commit_sha", ASCENDING), ("path", ASCENDING), ("symbol", ASCENDING)], {})],
        "candidate_submissions": [([("candidate_id", ASCENDING), ("assessment_id", ASCENDING), ("created_at", DESCENDING)], {})],
        "execution_results": [([("assessment_id", ASCENDING), ("candidate_id", ASCENDING), ("created_at", DESCENDING)], {})],
        "assessment_results": [([("candidate_id", ASCENDING), ("assessment_id", ASCENDING)], {"unique": True})],
    }
    for collection_name, indexes in specs.items():
        for keys, options in indexes:
            await db[collection_name].create_index(keys, **options)
    # Older builds created a text index that interpreted the source-language
    # field (for example "py") as a MongoDB text-index language override.
    # Retrieval now ranks stored local vectors, so remove that unused index.
    knowledge_indexes = await db.repository_knowledge_sources.index_information()
    if "repository_knowledge_text" in knowledge_indexes:
        await db.repository_knowledge_sources.drop_index("repository_knowledge_text")
    # Create these protected collections up front; candidate RAG never queries them.
    existing = set(await db.list_collection_names())
    for collection_name in ("candidates", "oauth_states", "assessments", "assessment_workspace_files", "repositories", "repository_analysis_jobs", "repository_files", "repository_modules", "repository_symbols", "repository_knowledge_sources", "repository_challenge_guidance", "challenges", "submissions", "candidate_submissions", "execution_results", "assessment_results", "migration_state"):
        if collection_name not in existing:
            await db.create_collection(collection_name)
    # One-time cleanup of the old placeholder feature-hash index. Keep unrelated
    # assessment, candidate, and execution collections untouched.
    migration_id = "clear_legacy_repository_feature_hash_knowledge_v1"
    if not await db.migration_state.find_one({"_id": migration_id}, {"_id": 1}):
        for collection_name in ("repositories", "repository_analysis_jobs", "repository_files", "repository_modules", "repository_symbols", "repository_knowledge_sources"):
            await db[collection_name].delete_many({})
        await db.migration_state.insert_one({"_id": migration_id, "completed_at": datetime.now(timezone.utc), "reason": "Reset legacy repository knowledge before using MongoDB-only local vectors"})


async def close() -> None:
    if client.cache_info().currsize:
        await client().close()
        client.cache_clear()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)
