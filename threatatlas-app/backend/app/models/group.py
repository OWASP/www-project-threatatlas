from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


# Membership junction — a user can belong to many groups.
user_groups = Table(
    "user_groups",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("group_id", Integer, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
)


class Group(Base):
    """A named collection of users granted a common role.

    Role granted by a group is additive: a user's effective role is the most
    permissive between their direct `User.role` and the roles of every group
    they belong to.
    """

    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), unique=True, index=True, nullable=False)
    description = Column(String(500), nullable=True)
    role = Column(
        ENUM("admin", "standard", "read_only", name="userrole", create_type=False),
        nullable=False,
    )
    # SCIM externalId from the upstream IdP (unique per tenant). Null for groups
    # created through the in-app UI.
    scim_external_id = Column(String(256), unique=True, index=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    members = relationship("User", secondary=user_groups, back_populates="groups", lazy="selectin")
