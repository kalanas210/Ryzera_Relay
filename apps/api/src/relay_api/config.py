"""Runtime settings, read from RELAY_* environment variables (see .env.example)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="RELAY_", env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://relay:relay@localhost:5432/relay"
    secret_key: str = "dev-only-secret-change-me-before-any-deploy"
    session_hours: int = 12
    cookie_secure: bool = False

    demo_mode: bool = True
    """Shows the demo bar: the scenario clock, private copies of the day and reset."""

    seed_dir: Path = _REPO_ROOT / "seed" / "data"
    seed_password: str = "relay2026"
    """Password of every seeded account. Loaders sign in with a PIN from the people file instead."""

    timezone: str = "Asia/Colombo"

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.timezone)


@lru_cache
def get_settings() -> Settings:
    return Settings()
