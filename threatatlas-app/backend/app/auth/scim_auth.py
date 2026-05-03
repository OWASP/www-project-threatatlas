"""Bearer-token authentication for SCIM 2.0 endpoints."""

import hashlib
import secrets
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ScimToken

_scim_security = HTTPBearer(auto_error=False, description="SCIM 2.0 bearer token")


def generate_token() -> str:
    """Return a URL-safe bearer token. Shown to the admin once."""
    return secrets.token_urlsafe(32)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def verify_scim_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(_scim_security),
    db: Session = Depends(get_db),
) -> ScimToken:
    """Require a valid SCIM bearer token and stamp `last_used_at`."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing SCIM bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = db.query(ScimToken).filter(ScimToken.token_hash == hash_token(credentials.credentials)).first()
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid SCIM bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token.last_used_at = datetime.now(timezone.utc)
    db.commit()
    return token
