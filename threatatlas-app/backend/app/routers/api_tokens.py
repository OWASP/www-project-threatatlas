"""CRUD for user-owned API tokens (machine-to-machine / CI access)."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User as UserModel
from app.models.api_token import ApiToken
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api-tokens", tags=["api-tokens"])

TOKEN_PREFIX = "ta_"


def _generate_raw() -> str:
    return TOKEN_PREFIX + secrets.token_urlsafe(32)


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


# ── Schemas ───────────────────────────────────────────────────────────────────

class ApiTokenCreate(BaseModel):
    name: str


class ApiTokenRead(BaseModel):
    id: int
    name: str
    prefix: str
    last_used_at: datetime | None = None
    expires_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ApiTokenCreated(ApiTokenRead):
    token: str  # raw token — shown once only


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[ApiTokenRead])
def list_tokens(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(ApiToken)
        .filter(ApiToken.user_id == current_user.id)
        .order_by(ApiToken.created_at.desc())
        .all()
    )


@router.post("/", response_model=ApiTokenCreated, status_code=status.HTTP_201_CREATED)
def create_token(
    payload: ApiTokenCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing_count = db.query(ApiToken).filter(ApiToken.user_id == current_user.id).count()
    if existing_count >= 20:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum of 20 API tokens per user reached. Revoke an existing token before creating a new one.",
        )

    raw = _generate_raw()
    prefix = raw[:10]  # "ta_" + 7 chars
    row = ApiToken(
        name=payload.name,
        token_hash=_hash(raw),
        prefix=prefix,
        user_id=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ApiTokenCreated(
        id=row.id,
        name=row.name,
        prefix=row.prefix,
        last_used_at=row.last_used_at,
        expires_at=row.expires_at,
        created_at=row.created_at,
        token=raw,
    )


@router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_token(
    token_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(ApiToken).filter(
        ApiToken.id == token_id,
        ApiToken.user_id == current_user.id,
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Token not found")
    db.delete(row)
    db.commit()
