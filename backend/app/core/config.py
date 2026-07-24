from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./civic.db"
    OPENAI_API_KEY: str = ""
    GOVERNMENT_USERNAME: str = "official"
    GOVERNMENT_PASSWORD: str = "dev-password"
    AUTH_SECRET: str = "replace-this-development-auth-secret"
    AUTH_TOKEN_TTL_MINUTES: int = 480
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASS: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
