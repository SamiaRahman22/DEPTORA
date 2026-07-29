"""Application configuration using pydantic-settings."""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List
import os


class Settings(BaseSettings):
    # App
    APP_NAME: str = "DeptAI - Department Assistant"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    FRONTEND_URL: str = "http://localhost:3000"

    # CORS — comma-separated list of allowed browser origins.
    # Add every host:port you actually load the frontend from (protocol matters —
    # http://localhost:3000 and http://127.0.0.1:3000 are different origins).
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Security
    SECRET_KEY: str = "change-this-to-a-real-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    DATABASE_URL: str = "sqlite:///./deptai.db"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"
    OLLAMA_TIMEOUT: int = 120

    # RAG
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    FAISS_INDEX_PATH: str = "./data/faiss_index"
    DOCUMENTS_PATH: str = "./data/documents"
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 50
    TOP_K_RESULTS: int = 5

    # Domain Restriction
    DEPARTMENT_NAME: str = "Computer Science & Engineering"
    DOMAIN_KEYWORDS: str = "course,curriculum,exam,assignment,thesis,attendance,faculty,professor,department,grade,cgpa,credit,semester,scholarship,transcript,fee,lab,research,procedure,deadline,notice,admission,internship,lecture,supervisor,class,schedule"
    DOMAIN_THRESHOLD: float = 0.35

    @property
    def domain_keywords_list(self) -> List[str]:
        return [k.strip() for k in self.DOMAIN_KEYWORDS.split(",")]

    @property
    def cors_origins_list(self) -> List[str]:
        origins = [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]
        if self.FRONTEND_URL and self.FRONTEND_URL not in origins:
            origins.append(self.FRONTEND_URL)
        return origins

    model_config = {"env_file": ".env", "case_sensitive": True}


settings = Settings()

# Ensure data directories exist
os.makedirs(settings.FAISS_INDEX_PATH, exist_ok=True)
os.makedirs(settings.DOCUMENTS_PATH, exist_ok=True)
os.makedirs("./data/uploads", exist_ok=True)