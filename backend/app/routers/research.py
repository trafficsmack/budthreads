"""
Research router for Vintage Bud Threads.

Provides non-streaming research endpoints that call the AI agents and return
JSON responses in a single call (useful for clients that don't support SSE).

Endpoints:
  GET /api/research/hashtags      — trending hashtags for a platform/niche
  GET /api/research/influencers   — influencer and brand recommendations
"""

from fastapi import APIRouter, HTTPException, Query

from app.agents.trend_agent import research_trends
from app.agents.influencer_agent import discover_influencers

router = APIRouter(prefix="/api/research", tags=["research"])

VALID_PLATFORMS = {"instagram", "facebook", "tiktok"}


@router.get("/hashtags")
async def get_hashtags(
    platform: str = Query(default="instagram", description="instagram | facebook | tiktok"),
    niche: str = Query(default="americana vintage beer bud man"),
):
    """
    Return trending hashtags, content formats, upcoming dates, and trend data
    for the specified platform and niche.

    Uses Claude with web_search to fetch real-time trend data. Falls back to
    curated defaults if the API is unavailable or rate-limited.

    Response shape:
      {
        "platform": str,
        "niche": str,
        "hashtags": [{"tag": str, "estimated_reach": str, "relevance": str}],
        "trends": [{"trend": str, "description": str, "how_to_use": str}],
        "upcoming_dates": [{"date": str, "event": str, "content_idea": str}],
        "content_formats": [{"format": str, "description": str, "platform_fit": str}],
        "research_summary": str
      }
    """
    if platform not in VALID_PLATFORMS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid platform '{platform}'. Must be one of: {', '.join(VALID_PLATFORMS)}",
        )

    try:
        result = await research_trends(platform=platform, niche=niche)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Trend research failed: {str(e)}")

    return {
        "platform": platform,
        "niche": niche,
        **result,
    }


@router.get("/influencers")
async def get_influencers(
    platform: str = Query(default="instagram", description="instagram | facebook | tiktok"),
    niche: str = Query(default="americana vintage beer patriotic merchandise"),
):
    """
    Return influencer recommendations, similar brand accounts, and outreach
    message templates for the specified platform and niche.

    Uses Claude with web_search to research real accounts. Falls back to
    curated template data if the API is unavailable.

    Response shape:
      {
        "platform": str,
        "niche": str,
        "influencers": [{
          "name": str, "handle": str, "platform": str,
          "estimated_followers": str, "niche": str,
          "why_relevant": str, "contact": str,
          "engagement_rate": str, "content_style": str
        }],
        "brands": [{
          "name": str, "handle": str, "platform": str,
          "niche": str, "why_relevant": str,
          "collaboration_opportunity": str
        }],
        "outreach_templates": [{
          "scenario": str, "subject_or_opener": str,
          "message": str, "notes": str
        }],
        "research_summary": str
      }
    """
    if platform not in VALID_PLATFORMS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid platform '{platform}'. Must be one of: {', '.join(VALID_PLATFORMS)}",
        )

    try:
        result = await discover_influencers(platform=platform, niche=niche)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Influencer research failed: {str(e)}")

    return {
        "platform": platform,
        "niche": niche,
        **result,
    }
