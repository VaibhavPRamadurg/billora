from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1 import health
from app.main import app


client = TestClient(app)


class SuccessfulConnection:
    def __enter__(self) -> "SuccessfulConnection":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def execute(self, _statement: object) -> None:
        return None


class SuccessfulEngine:
    def connect(self) -> SuccessfulConnection:
        return SuccessfulConnection()


class FailingEngine:
    def connect(self) -> None:
        raise SQLAlchemyError("connection failed")


def test_application_health_check() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_database_health_check_when_connected(monkeypatch) -> None:
    monkeypatch.setattr(health, "get_engine", lambda: SuccessfulEngine())

    response = client.get("/api/v1/health/db")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "connected"}


def test_database_health_check_when_unavailable(monkeypatch) -> None:
    monkeypatch.setattr(health, "get_engine", lambda: FailingEngine())

    response = client.get("/api/v1/health/db")

    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}
