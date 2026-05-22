"""
Posts router for Vintage Bud Threads.

Endpoints:
  GET    /api/posts               — list all posts (filterable by platform/status)
  POST   /api/posts               — create a new draft post
  GET    /api/posts/{id}          — fetch a single post
  PUT    /api/posts/{id}          — update a post
  DELETE /api/posts/{id}          — delete a post
  POST   /api/posts/{id}/publish  — publish a post to its platform
"""

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import select

from app.database import get_db
from app.models.post import Post, PostStatus, Platform
from app.models.setting import Setting
from app.social.meta import post_to_instagram, post_to_facebook
from app.social.tiktok import post_to_tiktok

router = APIRouter(prefix="/api/posts", tags=["posts"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class PostCreate(BaseModel):
    product_id: str | None = None
    platform: str
    caption: str
    hashtags: list[str] = []
    media_urls: list[str] = []
    scheduled_at: datetime | None = None


class PostUpdate(BaseModel):
    caption: str | None = None
    hashtags: list[str] | None = None
    media_urls: list[str] | None = None
    status: str | None = None
    scheduled_at: datetime | None = None


class PostOut(BaseModel):
    id: str
    product_id: str | None
    platform: str
    caption: str
    hashtags: list[Any]
    media_urls: list[Any]
    status: str
    platform_post_id: str | None
    scheduled_at: datetime | None
    published_at: datetime | None
    engagement: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[PostOut])
async def list_posts(
    platform: str | None = Query(default=None),
    status: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """
    List all posts. Optionally filter by platform and/or status.

    Query params:
      - platform: instagram | facebook | tiktok
      - status: draft | scheduled | published | failed
    """
    stmt = select(Post).order_by(Post.created_at.desc())
    if platform:
        stmt = stmt.where(Post.platform == platform)
    if status:
        stmt = stmt.where(Post.status == status)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=PostOut, status_code=201)
async def create_post(payload: PostCreate, db: AsyncSession = Depends(get_db)):
    """Create a new draft post."""
    # Validate platform
    valid_platforms = {p.value for p in Platform}
    if payload.platform not in valid_platforms:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid platform '{payload.platform}'. Must be one of: {', '.join(valid_platforms)}",
        )

    now = datetime.utcnow()
    status = PostStatus.SCHEDULED if payload.scheduled_at else PostStatus.DRAFT

    post = Post(
        id=str(uuid.uuid4()),
        product_id=payload.product_id,
        platform=payload.platform,
        caption=payload.caption,
        hashtags=payload.hashtags,
        media_urls=payload.media_urls,
        status=status.value,
        platform_post_id=None,
        scheduled_at=payload.scheduled_at,
        published_at=None,
        engagement={},
        created_at=now,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return post


@router.get("/{post_id}", response_model=PostOut)
async def get_post(post_id: str, db: AsyncSession = Depends(get_db)):
    """Fetch a single post by its database ID."""
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.put("/{post_id}", response_model=PostOut)
async def update_post(
    post_id: str,
    payload: PostUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a post's caption, hashtags, media_urls, status, or scheduled_at."""
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if payload.caption is not None:
        post.caption = payload.caption
    if payload.hashtags is not None:
        post.hashtags = payload.hashtags
    if payload.media_urls is not None:
        post.media_urls = payload.media_urls
    if payload.status is not None:
        valid_statuses = {s.value for s in PostStatus}
        if payload.status not in valid_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status '{payload.status}'. Must be one of: {', '.join(valid_statuses)}",
            )
        post.status = payload.status
    if payload.scheduled_at is not None:
        post.scheduled_at = payload.scheduled_at

    await db.commit()
    await db.refresh(post)
    return post


@router.patch("/{post_id}", response_model=PostOut)
async def patch_post(
    post_id: str,
    payload: PostUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Partial update — same behavior as PUT but accepts PATCH method."""
    return await update_post(post_id, payload, db)


@router.post("/{post_id}/approve", response_model=PostOut)
async def approve_post(post_id: str, db: AsyncSession = Depends(get_db)):
    """Approve a draft post: sets status to 'scheduled' so it will be published at scheduled_at."""
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.status != PostStatus.DRAFT.value:
        raise HTTPException(status_code=400, detail="Only draft posts can be approved.")
    post.status = PostStatus.SCHEDULED.value
    await db.commit()
    await db.refresh(post)
    return post


@router.delete("/{post_id}", status_code=204)
async def delete_post(post_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a post from the database."""
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    await db.delete(post)
    await db.commit()


@router.post("/{post_id}/publish")
async def publish_post(post_id: str, db: AsyncSession = Depends(get_db)):
    """
    Publish a post to its target social media platform.

    Dispatches to the appropriate platform integration (Meta Graph API or
    TikTok Content Posting API). Updates the post's status, platform_post_id,
    and published_at in the database based on the result.

    For Instagram/Facebook: requires publicly accessible image/video URLs.
    For TikTok: requires a publicly accessible video URL (first media_url used).
    """
    result = await db.execute(select(Post).where(Post.id == post_id))
    post = result.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post.status == PostStatus.PUBLISHED.value:
        raise HTTPException(status_code=400, detail="Post has already been published")

    media_urls: list[str] = post.media_urls or []
    image_url = media_urls[0] if media_urls else ""
    video_url = media_urls[0] if media_urls else None

    # Determine if we have a video based on extension heuristic
    video_extensions = (".mp4", ".mov", ".mpeg", ".3gp", ".avi", ".wmv", ".webm")
    has_video = any(image_url.lower().endswith(ext) for ext in video_extensions)
    effective_video_url = video_url if has_video else None
    effective_image_url = image_url if not has_video else ""

    platform = post.platform
    caption = post.caption
    hashtags: list[str] = post.hashtags or []

    # Fetch Meta credentials from DB (fall back to env vars inside meta.py)
    meta_creds: dict = {}
    if platform in (Platform.INSTAGRAM.value, Platform.FACEBOOK.value):
        key_map = {
            "meta_access_token": "access_token",
            "meta_instagram_account_id": "instagram_account_id",
            "meta_facebook_page_id": "facebook_page_id",
        }
        rows = (
            await db.execute(select(Setting).where(Setting.key.in_(key_map.keys())))
        ).scalars().all()
        for row in rows:
            if row.value:
                meta_creds[key_map[row.key]] = row.value

    publish_result: dict = {}

    if platform == Platform.INSTAGRAM.value:
        publish_result = await post_to_instagram(
            caption=caption,
            hashtags=hashtags,
            image_url=effective_image_url,
            video_url=effective_video_url,
            credentials=meta_creds or None,
        )
    elif platform == Platform.FACEBOOK.value:
        publish_result = await post_to_facebook(
            caption=caption,
            hashtags=hashtags,
            image_url=effective_image_url,
            video_url=effective_video_url,
            credentials=meta_creds or None,
        )
    elif platform == Platform.TIKTOK.value:
        if not video_url:
            raise HTTPException(
                status_code=400,
                detail="TikTok posts require a video URL in media_urls.",
            )
        publish_result = await post_to_tiktok(
            caption=caption,
            hashtags=hashtags,
            video_url=video_url,
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported platform: {platform}")

    now = datetime.utcnow()

    if publish_result.get("success"):
        post.status = PostStatus.PUBLISHED.value
        post.published_at = now
        post.platform_post_id = (
            publish_result.get("post_id")
            or publish_result.get("publish_id")
        )
    else:
        post.status = PostStatus.FAILED.value

    await db.commit()
    await db.refresh(post)

    return {
        "success": publish_result.get("success", False),
        "post": PostOut.model_validate(post),
        "platform_response": publish_result,
    }
