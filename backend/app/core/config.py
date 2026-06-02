from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "CampusGPT"
    API_V1_STR: str = "/api/v1"
    
    # JWT Config
    SECRET_KEY: str = "super_secret_key_for_development_change_in_production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440 # 24 hours
    
    # Database Config
    DATABASE_URL: str = "sqlite:///./sql_app.db"
    
    # AI Config
    LLM_PROVIDER: str = "local" # local, openai, gemini, grok, openrouter
    OPENAI_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    XAI_API_KEY: Optional[str] = None
    GROK_MODEL: str = "grok-beta"
    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_MODEL: str = "google/gemini-2.5-flash"
    CHROMA_PERSIST_DIRECTORY: str = "./chroma_db"
    MAX_UPLOAD_SIZE_MB: int = 25
    
    # CORS Config
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"

settings = Settings()
