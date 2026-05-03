from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, field_validator, model_validator


# ── AI Config ──────────────────────────────────────────────────────────────

class AIConfigCreate(BaseModel):
    provider: Literal["openai", "anthropic", "openai_compatible"]
    model_name: str
    api_key: str
    base_url: str | None = None
    temperature: float = 0.7
    max_tokens: int = 4096

    @field_validator("model_name")
    @classmethod
    def model_name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("model_name must not be empty")
        return v

    @field_validator("api_key")
    @classmethod
    def api_key_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("api_key must not be empty")
        return v

    @field_validator("temperature")
    @classmethod
    def temperature_range(cls, v: float) -> float:
        if not (0.0 <= v <= 2.0):
            raise ValueError("temperature must be between 0.0 and 2.0")
        return v

    @field_validator("max_tokens")
    @classmethod
    def max_tokens_range(cls, v: int) -> int:
        if not (256 <= v <= 128000):
            raise ValueError("max_tokens must be between 256 and 128000")
        return v

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, v, info):
        if v is not None:
            v = v.strip().rstrip("/")
            if not v.startswith(("http://", "https://")):
                raise ValueError("base_url must start with http:// or https://")
        return v

    @model_validator(mode="after")
    def base_url_required_for_compatible(self):
        if self.provider == "openai_compatible" and not self.base_url:
            raise ValueError("base_url is required for openai_compatible provider")
        return self


class AIConfigUpdate(BaseModel):
    provider: Literal["openai", "anthropic", "openai_compatible"] | None = None
    model_name: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    is_active: bool | None = None

    @field_validator("model_name")
    @classmethod
    def model_name_not_empty(cls, v):
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("model_name must not be empty")
        return v

    @field_validator("temperature")
    @classmethod
    def temperature_range(cls, v):
        if v is not None and not (0.0 <= v <= 2.0):
            raise ValueError("temperature must be between 0.0 and 2.0")
        return v

    @field_validator("max_tokens")
    @classmethod
    def max_tokens_range(cls, v):
        if v is not None and not (256 <= v <= 128000):
            raise ValueError("max_tokens must be between 256 and 128000")
        return v

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, v):
        if v is not None:
            v = v.strip().rstrip("/")
            if v and not v.startswith(("http://", "https://")):
                raise ValueError("base_url must start with http:// or https://")
        return v


class AIConfigResponse(BaseModel):
    id: int
    provider: str
    model_name: str
    api_key_masked: str       # e.g. "sk-abc...****"
    base_url: str | None
    temperature: float
    max_tokens: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── AI Conversations ────────────────────────────────────────────────────────

class ConversationCreate(BaseModel):
    diagram_id: int
    title: str | None = None


class ConversationResponse(BaseModel):
    id: int
    diagram_id: int
    user_id: int
    title: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── AI Messages & Proposals ─────────────────────────────────────────────────

class MessageCreate(BaseModel):
    content: str


class ProposalResponse(BaseModel):
    id: str
    type: Literal["threat", "mitigation"]
    element_id: str
    element_type: str
    threat_id: int | None = None
    mitigation_id: int | None = None
    name: str
    description: str
    category: str | None = None
    model_id: int | None = None
    status: Literal["pending", "approved", "dismissed"] = "pending"


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    role: str
    content: str
    proposals: list[dict[str, Any]] | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProposalActionRequest(BaseModel):
    proposal_id: str


class ConversationWithMessages(ConversationResponse):
    messages: list[MessageResponse] = []

    model_config = {"from_attributes": True}
