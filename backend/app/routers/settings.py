"""
Settings router — stores platform credentials in the DB.

Endpoints:
  GET  /api/settings                     — return all stored settings (secrets masked)
  PUT  /api/settings                     — upsert one or more settings
  GET  /api/settings/status              — connection status per integration
  GET  /api/settings/meta/oauth/start    — redirect to Facebook OAuth dialog
  GET  /api/settings/meta/oauth/callback — Facebook redirects here after auth
  GET  /api/settings/meta/pending-pages  — list pages awaiting user selection
  POST /api/settings/meta/select-page    — finalize page selection (multi-page accounts)
"""

import json
from urllib.parse import urlencode, quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from fastapi import Request
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
GRAPH_API_BASE = "https://graph.facebook.com/v21.0"
META_SCOPES = ",".join([
    "pages_show_list",
    "pages_manage_posts",
    "pages_read_engagement",
    "instagram_content_publish",
])


# ── Helpers ───────────────────────────────────────────────────────────────────

class SettingsPayload(BaseModel):
    settings: dict[str, str]


async def get_db_settings(db: AsyncSession, keys: list[str]) -> dict[str, str]:
    rows = (
        await db.execute(select(Setting).where(Setting.key.in_(keys)))
    ).scalars().all()
    return {row.key: row.value for row in rows if row.value}


async def _upsert(db: AsyncSession, key: str, value: str) -> None:
    existing = await db.get(Setting, key)
    if existing:
        existing.value = value
    else:
        db.add(Setting(key=key, value=value))


def _callback_url(request: Request) -> str:
    base = str(request.base_url).rstrip("/")
    # Railway (and most cloud platforms) terminate SSL at the proxy; uvicorn sees http://.
    # Force https:// for any non-localhost host so Facebook accepts the redirect URI.
    if base.startswith("http://") and "localhost" not in base and "127.0.0.1" not in base:
        base = "https://" + base[len("http://"):]
    return base + "/api/settings/meta/oauth/callback"


# ── General settings endpoints ────────────────────────────────────────────────

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
    """Upsert settings. Masked placeholder values are ignored."""
    for key, value in payload.settings.items():
        if not value or value == MASK:
            continue
        await _upsert(db, key, value)
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


# ── Meta OAuth flow ───────────────────────────────────────────────────────────

@router.get("/meta/oauth/start")
async def meta_oauth_start(request: Request, db: AsyncSession = Depends(get_db)):
    """Redirect the browser to the Facebook OAuth consent screen."""
    from app.config import get_settings
    env = get_settings()
    frontend_url = env.frontend_url or "http://localhost:3000"

    db_vals = await get_db_settings(db, ["meta_app_id"])
    app_id = db_vals.get("meta_app_id") or env.meta_app_id

    if not app_id:
        return RedirectResponse(f"{frontend_url}/settings?error=missing_app_id")

    params = {
        "client_id": app_id,
        "redirect_uri": _callback_url(request),
        "scope": META_SCOPES,
        "response_type": "code",
    }
    return RedirectResponse(
        "https://www.facebook.com/v21.0/dialog/oauth?" + urlencode(params)
    )


@router.get("/meta/oauth/callback")
async def meta_oauth_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
    code: str | None = Query(default=None),
    error: str | None = Query(default=None),
    error_description: str | None = Query(default=None),
):
    """Facebook redirects here after the user grants (or denies) permissions."""
    from app.config import get_settings
    env = get_settings()
    frontend_url = env.frontend_url or "http://localhost:3000"

    if error or not code:
        msg = quote(error_description or error or "access_denied")
        return RedirectResponse(f"{frontend_url}/settings?error={msg}")

    db_vals = await get_db_settings(db, ["meta_app_id", "meta_app_secret"])
    app_id = db_vals.get("meta_app_id") or env.meta_app_id
    app_secret = db_vals.get("meta_app_secret") or env.meta_app_secret

    if not app_secret:
        return RedirectResponse(f"{frontend_url}/settings?error=missing_app_secret")

    callback_url = _callback_url(request)

    async with httpx.AsyncClient(timeout=15.0) as client:
        # 1. Exchange authorization code for short-lived user token
        token_res = await client.get(
            f"{GRAPH_API_BASE}/oauth/access_token",
            params={
                "client_id": app_id,
                "client_secret": app_secret,
                "redirect_uri": callback_url,
                "code": code,
            },
        )
        token_data = token_res.json()
        if "error" in token_data:
            msg = quote(token_data["error"].get("message", "token_exchange_failed"))
            return RedirectResponse(f"{frontend_url}/settings?error={msg}")

        # 2. Extend to long-lived user token (60 days)
        ll_res = await client.get(
            f"{GRAPH_API_BASE}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": app_id,
                "client_secret": app_secret,
                "fb_exchange_token": token_data["access_token"],
            },
        )
        ll_data = ll_res.json()
        if "error" in ll_data:
            return RedirectResponse(f"{frontend_url}/settings?error=token_extend_failed")

        long_token = ll_data["access_token"]

        # 3. Fetch all pages this user manages (each gets its own non-expiring page token)
        pages_res = await client.get(
            f"{GRAPH_API_BASE}/me/accounts",
            params={"access_token": long_token, "fields": "id,name,access_token"},
        )
        pages = pages_res.json().get("data", [])

        if not pages:
            # pages_show_list may not have been granted — save the user token so
            # the frontend can let the user type their Page ID and we finish from there.
            await _upsert(db, "meta_user_token_temp", long_token)

            # If we already have a stored Page ID, try connecting automatically.
            db_vals2 = await get_db_settings(db, ["meta_facebook_page_id"])
            stored_page_id = db_vals2.get("meta_facebook_page_id", "").strip()
            if stored_page_id:
                await db.commit()
                async with httpx.AsyncClient(timeout=15.0) as inner_client:
                    page_res = await inner_client.get(
                        f"{GRAPH_API_BASE}/{stored_page_id}",
                        params={"fields": "id,name,access_token,instagram_business_account", "access_token": long_token},
                    )
                    page_data = page_res.json()
                if "error" not in page_data:
                    page_token = page_data.get("access_token") or long_token
                    page_name = page_data.get("name", stored_page_id)
                    ig_id = (page_data.get("instagram_business_account") or {}).get("id", "")
                    to_save = {"meta_access_token": page_token, "meta_facebook_page_id": stored_page_id}
                    if ig_id:
                        to_save["meta_instagram_account_id"] = ig_id
                    for key, value in to_save.items():
                        await _upsert(db, key, value)
                    temp = await db.get(Setting, "meta_user_token_temp")
                    if temp:
                        await db.delete(temp)
                    await db.commit()
                    qs = f"connected=meta&page={quote(page_name)}"
                    if ig_id:
                        qs += "&ig=1"
                    return RedirectResponse(f"{frontend_url}/settings?{qs}")

            await db.commit()
            return RedirectResponse(f"{frontend_url}/settings?enter_page_id=1")

        if len(pages) == 1:
            return await _save_page(pages[0], db, frontend_url, client)

        # Multiple pages — let the user pick
        pending = json.dumps([
            {"id": p["id"], "name": p["name"], "token": p["access_token"]}
            for p in pages
        ])
        await _upsert(db, "meta_pending_pages", pending)
        await db.commit()
        return RedirectResponse(f"{frontend_url}/settings?select_page=1")


@router.get("/meta/pending-pages")
async def meta_pending_pages(db: AsyncSession = Depends(get_db)):
    """Return the pages awaiting user selection (multi-page accounts only)."""
    row = await db.get(Setting, "meta_pending_pages")
    if not row:
        return {"pages": []}
    pages = json.loads(row.value)
    return {"pages": [{"id": p["id"], "name": p["name"]} for p in pages]}


@router.post("/meta/select-page")
async def meta_select_page(
    page_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Finalize credential setup by choosing one page from a multi-page account."""
    from app.config import get_settings
    env = get_settings()

    row = await db.get(Setting, "meta_pending_pages")
    if not row:
        raise HTTPException(status_code=400, detail="No pending page selection")

    pages = json.loads(row.value)
    page = next((p for p in pages if p["id"] == page_id), None)
    if not page:
        raise HTTPException(status_code=404, detail="Page ID not found")

    async with httpx.AsyncClient(timeout=15.0) as client:
        ig_id = await _fetch_ig_id(page["id"], page["token"], client)

    to_save = {
        "meta_access_token": page["token"],
        "meta_facebook_page_id": page["id"],
    }
    if ig_id:
        to_save["meta_instagram_account_id"] = ig_id

    for key, value in to_save.items():
        await _upsert(db, key, value)
    await db.delete(row)
    await db.commit()

    return {"ok": True, "page": page["name"], "ig": bool(ig_id)}


@router.post("/meta/connect-page")
async def meta_connect_page(
    page_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Fallback for when /me/accounts returns no pages (pages_show_list not granted).
    Uses the temporarily saved user token + a manually supplied Page ID to fetch
    the page access token and linked Instagram account, then saves all credentials.
    """
    token_row = await db.get(Setting, "meta_user_token_temp")
    if not token_row:
        raise HTTPException(status_code=400, detail="No authenticated session found. Please click 'Connect with Facebook' again.")

    user_token = token_row.value
    page_id = page_id.strip()

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Fetch page name + page access token using the user token
        page_res = await client.get(
            f"{GRAPH_API_BASE}/{page_id}",
            params={"fields": "id,name,access_token,instagram_business_account", "access_token": user_token},
        )
        page_data = page_res.json()

        if "error" in page_data:
            raise HTTPException(
                status_code=400,
                detail=page_data["error"].get("message", "Could not access that Page. Make sure this account is an Admin of the Page."),
            )

        page_token = page_data.get("access_token") or user_token
        page_name = page_data.get("name", page_id)
        ig_id = (page_data.get("instagram_business_account") or {}).get("id", "")

    to_save = {
        "meta_access_token": page_token,
        "meta_facebook_page_id": page_id,
    }
    if ig_id:
        to_save["meta_instagram_account_id"] = ig_id

    for key, value in to_save.items():
        await _upsert(db, key, value)

    # Clean up temp token
    await db.delete(token_row)
    await db.commit()

    return {"ok": True, "page": page_name, "ig": bool(ig_id)}


@router.get("/meta/save")
async def meta_save_via_url(
    access_token: str = Query(...),
    page_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """GET version of setup-from-token so credentials can be saved by visiting a URL."""
    from app.config import get_settings
    env = get_settings()
    frontend_url = env.frontend_url or "http://localhost:3000"
    result = await _do_setup_from_token(access_token.strip(), page_id.strip(), db)
    return RedirectResponse(
        f"{frontend_url}/settings?connected=meta&page={quote(result['page'])}{('&ig=1' if result['ig'] else '')}"
    )


@router.post("/meta/setup-from-token")
async def meta_setup_from_token(
    access_token: str = Query(...),
    page_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Save a Page Access Token + Page ID, auto-fetching Instagram account ID."""
    result = await _do_setup_from_token(access_token.strip(), page_id.strip(), db)
    return result


# ── Internal helpers ──────────────────────────────────────────────────────────

async def _do_setup_from_token(access_token: str, page_id: str, db: AsyncSession) -> dict:
    ig_id = ""
    page_name = page_id

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(
            f"{GRAPH_API_BASE}/{page_id}",
            params={"fields": "id,name,instagram_business_account", "access_token": access_token},
        )
        data = res.json()

        if "error" in data:
            res2 = await client.get(
                f"{GRAPH_API_BASE}/{page_id}",
                params={"fields": "id,name", "access_token": access_token},
            )
            data2 = res2.json()
            if "error" in data2:
                accts = (await client.get(
                    f"{GRAPH_API_BASE}/me/accounts",
                    params={"access_token": access_token, "fields": "id,name,access_token"},
                )).json().get("data", [])
                match = next((p for p in accts if p["id"] == page_id), None)
                if match:
                    access_token = match["access_token"]
                    page_name = match.get("name", page_id)
                    ig_id = (await client.get(
                        f"{GRAPH_API_BASE}/{page_id}",
                        params={"fields": "instagram_business_account", "access_token": access_token},
                    )).json().get("instagram_business_account", {}).get("id", "") or ""
            else:
                page_name = data2.get("name", page_id)
                ig_id = (data2.get("instagram_business_account") or {}).get("id", "")
        else:
            page_name = data.get("name", page_id)
            ig_id = (data.get("instagram_business_account") or {}).get("id", "")

    to_save = {"meta_access_token": access_token, "meta_facebook_page_id": page_id}
    if ig_id:
        to_save["meta_instagram_account_id"] = ig_id
    for key, value in to_save.items():
        await _upsert(db, key, value)
    await db.commit()

    return {"ok": True, "page": page_name, "ig": bool(ig_id), "ig_id": ig_id}


async def _fetch_ig_id(page_id: str, page_token: str, client: httpx.AsyncClient) -> str:
    res = await client.get(
        f"{GRAPH_API_BASE}/{page_id}",
        params={"fields": "instagram_business_account", "access_token": page_token},
    )
    return (res.json().get("instagram_business_account") or {}).get("id", "")


async def _save_page(
    page: dict,
    db: AsyncSession,
    frontend_url: str,
    client: httpx.AsyncClient,
) -> RedirectResponse:
    ig_id = await _fetch_ig_id(page["id"], page["access_token"], client)

    to_save = {
        "meta_access_token": page["access_token"],
        "meta_facebook_page_id": page["id"],
    }
    if ig_id:
        to_save["meta_instagram_account_id"] = ig_id

    for key, value in to_save.items():
        await _upsert(db, key, value)

    pending = await db.get(Setting, "meta_pending_pages")
    if pending:
        await db.delete(pending)

    await db.commit()

    qs = f"connected=meta&page={quote(page['name'])}"
    if ig_id:
        qs += "&ig=1"
    return RedirectResponse(f"{frontend_url}/settings?{qs}")
