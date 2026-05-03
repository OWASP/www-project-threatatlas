"""Invitation model for invitation-based user registration."""

import secrets
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import ENUM

from app.database import Base


class Invitation(Base):
    """Invitation for new user registration."""

    __tablename__ = "invitations"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=False, index=True)
    token = Column(String(64), unique=True, nullable=False, index=True)
    role = Column(ENUM('admin', 'standard', 'read_only', name='userrole', create_type=False), default='standard', nullable=False)

    invited_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    invited_by_user = relationship("User", foreign_keys=[invited_by], back_populates="invitations_sent")

    is_accepted = Column(Boolean, default=False, nullable=False)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    user = relationship("User", foreign_keys=[user_id], back_populates="invitation_used")

    @staticmethod
    def generate_token() -> str:
        """Generate a cryptographically secure invitation token."""
        return secrets.token_urlsafe(48)  # 64-character URL-safe token
