from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AxiomEval"
    api_prefix: str = "/api"
    environment: Literal["development", "test", "production"] = "development"
    database_url: str = Field(
        default="sqlite:///./axiomeval.db",
        validation_alias=AliasChoices("AXIOM_DATABASE_URL", "DATABASE_URL"),
        repr=False,
    )
    redis_url: str | None = Field(default=None, repr=False)
    judge_model: str = "gpt-6-astra"
    cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=(".env.local", ".env"),
        env_prefix="AXIOM_",
        extra="ignore",
        populate_by_name=True,
        hide_input_in_errors=True,
    )

    @field_validator("database_url")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        """Use psycopg 3 for standard Supabase/Render PostgreSQL URLs."""
        value = value.strip()
        if value.startswith("postgres://"):
            return value.replace("postgres://", "postgresql+psycopg://", 1)
        if value.startswith("postgresql://"):
            return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            item.strip().rstrip("/")
            for item in self.cors_origins.split(",")
            if item.strip()
        ]

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.environment != "production":
            return self
        if self.database_url.startswith("sqlite"):
            raise ValueError("Production requires DATABASE_URL or AXIOM_DATABASE_URL")
        if not self.cors_origin_list:
            raise ValueError("Production requires at least one AXIOM_CORS_ORIGINS value")
        for origin in self.cors_origin_list:
            parsed = urlsplit(origin)
            if (
                origin == "*"
                or parsed.scheme != "https"
                or not parsed.netloc
                or parsed.username is not None
                or parsed.password is not None
            ):
                raise ValueError(
                    "Production CORS origins must be exact HTTPS origins; wildcards are not allowed"
                )
            if parsed.path not in {"", "/"} or parsed.query or parsed.fragment:
                raise ValueError(
                    "Production CORS origins cannot include a path, query, or fragment"
                )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
