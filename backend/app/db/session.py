"""Synchronous SQLAlchemy engine and session dependency management."""

from collections.abc import Generator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


class DatabaseNotConfiguredError(RuntimeError):
    """Raised when a database operation is requested without DATABASE_URL."""


# The connection pool is intentionally small for a managed Supabase PostgreSQL instance.
# It is created lazily so non-database endpoints can run without local credentials.
engine: Engine | None = None
SessionLocal: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    """Return the shared engine, creating it from DATABASE_URL on first use."""
    global engine

    if engine is None:
        if not settings.database_url:
            raise DatabaseNotConfiguredError("DATABASE_URL is not configured")
        engine = create_engine(
            settings.database_url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=5,
            pool_timeout=30,
            pool_recycle=1800,
        )
    return engine


def get_session_factory() -> sessionmaker[Session]:
    """Return the shared session factory bound to the Billora database engine."""
    global SessionLocal

    if SessionLocal is None:
        SessionLocal = sessionmaker(
            bind=get_engine(),
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
        )
    return SessionLocal


def get_db() -> Generator[Session, None, None]:
    """Yield a database session and always close it after the request."""
    db = get_session_factory()()
    try:
        yield db
    finally:
        db.close()
