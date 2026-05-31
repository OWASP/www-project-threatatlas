from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.database import Base


class ApiToken(Base):
    """Long-lived bearer token for machine-to-machine and CI/CD access.

    The raw token (prefixed with 'ta_') is shown to the user exactly once at
    creation. Only its SHA-256 hash is persisted. To rotate, delete and recreate.
    """

    __tablename__ = "api_tokens"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    token_hash = Column(String(128), unique=True, index=True, nullable=False)
    prefix = Column(String(12), nullable=False)  # first 8 chars for display
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
