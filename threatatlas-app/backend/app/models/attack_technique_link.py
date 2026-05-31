"""Links a DiagramThreat to a MITRE ATT&CK technique.

The technique catalog itself is static reference data (see
app/data/attack_techniques.py); only the mappings between a user's threats and
techniques are persisted, so the technique_id is stored as a string rather than
a foreign key.
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class DiagramThreatAttackTechnique(Base):
    __tablename__ = "diagram_threat_attack_techniques"

    id = Column(Integer, primary_key=True, index=True)
    diagram_threat_id = Column(
        Integer, ForeignKey("diagram_threats.id", ondelete="CASCADE"), nullable=False, index=True
    )
    technique_id = Column(String(20), nullable=False)  # e.g. "T1190" — validated against the catalog
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    diagram_threat = relationship("DiagramThreat")

    __table_args__ = (
        UniqueConstraint("diagram_threat_id", "technique_id", name="uq_threat_technique"),
    )
