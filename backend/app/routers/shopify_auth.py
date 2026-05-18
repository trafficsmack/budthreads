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
from sqlalchemy import func, select
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
    # Prefer explicit BACKEND_URL env var (avoids http vs https mismatch behind proxies)
    if settings.backend_url:
        return f"{settings.backend_url.rstrip('/')}/api/shopify/callback"
    base = str(request.base_url).rstrip("/").replace("http://", "https://")
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


@router.get("/test")
async def shopify_test():
    """Hit the Shopify API directly and return the raw response for debugging."""
    try:
        access_token = settings.shopify_access_token
        store = settings.shopify_store_domain
        url = f"https://{store}/admin/api/2024-01/products.json?limit=3"
        headers = {"X-Shopify-Access-Token": access_token}

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers)

        try:
            body = resp.json()
        except Exception:
            body = resp.text

        return {
            "store": store,
            "token_prefix": (access_token[:8] + "...") if len(access_token) > 8 else f"({len(access_token)} chars)",
            "status_code": resp.status_code,
            "response": body,
        }
    except Exception as e:
        return {"error": str(e), "type": type(e).__name__}


@router.get("/debug")
async def shopify_debug(db: AsyncSession = Depends(get_db)):
    """
    Diagnostic endpoint: shows which token will be used for sync, calls Shopify
    with status=any to count all products, and reports local DB product count.
    """
    from app.models.product import Product as ProductModel

    # Determine which token sync will use
    token_source = "env"
    access_token = settings.shopify_access_token
    if not access_token:
        token_source = "db"
        result = await db.execute(select(Setting).where(Setting.key == "shopify_access_token"))
        setting = result.scalar_one_or_none()
        access_token = setting.value if setting else ""

    if not access_token:
        return {"error": "No Shopify access token configured.", "token_source": None}

    store = settings.shopify_store_domain
    token_display = (access_token[:6] + "..." + access_token[-4:]) if len(access_token) > 10 else f"({len(access_token)} chars)"

    # Count products already in local DB
    count_result = await db.execute(select(func.count()).select_from(ProductModel))
    local_count = count_result.scalar()

    # Call Shopify with status=any
    shopify_info: dict = {}
    try:
        url = f"https://{store}/admin/api/2024-01/products.json?limit=10&status=any"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers={"X-Shopify-Access-Token": access_token})
        shopify_info = {
            "status_code": resp.status_code,
            "product_count_in_first_page": len(resp.json().get("products", [])) if resp.status_code == 200 else 0,
            "sample_titles": [p.get("title") for p in resp.json().get("products", [])[:5]] if resp.status_code == 200 else [],
            "error": None if resp.status_code == 200 else resp.text[:300],
        }
    except Exception as e:
        shopify_info = {"error": str(e)}

    return {
        "store": store,
        "token_source": token_source,
        "token": token_display,
        "local_db_products": local_count,
        "shopify": shopify_info,
    }
