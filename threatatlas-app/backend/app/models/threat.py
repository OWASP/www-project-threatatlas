from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Threat(Base):
    """Threat definition in a framework."""

    __tablename__ = "threats"

    id = Column(Integer, primary_key=True, index=True)
    framework_id = Column(Integer, ForeignKey("frameworks.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)  # e.g., for STRIDE: Spoofing, Tampering, etc.
    is_custom = Column(Boolean, default=False, nullable=False)  # User-created vs pre-defined
    is_modified = Column(Boolean, default=False, nullable=False)  # Predefined entry edited by a user
    original_name = Column(String(200), nullable=True)        # Snapshot taken on first edit
    original_description = Column(Text, nullable=True)
    original_category = Column(String(100), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User")
    framework = relationship("Framework", back_populates="threats")
    diagram_threats = relationship("DiagramThreat", back_populates="threat", cascade="all, delete-orphan")


class DiagramThreat(Base):
    """Association between a diagram element and a threat."""

    __tablename__ = "diagram_threats"

    id = Column(Integer, primary_key=True, index=True)
    diagram_id = Column(Integer, ForeignKey("diagrams.id"), nullable=False, index=True)
    model_id = Column(Integer, ForeignKey("models.id", ondelete="CASCADE"), nullable=False, index=True)
    threat_id = Column(Integer, ForeignKey("threats.id"), nullable=False, index=True)
    element_id = Column(String(100), nullable=False)  # ReactFlow node/edge ID
    element_type = Column(String(50), nullable=False)  # 'node' or 'edge'
    status = Column(String(50), default="identified", nullable=False)  # identified, mitigated, accepted, etc.
    comments = Column(Text, nullable=True)
    likelihood = Column(Integer, nullable=True)  # 1-5
    impact = Column(Integer, nullable=True)  # 1-5
    risk_score = Column(Integer, nullable=True)  # Auto-calculated: likelihood × impact
    severity = Column(String(20), nullable=True)  # 'low', 'medium', 'high', 'critical'
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    diagram = relationship("Diagram", back_populates="diagram_threats")
    model = relationship("Model", back_populates="diagram_threats")
    threat = relationship("Threat", back_populates="diagram_threats")
    diagram_mitigations = relationship("DiagramMitigation", back_populates="diagram_threat", cascade="all, delete-orphan", foreign_keys="DiagramMitigation.threat_id")
