from app.core.config import Settings
from app.db import session


def test_settings_load_database_url_from_backend_environment_file(tmp_path) -> None:
    environment_file = tmp_path / ".env"
    environment_file.write_text(
        "DATABASE_URL=postgresql+psycopg://user:pass@example.com:5432/billora?sslmode=require\n"
        "FRONTEND_URL=http://localhost:5173\n",
        encoding="utf-8",
    )

    configured_settings = Settings(_env_file=environment_file)

    assert configured_settings.database_url is not None
    assert configured_settings.database_url.startswith("postgresql+psycopg://")
    assert configured_settings.frontend_url == "http://localhost:5173"


def test_get_db_closes_session(monkeypatch) -> None:
    class FakeSession:
        closed = False

        def close(self) -> None:
            self.closed = True

    fake_session = FakeSession()
    monkeypatch.setattr(session, "get_session_factory", lambda: lambda: fake_session)

    dependency = session.get_db()
    assert next(dependency) is fake_session

    dependency.close()

    assert fake_session.closed is True


def test_session_factory_is_created_from_shared_engine(monkeypatch) -> None:
    fake_engine = object()
    monkeypatch.setattr(session, "engine", None)
    monkeypatch.setattr(session, "SessionLocal", None)
    monkeypatch.setattr(session, "get_engine", lambda: fake_engine)

    session_factory = session.get_session_factory()

    assert session_factory.kw["bind"] is fake_engine
