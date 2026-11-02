import hashlib
import json, sqlite3
import threading
from pathlib import Path
from .config import settings

_SCHEMA_READY = False
_SCHEMA_LOCK = threading.Lock()
_SCHEMA = """
    CREATE TABLE IF NOT EXISTS candidates(id TEXT PRIMARY KEY, github_id TEXT, login TEXT, access_token TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS oauth_states(state TEXT PRIMARY KEY, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS interview_sessions(interview_id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL, github_id TEXT, github_login TEXT, repository TEXT NOT NULL, assessment_id TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(candidate_id) REFERENCES candidates(id), FOREIGN KEY(assessment_id) REFERENCES assessments(id));
    CREATE TABLE IF NOT EXISTS assessments(id TEXT PRIMARY KEY, candidate_id TEXT NOT NULL, repo TEXT NOT NULL, branch TEXT, commit_sha TEXT, claims TEXT, status TEXT, progress TEXT, workspace TEXT, knowledge TEXT, challenge_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(candidate_id) REFERENCES candidates(id));
    CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY, assessment_id TEXT, secret TEXT, public_json TEXT, FOREIGN KEY(assessment_id) REFERENCES assessments(id));
    CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY, assessment_id TEXT, diff TEXT, result TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE INDEX IF NOT EXISTS idx_assessments_candidate ON assessments(candidate_id, created_at);
"""


def _scrub_local_code_copies(db):
    """Retain local result metadata without persisting repository source text."""
    for row in db.execute("SELECT id, secret FROM challenges").fetchall():
        try:
            secret = json.loads(row[1] or "{}")
        except (TypeError, json.JSONDecodeError):
            continue
        if "original_source" in secret or "baseline_files" in secret:
            secret.pop("original_source", None)
            secret.pop("baseline_files", None)
            db.execute("UPDATE challenges SET secret=? WHERE id=?", (json.dumps(secret, ensure_ascii=False), row[0]))
    for row in db.execute("SELECT id, diff FROM submissions").fetchall():
        try:
            diff = json.loads(row[1] or "{}")
        except (TypeError, json.JSONDecodeError):
            continue
        if isinstance(diff, dict) and any(isinstance(value, str) for value in diff.values()):
            hashes = {key: hashlib.sha256(value.encode("utf-8")).hexdigest() for key, value in diff.items() if isinstance(value, str)}
            db.execute("UPDATE submissions SET diff=? WHERE id=?", (json.dumps({"source_sha256": hashes}, ensure_ascii=False), row[0]))
    db.execute("UPDATE assessments SET workspace=NULL WHERE workspace IS NOT NULL AND workspace NOT LIKE 'daytona://momentum/%'")


def initialize():
    """Create the SQLite schema once per process, not on every HTTP request."""
    global _SCHEMA_READY
    if _SCHEMA_READY:
        return
    with _SCHEMA_LOCK:
        if _SCHEMA_READY:
            return
        p = Path(settings.database_path)
        p.parent.mkdir(parents=True, exist_ok=True)
        db = sqlite3.connect(p, timeout=10)
        try:
            db.execute("PRAGMA journal_mode=WAL")
            db.executescript(_SCHEMA)
            # Older local builds saved the fixed module and the complete
            # candidate-edited file in SQLite. Keep only hashes/assessment
            # metadata here; source copies belong in the remote Daytona sandbox and the
            # existing Mongo knowledge/submission collections.
            _scrub_local_code_copies(db)
            db.commit()
        finally:
            db.close()
        _SCHEMA_READY = True


def connect():
    initialize()
    p = Path(settings.database_path)
    db = sqlite3.connect(p, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA busy_timeout=10000")
    return db

def rowdict(row): return dict(row) if row else None
def json_dump(value): return json.dumps(value, ensure_ascii=False)


