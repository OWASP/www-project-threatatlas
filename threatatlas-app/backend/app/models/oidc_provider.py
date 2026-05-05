from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func

from app.database import Base


class OIDCProviderConfig(Base):
    """An OIDC identity provider configured at runtime via the admin UI."""

    __tablename__ = "oidc_providers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(64), unique=True, index=True, nullable=False)
    display_name = Column(String(128), nullable=False)
    issuer = Column(String(512), nullable=False)
    # Optional override for the OIDC discovery document URL. When unset, the
    # backend fetches "{issuer}/.well-known/openid-configuration". Useful when
    # the IdP is reachable at a different hostname from within the backend
    # than the issuer claim returns (e.g. docker-net hostname vs. public URL).
    metadata_url = Column(String(1024), nullable=True)
    client_id = Column(String(256), nullable=False)
    # Fernet-encrypted; never exposed via API.
    client_secret_encrypted = Column(String(1024), nullable=False)
    scopes = Column(String(256), nullable=False, default="openid email profile")
    is_enabled = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
