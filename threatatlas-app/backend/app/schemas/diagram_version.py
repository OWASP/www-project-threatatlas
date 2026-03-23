from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict


class DiagramThreatVersionSnapshot(BaseModel):
    """Threat assessment snapshot at a version."""
    id: int
    element_id: str
    element_type: str
    threat_id: int
    status: str
    comments: str | None = None
    likelihood: int | None = None
    impact: int | None = None
    risk_score: int | None = None
    severity: str | None = None
    threat_name: str | None = None
    node_label: str | None = None

    model_config = ConfigDict(from_attributes=True)


class DiagramMitigationVersionSnapshot(BaseModel):
    """Mitigation snapshot at a version."""
    id: int
    element_id: str
    element_type: str
    mitigation_id: int
    threat_id: int | None = None
    status: str
    comments: str | None = None

    model_config = ConfigDict(from_attributes=True)


class DiagramVersionBase(BaseModel):
    """Base schema for DiagramVersion."""
    diagram_data: dict[str, Any] | None = None
    name: str
    description: str | None = None
    comment: str | None = None


class DiagramVersion(DiagramVersionBase):
    """Full version data with complete snapshot."""
    id: int
    diagram_id: int
    version_number: int
    created_at: datetime
    created_by: int | None = None
    threat_versions: list[DiagramThreatVersionSnapshot] = []
    mitigation_versions: list[DiagramMitigationVersionSnapshot] = []

    model_config = ConfigDict(from_attributes=True)


class DiagramVersionSummary(BaseModel):
    """Lightweight version summary for listings."""
    id: int
    diagram_id: int
    version_number: int
    name: str
    comment: str | None = None
    created_at: datetime
    node_count: int
    edge_count: int
    threat_count: int
    total_risk_score: int

    model_config = ConfigDict(from_attributes=True)


class VersionCreateRequest(BaseModel):
    """Request to create a version."""
    comment: str | None = None


class ElementChange(BaseModel):
    """Change to a diagram element."""
    element_id: str
    element_type: str  # 'node' or 'edge'
    change_type: str  # 'added', 'removed', 'modified'
    before: dict[str, Any] | None = None
    after: dict[str, Any] | None = None


class ThreatChange(BaseModel):
    """Change to a threat assessment."""
    element_id: str
    threat_id: int
    change_type: str  # 'added', 'removed', 'modified'
    before: DiagramThreatVersionSnapshot | None = None
    after: DiagramThreatVersionSnapshot | None = None
    risk_score_delta: int | None = None


class DiagramVersionComparison(BaseModel):
    """Comparison result between two versions."""
    from_version: int
    to_version: int

    # Element changes
    nodes_added: list[ElementChange] = []
    nodes_removed: list[ElementChange] = []
    nodes_modified: list[ElementChange] = []
    edges_added: list[ElementChange] = []
    edges_removed: list[ElementChange] = []
    edges_modified: list[ElementChange] = []

    # Threat changes
    threats_added: list[ThreatChange] = []
    threats_removed: list[ThreatChange] = []
    threats_modified: list[ThreatChange] = []

    # Summary statistics
    total_risk_score_delta: int
    from_total_risk_score: int
    to_total_risk_score: int
