"""
Influencer Research Agent for Vintage Bud Threads.

Uses Claude claude-opus-4-7 with the web_search server-side tool to:
1. Find influencers in the Americana, vintage beer, patriotic merchandise niches
2. Find similar brand accounts to follow/engage with
3. Generate outreach message templates
"""

import json
import re
import anthropic
from app.config import get_settings

settings = get_settings()

INFLUENCER_SYSTEM_PROMPT = """You are an influencer marketing strategist for Vintage Bud Threads
(vintagebudthreads.com), a brand selling retro Bud Man (Budweiser mascot) apparel and gear
celebrating Americana and America's 250th birthday.

Your job is to identify relevant influencers and brand accounts that align with the brand's values
and audience. Focus on:
- Americana and patriotic lifestyle content creators
- Vintage beer and brewery culture enthusiasts
- Retro apparel and collectibles communities
- Tailgate, BBQ, and outdoor lifestyle influencers
- People celebrating Made in USA and American heritage

Provide specific, actionable recommendations with real-world handles and outreach strategies.
Return all data in structured JSON format as instructed.
"""


async def discover_influencers(
    platform: str,
    niche: str = "americana vintage beer patriotic merchandise",
) -> dict:
    """
    Discover influencers and similar brands for Vintage Bud Threads marketing.

    Args:
        platform: Social media platform ("instagram", "facebook", "tiktok")
        niche: Niche keywords to search for (default: americana vintage beer patriotic merchandise)

    Returns:
        Dict containing:
            influencers (list): List of influencer profiles with handle, followers, niche, contact
            brands (list): Similar brand accounts to follow/engage with
            outreach_templates (list): Message templates for influencer outreach
    """
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    user_prompt = f"""Research and identify influencers and brand accounts on {platform.upper()}
for Vintage Bud Threads, a brand selling retro Bud Man (Budweiser mascot) apparel celebrating
Americana and America's 250th birthday (2026). Search for accounts in the {niche} niche.

Please find and compile:

1. **Influencers** on {platform}: Search for accounts in the Americana, vintage beer, patriotic
   merchandise, tailgate lifestyle, and retro apparel niches. Look for micro-influencers
   (10K-100K followers) who authentically represent these values — they tend to have higher
   engagement and are more accessible for smaller brands.

2. **Similar Brand Accounts**: Find brands already operating in similar spaces on {platform}
   (Americana apparel, vintage beer merchandise, patriotic gear) that Vintage Bud Threads
   could collaborate with, engage with, or learn from.

3. **Outreach Message Templates**: Create 3 personalized outreach message templates for
   different scenarios (gifting collaboration, paid partnership, affiliate program) that feel
   authentic to the Vintage Bud Threads brand voice — nostalgic, patriotic, fun, and genuine.

Return ONLY a valid JSON object with this exact structure:
{{
  "influencers": [
    {{
      "name": "full name or display name",
      "handle": "@handle",
      "platform": "{platform}",
      "estimated_followers": "10K-50K or specific number",
      "niche": "specific niche/content focus",
      "why_relevant": "why they align with Vintage Bud Threads",
      "contact": "DM via {platform} or email if known",
      "engagement_rate": "estimated % or high/medium/low",
      "content_style": "brief description of their content style"
    }}
  ],
  "brands": [
    {{
      "name": "brand name",
      "handle": "@handle",
      "platform": "{platform}",
      "niche": "what they sell/do",
      "why_relevant": "how they relate to Vintage Bud Threads",
      "collaboration_opportunity": "how we could work together or learn from them"
    }}
  ],
  "outreach_templates": [
    {{
      "scenario": "gifting / paid partnership / affiliate",
      "subject_or_opener": "opening line or DM subject",
      "message": "full outreach message template",
      "notes": "tips for personalizing this template"
    }}
  ],
  "research_summary": "2-3 sentence summary of the influencer landscape on {platform} for this niche"
}}
"""

    # Use web_search tool so Claude can look up real-time influencer and brand data
    with client.messages.stream(
        model="claude-opus-4-7",
        max_tokens=4096,
        thinking={"type": "adaptive"},
        output_config={"effort": "high"},
        system=INFLUENCER_SYSTEM_PROMPT,
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
                result = _fallback_influencer_data(platform)
        else:
            result = _fallback_influencer_data(platform)

    return result


def _fallback_influencer_data(platform: str) -> dict:
    """Return sensible fallback data when the agent cannot parse its own output."""
    return {
        "influencers": [
            {
                "name": "Search Results Unavailable",
                "handle": "@example",
                "platform": platform,
                "estimated_followers": "10K-50K",
                "niche": "Americana / vintage apparel",
                "why_relevant": "Targets Vintage Bud Threads' core demographic",
                "contact": f"DM via {platform}",
                "engagement_rate": "medium",
                "content_style": "Lifestyle and product reviews in the Americana space",
            }
        ],
        "brands": [
            {
                "name": "Americana Apparel Co.",
                "handle": "@americanaapparel",
                "platform": platform,
                "niche": "Vintage American apparel and accessories",
                "why_relevant": "Overlapping audience of patriotic lifestyle consumers",
                "collaboration_opportunity": "Cross-promotion or co-branded collections",
            }
        ],
        "outreach_templates": [
            {
                "scenario": "gifting",
                "subject_or_opener": "Hey [Name] — love your content! We'd love to send you some gear.",
                "message": (
                    "Hey [Name]! We're Vintage Bud Threads — we make retro Bud Man apparel "
                    "celebrating America's 250th birthday. We think our gear would be perfect "
                    "for your audience. Would you be open to us sending you a piece to try out? "
                    "No strings attached — just genuine love for American heritage. "
                    "Let us know what you think! 🇺🇸"
                ),
                "notes": "Personalize with a specific reference to their recent content",
            },
            {
                "scenario": "paid partnership",
                "subject_or_opener": "Paid partnership opportunity — Vintage Bud Threads x [Name]",
                "message": (
                    "Hi [Name], we're huge fans of your [specific content style] content! "
                    "We're Vintage Bud Threads — retro Bud Man gear for people who love America "
                    "and cold beer. We're looking for authentic voices to help us celebrate "
                    "America's 250th birthday in 2026. We'd love to discuss a paid partnership "
                    "that includes product, commission, and exposure. Interested in chatting?"
                ),
                "notes": "Reference specific posts or content that resonates with the brand",
            },
            {
                "scenario": "affiliate",
                "subject_or_opener": "Earn with every post — Vintage Bud Threads affiliate program",
                "message": (
                    "Hey [Name]! We're launching our affiliate program and think you'd be perfect. "
                    "Vintage Bud Threads makes retro Bud Man gear your followers will love. "
                    "You'd earn a commission on every sale from your unique link — and you get "
                    "to be part of celebrating America's 250th birthday. Interested?"
                ),
                "notes": "Works well for smaller accounts looking for a low-commitment start",
            },
        ],
        "research_summary": (
            f"Influencer research for {platform} in the Americana/vintage beer niche. "
            "Focus on micro-influencers with authentic patriotic lifestyle content for the best "
            "engagement rates and brand alignment with Vintage Bud Threads."
        ),
    }
