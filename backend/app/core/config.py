from __future__ import annotations

from typing import Any, List, Optional

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "AutoReply AI"
    VERSION: str = "1.0.0"
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/autoreply"
    REDIS_URL: str = ""
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o"
    AI_GENERATION_ENABLED: bool = False
    AI_REQUEST_TIMEOUT_SECONDS: float = Field(15.0, ge=2, le=18)
    ALLOW_SIGNUPS: bool = False
    AUTO_CREATE_TABLES: bool = False
    APP_URL: str = "http://localhost:3000"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    EMBEDDING_MODEL: str = "text-embedding-3-small"

    VECTOR_DB_TYPE: str = "pinecone"
    PINECONE_API_KEY: Optional[str] = None
    PINECONE_ENVIRONMENT: Optional[str] = None
    PINECONE_INDEX_NAME: str = "autoreply"
    QDRANT_URL: Optional[str] = None

    SENTRY_DSN: Optional[str] = None

    CORS_ORIGINS: str = "http://localhost:3000"

    WEBHOOK_SECRET: Optional[str] = None

    @field_validator("DATABASE_URL")
    @classmethod
    def ensure_async_driver(cls, v: str) -> str:
        if v.startswith(("postgres://", "postgresql://")):
            v = "postgresql+asyncpg://" + v.split("://", 1)[1]
        if v.startswith("postgresql+asyncpg://") and "sslmode=" in v:
            from sqlalchemy.engine import make_url

            url = make_url(v)
            if "sslmode" in url.query:
                query = dict(url.query)
                query["ssl"] = query.pop("sslmode")
                return url.set(query=query).render_as_string(hide_password=False)
        return v

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError(
                "SECRET_KEY must be at least 32 characters long. "
                "Generate one with: openssl rand -hex 32"
            )
        if v in ("your-secret-key-change-in-production-min-32-chars", "replace-with-random-secret-at-least-32-characters"):
            raise ValueError(
                "SECRET_KEY must be changed from the default value. "
                "Generate a secure random key with: openssl rand -hex 32"
            )
        return v

    @field_validator("OPENAI_API_KEY")
    @classmethod
    def validate_openai_key(cls, v: str) -> str:
        if v and v.startswith("sk-") and v != "sk-your-openai-api-key":
            return v
        if v and v != "sk-your-openai-api-key":
            return v
        if not v:
            return v
        raise ValueError(
            "OPENAI_API_KEY appears to be a placeholder. Set a valid OpenAI API key."
        )

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @field_validator("CORS_ORIGINS")
    @classmethod
    def require_explicit_origins(cls, value: str) -> str:
        if "*" in value:
            raise ValueError("Use explicit CORS origins")
        return value

    @model_validator(mode="after")
    def limit_live_ai_to_provisioned_workspaces(self):
        if self.AI_GENERATION_ENABLED and self.ALLOW_SIGNUPS:
            raise ValueError("Disable public registration before enabling live AI")
        return self

    CELERY_BROKER_URL: str = ""
    CELERY_RESULT_BACKEND: str = ""
    RATE_LIMIT: str = "100/minute"

    AI_QUALITY_THRESHOLD: float = 0.85
    SAFETY_SCORE_THRESHOLD: float = 0.90
    ENABLE_AUDIT_LOG: bool = True
    DEFAULT_TENANT_PLAN: str = "starter"

    MAX_REQUEST_BODY_SIZE: int = 2_000_000

    @property
    def compute_redis_url(self) -> str:
        if self.REDIS_URL:
            return self.REDIS_URL
        if self.CELERY_BROKER_URL:
            return self.CELERY_BROKER_URL
        return "redis://localhost:6379/0"


settings = Settings()
