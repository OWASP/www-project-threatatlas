from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func

from app.database import Base


class UserIntegration(Base):
    """Per-user integration configuration (e.g. JIRA).

    Sensitive credentials (API tokens) are stored encrypted via Fernet
    using the same key-derivation as AIConfig.
    """

    __tablename__ = "user_integrations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(50), nullable=False)  # always "jira" for now

    # JIRA-specific fields
    jira_url = Column(String(500), nullable=True)           # e.g. https://company.atlassian.net
    jira_email = Column(String(255), nullable=True)
    jira_token_encrypted = Column(Text, nullable=True)      # Fernet-encrypted API token
    jira_project_key = Column(String(50), nullable=True)    # e.g. "SEC"

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "type", name="uq_user_integrations_user_type"),
    )
