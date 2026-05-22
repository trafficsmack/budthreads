"""
Settings router — stores platform credentials in the DB.

Endpoints:
  GET  /api/settings        — return all stored settings (secrets masked)
  PUT  /api/settings        — upsert one or more settings
  GET  /api/settings/status — connection status for each integration
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.setting import Setting

router = APIRouter(prefix="/api/settings", tags=["settings"])

SENSITIVE_KEYS = {
    "meta_access_token",
    "meta_app_secret",
    "tiktok_access_token",
    "tiktok_client_secret",
    "shopify_access_token",
    "anthropic_api_key",
}

MASK = "••••••••"


class SettingsPayload(BaseModel):
    settings: dict[str, str]


async def get_db_settings(db: AsyncSession, keys: list[str]) -> dict[str, str]:
    """Fetch a specific set of settings from the DB."""
    rows = (
        await db.execute(select(Setting).where(Setting.key.in_(keys)))
    ).scalars().all()
    return {row.key: row.value for row in rows if row.value}


@router.get("")
async def list_settings(db: AsyncSession = Depends(get_db)):
    """Return all stored settings. Sensitive values are masked."""
    rows = (await db.execute(select(Setting))).scalars().all()
    return {
        row.key: (MASK if row.key in SENSITIVE_KEYS and row.value else row.value)
        for row in rows
    }


@router.put("")
async def upsert_settings(payload: SettingsPayload, db: AsyncSession = Depends(get_db)):
    """Upsert settings. Masked placeholder values are ignored (not overwritten)."""
    for key, value in payload.settings.items():
        if not value or value == MASK:
            continue
        existing = await db.get(Setting, key)
        if existing:
            existing.value = value
        else:
            db.add(Setting(key=key, value=value))
    await db.commit()
    return {"ok": True}


@router.get("/status")
async def integration_status(db: AsyncSession = Depends(get_db)):
    """Return True/False per integration based on DB-stored credentials."""
    from app.config import get_settings
    env = get_settings()

    db_vals = await get_db_settings(db, [
        "meta_access_token", "meta_instagram_account_id", "meta_facebook_page_id",
        "tiktok_access_token", "shopify_access_token",
    ])

    def has(key: str, fallback: str) -> bool:
        return bool(db_vals.get(key) or fallback)

    return {
        "meta": all([
            has("meta_access_token", env.meta_access_token),
            has("meta_instagram_account_id", env.meta_instagram_account_id),
            has("meta_facebook_page_id", env.meta_facebook_page_id),
        ]),
        "tiktok": has("tiktok_access_token", env.tiktok_access_token),
        "shopify": has("shopify_access_token", env.shopify_access_token),
    }
