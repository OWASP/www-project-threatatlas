"""JIRA integration endpoints — per-user config storage and issue creation."""

from __future__ import annotations

import asyncio
import base64
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.ai.encryption import encrypt_api_key, decrypt_api_key
from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import User as UserModel
from app.models.user_integration import UserIntegration

router = APIRouter(prefix="/integrations", tags=["integrations"])

# ── Schemas ────────────────────────────────────────────────────────────────────


class JiraConfigIn(BaseModel):
    jira_url: str
    jira_email: str
    jira_token: str
    jira_project_key: str


class JiraConfigOut(BaseModel):
    jira_url: Optional[str] = None
    jira_email: Optional[str] = None
    jira_token_masked: str = "****"
    jira_project_key: Optional[str] = None
    configured: bool = False


class JiraProjectOut(BaseModel):
    key: str
    name: str
    project_type: str = ""


class JiraIssueIn(BaseModel):
    summary: str
    description: str
    issue_type: str = "Bug"
    priority: str = "Medium"
    threat_id: Optional[int] = None
    project_key: Optional[str] = None  # overrides the stored default when provided


class JiraIssueOut(BaseModel):
    key: str
    url: str


# ── Helpers ────────────────────────────────────────────────────────────────────


def _get_or_none(db: Session, user_id: int) -> Optional[UserIntegration]:
    return (
        db.query(UserIntegration)
        .filter(UserIntegration.user_id == user_id, UserIntegration.type == "jira")
        .first()
    )


def _basic_auth_header(email: str, token: str) -> str:
    credentials = base64.b64encode(f"{email}:{token}".encode()).decode()
    return f"Basic {credentials}"


def _adf_description(text: str) -> dict:
    """Wrap plain text in Atlassian Document Format (ADF) for JIRA v3 API."""
    return {
        "type": "doc",
        "version": 1,
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": text}],
            }
        ],
    }


# ── Routes ─────────────────────────────────────────────────────────────────────


@router.get("/jira", response_model=JiraConfigOut)
def get_jira_config(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_or_none(db, current_user.id)
    if not row:
        return JiraConfigOut(configured=False)
    return JiraConfigOut(
        jira_url=row.jira_url,
        jira_email=row.jira_email,
        jira_token_masked="****",
        jira_project_key=row.jira_project_key,
        configured=bool(row.jira_url and row.jira_email and row.jira_token_encrypted),
    )


@router.put("/jira", response_model=JiraConfigOut, status_code=status.HTTP_200_OK)
def save_jira_config(
    payload: JiraConfigIn,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    encrypted = encrypt_api_key(payload.jira_token)
    # Store as string (Fernet returns bytes)
    encrypted_str = encrypted.decode() if isinstance(encrypted, bytes) else encrypted

    row = _get_or_none(db, current_user.id)
    if row:
        row.jira_url = payload.jira_url.rstrip("/")
        row.jira_email = payload.jira_email
        row.jira_token_encrypted = encrypted_str
        row.jira_project_key = payload.jira_project_key.upper()
    else:
        row = UserIntegration(
            user_id=current_user.id,
            type="jira",
            jira_url=payload.jira_url.rstrip("/"),
            jira_email=payload.jira_email,
            jira_token_encrypted=encrypted_str,
            jira_project_key=payload.jira_project_key.upper(),
        )
        db.add(row)
    db.commit()
    db.refresh(row)
    return JiraConfigOut(
        jira_url=row.jira_url,
        jira_email=row.jira_email,
        jira_token_masked="****",
        jira_project_key=row.jira_project_key,
        configured=True,
    )


@router.delete("/jira", status_code=status.HTTP_204_NO_CONTENT)
def delete_jira_config(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_or_none(db, current_user.id)
    if not row:
        raise HTTPException(status_code=404, detail="No JIRA integration configured")
    db.delete(row)
    db.commit()


@router.post("/jira/test", status_code=status.HTTP_200_OK)
async def test_jira_connection(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_or_none(db, current_user.id)
    if not row or not row.jira_token_encrypted:
        raise HTTPException(status_code=400, detail="No JIRA integration configured")

    token = decrypt_api_key(
        row.jira_token_encrypted.encode()
        if isinstance(row.jira_token_encrypted, str)
        else row.jira_token_encrypted
    )
    auth_header = _basic_auth_header(row.jira_email, token)
    url = f"{row.jira_url}/rest/api/3/myself"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, headers={"Authorization": auth_header})
        if resp.status_code == 200:
            data = resp.json()
            return {
                "ok": True,
                "display_name": data.get("displayName", ""),
                "email": data.get("emailAddress", ""),
            }
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"JIRA returned {resp.status_code}: {resp.text[:200]}",
        )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not reach JIRA: {exc}",
        )


@router.get("/jira/projects", response_model=list[JiraProjectOut])
async def list_jira_projects(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return all Jira projects accessible with the user's stored credentials."""
    row = _get_or_none(db, current_user.id)
    if not row or not row.jira_token_encrypted:
        raise HTTPException(status_code=400, detail="No JIRA integration configured")

    token = decrypt_api_key(
        row.jira_token_encrypted.encode()
        if isinstance(row.jira_token_encrypted, str)
        else row.jira_token_encrypted
    )
    auth_header = _basic_auth_header(row.jira_email, token)
    url = f"{row.jira_url}/rest/api/3/project"

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                url,
                headers={"Authorization": auth_header},
                params={"maxResults": 100, "orderBy": "name"},
            )
        if resp.status_code == 200:
            raw = resp.json()
            return [
                JiraProjectOut(
                    key=p.get("key", ""),
                    name=p.get("name", ""),
                    project_type=p.get("projectTypeKey", ""),
                )
                for p in raw
                if p.get("key")
            ]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"JIRA returned {resp.status_code}: {resp.text[:200]}",
        )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not reach JIRA: {exc}",
        )


@router.post("/jira/issues", response_model=JiraIssueOut, status_code=status.HTTP_201_CREATED)
async def create_jira_issue(
    payload: JiraIssueIn,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_or_none(db, current_user.id)
    if not row or not row.jira_token_encrypted:
        raise HTTPException(status_code=400, detail="No JIRA integration configured")

    token = decrypt_api_key(
        row.jira_token_encrypted.encode()
        if isinstance(row.jira_token_encrypted, str)
        else row.jira_token_encrypted
    )
    auth_header = _basic_auth_header(row.jira_email, token)
    url = f"{row.jira_url}/rest/api/3/issue"

    # Honour per-call project_key override; fall back to the stored integration default
    resolved_project_key = (payload.project_key or "").strip().upper() or row.jira_project_key
    if not resolved_project_key:
        raise HTTPException(status_code=400, detail="No Jira project key configured. Set one in your Jira integration settings.")

    body = {
        "fields": {
            "project": {"key": resolved_project_key},
            "summary": payload.summary,
            "description": _adf_description(payload.description),
            "issuetype": {"name": payload.issue_type},
            "priority": {"name": payload.priority},
        }
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                json=body,
                headers={
                    "Authorization": auth_header,
                    "Content-Type": "application/json",
                },
            )
        if resp.status_code in (200, 201):
            data = resp.json()
            issue_key = data.get("key", "")
            issue_url = f"{row.jira_url}/browse/{issue_key}"
            return JiraIssueOut(key=issue_key, url=issue_url)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"JIRA returned {resp.status_code}: {resp.text[:400]}",
        )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not reach JIRA: {exc}",
        )
