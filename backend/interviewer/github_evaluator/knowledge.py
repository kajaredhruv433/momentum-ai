"""Local repository chunking and commit-scoped vector retrieval."""
from __future__ import annotations

import asyncio
import ast
import hashlib
import math
import re
from typing import TypedDict
from pathlib import Path

from langgraph.graph import END, StateGraph
from .config import settings
from .mongo_store import database, initialize, utcnow

MAX_CHUNK_CHARS = 6000
MAX_EMBEDDING_BATCH_ITEMS = 128
MAX_EMBEDDING_BATCH_CHARS = 80000
TOKEN_RE = re.compile(r"[A-Za-z_$][\w$.-]{1,80}")
MODULE_LIMIT = 3
SYMBOL_LIMIT = 5
SECRET_PATTERNS = [
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{25,}\b"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bAIza[0-9A-Za-z_-]{30,}\b"),
    re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b"),
    re.compile(r"\bglpat-[A-Za-z0-9_-]{20,}\b"),
    re.compile(r"(?i)(?:api[_-]?key|secret|password|token)\s*[:=]\s*['\"]?(?!your_|replace_|example|changeme)[A-Za-z0-9_./+-]{20,}"),
]


SKIP_DIRS = {".git", "node_modules", "vendor", "dist", "build", "coverage", ".venv", "__pycache__", ".next"}
SKIP_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".pdf", ".zip", ".woff", ".woff2", ".lock", ".pyc", ".sqlite", ".db"}
SKIP_NAMES = {".env", "id_rsa", "id_ed25519", "credentials.json", "service-account.json"}


def repository_id(full_name: str, session_id: str | None = None) -> str:
    """Scope repository knowledge to an interview so candidate sessions never share stored source data."""
    material = full_name.lower() + (":" + session_id if session_id else "")
    return hashlib.sha256(material.encode()).hexdigest()


def _safe_source(path: str, body: str) -> bool:
    name = Path(path.lower()).name
    if name in SKIP_NAMES or name.startswith(".env") or Path(name).suffix in SKIP_SUFFIXES:
        return False
    if any(part.lower() in SKIP_DIRS for part in Path(path).parts):
        return False
    return not any(pattern.search(body) for pattern in SECRET_PATTERNS)


def _line_chunks(path: str, text: str, start_line: int = 1, symbol: str = "", kind: str = "text") -> list[dict]:
    lines = text.splitlines()
    chunks, current, first, size = [], [], start_line, 0
    for index, original in enumerate(lines):
        segments = [original[offset:offset + MAX_CHUNK_CHARS] for offset in range(0, max(1, len(original)), MAX_CHUNK_CHARS)]
        for segment in segments:
            addition = len(segment) + (1 if current else 0)
            if current and size + addition > MAX_CHUNK_CHARS:
                chunks.append({"path": path, "symbol": symbol, "kind": kind, "start_line": first, "end_line": start_line + index, "content": "\n".join(current)})
                current, first, size = [], start_line + index, 0
            current.append(segment)
            size += len(segment) + (1 if len(current) > 1 else 0)
            if len(segment) >= MAX_CHUNK_CHARS:
                chunks.append({"path": path, "symbol": symbol, "kind": kind, "start_line": first, "end_line": start_line + index, "content": "\n".join(current)})
                current, first, size = [], start_line + index, 0
    if current:
        chunks.append({"path": path, "symbol": symbol, "kind": kind, "start_line": first, "end_line": start_line + len(lines) - 1, "content": "\n".join(current)})
    return chunks


def chunk_file(path: str, text: str) -> tuple[dict, list[dict], list[dict]]:
    ext = Path(path).suffix.lower()
    imports = re.findall(r"(?m)^\s*(?:import\s+.*?\s+from\s+['\"]([^'\"]+)|from\s+['\"]([^'\"]+)['\"]|require\(['\"]([^'\"]+))", text)
    imports = [next((x for x in row if x), "") for row in imports][:100]
    symbols, chunks = [], []
    if ext == ".py":
        try:
            tree = ast.parse(text, filename=path)
            lines = text.splitlines()
            for node in ast.walk(tree):
                if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    continue
                start, end = node.lineno, getattr(node, "end_lineno", node.lineno)
                name = node.name
                calls = sorted({n.func.id if isinstance(n.func, ast.Name) else n.func.attr for n in ast.walk(node) if isinstance(n, ast.Call)})[:60]
                kind = "class" if isinstance(node, ast.ClassDef) else "function"
                arguments = [arg.arg for arg in node.args.args] if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) else []
                signature = f"{name}({', '.join(arguments)})" if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) else name
                docstring = (ast.get_docstring(node) or "")[:500]
                summary = docstring or f"{kind.title()} {signature}. " + (f"Uses {', '.join(calls[:6])}." if calls else "")
                symbols.append({"name": name, "kind": kind, "signature": signature, "summary": summary[:700], "docstring": docstring, "start_line": start, "end_line": end, "imports": imports, "calls": calls})
                chunks.extend(_line_chunks(path, "\n".join(lines[start - 1:end]), start, name, "symbol"))
        except SyntaxError as exc:
            symbols.append({"name": "<parse-error>", "kind": "warning", "start_line": exc.lineno or 1, "end_line": exc.lineno or 1, "warning": exc.msg, "imports": imports, "calls": []})
    else:
        lines = text.splitlines()
        if ext in {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".go", ".rs", ".java", ".cs", ".php"}:
            for index, line in enumerate(lines, 1):
                match = re.match(r"\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|def|fn|func|interface|type|const|let|var)\s+([\w$]+)", line)
                if match:
                    name = match.group(1)
                    depth = 0
                    end = index
                    for cursor in range(index - 1, len(lines)):
                        depth += lines[cursor].count("{") - lines[cursor].count("}")
                        end = cursor + 1
                        if cursor >= index - 1 and depth <= 0 and ("{" in line or end == index):
                            break
                    source = "\n".join(lines[index - 1:end])
                    calls = sorted(set(re.findall(r"\b([A-Za-z_$][\w$]*)\s*\(", source)) - {name})[:40]
                    symbols.append({"name": name, "kind": "declaration", "signature": name, "summary": f"Declaration {name} in module {path}. " + (f"Calls {', '.join(calls[:6])}." if calls else ""), "docstring": "", "start_line": index, "end_line": end, "imports": imports, "calls": calls})
                    chunks.extend(_line_chunks(path, source, index, name, "symbol"))
        if not chunks:
            chunks = _line_chunks(path, text)
    if not chunks:
        chunks = _line_chunks(path, text)
    file_doc = {"path": path, "bytes": len(text.encode("utf-8")), "language": ext.lstrip(".") or "text", "imports": imports, "symbol_count": len(symbols)}
    return file_doc, symbols, chunks


def _embedding_batches(chunks: list[dict]) -> list[list[dict]]:
    batches, current, chars = [], [], 0
    for chunk in chunks:
        size = len(chunk["content"])
        if current and (len(current) >= MAX_EMBEDDING_BATCH_ITEMS or chars + size > MAX_EMBEDDING_BATCH_CHARS):
            batches.append(current)
            current, chars = [], 0
        current.append(chunk)
        chars += size
    if current:
        batches.append(current)
    return batches


def local_embedding(text: str, dimensions: int | None = None) -> list[float]:
    """Create a repeatable normalized vector without a paid or remote embedding API."""
    dimensions = dimensions or settings.embedding_dimensions
    if dimensions < 1:
        raise ValueError("Vector dimensions must be positive")

    words = TOKEN_RE.findall(text[:MAX_CHUNK_CHARS])
    expanded: list[str] = []
    for word in words:
        expanded.append(word.lower())
        # Make identifiers such as parseUserRecord searchable by their parts.
        expanded.extend(part.lower() for part in re.findall(r"[A-Z]?[a-z]+|[A-Z]+(?=[A-Z][a-z]|$)|\d+", word))
    expanded.extend(f"{left.lower()}_{right.lower()}" for left, right in zip(words, words[1:]))

    vector = [0.0] * dimensions
    for token in expanded:
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
        index = int.from_bytes(digest[:4], "little") % dimensions
        sign = 1.0 if digest[4] & 1 else -1.0
        vector[index] += sign
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        vector[0] = 1.0
        return vector
    return [value / norm for value in vector]


async def embed_documents(texts: list[str]) -> list[list[float]]:
    return await asyncio.to_thread(lambda: [local_embedding(text) for text in texts])


async def embed_query(text: str) -> list[float]:
    return await asyncio.to_thread(local_embedding, text)


def _module_summary(path: str, body: str, file_doc: dict, symbols: list[dict]) -> str:
    description = ""
    try:
        if path.lower().endswith(".py"):
            description = (ast.get_docstring(ast.parse(body, filename=path)) or "").strip()
    except SyntaxError:
        pass
    if not description:
        header = [line.strip(" #/*\t") for line in body.splitlines()[:5] if line.strip().startswith(("#", "//", "/*", "*"))]
        description = " ".join(header)[:300]
    names = ", ".join(symbol["name"] for symbol in symbols[:12]) or "no recognized declarations"
    imports = ", ".join(file_doc.get("imports", [])[:8]) or "no direct imports"
    overview = description or f"Module {path} contains {names}; it imports {imports}."
    return f"{overview[:500]} Declarations: {names}. Imports: {imports}."


def _prepare_index_payload(files: dict[str, str], repo_id: str, commit: str) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    """Parse repository source and build vectors without blocking the ASGI loop."""
    key = {"repo_id": repo_id, "commit_sha": commit}
    file_docs, module_docs, symbol_docs, chunk_docs = [], [], [], []
    for path, body in files.items():
        if not _safe_source(path, body):
            continue
        file_doc, symbols, chunks = chunk_file(path, body)
        file_id = hashlib.sha256(f"{repo_id}:{commit}:{path}".encode()).hexdigest()
        file_docs.append({"_id": file_id, **key, **file_doc})
        module_summary = _module_summary(path, body, file_doc, symbols)
        module_docs.append({"_id": file_id, **key, "path": path, "language": file_doc["language"], "summary": module_summary, "imports": file_doc["imports"], "symbol_names": [item["name"] for item in symbols[:100]], "symbol_count": len(symbols)})
        symbol_by_name = {item["name"]: item for item in symbols}
        for symbol in symbols:
            symbol_id = hashlib.sha256(f"{repo_id}:{commit}:{path}:{symbol['name']}:{symbol['start_line']}".encode()).hexdigest()
            symbol_docs.append({"_id": symbol_id, **key, "path": path, **symbol})
        for chunk in chunks:
            content_hash = hashlib.sha256(chunk["content"].encode()).hexdigest()
            chunk_id = hashlib.sha256(f"{repo_id}:{commit}:{path}:{chunk['start_line']}:{chunk['end_line']}:{chunk['symbol']}:{content_hash}".encode()).hexdigest()
            symbol_meta = symbol_by_name.get(chunk["symbol"], {})
            chunk_docs.append({"_id": chunk_id, "chunk_id": chunk_id, **key, "language": file_doc["language"], "function_summary": symbol_meta.get("summary", "Module-level source detail."), **chunk})
            if len(chunk_docs) > settings.max_knowledge_chunks:
                raise ValueError(f"Repository exceeds the configured {settings.max_knowledge_chunks} knowledge-chunk limit")
    if not file_docs or not chunk_docs:
        raise ValueError("Repository snapshot contains no eligible source or documentation chunks")

    def attach_vectors(documents: list[dict], texts: list[str]) -> None:
        for document, text in zip(documents, texts):
            document["embedding"] = local_embedding(text)
            document["vectorizer"] = settings.vectorizer_name
            document["vector_dimensions"] = settings.embedding_dimensions

    attach_vectors(module_docs, [f"Module: {x['path']}\n{x['summary']}\nSymbols: {' '.join(x['symbol_names'])}" for x in module_docs])
    attach_vectors(symbol_docs, [f"Module: {x['path']}\n{x.get('kind', '')}: {x['name']}\n{x.get('signature', '')}\n{x.get('summary', '')}\nCalls: {' '.join(x.get('calls', []))}" for x in symbol_docs])
    for chunk in chunk_docs:
        chunk["embedding"] = local_embedding(f"File: {chunk['path']}\nSymbol: {chunk.get('symbol', '')}\n{chunk['content']}")
        chunk["vectorizer"] = settings.vectorizer_name
        chunk["vector_dimensions"] = settings.embedding_dimensions
    return file_docs, module_docs, symbol_docs, chunk_docs


async def index_repository(state: dict) -> dict:
    db = database()
    await initialize()
    repo_id, commit = repository_id(state["repo"], state.get("assessment_id")), state["sha"]
    key = {"repo_id": repo_id, "commit_sha": commit}
    jobs, now = db.repository_analysis_jobs, utcnow()
    await jobs.update_one(key, {"$set": {**key, "assessment_id": state["assessment_id"], "status": "indexing", "progress": "Building and embedding repository snapshot", "updated_at": now}, "$setOnInsert": {"created_at": now, "attempts": 0, "vector_ids": []}}, upsert=True)
    try:
        file_docs, module_docs, symbol_docs, chunk_docs = await asyncio.to_thread(
            _prepare_index_payload, state["files"], repo_id, commit
        )
        await jobs.update_one(key, {"$set": {"progress": f"Prepared {len(chunk_docs)} code chunks and vectors; saving repository index", "updated_at": utcnow()}})
        # Replace this repository's MongoDB knowledge only after the full new
        # snapshot and all local vectors have been prepared successfully.
        await db.repositories.update_many({"repo_id": repo_id}, {"$set": {"indexed": False, "updated_at": utcnow()}})
        for name in ("repositories", "repository_files", "repository_modules", "repository_symbols", "repository_knowledge_sources"):
            await db[name].delete_many({"repo_id": repo_id})
        await jobs.delete_many({"repo_id": repo_id, "commit_sha": {"$ne": commit}})
        await db.repository_files.insert_many(file_docs, ordered=False)
        await db.repository_modules.insert_many(module_docs, ordered=False)
        if symbol_docs:
            await db.repository_symbols.insert_many(symbol_docs, ordered=False)
        await db.repository_knowledge_sources.insert_many(chunk_docs, ordered=False)
        verified = {
            "files": await db.repository_files.count_documents(key),
            "modules": await db.repository_modules.count_documents(key),
            "symbols": await db.repository_symbols.count_documents(key),
            "chunks": await db.repository_knowledge_sources.count_documents(key),
        }
        expected = {"files": len(file_docs), "modules": len(module_docs), "symbols": len(symbol_docs), "chunks": len(chunk_docs)}
        if verified != expected:
            await jobs.update_one(key, {"$set": {"status": "failed", "progress": f"Persisted record verification mismatch: {verified}", "updated_at": utcnow()}})
            raise RuntimeError(f"MongoDB repository index verification failed: expected {expected}, found {verified}")
        knowledge = state["knowledge"]
        await db.repositories.update_one(key, {"$set": {**key, "full_name": state["repo"], "branch": state["branch"], "languages": knowledge.get("languages", {}), "file_count": len(file_docs), "symbol_count": len(symbol_docs), "indexed": True, "vectorizer": settings.vectorizer_name, "vector_dimensions": settings.embedding_dimensions, "knowledge_summary": knowledge, "updated_at": utcnow()}}, upsert=True)
        await jobs.update_one(key, {"$set": {"status": "complete", "progress": "Repository files, hierarchy, and source chunks indexed and verified in MongoDB", "chunk_count": len(chunk_docs), "vectorizer": settings.vectorizer_name, "vector_dimensions": settings.embedding_dimensions, "updated_at": utcnow()}})
        return {"repo_id": repo_id, "chunk_count": len(chunk_docs), "indexed": True}
    except Exception as exc:
        await db.repositories.update_one(key, {"$set": {"indexed": False, "updated_at": utcnow()}})
        await jobs.update_one(key, {"$set": {"status": "failed", "progress": str(exc)[:500], "retryable": True, "updated_at": utcnow()}, "$inc": {"attempts": 1}}, upsert=True)
        raise


def _cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b)) if len(a) == len(b) else 0.0


def repository_scope(repo_id: str, commit_sha: str, filters: dict | None = None) -> dict:
    """Build the mandatory repository and pinned-commit restriction."""
    filt: dict = {"repo_id": repo_id, "commit_sha": commit_sha}
    filters = filters or {}
    if filters.get("path"):
        filt["path"] = {"$regex": re.escape(filters["path"]), "$options": "i"}
    if filters.get("language"):
        filt["language"] = filters["language"].lower()
    return filt


async def retrieve_repository_context(repo_id: str, commit_sha: str, query: str, top_k: int = 8, filters: dict | None = None) -> dict:
    """Use a LangGraph module -> symbol -> source-detail retrieval path."""
    active = await database().repositories.find_one({"repo_id": repo_id, "commit_sha": commit_sha, "indexed": True, "vectorizer": settings.vectorizer_name}, {"_id": 1})
    if not active:
        raise RuntimeError("This repository commit has no verified MongoDB knowledge index; analyze it again")
    state = await _repository_retrieval_graph.ainvoke({
        "repo_id": repo_id,
        "commit_sha": commit_sha,
        "query": query,
        "filters": filters or {},
        "top_k": max(1, min(top_k, 12)),
    })
    return {
        "repo_id": repo_id,
        "commit_sha": commit_sha,
        "modules": [{key: item.get(key) for key in ("path", "language", "summary", "symbol_names", "score")} for item in state.get("modules", [])],
        "symbols": [{key: item.get(key) for key in ("path", "name", "kind", "signature", "summary", "start_line", "end_line", "score")} for item in state.get("symbols", [])],
        "results": state.get("results", []),
    }


class RepositoryRetrievalState(TypedDict, total=False):
    repo_id: str
    commit_sha: str
    query: str
    filters: dict
    top_k: int
    query_vector: list[float]
    modules: list[dict]
    module_paths: list[str]
    symbols: list[dict]
    results: list[dict]


def _rank_doc(doc: dict, query: str, query_vector: list[float], text_field: str) -> float:
    lexical_query = {token.lower() for token in TOKEN_RE.findall(query)}
    lexical_doc = {token.lower() for token in TOKEN_RE.findall(" ".join((doc.get(text_field, ""), doc.get("path", ""), doc.get("name", ""))))}
    overlap = len(lexical_query & lexical_doc) / max(1, len(lexical_query))
    return _cosine(query_vector, doc.get("embedding", [])) + overlap * 0.35


async def _select_modules(state: RepositoryRetrievalState) -> dict:
    db = database()
    filters = state.get("filters", {})
    query = state["query"]
    query_vector = await embed_query(query)
    scope = {"repo_id": state["repo_id"], "commit_sha": state["commit_sha"]}
    if filters.get("language"):
        scope["language"] = filters["language"].lower()
    projection = {"path": 1, "language": 1, "summary": 1, "imports": 1, "symbol_names": 1, "symbol_count": 1, "embedding": 1}
    scope["vectorizer"] = settings.vectorizer_name
    modules = await db.repository_modules.find(scope, projection).limit(5000).to_list(length=5000)
    if filters.get("path"):
        modules = [doc for doc in modules if filters["path"].lower() in doc.get("path", "").lower()]
    for doc in modules:
        doc["score"] = _rank_doc(doc, query, query_vector, "summary")
    modules.sort(key=lambda doc: doc["score"], reverse=True)
    selected = modules[:MODULE_LIMIT]
    return {"query_vector": query_vector, "modules": selected, "module_paths": [item["path"] for item in selected]}


async def _select_symbols(state: RepositoryRetrievalState) -> dict:
    if not state.get("module_paths"):
        return {"symbols": []}
    db = database()
    docs = await db.repository_symbols.find(
        {"repo_id": state["repo_id"], "commit_sha": state["commit_sha"], "path": {"$in": state["module_paths"]}, "vectorizer": settings.vectorizer_name},
        {"path": 1, "name": 1, "kind": 1, "signature": 1, "summary": 1, "docstring": 1, "calls": 1, "start_line": 1, "end_line": 1, "embedding": 1},
    ).limit(1000).to_list(length=1000)
    for doc in docs:
        doc["score"] = _rank_doc(doc, state["query"], state["query_vector"], "summary")
    docs.sort(key=lambda doc: doc["score"], reverse=True)
    return {"symbols": docs[:SYMBOL_LIMIT]}


async def _load_symbol_details(state: RepositoryRetrievalState) -> dict:
    db = database()
    module_by_path = {item["path"]: item for item in state.get("modules", [])}
    selected_symbols = state.get("symbols", [])
    details: list[dict] = []
    if selected_symbols:
        paths = sorted({symbol["path"] for symbol in selected_symbols})
        symbols = sorted({symbol["name"] for symbol in selected_symbols})
        details = await db.repository_knowledge_sources.find(
            {"repo_id": state["repo_id"], "commit_sha": state["commit_sha"], "path": {"$in": paths}, "symbol": {"$in": symbols}, "vectorizer": settings.vectorizer_name},
            {"path": 1, "symbol": 1, "kind": 1, "start_line": 1, "end_line": 1, "content": 1, "function_summary": 1, "embedding": 1},
        ).limit(512).to_list(length=512)
        symbol_by_key = {(symbol["path"], symbol["name"]): symbol for symbol in selected_symbols}
        for detail in details:
            detail["module_summary"] = module_by_path.get(detail.get("path", ""), {}).get("summary", "")
            detail["function_summary"] = symbol_by_key.get((detail.get("path"), detail.get("symbol")), {}).get("summary", "")
    if not details and state.get("module_paths"):
        details = await db.repository_knowledge_sources.find(
            {"repo_id": state["repo_id"], "commit_sha": state["commit_sha"], "path": {"$in": state["module_paths"]}, "vectorizer": settings.vectorizer_name},
            {"path": 1, "symbol": 1, "kind": 1, "start_line": 1, "end_line": 1, "content": 1, "function_summary": 1, "embedding": 1},
        ).limit(512).to_list(length=512)
        for detail in details:
            detail["module_summary"] = module_by_path.get(detail.get("path", ""), {}).get("summary", "")
    for detail in details:
        detail["score"] = _rank_doc(detail, state["query"], state["query_vector"], "content")
    details.sort(key=lambda item: item.get("score", 0), reverse=True)
    selected, spans, size = [], {}, 0
    for detail in details:
        path, start, end = detail.get("path", ""), int(detail.get("start_line", 1)), int(detail.get("end_line", 1))
        if any(not (end < first or start > last) for first, last in spans.get(path, [])):
            continue
        content = detail.get("content", "")
        if size + len(content) > 18000:
            continue
        spans.setdefault(path, []).append((start, end))
        size += len(content)
        selected.append({key: detail.get(key) for key in ("path", "symbol", "kind", "start_line", "end_line", "content", "module_summary", "function_summary", "score")})
        if len(selected) >= state.get("top_k", 8):
            break
    return {"results": selected}


_retrieval_builder = StateGraph(RepositoryRetrievalState)
_retrieval_builder.add_node("select_modules", _select_modules)
_retrieval_builder.add_node("select_symbols", _select_symbols)
_retrieval_builder.add_node("load_symbol_details", _load_symbol_details)
_retrieval_builder.set_entry_point("select_modules")
_retrieval_builder.add_edge("select_modules", "select_symbols")
_retrieval_builder.add_edge("select_symbols", "load_symbol_details")
_retrieval_builder.add_edge("load_symbol_details", END)
_repository_retrieval_graph = _retrieval_builder.compile()
