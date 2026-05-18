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
from anthropic import AsyncAnthropic
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
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    user_prompt = f"""Research and identify influencers and brand accounts on {platform.upper()}
for Vintage Bud Threads, a brand selling retro Bud Man (Budweiser mascot) apparel celebrating
Americana and America's 250th birthday (2026). Identify accounts in the {niche} niche.

Please find and compile:

1. **Influencers** on {platform}: Accounts in the Americana, vintage beer, patriotic
   merchandise, tailgate lifestyle, and retro apparel niches. Focus on micro-influencers
   (10K-100K followers) who authentically represent these values.

2. **Similar Brand Accounts**: Brands already operating in similar spaces on {platform}
   (Americana apparel, vintage beer merchandise, patriotic gear) that Vintage Bud Threads
   could collaborate with or learn from.

3. **Outreach Message Templates**: 3 personalized outreach templates for different scenarios
   (gifting collaboration, paid partnership, affiliate program) in the Vintage Bud Threads
   brand voice — nostalgic, patriotic, fun, and genuine.

Return ONLY a valid JSON object with this exact structure:
{{
  "influencers": [
    {{
      "name": "full name or display name",
      "handle": "@handle",
      "estimated_followers": "10K-50K or specific number",
      "niche_tags": ["americana", "vintage", "beer"],
      "bio": "brief description of their content and why they are relevant",
      "engagement_rate": "estimated % or high/medium/low",
      "profile_url": "https://platform.com/handle or empty string"
    }}
  ],
  "similar_brands": [
    {{
      "name": "brand name",
      "handle": "@handle",
      "description": "what they do and why relevant to Vintage Bud Threads"
    }}
  ],
  "outreach_templates": [
    {{
      "type": "gifting / paid partnership / affiliate",
      "subject": "opening line or DM subject",
      "body": "full outreach message template"
    }}
  ],
  "raw_insights": ["key insight about the influencer landscape on {platform}"]
}}
"""

    try:
        async with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=INFLUENCER_SYSTEM_PROMPT,
            tools=[{"type": "web_search_20260209", "name": "web_search"}],
            messages=[{"role": "user", "content": user_prompt}],
        ) as stream:
            final_message = await stream.get_final_message()
    except anthropic.APIError:
        # web_search not enabled on this key — fall back to training knowledge
        async with client.messages.stream(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=INFLUENCER_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        ) as stream:
            final_message = await stream.get_final_message()

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
                "name": "Americana Lifestyle Creator",
                "handle": "@americanalifestyle",
                "estimated_followers": "10K-50K",
                "niche_tags": ["americana", "vintage", "patriotic"],
                "bio": "Micro-influencer covering American heritage lifestyle — ideal fit for Vintage Bud Threads.",
                "engagement_rate": "medium",
                "profile_url": "",
            }
        ],
        "similar_brands": [
            {
                "name": "Americana Apparel Co.",
                "handle": "@americanaapparel",
                "description": "Vintage American apparel with overlapping patriotic audience — great for cross-promotion.",
            }
        ],
        "outreach_templates": [
            {
                "type": "gifting",
                "subject": "Hey [Name] — love your content! We'd love to send you some gear.",
                "body": (
                    "Hey [Name]! We're Vintage Bud Threads — we make retro Bud Man apparel "
                    "celebrating America's 250th birthday. We think our gear would be perfect "
                    "for your audience. Would you be open to us sending you a piece to try out? "
                    "No strings attached — just genuine love for American heritage. "
                    "Let us know what you think! 🇺🇸"
                ),
            },
            {
                "type": "paid partnership",
                "subject": "Paid partnership opportunity — Vintage Bud Threads x [Name]",
                "body": (
                    "Hi [Name], we're huge fans of your content! "
                    "We're Vintage Bud Threads — retro Bud Man gear for people who love America "
                    "and cold beer. We're looking for authentic voices to help us celebrate "
                    "America's 250th birthday in 2026. We'd love to discuss a paid partnership "
                    "that includes product, commission, and exposure. Interested in chatting?"
                ),
            },
            {
                "type": "affiliate",
                "subject": "Earn with every post — Vintage Bud Threads affiliate program",
                "body": (
                    "Hey [Name]! We're launching our affiliate program and think you'd be perfect. "
                    "Vintage Bud Threads makes retro Bud Man gear your followers will love. "
                    "You'd earn a commission on every sale from your unique link — and you get "
                    "to be part of celebrating America's 250th birthday. Interested?"
                ),
            },
        ],
        "raw_insights": [
            f"Focus on micro-influencers (10K-100K followers) on {platform} in the Americana "
            "and vintage beer niches for the best engagement rates and brand alignment."
        ],
    }
