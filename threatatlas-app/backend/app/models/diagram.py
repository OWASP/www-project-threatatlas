from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Diagram(Base):
    """Data flow diagram for a product."""

    __tablename__ = "diagrams"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    diagram_data = Column(JSON, nullable=True)  # Stores ReactFlow nodes and edges
    current_version = Column(Integer, default=0, nullable=False)  # Track latest version number
    auto_version = Column(Boolean, default=True, nullable=False)  # Enable/disable auto-versioning
    snapshot = Column(Text, nullable=True)  # Base64 JPEG screenshot for reports
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    product = relationship("Product", back_populates="diagrams")
    creator = relationship("User", foreign_keys=[created_by], back_populates="diagrams")
    models = relationship("Model", back_populates="diagram", cascade="all, delete-orphan")
    diagram_threats = relationship("DiagramThreat", back_populates="diagram", cascade="all, delete-orphan")
    diagram_mitigations = relationship("DiagramMitigation", back_populates="diagram", cascade="all, delete-orphan")
    versions = relationship("DiagramVersion", back_populates="diagram", cascade="all, delete-orphan")
