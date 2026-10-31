"""Shared SQLAlchemy declarative base for all Billora ORM models."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base class to inherit from when adding ORM models in later phases."""
