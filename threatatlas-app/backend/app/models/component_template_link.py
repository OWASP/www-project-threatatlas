from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from app.database import Base


class ComponentTemplateThreat(Base):
    """Links a ComponentTemplate to a KB Threat (framework-aware via threat.framework_id)."""
    __tablename__ = "component_template_threats"
    id = Column(Integer, primary_key=True)
    component_id = Column(Integer, ForeignKey("component_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    threat_id = Column(Integer, ForeignKey("threats.id", ondelete="CASCADE"), nullable=False)
    __table_args__ = (UniqueConstraint("component_id", "threat_id"),)


class ComponentTemplateMitigation(Base):
    """Links a ComponentTemplate to a KB Mitigation (framework-aware via mitigation.framework_id)."""
    __tablename__ = "component_template_mitigations"
    id = Column(Integer, primary_key=True)
    component_id = Column(Integer, ForeignKey("component_templates.id", ondelete="CASCADE"), nullable=False, index=True)
    mitigation_id = Column(Integer, ForeignKey("mitigations.id", ondelete="CASCADE"), nullable=False)
    __table_args__ = (UniqueConstraint("component_id", "mitigation_id"),)
