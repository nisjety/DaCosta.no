"""
Configuration settings for LixService.
Loads settings from environment variables with sensible defaults.
"""
import os
from typing import Dict, Any
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Settings:
    """Application settings class."""
    
    # Application
    APP_NAME: str = "LixService"
    APP_VERSION: str = "3.0.0"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"
    
    # Redis
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", "6379"))
    REDIS_DB: int = int(os.getenv("REDIS_DB", "0"))
    REDIS_PASSWORD: str = os.getenv("REDIS_PASSWORD", "")
    
    # RabbitMQ
    RABBITMQ_HOST: str = os.getenv("RABBITMQ_HOST", "localhost")
    RABBITMQ_PORT: int = int(os.getenv("RABBITMQ_PORT", "5672"))
    RABBITMQ_USER: str = os.getenv("RABBITMQ_USER", "guest")
    RABBITMQ_PASSWORD: str = os.getenv("RABBITMQ_PASSWORD", "guest")
    RABBITMQ_VHOST: str = os.getenv("RABBITMQ_VHOST", "/")
    RABBITMQ_QUEUE_NAME: str = os.getenv("RABBITMQ_QUEUE_NAME", "lix_persistent_queue")
    RABBITMQ_EXCHANGE: str = os.getenv("RABBITMQ_EXCHANGE", "readability.persistent")
    RABBITMQ_ROUTING_KEY: str = os.getenv("RABBITMQ_ROUTING_KEY", "lix.critical")
    
    # Cache
    REDIS_CACHE_TTL: int = int(os.getenv("REDIS_CACHE_TTL", "3600"))  # 1 hour default
    REDIS_CACHE_TTL_SMALL: int = int(os.getenv("REDIS_CACHE_TTL_SMALL", "7200"))  # 2 hours for small texts
    REDIS_CACHE_TTL_LARGE: int = int(os.getenv("REDIS_CACHE_TTL_LARGE", "1800"))  # 30 minutes for large texts
    
    # Processing thresholds
    SMALL_TEXT_THRESHOLD: int = int(os.getenv("SMALL_TEXT_THRESHOLD", "1000"))  # Less than 1000 chars is small
    LARGE_TEXT_THRESHOLD: int = int(os.getenv("LARGE_TEXT_THRESHOLD", "10000"))  # More than 10000 chars is large
    BACKGROUND_PROCESSING_THRESHOLD: int = int(os.getenv("BACKGROUND_PROCESSING_THRESHOLD", "20000"))  # Process texts larger than 20K in background
    
    # Metrics and monitoring
    ENABLE_METRICS: bool = os.getenv("ENABLE_METRICS", "true").lower() == "true"
    
    # Logs
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO").upper()
    
    def dict(self) -> Dict[str, Any]:
        """Return settings as a dictionary."""
        return {k: v for k, v in self.__dict__.items() 
                if not k.startswith("_") and k.isupper()}
    
    def __str__(self) -> str:
        """Human-readable representation of settings."""
        items = [f"{k}={v}" for k, v in self.dict().items()]
        return f"Settings({', '.join(items)})"

# Create singleton settings instance
settings = Settings()

# For easier imports
__all__ = ["settings"]