import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


def find_project_root() -> Path:
    """Find the root directory of the FraudGuard project containing models/."""
    current = Path(__file__).resolve()
    # Check parent directories for models/ directory
    for parent in [current.parent, current.parents[1], current.parents[2], current.parents[3], Path.cwd()]:
        if (parent / "models" / "fraud_model.pkl").exists():
            return parent
    # Default to current working directory
    return Path.cwd()


PROJECT_ROOT = find_project_root()


class Settings(BaseSettings):
    """Application runtime configuration."""
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Service configuration
    SERVICE_NAME: str = "FraudGuard AI Engine"
    SERVICE_VERSION: str = "1.0.0"
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"
    FASTAPI_INTERNAL_SECRET: str = os.getenv("FASTAPI_INTERNAL_SECRET", "")

    # Relative or absolute artifact paths
    MODEL_PATH: str = "models/fraud_model.pkl"
    PREPROCESSING_PATH: str = "models/preprocessing.pkl"
    METADATA_PATH: str = "models/model_metadata.json"
    MANIFEST_PATH: str = "models/model_manifest.json"

    def get_resolved_model_path(self) -> Path:
        """Resolve model path against project root if relative."""
        p = Path(self.MODEL_PATH)
        return p if p.is_absolute() else PROJECT_ROOT / p

    def get_resolved_preprocessing_path(self) -> Path:
        """Resolve preprocessing bundle path against project root if relative."""
        p = Path(self.PREPROCESSING_PATH)
        return p if p.is_absolute() else PROJECT_ROOT / p

    def get_resolved_metadata_path(self) -> Path:
        """Resolve metadata path against project root if relative."""
        p = Path(self.METADATA_PATH)
        return p if p.is_absolute() else PROJECT_ROOT / p

    def get_resolved_manifest_path(self) -> Path:
        """Resolve model manifest path against project root if relative."""
        p = Path(self.MANIFEST_PATH)
        return p if p.is_absolute() else PROJECT_ROOT / p


settings = Settings()
