from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator, computed_field


class ThreatBase(BaseModel):
    """Base schema for Threat."""
    name: str
    description: str | None = None
    category: str | None = None
    user_id: int | None = None


class ThreatCreate(ThreatBase):
    """Schema for creating a Threat."""
    framework_id: int
    is_custom: bool = True


class ThreatUpdate(ThreatBase):
    """Schema for updating a Threat."""
    name: str | None = None
    framework_id: int | None = None


class Threat(ThreatBase):
    """Schema for Threat response."""
    id: int
    framework_id: int
    is_custom: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DiagramThreatBase(BaseModel):
    """Base schema for DiagramThreat."""
    element_id: str
    element_type: str
    status: str = "identified"
    comments: str | None = None
    likelihood: int | None = None
    impact: int | None = None

    @field_validator('likelihood', 'impact')
    @classmethod
    def validate_score(cls, v):
        if v is not None and (v < 1 or v > 5):
            raise ValueError('Score must be between 1 and 5')
        return v


class DiagramThreatCreate(DiagramThreatBase):
    """Schema for creating a DiagramThreat."""
    diagram_id: int
    model_id: int
    threat_id: int


class DiagramThreatUpdate(BaseModel):
    """Schema for updating a DiagramThreat."""
    status: str | None = None
    comments: str | None = None
    likelihood: int | None = None
    impact: int | None = None

    @field_validator('likelihood', 'impact')
    @classmethod
    def validate_score(cls, v):
        if v is not None and (v < 1 or v > 5):
            raise ValueError('Score must be between 1 and 5')
        return v


class DiagramThreat(DiagramThreatBase):
    """Schema for DiagramThreat response."""
    id: int
    diagram_id: int
    model_id: int
    threat_id: int
    risk_score: int | None = None
    severity: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


from .model import Model

class DiagramThreatWithDetails(DiagramThreat):
    """Schema for DiagramThreat with threat details."""
    threat: Threat
    model: Model | None = None

    model_config = ConfigDict(from_attributes=True)
