"""Versioned operational health endpoints."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import DatabaseNotConfiguredError, get_engine


router = APIRouter(prefix="/health", tags=["system"])


@router.get("/db")
def database_health_check() -> dict[str, str]:
    """Check that the configured PostgreSQL database accepts a simple query."""
    try:
        with get_engine().connect() as connection:
            connection.execute(text("SELECT 1"))
    except (DatabaseNotConfiguredError, SQLAlchemyError):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        ) from None

    return {"status": "ok", "database": "connected"}
