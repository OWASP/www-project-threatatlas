import re

from pydantic import BaseModel, ConfigDict, Field, field_validator


_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,62}$")


class OIDCProviderBase(BaseModel):
    name: str = Field(..., description="URL-safe slug used in callback URLs")
    display_name: str = Field(..., min_length=1, max_length=128)
    issuer: str = Field(..., min_length=1, max_length=512)
    metadata_url: str | None = Field(default=None, max_length=1024)
    client_id: str = Field(..., min_length=1, max_length=256)
    scopes: str = Field(default="openid email profile", max_length=256)
    is_enabled: bool = True

    @field_validator("name")
    @classmethod
    def _validate_name(cls, v: str) -> str:
        v = v.strip().lower()
        if not _NAME_RE.match(v):
            raise ValueError(
                "name must be 1-63 chars, lowercase letters, digits, '-' or '_', "
                "and start with a letter or digit"
            )
        return v

    @field_validator("issuer")
    @classmethod
    def _validate_issuer(cls, v: str) -> str:
        v = v.strip().rstrip("/")
        if not v.startswith(("http://", "https://")):
            raise ValueError("issuer must be an http(s) URL")
        return v


class OIDCProviderCreate(OIDCProviderBase):
    client_secret: str = Field(..., min_length=1, max_length=1024)


class OIDCProviderUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=128)
    issuer: str | None = Field(default=None, min_length=1, max_length=512)
    metadata_url: str | None = Field(default=None, max_length=1024)
    client_id: str | None = Field(default=None, min_length=1, max_length=256)
    # Optional on update — leave blank to keep the existing secret.
    client_secret: str | None = Field(default=None, min_length=1, max_length=1024)
    scopes: str | None = Field(default=None, max_length=256)
    is_enabled: bool | None = None

    @field_validator("issuer")
    @classmethod
    def _validate_issuer(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip().rstrip("/")
        if not v.startswith(("http://", "https://")):
            raise ValueError("issuer must be an http(s) URL")
        return v


class OIDCProviderRead(OIDCProviderBase):
    """Admin-facing view — omits client_secret."""
    model_config = ConfigDict(from_attributes=True)
    id: int
