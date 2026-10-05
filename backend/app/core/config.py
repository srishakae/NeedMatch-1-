"""Application configuration, loaded from environment variables."""
import os

from dotenv import load_dotenv

load_dotenv()


def _normalize_database_url(url: str | None) -> str | None:
    """Make a Supabase connection string work with SQLAlchemy + psycopg (v3).

    Supabase shows URLs that start with ``postgresql://`` (or ``postgres://``).
    SQLAlchemy needs the driver name, so we rewrite the prefix.
    """
    if not url:
        return None
    url = url.strip()
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


class Settings:
    app_name: str = "NeedMatch API"
    environment: str = os.getenv("ENVIRONMENT", "development")
    # One or more allowed frontend origins, comma-separated.
    # e.g. "http://localhost:8443,https://my-app.vercel.app"
    frontend_url: str = os.getenv("FRONTEND_URL", "http://localhost:8443")
    # Supabase PostgreSQL connection string. Optional so the API (e.g. /api/health)
    # can still start without a database. Never commit a real value.
    database_url: str | None = _normalize_database_url(os.getenv("DATABASE_URL"))

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.frontend_url.split(",") if o.strip()]


settings = Settings()
