"""Database engine and session factory.

The engine is created lazily, so importing this module (or starting the API)
does not require a database connection.
"""
from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


@lru_cache
def get_engine() -> Engine:
    if not settings.database_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Copy .env.example to .env and add your "
            "Supabase connection string."
        )
    return create_engine(
        settings.database_url,
        pool_pre_ping=True,
        # Needed when connecting through Supabase's transaction pooler (port 6543).
        connect_args={"prepare_threshold": None},
    )


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """Yield a database session and always close it (for future FastAPI use)."""
    db = get_session_factory()()
    try:
        yield db
    finally:
        db.close()
