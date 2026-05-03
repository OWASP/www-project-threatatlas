from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ScimTokenCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)


class ScimTokenRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    last_used_at: datetime | None = None
    created_at: datetime


class ScimTokenCreated(ScimTokenRead):
    """Returned exactly once on creation — includes the plaintext token."""
    token: str
