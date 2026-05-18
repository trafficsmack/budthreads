"""
Shopify OAuth router.

Handles the OAuth 2.0 authorization code flow for Shopify custom apps
created via the Shopify Dev Dashboard (client_id + client_secret).

Flow:
  GET /api/shopify/auth      → redirects to Shopify's OAuth consent screen
  GET /api/shopify/callback  → exchanges code for token, stores in DB,
                               redirects back to the frontend dashboard
"""

import hmac
import hashlib
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.setting import Setting

router = APIRouter(prefix="/api/shopify", tags=["shopify-auth"])
settings = get_settings()

SCOPES = "read_products"


def _redirect_uri() -> str:
    return f"https://{settings.shopify_store_domain.replace('.myshopify.com', '')}.myshopify.com"


def _callback_uri(request: Request) -> str:
    base = str(request.base_url).rstrip("/")
    return f"{base}/api/shopify/callback"


@router.get("/auth")
async def shopify_auth(request: Request):
    """Redirect the browser to Shopify's OAuth consent page."""
    if not settings.shopify_client_id:
        raise HTTPException(status_code=400, detail="SHOPIFY_CLIENT_ID not configured.")

    shop = settings.shopify_store_domain
    callback = _callback_uri(request)
    auth_url = (
        f"https://{shop}/admin/oauth/authorize"
        f"?client_id={settings.shopify_client_id}"
        f"&scope={SCOPES}"
        f"&redirect_uri={callback}"
    )
    return RedirectResponse(auth_url)


@router.get("/callback")
async def shopify_callback(
    request: Request,
    code: str,
    shop: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Shopify redirects here after the merchant authorizes the app.
    Exchange the code for a permanent access token and store it.
    """
    if not settings.shopify_client_id or not settings.shopify_client_secret:
        raise HTTPException(status_code=400, detail="Shopify OAuth not configured.")

    # Exchange authorization code for access token
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"https://{shop}/admin/oauth/access_token",
            json={
                "client_id": settings.shopify_client_id,
                "client_secret": settings.shopify_client_secret,
                "code": code,
            },
        )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"Shopify token exchange failed: {resp.text}",
            )
        data = resp.json()

    access_token = data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=502, detail="No access_token in Shopify response.")

    # Persist token in the settings table
    existing = await db.get(Setting, "shopify_access_token")
    if existing:
        existing.value = access_token
    else:
        db.add(Setting(key="shopify_access_token", value=access_token))
    await db.commit()

    # Redirect back to the frontend dashboard
    return RedirectResponse(f"{settings.frontend_url}?shopify=connected")


@router.get("/status")
async def shopify_status(db: AsyncSession = Depends(get_db)):
    """Return whether Shopify is connected (token exists in DB or env)."""
    if settings.shopify_access_token:
        return {"connected": True, "source": "env"}
    result = await db.execute(select(Setting).where(Setting.key == "shopify_access_token"))
    setting = result.scalar_one_or_none()
    return {"connected": bool(setting), "source": "db" if setting else None}
