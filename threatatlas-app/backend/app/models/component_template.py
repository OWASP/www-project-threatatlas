from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.sql import func

from app.database import Base


class ComponentTemplate(Base):
    """Component Threat Library entry.

    Each template represents a reusable system component (e.g. AWS S3, Redis,
    Docker Container) with pre-populated threats and mitigations stored as
    inline JSON arrays to avoid FK complexity.

    Threat item shape:
        {"name": str, "description": str, "category": str, "severity_hint": str}

    Mitigation item shape:
        {"name": str, "description": str, "category": str}
    """

    __tablename__ = "component_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    category = Column(String(100), nullable=False)   # e.g. "Cloud Storage", "Databases"
    node_type = Column(String(50), nullable=False)    # "process", "datastore", "external"
    icon = Column(String(100), nullable=True)          # lucide icon name key
    description = Column(Text, nullable=True)

    # Inline JSON arrays — no FK complexity needed
    threats = Column(JSON, nullable=False, default=list)
    # Each threat: {name, description, category, severity_hint}
    mitigations = Column(JSON, nullable=False, default=list)
    # Each mitigation: {name, description, category}

    is_custom = Column(Boolean, nullable=False, default=False)
    # Tracks whether a predefined (is_custom=False) entry has been edited by an admin.
    # On first edit, originals are snapshotted; revert restores from them.
    is_modified = Column(Boolean, nullable=False, default=False)
    original_name = Column(String(200), nullable=True)
    original_description = Column(Text, nullable=True)
    original_category = Column(String(100), nullable=True)
    original_node_type = Column(String(50), nullable=True)
    original_icon = Column(String(100), nullable=True)
    # Snapshot of KB link IDs before first edit (for restore)
    original_threat_ids = Column(JSON, nullable=True)
    original_mitigation_ids = Column(JSON, nullable=True)

    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
