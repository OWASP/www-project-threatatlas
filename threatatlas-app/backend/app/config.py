from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Database
    database_url: str = "postgresql://threatatlas:threatatlas_dev@localhost:5432/threatatlas"

    # API
    api_title: str = "ThreatAtlas API"
    api_version: str = "1.0.0"
    debug: bool = True

    # Security
    secret_key: str = "your-secret-key-here-change-in-production"

    # JWT Authentication
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # Email
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = "noreply@threatatlas.com"
    smtp_from_name: str = "ThreatAtlas"
    smtp_tls: bool = True

    # Invitations
    invitation_expire_hours: int = 168  # 7 days
    frontend_url: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()
