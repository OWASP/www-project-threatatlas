from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import ENUM

from app.database import Base
from app.models.enums import UserRole


class User(Base):
    """User account for authentication and authorization."""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)
    full_name = Column(String(200), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    role = Column(ENUM('admin', 'standard', 'read_only', name='userrole', create_type=False), default='standard', nullable=False)
    # SCIM externalId from the upstream IdP (unique). Null for users created locally.
    scim_external_id = Column(String(256), unique=True, index=True, nullable=True)
    invited_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    products = relationship("Product", back_populates="user", cascade="all, delete-orphan")
    diagrams = relationship("Diagram", foreign_keys="Diagram.created_by", back_populates="creator")
    invited_users = relationship("User", foreign_keys=[invited_by], remote_side=[id], backref="inviter")
    invitations_sent = relationship("Invitation", foreign_keys="Invitation.invited_by", back_populates="invited_by_user", cascade="all, delete-orphan")
    invitation_used = relationship("Invitation", foreign_keys="Invitation.user_id", back_populates="user", uselist=False, cascade="all, delete-orphan")
    collaborations = relationship("ProductCollaborator", foreign_keys="ProductCollaborator.user_id", back_populates="user", cascade="all, delete-orphan")
    groups = relationship("Group", secondary="user_groups", back_populates="members", lazy="selectin")

    @property
    def effective_role(self) -> str:
        """Most permissive role between the user's direct role and any group roles."""
        precedence = {"read_only": 0, "standard": 1, "admin": 2}
        roles = [self.role] + [g.role for g in (self.groups or [])]
        return max(roles, key=lambda r: precedence.get(r, -1))
