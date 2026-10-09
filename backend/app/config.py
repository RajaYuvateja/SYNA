"""Configuration and environment management for Clinical Triage."""
import os
import pathlib
from pydantic import BaseModel

APP_DIR = pathlib.Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent
FRONTEND_DIR = PROJECT_ROOT / "frontend"

# Load environment variables from .env file at project root
try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")
except ImportError:
    pass


class Settings(BaseModel):
    # App
    app_title: str = "Clinical Voice Triage & Intake Aid"
    app_version: str = "1.0.0"
    debug: bool = os.getenv("DEBUG", "false").lower() in ("true", "1")
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))

    # Speech & Translation Providers
    sarvam_api_key: str = os.getenv("SARVAM_API_KEY", "")
    google_project_id: str = os.getenv("GOOGLE_PROJECT_ID", "")
    google_glossary_id: str = os.getenv("GOOGLE_GLOSSARY_ID", "")

    # GroqCloud (Ultra-fast LLM clinical extraction & Whisper speech)
    groq_api_key: str = os.getenv("GROQ_API_KEY", "")
    groq_model: str = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")

    # Storage
    database_url: str = os.getenv("DATABASE_URL", "postgresql://triage:triage@localhost:5432/triage")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    # Directory Paths
    frontend_dir: pathlib.Path = FRONTEND_DIR
    backend_dir: pathlib.Path = BACKEND_DIR


settings = Settings()
