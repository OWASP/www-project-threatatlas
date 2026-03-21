from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Mitigation(Base):
    """Mitigation definition in a framework."""

    __tablename__ = "mitigations"

    id = Column(Integer, primary_key=True, index=True)
    framework_id = Column(Integer, ForeignKey("frameworks.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    is_custom = Column(Boolean, default=False, nullable=False)  # User-created vs pre-defined
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User")
    framework = relationship("Framework", back_populates="mitigations")
    diagram_mitigations = relationship("DiagramMitigation", back_populates="mitigation", cascade="all, delete-orphan")


class DiagramMitigation(Base):
    """Association between a diagram element and a mitigation."""

    __tablename__ = "diagram_mitigations"

    id = Column(Integer, primary_key=True, index=True)
    diagram_id = Column(Integer, ForeignKey("diagrams.id"), nullable=False, index=True)
    model_id = Column(Integer, ForeignKey("models.id", ondelete="CASCADE"), nullable=False, index=True)
    mitigation_id = Column(Integer, ForeignKey("mitigations.id"), nullable=False, index=True)
    element_id = Column(String(100), nullable=False)  # ReactFlow node/edge ID
    element_type = Column(String(50), nullable=False)  # 'node' or 'edge'
    threat_id = Column(Integer, ForeignKey("diagram_threats.id", ondelete="CASCADE"), nullable=True, index=True)  # Optional link to specific threat
    status = Column(String(50), default="proposed", nullable=False)  # proposed, implemented, verified, etc.
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    diagram = relationship("Diagram", back_populates="diagram_mitigations")
    model = relationship("Model", back_populates="diagram_mitigations")
    mitigation = relationship("Mitigation", back_populates="diagram_mitigations")
    diagram_threat = relationship("DiagramThreat", foreign_keys=[threat_id])
