import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    DATABASE_URL: str = Field(
        default="mysql+pymysql://reminder_user:reminder_pass@localhost:3306/reminder_db",
        validation_alias="DATABASE_URL"
    )
    JWT_SECRET: str = Field(
        default="super_secret_jwt_key_please_change_in_production_1234567890",
        validation_alias="JWT_SECRET"
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours for mobile friendliness
    
    # Web Push VAPID Settings
    VAPID_PUBLIC_KEY: str = Field(
        default="",
        validation_alias="VAPID_PUBLIC_KEY"
    )
    VAPID_PRIVATE_KEY: str = Field(
        default="",
        validation_alias="VAPID_PRIVATE_KEY"
    )
    VAPID_CLAIM_EMAIL: str = Field(
        default="mailto:admin@smartreminder.pwa",
        validation_alias="VAPID_CLAIM_EMAIL"
    )

    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
