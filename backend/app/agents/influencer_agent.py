"""
Influencer Research Agent for Vintage Bud Threads.

Uses Claude Sonnet to identify influencers, brand accounts, and outreach
templates for the Americana/beer/vintage niche.
"""

import json
import re
from anthropic import AsyncAnthropic
from app.config import get_settings

settings = get_settings()

INFLUENCER_SYSTEM_PROMPT = "You are an influencer marketing strategist for Vintage Bud Threads (vintagebudthreads.com), selling retro Bud Man apparel celebrating Americana and America's 250th birthday. Return ONLY valid JSON with no markdown or code fences."


async def discover_influencers(
    platform: str,
    niche: str = "americana vintage beer patriotic merchandise",
) -> dict:
    user_prompt = f"""Influencer research for {platform.upper()} — Vintage Bud Threads (retro Bud Man apparel, Americana, America's 250th birthday 2026). Niche: {niche}.

Return ONLY JSON (no markdown):
{{"influencers":[{{"name":"string","handle":"@string","estimated_followers":"string","niche_tags":["string"],"bio":"string","engagement_rate":"high|medium|low","profile_url":""}}],"similar_brands":[{{"name":"string","handle":"@string","description":"string"}}],"outreach_templates":[{{"type":"gifting|paid partnership|affiliate","subject":"string","body":"string"}}],"raw_insights":["string"]}}

Include: 6 influencers, 3 brands, 3 outreach templates."""

    response = await AsyncAnthropic(api_key=settings.anthropic_api_key).messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2048,
        system=INFLUENCER_SYSTEM_PROMPT,
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
    return _fallback_influencer_data(platform)


def _fallback_influencer_data(platform: str) -> dict:
    return {
        "influencers": [
            {
                "name": "Americana Lifestyle Creator",
                "handle": "@americanalifestyle",
                "estimated_followers": "25K",
                "niche_tags": ["americana", "vintage", "patriotic"],
                "bio": "Micro-influencer covering American heritage lifestyle — ideal fit for Vintage Bud Threads.",
                "engagement_rate": "high",
                "profile_url": "",
            },
            {
                "name": "Vintage Beer Collector",
                "handle": "@vintagebeerculture",
                "estimated_followers": "18K",
                "niche_tags": ["beer", "vintage", "collectibles"],
                "bio": "Covers vintage brewery memorabilia and beer culture — perfect audience overlap.",
                "engagement_rate": "high",
                "profile_url": "",
            },
        ],
        "similar_brands": [
            {
                "name": "Americana Apparel Co.",
                "handle": "@americanaapparel",
                "description": "Vintage American apparel with overlapping patriotic audience — great for cross-promotion.",
            },
            {
                "name": "Retro Brewery Merch",
                "handle": "@retrobrewerymerch",
                "description": "Vintage brewery-themed merchandise — direct audience alignment with Bud Man fans.",
            },
        ],
        "outreach_templates": [
            {
                "type": "gifting",
                "subject": "Hey [Name] — love your content! We'd love to send you some gear.",
                "body": "Hey [Name]! We're Vintage Bud Threads — we make retro Bud Man apparel celebrating America's 250th birthday. We think our gear would be perfect for your audience. Would you be open to us sending you a piece? No strings attached — just genuine love for American heritage. 🇺🇸",
            },
            {
                "type": "paid partnership",
                "subject": "Paid partnership opportunity — Vintage Bud Threads x [Name]",
                "body": "Hi [Name], huge fan of your content! We're Vintage Bud Threads — retro Bud Man gear for people who love America and cold beer. We're celebrating America's 250th birthday in 2026 and looking for authentic voices. We'd love to discuss a paid partnership with product + commission. Interested?",
            },
            {
                "type": "affiliate",
                "subject": "Earn with every post — Vintage Bud Threads affiliate program",
                "body": "Hey [Name]! We're launching our affiliate program and think you'd be a perfect fit. Vintage Bud Threads makes retro Bud Man gear your followers will love. Earn commission on every sale from your unique link — and be part of celebrating America's 250th birthday. Interested?",
            },
        ],
        "raw_insights": [
            f"Micro-influencers (10K-100K followers) in the Americana and vintage beer niches on {platform} deliver the best engagement rates and authentic brand alignment for Vintage Bud Threads."
        ],
    }
