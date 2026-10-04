"""Runtime configuration for the API.

All production-sensitive values come from environment variables. Development
defaults exist only for running the local compose stack.
"""

from dataclasses import dataclass
import os
from pathlib import Path

from dotenv import load_dotenv

# Locate foretrade.db deterministically across repo directories
_REPO_ROOT = Path(__file__).resolve().parents[4]
_ROOT_DB = _REPO_ROOT / "foretrade.db"
_API_DB = _REPO_ROOT / "apps" / "api" / "foretrade.db"

# Automatically load .env files
load_dotenv(_REPO_ROOT / ".env")
load_dotenv(_REPO_ROOT / "apps" / "api" / ".env")

if _ROOT_DB.exists():
    _DEFAULT_DB_FILE = _ROOT_DB
elif _API_DB.exists():
    _DEFAULT_DB_FILE = _API_DB
else:
    _DEFAULT_DB_FILE = _ROOT_DB

_DEFAULT_DB_URL = f"sqlite:///{_DEFAULT_DB_FILE.as_posix()}"


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv("DATABASE_URL", _DEFAULT_DB_URL)
    session_cookie_name: str = os.getenv("SESSION_COOKIE_NAME", "foretrade_session")
    session_ttl_hours: int = int(os.getenv("SESSION_TTL_HOURS", "168"))
    cookie_secure: bool = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    allowed_origins: tuple[str, ...] = tuple(
        item.strip() for item in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if item.strip()
    )
    upload_dir: str = os.getenv("UPLOAD_DIR", str((_REPO_ROOT / ".uploads").as_posix()))
    max_upload_bytes: int = int(os.getenv("MAX_UPLOAD_BYTES", str(25 * 1024 * 1024)))
    google_client_id: str | None = os.getenv("GOOGLE_CLIENT_ID")
    google_client_secret: str | None = os.getenv("GOOGLE_CLIENT_SECRET")
    google_redirect_uri: str | None = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/v1/auth/google/callback")
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:3000")


settings = Settings()
