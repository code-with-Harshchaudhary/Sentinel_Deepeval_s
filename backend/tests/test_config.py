from configparser import ConfigParser

import pytest
from pydantic import ValidationError

from app.config import Settings, escape_alembic_url


def test_database_url_accepts_supabase_postgresql_scheme() -> None:
    settings = Settings(
        database_url="postgresql://user:password@db.example.test:5432/postgres?sslmode=require"
    )

    assert settings.database_url.startswith("postgresql+psycopg://")
    assert settings.database_url.endswith("?sslmode=require")


def test_alembic_url_escapes_percent_encoded_password() -> None:
    database_url = "postgresql+psycopg://user:password%40value@db.example.test/postgres"
    escaped_url = escape_alembic_url(database_url)
    parser = ConfigParser()
    parser.add_section("alembic")
    parser.set("alembic", "sqlalchemy.url", escaped_url)

    assert escaped_url == (
        "postgresql+psycopg://user:password%%40value@db.example.test/postgres"
    )
    assert parser.get("alembic", "sqlalchemy.url") == database_url


def test_database_url_supports_render_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("AXIOM_DATABASE_URL", raising=False)
    monkeypatch.setenv("DATABASE_URL", "postgres://user:password@db.example.test/postgres")

    assert Settings().database_url.startswith("postgresql+psycopg://")


@pytest.mark.parametrize(
    "cors_origins",
    ["*", "http://app.example.test", "https://app.example.test/path"],
)
def test_production_rejects_unsafe_cors_origins(cors_origins: str) -> None:
    with pytest.raises(ValidationError):
        Settings(
            environment="production",
            database_url="postgresql://user:password@db.example.test/postgres",
            cors_origins=cors_origins,
        )


def test_production_accepts_exact_https_cors_origins() -> None:
    settings = Settings(
        environment="production",
        database_url="postgresql://user:password@db.example.test/postgres",
        cors_origins="https://axiomeval.vercel.app/, https://eval.example.com",
    )

    assert settings.cors_origin_list == [
        "https://axiomeval.vercel.app",
        "https://eval.example.com",
    ]


def test_validation_errors_do_not_echo_database_credentials() -> None:
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment="production",
            database_url="postgresql://user:super-secret@db.example.test/postgres",
            cors_origins="*",
        )

    assert "super-secret" not in str(exc_info.value)
