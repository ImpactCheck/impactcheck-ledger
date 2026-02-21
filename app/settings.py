from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import os
from pathlib import Path


DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


@dataclass(slots=True)
class Settings:
    app_name: str
    db_path: Path
    data_dir: Path
    uploads_dir: Path
    cors_origins: list[str]
    job_step_delay_seconds: float
    gemini_api_key: str | None


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    _load_dotenv(Path(".env"))

    data_dir = Path(os.getenv("IMPACTCHECK_DATA_DIR", "data"))
    uploads_dir = Path(os.getenv("IMPACTCHECK_UPLOADS_DIR", "data/uploads"))
    db_path = Path(os.getenv("IMPACTCHECK_DB_PATH", "data/impactcheck.db"))

    cors_origins_raw = os.getenv("IMPACTCHECK_CORS_ORIGINS", "")
    if cors_origins_raw.strip():
        cors_origins = [origin.strip() for origin in cors_origins_raw.split(",") if origin.strip()]
    else:
        cors_origins = DEFAULT_CORS_ORIGINS

    return Settings(
        app_name=os.getenv("IMPACTCHECK_APP_NAME", "ImpactCheck v2 API"),
        db_path=db_path,
        data_dir=data_dir,
        uploads_dir=uploads_dir,
        cors_origins=cors_origins,
        job_step_delay_seconds=float(os.getenv("IMPACTCHECK_JOB_STEP_DELAY_SECONDS", "0.2")),
        gemini_api_key=os.getenv("GEMINI_API_KEY") or None,
    )
