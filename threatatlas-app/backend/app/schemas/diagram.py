from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict


class DiagramBase(BaseModel):
    """Base schema for Diagram."""
    name: str
    description: str | None = None
    diagram_data: dict[str, Any] | None = None


class DiagramCreate(DiagramBase):
    """Schema for creating a Diagram."""
    product_id: int


class DiagramUpdate(DiagramBase):
    """Schema for updating a Diagram."""
    name: str | None = None
    product_id: int | None = None
    auto_version: bool | None = None
    version_comment: str | None = None
    snapshot: str | None = None


class Diagram(DiagramBase):
    """Schema for Diagram response."""
    id: int
    product_id: int
    current_version: int = 0
    auto_version: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DiagramWithVersionInfo(Diagram):
    """Diagram response with version information."""
    version_count: int
