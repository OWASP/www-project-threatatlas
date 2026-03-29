from datetime import datetime
from pydantic import BaseModel, ConfigDict


class MitigationBase(BaseModel):
    """Base schema for Mitigation."""
    name: str
    description: str | None = None
    category: str | None = None
    user_id: int | None = None


class MitigationCreate(MitigationBase):
    """Schema for creating a Mitigation."""
    framework_id: int
    is_custom: bool = True


class MitigationUpdate(MitigationBase):
    """Schema for updating a Mitigation."""
    name: str | None = None
    framework_id: int | None = None


class Mitigation(MitigationBase):
    """Schema for Mitigation response."""
    id: int
    framework_id: int
    is_custom: bool
    is_modified: bool = False
    original_name: str | None = None
    original_description: str | None = None
    original_category: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DiagramMitigationBase(BaseModel):
    """Base schema for DiagramMitigation."""
    element_id: str
    element_type: str
    status: str = "proposed"
    comments: str | None = None


class DiagramMitigationCreate(DiagramMitigationBase):
    """Schema for creating a DiagramMitigation."""
    diagram_id: int
    model_id: int
    mitigation_id: int
    threat_id: int | None = None


class DiagramMitigationUpdate(BaseModel):
    """Schema for updating a DiagramMitigation."""
    status: str | None = None
    comments: str | None = None


class DiagramMitigation(DiagramMitigationBase):
    """Schema for DiagramMitigation response."""
    id: int
    diagram_id: int
    model_id: int
    mitigation_id: int
    threat_id: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


from .model import Model

class DiagramMitigationWithDetails(DiagramMitigation):
    """Schema for DiagramMitigation with mitigation details."""
    mitigation: Mitigation
    model: Model | None = None

    model_config = ConfigDict(from_attributes=True)
