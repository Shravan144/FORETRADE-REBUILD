"""Runtime configuration for the API.

All production-sensitive values come from environment variables. Development
defaults exist only for running the local compose stack.
"""

from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./foretrade.db")
    session_cookie_name: str = os.getenv("SESSION_COOKIE_NAME", "foretrade_session")
    session_ttl_hours: int = int(os.getenv("SESSION_TTL_HOURS", "168"))
    cookie_secure: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    allowed_origins: tuple[str, ...] = tuple(
        item.strip() for item in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if item.strip()
    )
    upload_dir: str = os.getenv("UPLOAD_DIR", "./.uploads")
    max_upload_bytes: int = int(os.getenv("MAX_UPLOAD_BYTES", str(25 * 1024 * 1024)))
    google_client_id: str | None = os.getenv("GOOGLE_CLIENT_ID")
    google_client_secret: str | None = os.getenv("GOOGLE_CLIENT_SECRET")
    google_redirect_uri: str | None = os.getenv("GOOGLE_REDIRECT_URI")


settings = Settings()
