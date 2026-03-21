from datetime import datetime
from pydantic import BaseModel, ConfigDict


class FrameworkBase(BaseModel):
    """Base schema for Framework."""
    name: str | None = None
    description: str | None = None
    is_custom: bool = False
    user_id: int | None = None


class FrameworkCreate(FrameworkBase):
    """Schema for creating a Framework."""
    name: str


class FrameworkUpdate(FrameworkBase):
    """Schema for updating a Framework."""
    pass


class Framework(FrameworkBase):
    """Schema for Framework response."""
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
