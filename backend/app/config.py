from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    anthropic_api_key: str = ""
    meta_app_id: str = ""
    meta_app_secret: str = ""
    meta_access_token: str = ""
    meta_instagram_account_id: str = ""
    meta_facebook_page_id: str = ""
    tiktok_client_key: str = ""
    tiktok_client_secret: str = ""
    tiktok_access_token: str = ""
    shopify_store_domain: str = "vintagebudthreads.myshopify.com"
    shopify_access_token: str = ""
    shopify_client_id: str = ""
    shopify_client_secret: str = ""
    database_url: str = "sqlite+aiosqlite:///./budthreads.db"
    frontend_url: str = "http://localhost:3000"
    backend_url: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()
