"""Session-only GitHub App connection used to select an interview project."""
from __future__ import annotations

import secrets
import time
from typing import Any
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from backend.config import (
    GITHUB_CALLBACK_URL,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    GITHUB_FRONTEND_ORIGINS,
)

router = APIRouter(tags=["github"])

# OAuth state and access tokens intentionally live only in this process. Restarting
# the backend drops connected GitHub sessions; repository contents are never stored.
_oauth_states: dict[str, dict[str, Any]] = {}
_sessions: dict[str, dict[str, Any]] = {}
_SESSION_COOKIE = "momentum_github_session"
_STATE_COOKIE = "momentum_github_oauth_state"
_SESSION_TTL_SECONDS = 12 * 60 * 60
_STATE_TTL_SECONDS = 10 * 60


def _require_configured() -> None:
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="GitHub connection is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in backend/.env.",
        )


def _cookie_secure(request: Request) -> bool:
    return request.url.scheme == "https"


def _return_url(request: Request) -> str:
    """Return to the interview page only when its origin is on our allowlist."""
    referer = request.headers.get("referer", "")
    parsed = urlsplit(referer)
    origin = f"{parsed.scheme}://{parsed.netloc}" if parsed.scheme and parsed.netloc else ""
    callback_host = urlsplit(GITHUB_CALLBACK_URL).hostname
    if origin not in GITHUB_FRONTEND_ORIGINS or parsed.hostname != callback_host:
        callback = urlsplit(GITHUB_CALLBACK_URL)
        return urlunsplit((callback.scheme, callback.netloc, "/interview-app", "", ""))
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path or "/", parsed.query, parsed.fragment))


def _with_status(url: str, status: str) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query["github"] = status
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def _get_session(request: Request) -> dict[str, Any]:
    session_id = request.cookies.get(_SESSION_COOKIE, "")
    session = _sessions.get(session_id)
    if not session or session["expires_at"] <= time.time():
        if session_id:
            _sessions.pop(session_id, None)
        raise HTTPException(status_code=401, detail="Connect GitHub to continue.")
    return session


def get_github_evaluation_session(request: Request) -> dict[str, str]:
    """Return the connected GitHub identity/token for server-side evaluation only."""
    session = _get_session(request)
    if not session.get("selected_repository"):
        raise HTTPException(status_code=409, detail="Select the candidate's repository before starting its evaluation.")
    return {
        "github_id": session.get("github_id", ""),
        "login": session["login"],
        "token": session["token"],
        "session_id": request.cookies.get(_SESSION_COOKIE, ""),
    }


def get_selected_repository(request: Request, requested_full_name: str | None):
    """Validate an interview's repo metadata against the OAuth session selection."""
    if not requested_full_name:
        return None
    session = _get_session(request)
    selected = session.get("selected_repository")
    if not selected or selected["full_name"].casefold() != requested_full_name.casefold():
        raise HTTPException(status_code=403, detail="Select this repository from your connected GitHub account first.")
    return selected


async def _github_get(token: str, path: str, params: dict[str, Any] | None = None):
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"https://api.github.com{path}",
            params=params,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
        )
    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="GitHub session expired. Reconnect GitHub.")
    if response.is_error:
        raise HTTPException(status_code=502, detail="GitHub could not provide repository access.")
    return response.json()


@router.get("/auth/github")
async def github_login(request: Request):
    _require_configured()
    for state, data in list(_oauth_states.items()):
        if data["created_at"] + _STATE_TTL_SECONDS < time.time():
            _oauth_states.pop(state, None)

    state = secrets.token_urlsafe(32)
    _oauth_states[state] = {"created_at": time.time(), "return_url": _return_url(request)}
    params = {
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": GITHUB_CALLBACK_URL,
        "state": state,
    }
    # GitHub App permissions come from its configured permissions. OAuth Apps need
    # read:user for identity; GitHub App IDs use the App authorization flow instead.
    if not GITHUB_CLIENT_ID.startswith("Iv23"):
        params["scope"] = "read:user"

    response = RedirectResponse(
        "https://github.com/login/oauth/authorize?" + urlencode(params), status_code=302
    )
    response.set_cookie(
        _STATE_COOKIE,
        state,
        httponly=True,
        secure=_cookie_secure(request),
        samesite="lax",
        max_age=_STATE_TTL_SECONDS,
        path="/",
    )
    return response


@router.get("/auth/github/callback")
async def github_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    _require_configured()
    if error or not code or not state:
        return_url = _return_url(request)
        return RedirectResponse(_with_status(return_url, "error"), status_code=302)
    saved = _oauth_states.pop(state, None)
    return_url = saved["return_url"] if saved else _return_url(request)
    browser_state = request.cookies.get(_STATE_COOKIE, "")
    if not saved or not secrets.compare_digest(browser_state, state):
        response = RedirectResponse(_with_status(return_url, "error"), status_code=302)
        response.delete_cookie(_STATE_COOKIE, path="/")
        return response
    if saved["created_at"] + _STATE_TTL_SECONDS < time.time():
        response = RedirectResponse(_with_status(return_url, "error"), status_code=302)
        response.delete_cookie(_STATE_COOKIE, path="/")
        return response

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            token_response = await client.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": GITHUB_CLIENT_ID,
                    "client_secret": GITHUB_CLIENT_SECRET,
                    "code": code,
                },
                headers={"Accept": "application/json"},
            )
            token_response.raise_for_status()
            token = token_response.json().get("access_token")
            if not token:
                raise ValueError("GitHub did not return an access token")
            profile_response = await client.get(
                "https://api.github.com/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
            )
            profile_response.raise_for_status()
            profile = profile_response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(
            status_code=502,
            detail="GitHub authorization failed. Check the GitHub App callback URL and repository permissions.",
        ) from exc

    session_id = secrets.token_urlsafe(32)
    _sessions[session_id] = {
        "token": token,
        "login": profile.get("login", "GitHub user"),
        "github_id": str(profile.get("id", "")),
        "expires_at": time.time() + _SESSION_TTL_SECONDS,
        "selected_repository": None,
    }
    response = RedirectResponse(_with_status(return_url, "connected"), status_code=302)
    response.set_cookie(
        _SESSION_COOKIE,
        session_id,
        httponly=True,
        secure=_cookie_secure(request),
        samesite="lax",
        max_age=_SESSION_TTL_SECONDS,
        path="/",
    )
    response.delete_cookie(_STATE_COOKIE, path="/")
    return response


@router.get("/api/github/session")
async def github_session(request: Request):
    try:
        session = _get_session(request)
    except HTTPException as exc:
        if exc.status_code == 401:
            return {"connected": False, "login": None}
        raise
    return {"connected": True, "login": session["login"], "selected_repository": session["selected_repository"]}


@router.get("/api/github/repositories")
async def github_repositories(request: Request):
    session = _get_session(request)
    repositories = []
    for page in range(1, 11):
        batch = await _github_get(
            session["token"],
            "/user/repos",
            {"sort": "updated", "per_page": 100, "page": page, "affiliation": "owner,collaborator,organization_member"},
        )
        repositories.extend(batch)
        if len(batch) < 100:
            break
    return {
        "repositories": [
            {
                "full_name": repo["full_name"],
                "html_url": repo["html_url"],
                "description": repo.get("description"),
                "private": bool(repo.get("private")),
                "default_branch": repo.get("default_branch"),
                "updated_at": repo.get("updated_at"),
            }
            for repo in repositories
        ]
    }


class SelectRepositoryRequest(BaseModel):
    full_name: str = Field(min_length=3, max_length=200)


@router.post("/api/github/repository")
async def select_github_repository(request: Request, body: SelectRepositoryRequest):
    session = _get_session(request)
    repositories = await github_repositories(request)
    selected = next(
        (repo for repo in repositories["repositories"] if repo["full_name"].casefold() == body.full_name.casefold()),
        None,
    )
    if not selected:
        raise HTTPException(status_code=404, detail="Choose a repository available to your connected GitHub account.")
    session["selected_repository"] = selected
    return {"repository": selected}


@router.delete("/api/github/session")
async def github_disconnect(request: Request, response: Response):
    session_id = request.cookies.get(_SESSION_COOKIE, "")
    session = _sessions.pop(session_id, None)
    if session and GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.delete(
                    f"https://api.github.com/applications/{GITHUB_CLIENT_ID}/grant",
                    auth=(GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET),
                    json={"access_token": session["token"]},
                    headers={"Accept": "application/vnd.github+json"},
                )
        except httpx.HTTPError:
            pass
    response.delete_cookie(_SESSION_COOKIE, path="/")
    return {"connected": False}
