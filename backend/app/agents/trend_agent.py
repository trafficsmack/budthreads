"""
Trend Research Agent for Vintage Bud Threads.

Uses Claude claude-opus-4-7 with the web_search server-side tool to research:
- Trending hashtags for Americana/beer/vintage/Bud Man content
- Trending content formats on Instagram/TikTok/Facebook
- Upcoming relevant dates (July 4th, patriotic events, beer holidays)
"""

import json
import re
import anthropic
from app.config import get_settings

settings = get_settings()

TREND_SYSTEM_PROMPT = """You are a social media trend researcher for Vintage Bud Threads
(vintagebudthreads.com), a brand selling retro Bud Man (Budweiser mascot) apparel and gear
celebrating Americana and America's 250th birthday.

Your job is to research current trends on social media platforms and provide actionable
intelligence for content planning. Focus on:
- Americana, patriotic, vintage beer, and retro apparel niches
- Beer lover communities and lifestyle content
- Collectibles and vintage merchandise communities
- Relevant upcoming dates and events (patriotic holidays, beer events, sports seasons)

Always provide specific, actionable recommendations rather than generic advice.
Return data in structured JSON format as instructed.
"""


async def research_trends(
    platform: str,
    niche: str = "americana vintage beer bud man",
) -> dict:
    """
    Research trending hashtags, content formats, and upcoming dates for a given platform.

    Args:
        platform: Social media platform ("instagram", "facebook", "tiktok")
        niche: Niche keywords to research (default: americana vintage beer bud man)

    Returns:
        Dict containing:
            hashtags (list): Trending hashtags for the niche
            trends (list): Trending content formats and topics
            upcoming_dates (list): Relevant upcoming dates and events
            content_formats (list): Recommended content formats for the platform
    """
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    user_prompt = f"""Research current trends on {platform.upper()} for a brand in the
{niche} niche. The brand (Vintage Bud Threads) sells retro Bud Man apparel and gear
celebrating Americana and America's 250th birthday.

Please search for and compile:
1. Currently trending hashtags on {platform} for americana, vintage beer, patriotic merchandise,
   and retro apparel content
2. Trending content formats and viral content types on {platform} right now (especially for
   lifestyle, merchandise, and Americana brands)
3. Upcoming relevant dates and events in the next 90 days that would be good content hooks
   (patriotic holidays, beer events, sporting events, seasonal moments)
4. Specific content format recommendations for {platform} that are performing well for
   similar brands

Return ONLY a valid JSON object with this exact structure:
{{
  "hashtags": [
    {{"tag": "#example", "estimated_reach": "broad/medium/niche", "relevance": "high/medium"}}
  ],
  "trends": [
    {{"trend": "trend name", "description": "brief description", "how_to_use": "how the brand can use this"}}
  ],
  "upcoming_dates": [
    {{"date": "YYYY-MM-DD or month", "event": "event name", "content_idea": "specific content hook for the brand"}}
  ],
  "content_formats": [
    {{"format": "format name", "description": "description", "platform_fit": "why it works on {platform}"}}
  ],
  "research_summary": "2-3 sentence summary of key findings"
}}
"""

    # Use web_search tool so Claude can look up real-time trending information
    with client.messages.stream(
        model="claude-opus-4-7",
        max_tokens=4096,
        thinking={"type": "adaptive"},
        output_config={"effort": "high"},
        system=TREND_SYSTEM_PROMPT,
        tools=[
            {
                "type": "web_search_20260209",
                "name": "web_search",
            }
        ],
        messages=[
            {"role": "user", "content": user_prompt}
        ],
    ) as stream:
        final_message = stream.get_final_message()

    # Extract the final text response
    raw_text = ""
    for block in final_message.content:
        if block.type == "text":
            raw_text = block.text
            break

    # Parse JSON from response
    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError:
        json_match = re.search(r'\{[\s\S]*\}', raw_text)
        if json_match:
            try:
                result = json.loads(json_match.group())
            except json.JSONDecodeError:
                result = _fallback_trend_data(platform)
        else:
            result = _fallback_trend_data(platform)

    return result


def _fallback_trend_data(platform: str) -> dict:
    """Return sensible fallback data when the agent cannot parse its own output."""
    return {
        "hashtags": [
            {"tag": "#VintageBudThreads", "estimated_reach": "niche", "relevance": "high"},
            {"tag": "#BudMan", "estimated_reach": "niche", "relevance": "high"},
            {"tag": "#Americana", "estimated_reach": "medium", "relevance": "high"},
            {"tag": "#MadeInUSA", "estimated_reach": "broad", "relevance": "high"},
            {"tag": "#VintageApparel", "estimated_reach": "medium", "relevance": "medium"},
            {"tag": "#RetroStyle", "estimated_reach": "broad", "relevance": "medium"},
            {"tag": "#BeerLovers", "estimated_reach": "broad", "relevance": "high"},
            {"tag": "#PatrioticStyle", "estimated_reach": "medium", "relevance": "high"},
        ],
        "trends": [
            {
                "trend": "Nostalgia-core content",
                "description": "Retro aesthetics and vintage throwbacks performing strongly",
                "how_to_use": "Showcase the vintage Bud Man designs with retro-filtered photography",
            },
            {
                "trend": "Americana lifestyle content",
                "description": "Patriotic and outdoor lifestyle content trending year-round",
                "how_to_use": "Feature products in outdoor settings — tailgates, BBQs, camping",
            },
        ],
        "upcoming_dates": [
            {
                "date": "July 4",
                "event": "Independence Day",
                "content_idea": "America's birthday deserves American gear — launch July 4th collection",
            },
            {
                "date": "Memorial Day",
                "event": "Memorial Day Weekend",
                "content_idea": "Honor those who served in American-made style",
            },
        ],
        "content_formats": [
            {
                "format": "Product lifestyle photography",
                "description": "Real people wearing gear in authentic settings",
                "platform_fit": f"Performs consistently well on {platform}",
            },
        ],
        "research_summary": f"Research data for {platform} in the Americana/beer niche. Focus on patriotic holidays and vintage aesthetics for maximum engagement.",
    }
