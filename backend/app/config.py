from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AxiomEval"
    api_prefix: str = "/api"
    database_url: str = "sqlite:///./axiomeval.db"
    redis_url: str | None = None
    judge_model: str = "gpt-6-astra"
    cors_origins: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=(".env.local", ".env"),
        env_prefix="AXIOM_",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
