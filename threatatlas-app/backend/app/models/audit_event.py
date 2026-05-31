from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func

from app.database import Base


class AuditEvent(Base):
    """Append-only audit log recording significant write actions in ThreatAtlas."""

    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=True, index=True)
    diagram_id = Column(Integer, ForeignKey("diagrams.id", ondelete="SET NULL"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(80), nullable=False)          # e.g. "threat_added"
    entity_type = Column(String(50), nullable=True)      # "threat", "mitigation", "diagram"
    entity_name = Column(String(500), nullable=True)     # human-readable name for display
    details = Column(JSON, nullable=True)                # extra context dict
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
