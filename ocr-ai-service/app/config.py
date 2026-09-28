from functools import lru_cache
from typing import Optional, Set
from urllib.parse import urlparse

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ocr-ai-service"
    env: str = "development"
    log_level: str = "INFO"

    ocr_backend: str = "auto"  # auto | rapidocr | tesseract
    service_auth_token: Optional[str] = None

    nestjs_callback_url: Optional[str] = None
    callback_auth_token: Optional[str] = None
    callback_hmac_secret: Optional[str] = None

    callback_timeout_seconds: float = 12.0
    callback_max_attempts: int = 3
    callback_backoff_seconds: float = 0.5
    callback_outbox_dir: str = "data/callback-outbox"
    callback_outbox_retry_seconds: float = 30.0
    request_timeout_seconds: float = 20.0
    max_image_bytes: int = 10_000_000
    max_image_pixels: int = 20_000_000
    max_concurrent_jobs: int = 2
    min_required_field_confidence: float = 0.5
    max_transaction_amount: int = 1_000_000_000
    allowed_image_hosts: Optional[str] = None

    enable_diagnostics: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_security_settings(self) -> "Settings":
        if self.env.lower() != "development":
            if not self.service_auth_token:
                raise ValueError("SERVICE_AUTH_TOKEN is required outside development.")
            if not self.nestjs_callback_url:
                raise ValueError("NESTJS_CALLBACK_URL is required outside development.")
            if not (self.callback_auth_token or self.callback_hmac_secret):
                raise ValueError(
                    "CALLBACK_AUTH_TOKEN or CALLBACK_HMAC_SECRET is required outside development."
                )
        if self.callback_max_attempts < 1:
            raise ValueError("CALLBACK_MAX_ATTEMPTS must be at least 1.")
        if self.callback_outbox_retry_seconds <= 0:
            raise ValueError("CALLBACK_OUTBOX_RETRY_SECONDS must be positive.")
        if self.max_concurrent_jobs < 1:
            raise ValueError("MAX_CONCURRENT_JOBS must be at least 1.")
        if self.max_transaction_amount < 1:
            raise ValueError("MAX_TRANSACTION_AMOUNT must be positive.")
        return self

    @property
    def allowed_hosts_set(self) -> Set[str]:
        if not self.allowed_image_hosts:
            return set()
        return {
            item.strip().lower()
            for item in self.allowed_image_hosts.split(",")
            if item.strip()
        }

    def resolve_callback_url(self, requested_url: Optional[str]) -> Optional[str]:
        configured = self.nestjs_callback_url
        if not configured:
            return None

        if requested_url and self._normalize_url(requested_url) != self._normalize_url(configured):
            raise ValueError("Requested callback URL is not trusted.")
        return configured

    @staticmethod
    def _normalize_url(value: str) -> str:
        parsed = urlparse(value)
        return parsed._replace(path=parsed.path.rstrip("/"), query="", fragment="").geturl()


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
