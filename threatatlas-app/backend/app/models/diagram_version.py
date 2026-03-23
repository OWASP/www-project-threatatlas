from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class DiagramVersion(Base):
    """Version snapshot of a diagram."""

    __tablename__ = "diagram_versions"

    id = Column(Integer, primary_key=True, index=True)
    diagram_id = Column(Integer, ForeignKey("diagrams.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False, index=True)
    diagram_data = Column(JSON, nullable=True)  # Complete ReactFlow state at this version
    name = Column(String(200), nullable=False)  # Diagram name at this version
    description = Column(Text, nullable=True)  # Diagram description at this version
    comment = Column(Text, nullable=True)  # Optional user comment about this version
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by = Column(Integer, nullable=True)  # Future: user_id

    # Relationships
    diagram = relationship("Diagram", back_populates="versions")
    threat_versions = relationship("DiagramThreatVersion", back_populates="version", cascade="all, delete-orphan")
    mitigation_versions = relationship("DiagramMitigationVersion", back_populates="version", cascade="all, delete-orphan")

    # Ensure unique version numbers per diagram
    __table_args__ = (
        UniqueConstraint('diagram_id', 'version_number', name='uq_diagram_version'),
    )


class DiagramThreatVersion(Base):
    """Snapshot of a threat assessment at a specific version."""

    __tablename__ = "diagram_threat_versions"

    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("diagram_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    diagram_threat_id = Column(Integer, ForeignKey("diagram_threats.id", ondelete="CASCADE"), nullable=False, index=True)
    element_id = Column(String(100), nullable=False)  # ReactFlow node/edge ID
    element_type = Column(String(50), nullable=False)  # 'node' or 'edge'
    threat_id = Column(Integer, ForeignKey("threats.id"), nullable=False, index=True)
    status = Column(String(50), nullable=False)
    comments = Column(Text, nullable=True)
    likelihood = Column(Integer, nullable=True)  # 1-5
    impact = Column(Integer, nullable=True)  # 1-5
    risk_score = Column(Integer, nullable=True)  # likelihood × impact
    severity = Column(String(20), nullable=True)  # 'low', 'medium', 'high', 'critical'
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    version = relationship("DiagramVersion", back_populates="threat_versions")
    diagram_threat = relationship("DiagramThreat")
    threat = relationship("Threat")


class DiagramMitigationVersion(Base):
    """Snapshot of a mitigation at a specific version."""

    __tablename__ = "diagram_mitigation_versions"

    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("diagram_versions.id", ondelete="CASCADE"), nullable=False, index=True)
    diagram_mitigation_id = Column(Integer, ForeignKey("diagram_mitigations.id", ondelete="CASCADE"), nullable=False, index=True)
    element_id = Column(String(100), nullable=False)  # ReactFlow node/edge ID
    element_type = Column(String(50), nullable=False)  # 'node' or 'edge'
    mitigation_id = Column(Integer, ForeignKey("mitigations.id"), nullable=False, index=True)
    threat_id = Column(Integer, nullable=True)  # Reference to diagram_threat_id (not FK due to cascade complexity)
    status = Column(String(50), nullable=False)
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    version = relationship("DiagramVersion", back_populates="mitigation_versions")
    diagram_mitigation = relationship("DiagramMitigation")
    mitigation = relationship("Mitigation")
