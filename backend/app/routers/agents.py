"""
AI Agents router for Vintage Bud Threads.

All endpoints stream responses via Server-Sent Events (SSE) so the frontend
can display progress in real time while Claude thinks and generates content.

Endpoints:
  POST /api/agents/generate-content    — generate captions/hashtags for a product
  GET  /api/agents/research-trends     — research trending hashtags and formats
  GET  /api/agents/discover-influencers — find relevant influencers and brands
"""

import json
import uuid
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.product import Product
from app.agents.content_agent import generate_post_content
from app.agents.trend_agent import research_trends
from app.agents.influencer_agent import discover_influencers

router = APIRouter(prefix="/api/agents", tags=["agents"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class GenerateContentRequest(BaseModel):
    product_id: str | None = None
    product_title: str = ""
    product_description: str = ""
    product_price: float = 0.0
    platforms: list[str] = ["instagram", "facebook", "tiktok"]
    media_type: str = "image"
    tone_notes: str = ""


# ── SSE helpers ───────────────────────────────────────────────────────────────

async def _sse_stream(generator: AsyncGenerator[str, None]) -> StreamingResponse:
    """Wrap an async generator of SSE lines into a StreamingResponse."""
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


async def _generate_content_events(
    product_title: str,
    product_description: str,
    product_price: float,
    platforms: list[str],
    media_type: str,
    tone_notes: str,
) -> AsyncGenerator[str, None]:
    """Async generator that calls the content agent and streams progress events."""
    yield f"data: {json.dumps({'type': 'progress', 'message': 'Generating content with Claude...'})}\n\n"

    try:
        result = await generate_post_content(
            product_title=product_title,
            product_description=product_description,
            product_price=product_price,
            platforms=platforms,
            media_type=media_type,
            tone_notes=tone_notes,
        )

        yield f"data: {json.dumps({'type': 'result', 'data': result})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"


async def _research_trends_events(
    platform: str,
    niche: str,
) -> AsyncGenerator[str, None]:
    """Async generator that calls the trend agent and streams progress events."""
    yield f"data: {json.dumps({'type': 'progress', 'message': f'Researching trends on {platform}...'})}\n\n"

    try:
        result = await research_trends(platform=platform, niche=niche)

        # Normalize to TrendResults shape (handles both old and new field names)
        normalized: dict = {
            "hashtags": [
                {
                    "tag": h.get("tag", "").lstrip("#"),
                    "estimated_reach": h.get("estimated_reach", ""),
                    "category": h.get("category", h.get("relevance", "General")),
                }
                for h in result.get("hashtags", [])
            ],
            "content_trends": [
                {
                    "title": t.get("title", t.get("trend", "")),
                    "description": t.get("description", ""),
                    "format": t.get("format", t.get("how_to_use", "")),
                }
                for t in result.get("content_trends", result.get("trends", []))
            ],
            "upcoming_dates": [
                {
                    "date": d.get("date", ""),
                    "name": d.get("name", d.get("event", "")),
                    "relevance": d.get("relevance", d.get("content_idea", "")),
                }
                for d in result.get("upcoming_dates", [])
            ],
            "content_tips": [
                {
                    "tip": t.get("tip", t.get("description", t.get("format", ""))),
                    "example": t.get("example", t.get("platform_fit")),
                }
                for t in result.get("content_tips", result.get("content_formats", []))
            ],
            "raw_insights": result.get("raw_insights", [result["research_summary"]] if result.get("research_summary") else []),
        }

        yield f"data: {json.dumps({'type': 'result', 'data': normalized})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"


async def _discover_influencers_events(
    platform: str,
    niche: str,
) -> AsyncGenerator[str, None]:
    """Async generator that calls the influencer agent and streams progress events."""
    yield f"data: {json.dumps({'type': 'progress', 'message': f'Finding influencers on {platform}...'})}\n\n"

    try:
        result = await discover_influencers(platform=platform, niche=niche)

        # Normalize to InfluencerResults shape (handles both old and new field names)
        normalized: dict = {
            "influencers": [
                {
                    "name": inf.get("name", ""),
                    "handle": inf.get("handle", ""),
                    "estimated_followers": inf.get("estimated_followers", ""),
                    "niche_tags": inf.get("niche_tags", [inf.get("niche")] if inf.get("niche") else []),
                    "bio": inf.get("bio", inf.get("why_relevant", inf.get("content_style", ""))),
                    "engagement_rate": inf.get("engagement_rate", ""),
                    "profile_url": inf.get("profile_url", ""),
                }
                for inf in result.get("influencers", [])
            ],
            "similar_brands": [
                {
                    "name": b.get("name", ""),
                    "handle": b.get("handle", ""),
                    "description": b.get("description", b.get("why_relevant", b.get("collaboration_opportunity", ""))),
                }
                for b in result.get("similar_brands", result.get("brands", []))
            ],
            "outreach_templates": [
                {
                    "subject": t.get("subject", t.get("subject_or_opener", "")),
                    "body": t.get("body", t.get("message", "")),
                    "type": t.get("type", t.get("scenario", "general")),
                }
                for t in result.get("outreach_templates", [])
            ],
            "raw_insights": result.get("raw_insights", [result["research_summary"]] if result.get("research_summary") else []),
        }

        yield f"data: {json.dumps({'type': 'result', 'data': normalized})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/generate-content")
async def generate_content(
    payload: GenerateContentRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Generate social media captions and hashtags for a product using Claude.

    Streams SSE events as Claude generates content. The client should listen
    for `platform_content` events (one per platform) and a final `complete` event.

    If product_id is provided, product details are fetched from the database
    and merged with any overrides in the request body.
    """
    title = payload.product_title
    description = payload.product_description
    price = payload.product_price

    if payload.product_id:
        result = await db.execute(select(Product).where(Product.id == payload.product_id))
        product = result.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        # Use DB values as defaults; allow request body to override
        title = title or product.title
        description = description or (product.description or "")
        price = price or product.price

    if not title:
        raise HTTPException(status_code=400, detail="product_title is required")

    return StreamingResponse(
        _generate_content_events(
            product_title=title,
            product_description=description,
            product_price=price,
            platforms=payload.platforms,
            media_type=payload.media_type,
            tone_notes=payload.tone_notes,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/research-trends")
async def research_trends_endpoint(
    platform: str = Query(default="instagram", description="instagram | facebook | tiktok"),
    niche: str = Query(default="americana vintage beer bud man"),
):
    """
    Research current trends on the given platform using Claude + web search.

    Streams SSE events: `hashtags`, `trends`, `upcoming_dates`, `content_formats`,
    then a final `complete` event with the full result object.
    """
    valid_platforms = {"instagram", "facebook", "tiktok"}
    if platform not in valid_platforms:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid platform. Must be one of: {', '.join(valid_platforms)}",
        )

    return StreamingResponse(
        _research_trends_events(platform=platform, niche=niche),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/discover-influencers")
async def discover_influencers_endpoint(
    platform: str = Query(default="instagram", description="instagram | facebook | tiktok"),
    niche: str = Query(default="americana vintage beer patriotic merchandise"),
):
    """
    Discover relevant influencers and brand accounts using Claude + web search.

    Streams SSE events: `influencers`, `brands`, `outreach_templates`,
    then a final `complete` event with the full result object.
    """
    valid_platforms = {"instagram", "facebook", "tiktok"}
    if platform not in valid_platforms:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid platform. Must be one of: {', '.join(valid_platforms)}",
        )

    return StreamingResponse(
        _discover_influencers_events(platform=platform, niche=niche),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
