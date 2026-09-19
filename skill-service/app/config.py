import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"

# Muat .env secara eksplisit sebelum Settings dibuat.
load_dotenv(dotenv_path=ENV_FILE, override=True)


class Settings(BaseSettings):
    app_name: str = "Leafy Skill Service"
    app_env: str = "development"
    app_host: str = "127.0.0.1"
    app_port: int = 8000
    leafy_internal_key: str

    model_config = SettingsConfigDict(
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()