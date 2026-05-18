"""
Trend Research Agent for Vintage Bud Threads.

Uses Claude Sonnet to research trending hashtags, content formats, and
upcoming dates for the Americana/beer/vintage niche — based on training
knowledge, no web search required.
"""

import json
import re
from anthropic import AsyncAnthropic
from app.config import get_settings

settings = get_settings()

TREND_SYSTEM_PROMPT = "You are a social media trend researcher for Vintage Bud Threads (vintagebudthreads.com), selling retro Bud Man (Budweiser mascot) apparel celebrating Americana and America's 250th birthday. Return ONLY valid JSON with no markdown or code fences."


async def research_trends(
    platform: str,
    niche: str = "americana vintage beer bud man",
) -> dict:
    user_prompt = f"""Social media trends for {platform.upper()} — Vintage Bud Threads brand (retro Bud Man apparel, Americana, America's 250th birthday 2026).

Return ONLY JSON (no markdown):
{{"hashtags":[{{"tag":"string","estimated_reach":"broad|medium|niche","category":"string"}}],"content_trends":[{{"title":"string","description":"string","format":"Reel|Carousel|Photo|Story"}}],"upcoming_dates":[{{"date":"YYYY-MM-DD","name":"string","relevance":"string"}}],"content_tips":[{{"tip":"string","example":"string or null"}}],"raw_insights":["string"]}}

Include: 12 hashtags, 4 trends, 5 upcoming dates (May–Aug 2026), 4 tips."""

    response = await AsyncAnthropic(api_key=settings.anthropic_api_key).messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=TREND_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw_text = ""
    for block in response.content:
        if block.type == "text":
            raw_text = block.text
            break

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        json_match = re.search(r'\{[\s\S]*\}', raw_text)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass
    return _fallback_trend_data(platform)


def _fallback_trend_data(platform: str) -> dict:
    return {
        "hashtags": [
            {"tag": "VintageBudThreads", "estimated_reach": "niche", "category": "Brand"},
            {"tag": "BudMan", "estimated_reach": "niche", "category": "Character"},
            {"tag": "Americana", "estimated_reach": "broad", "category": "Lifestyle"},
            {"tag": "MadeInUSA", "estimated_reach": "broad", "category": "Patriotic"},
            {"tag": "VintageApparel", "estimated_reach": "medium", "category": "Fashion"},
            {"tag": "RetroStyle", "estimated_reach": "broad", "category": "Fashion"},
            {"tag": "BeerLovers", "estimated_reach": "broad", "category": "Beer"},
            {"tag": "PatrioticStyle", "estimated_reach": "medium", "category": "Lifestyle"},
            {"tag": "BudweiserVintage", "estimated_reach": "medium", "category": "Brand"},
            {"tag": "ClassicAmericana", "estimated_reach": "broad", "category": "Lifestyle"},
        ],
        "content_trends": [
            {"title": "Nostalgia-core Content", "description": "Retro aesthetics and vintage throwbacks performing strongly across all platforms.", "format": "Reel"},
            {"title": "Americana Lifestyle Shots", "description": "Patriotic and outdoor lifestyle content — tailgates, BBQs, camping.", "format": "Photo"},
            {"title": "'Then vs Now' Comparisons", "description": "Side-by-side of vintage Bud Man ads with your modern merch. Highly shareable.", "format": "Carousel"},
            {"title": "Unboxing / Reveal Videos", "description": "Show the product arriving in branded packaging — retro aesthetic gets huge engagement.", "format": "Reel"},
        ],
        "upcoming_dates": [
            {"date": "2026-05-25", "name": "Memorial Day", "relevance": "Peak patriotic content — highest engagement of the month"},
            {"date": "2026-06-14", "name": "Flag Day", "relevance": "Perfect for Americana-themed product showcases"},
            {"date": "2026-07-04", "name": "Independence Day", "relevance": "America's 250th birthday — biggest opportunity of the year"},
            {"date": "2026-09-07", "name": "Labor Day", "relevance": "End-of-summer beer season content"},
        ],
        "content_tips": [
            {"tip": "Post between 11am–1pm and 7pm–9pm EST for highest engagement on weekdays.", "example": None},
            {"tip": "Use 8–15 hashtags on Instagram for optimal reach without looking spammy.", "example": None},
            {"tip": "Authentic lifestyle photography outperforms studio shots 3:1 for apparel brands.", "example": "Real people at a backyard BBQ wearing the tee"},
            {"tip": "User-generated content reposts drive 28% more engagement than original posts.", "example": None},
        ],
        "raw_insights": [f"The Americana/vintage beer niche on {platform} rewards authenticity — real settings, real people, real stories about American heritage perform best."],
    }
