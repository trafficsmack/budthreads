"""
Vintage Bud Threads — Social Media Publishing Platform
FastAPI backend entry point.

Start with:
  uvicorn main:app --reload --host 0.0.0.0 --port 8000

Or with the convenience script:
  python main.py
"""

import uvicorn
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import init_db, get_db
from app.models.post import Post, PostStatus
from app.models.product import Product
from app.models.setting import Setting  # noqa: F401 — registers table with Base
from app.routers import products, posts, agents, research, shopify_auth, settings as settings_router
from app.routers.auth import router as auth_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the database on startup."""
    await init_db()
    yield


app = FastAPI(
    title="Vintage Bud Threads — Social Media API",
    description=(
        "AI-powered social media publishing platform for Vintage Bud Threads. "
        "Generates captions, researches trends, discovers influencers, and publishes "
        "content to Instagram, Facebook, and TikTok."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
_cors_origins = [
    settings.frontend_url,
    "http://localhost:3000",
    "http://localhost:3001",
]
# Accept any Vercel preview/production URL automatically
_cors_origin_regex = r"https://.*\.vercel\.app"

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=_cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(products.router)
app.include_router(posts.router)
app.include_router(agents.router)
app.include_router(research.router)
app.include_router(shopify_auth.router)
app.include_router(settings_router.router)

# ── Auth middleware ───────────────────────────────────────────────────────────
_PUBLIC_PATHS = {"/", "/health", "/api/auth/login", "/api/auth/verify"}


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    if path in _PUBLIC_PATHS or path.startswith(("/docs", "/openapi", "/redoc")):
        return await call_next(request)
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return JSONResponse(status_code=401, content={"detail": "Not authenticated"})
    try:
        jwt.decode(auth[7:], settings.secret_key, algorithms=["HS256"])
    except JWTError:
        return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})
    return await call_next(request)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/", tags=["system"])
async def root():
    return {"name": "Vintage Bud Threads API", "status": "ok"}


@app.get("/health", tags=["system"])
async def health_check():
    """
    Health check endpoint. Returns the status of configured integrations
    so the frontend can surface warnings about missing credentials.
    """
    from app.social.meta import is_configured as meta_configured
    from app.social.tiktok import is_configured as tiktok_configured
    from app.shopify.client import is_configured as shopify_configured

    anthropic_configured = bool(settings.anthropic_api_key)

    return {
        "status": "ok",
        "version": "1.0.0",
        "integrations": {
            "anthropic": anthropic_configured,
            "meta": meta_configured(),
            "tiktok": tiktok_configured(),
            "shopify": shopify_configured(),
        },
        "warnings": [
            name
            for name, ok in {
                "ANTHROPIC_API_KEY": anthropic_configured,
                "META credentials": meta_configured(),
                "TIKTOK credentials": tiktok_configured(),
                "SHOPIFY credentials": shopify_configured(),
            }.items()
            if not ok
        ],
    }


@app.get("/api/stats", tags=["system"])
async def get_stats(db: AsyncSession = Depends(get_db)):
    """Dashboard summary stats."""
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    total_posts = (await db.execute(select(func.count()).select_from(Post))).scalar_one()
    published_this_week = (
        await db.execute(
            select(func.count())
            .select_from(Post)
            .where(Post.status == PostStatus.published, Post.published_at >= week_ago)
        )
    ).scalar_one()
    draft_posts = (
        await db.execute(
            select(func.count()).select_from(Post).where(Post.status == PostStatus.draft)
        )
    ).scalar_one()
    total_products = (await db.execute(select(func.count()).select_from(Product))).scalar_one()

    return {
        "total_posts": total_posts,
        "published_this_week": published_this_week,
        "draft_posts": draft_posts,
        "total_products": total_products,
    }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
