"""Environment-driven application configuration."""

from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables or the project .env file."""

    app_name: str = "Billora — Subscription Management System"
    database_url: str | None = None
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    frontend_url: str = "http://localhost:5173"
    billing_country: str = "IN"

    @field_validator("billing_country")
    @classmethod
    def normalize_billing_country(cls, value: str) -> str:
        """Validate the MVP tax-country assumption, not a customer address."""
        if not isinstance(value, str) or len(value.strip()) != 2 or not value.strip().isalpha():
            raise ValueError("BILLING_COUNTRY must be a two-letter country code")
        return value.strip().upper()

    model_config = SettingsConfigDict(
        env_file=BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
