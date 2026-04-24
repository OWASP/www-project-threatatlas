from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.database import Base


class ScimToken(Base):
    """Bearer token used by IdPs to push SCIM 2.0 requests to ThreatAtlas.

    The raw token is shown to the admin exactly once at creation; only its
    SHA-256 hash is persisted. To rotate, delete the old token and create a new
    one — then update the IdP configuration.
    """

    __tablename__ = "scim_tokens"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    # Uniquely identifies the token without storing the plaintext.
    token_hash = Column(String(128), unique=True, index=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
