from functools import lru_cache
from pathlib import Path
from urllib.parse import quote_plus

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized runtime settings loaded from .env without storing secrets in Git."""

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[3] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = Field(default="development", alias="APP_ENV")
    app_name: str = Field(default="EduCard Secure", alias="APP_NAME")
    app_debug: bool = Field(default=False, alias="APP_DEBUG")

    database_host: str = Field(default="localhost", alias="DATABASE_HOST")
    database_port: int = Field(default=3306, alias="DATABASE_PORT")
    database_name: str = Field(default="educard_secure", alias="DATABASE_NAME")
    database_user: str = Field(default="educard_app", alias="DATABASE_USER")
    database_password: str = Field(default="", alias="DATABASE_PASSWORD")
    database_url: str = Field(default="", alias="DATABASE_URL")

    secret_key: str = Field(default="", alias="SECRET_KEY")
    field_encryption_key: str = Field(default="", alias="FIELD_ENCRYPTION_KEY")
    qr_signing_private_key_path: str = Field(default="", alias="QR_SIGNING_PRIVATE_KEY_PATH")
    qr_signing_public_key_path: str = Field(default="", alias="QR_SIGNING_PUBLIC_KEY_PATH")

    def sqlalchemy_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        password = quote_plus(self.database_password)
        return (
            f"mysql+pymysql://{self.database_user}:{password}"
            f"@{self.database_host}:{self.database_port}/{self.database_name}"
            "?charset=utf8mb4"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
