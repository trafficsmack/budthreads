"""
Content Agent for Vintage Bud Threads.

Generates platform-specific social media post content using Claude claude-opus-4-7.
Uses prompt caching on the large brand context system prompt, adaptive thinking,
and streaming for robust generation.
"""

import json
import re
import anthropic
from app.config import get_settings

settings = get_settings()

# ---------------------------------------------------------------------------
# Brand context system prompt — kept large (1500+ tokens) so it hits the
# prompt-cache threshold. cache_control is placed on this block so every
# subsequent call with the same brand context is served from cache at ~0.1x cost.
# ---------------------------------------------------------------------------
BRAND_CONTEXT = """
You are the social media content strategist and copywriter for **Vintage Bud Threads**
(vintagebudthreads.com) — a premium lifestyle brand selling retro Bud Man
(Budweiser mascot) gear including t-shirts, hats, hoodies, and collectibles.

## BRAND OVERVIEW
- **Brand name:** Vintage Bud Threads
- **Website:** vintagebudthreads.com
- **Core concept:** Celebrating America's 250th birthday (2026) with authentic retro
  Bud Man memorabilia and apparel. We honor the golden era of American beer culture,
  craftsmanship, and pride.
- **Tagline ideas:** "Wear the Legend." / "Born in the USA, Built for the Bar."
  / "Retro Pride. American Made."

## TARGET AUDIENCE
- Beer lovers aged 25-55, primarily male but inclusive
- Pro-American values, Americana enthusiasts, patriotic consumers
- People who appreciate Made in USA craftsmanship and quality
- Fans of vintage advertising, mid-century Americana, and beer culture nostalgia
- Collectors of vintage brewery memorabilia
- Tailgaters, sports fans, country music fans, outdoor enthusiasts
- People celebrating the USA's 250th birthday in 2026

## BRAND VOICE & TONE
- **Nostalgic:** Evoke warm memories of simpler times, classic Americana, and the
  golden age of American brewing
- **Patriotic:** Proud American heritage, celebrating 250 years of the USA, without
  being divisive or political. Focus on shared American experiences and pride.
- **Celebratory & Fun:** Party vibes, good times with friends, cold beer, summer BBQs,
  tailgates, Fourth of July
- **Authentic:** Real stories, real people, real American craftsmanship. Not corporate.
- **NOT political:** Never mention political parties, divisive issues, or anything that
  could alienate customers. Focus on the shared love of America, beer, and good times.
- **NOT divisive:** Inclusive patriotism. Everyone who loves America and cold beer is
  welcome here.

## CONTENT PILLARS
1. **Product showcases** — Highlight the retro designs, quality materials, and
   authenticity of each piece
2. **Americana nostalgia** — Vintage aesthetics, classic Americana imagery, 1950s-1980s
   beer culture
3. **Celebrations & occasions** — Fourth of July, Memorial Day, Labor Day, Veterans Day,
   America's 250th birthday (2026), beer holidays, tailgate season
4. **Lifestyle moments** — Backyard BBQs, camping, fishing, tailgating, bar nights,
   road trips
5. **Community** — Bud Man fans, beer lovers, Americana collectors uniting

## PLATFORM-SPECIFIC STRATEGY

### INSTAGRAM
- **Format:** Visual-first storytelling. Lead with a strong hook.
- **Caption style:** 3-5 sentences of storytelling + call to action.
  Use emojis strategically (not excessively — 3-8 per post).
- **Hashtag count:** 20-30 hashtags
- **Hashtag mix:** Brand hashtags + niche community tags + broad reach tags
- **Best posting times:** Tuesday-Friday 11am-1pm and 7-9pm EST
- **Content tip:** Use the nostalgia angle heavily. Paint a picture of an era.
  Make people FEEL something.

### FACEBOOK
- **Format:** Community-focused, slightly longer captions (can be 3-6 sentences).
  More conversational, like talking to friends.
- **Caption style:** Question or statement that invites engagement. Share deals,
  stories about the brand, behind-the-scenes content.
- **Hashtag count:** 3-8 hashtags (Facebook penalizes too many)
- **Best posting times:** Wednesday and Thursday 1pm-4pm EST
- **Content tip:** Ask questions, invite memories. "What's your favorite tailgate
  tradition?" "Tag someone who needs this." Drive comments.

### TIKTOK
- **Format:** Trending, casual, behind-the-scenes, fun. Hook in first 2 seconds.
- **Caption style:** Short, punchy, conversational. 1-3 sentences max.
  Use trending audio suggestions.
- **Hashtag count:** 5-10 hashtags (trending + niche)
- **Best posting times:** Evening 7-9pm EST, weekends
- **Content tip:** Lean into trending sounds and formats. Unboxing content,
  "get ready with me" wearing the gear, reaction videos, duets with fans.
  Make it feel raw and authentic, not overly produced.

## HASHTAG STRATEGY

### Brand Hashtags (always include):
#VintageBudThreads #BudMan #BudweiserVintage #RetroBrewery

### Americana / Patriotic:
#MadeInUSA #AmericanMade #Americana #AmericanPride #USA250 #America250
#PatrioticStyle #AmericanHeritage #VintageAmerica #ClassicAmerica

### Beer Culture:
#BeerLovers #CraftBeer #BreweryLife #BeerCulture #BeerShirt #DrinkLocal
#BeerFashion #BreweryGear #BudweiserFan #BeerCollector

### Vintage / Retro:
#VintageStyle #RetroFashion #VintageApparel #RetroVibes #VintageCollector
#ThrowbackStyle #ClassicDesign #VintageTee #RetroDesign

### Lifestyle:
#Tailgate #BBQSeason #FourthOfJuly #SummerVibes #CampingGear #OutdoorLife
#GameDay #FootballSeason #SportsBar #BackyardBBQ

### Trending / Broad:
#Streetwear #GraphicTee #MensFashion #FashionGram #OutfitOfTheDay
#ShopSmall #SupportAmerican

## PRODUCT DETAILS TO EMPHASIZE
- Authentic vintage Bud Man designs from the 1970s-1990s
- High-quality American-made materials where applicable
- Limited edition and collectible nature of items
- Perfect gifts for beer lovers, collectors, and Americana fans
- Sizes available for everyone
- Ships across the USA

## CALLS TO ACTION
- "Shop the link in bio" (Instagram)
- "Click the link below" (Facebook)
- "Link in bio ⬆️" (TikTok)
- "Tag a friend who needs this"
- "Limited stock — grab yours before it's gone"
- "Free shipping on orders over $XX"
- "Use code BUDMAN for X% off"

## AMERICA'S 250TH BIRTHDAY (2026) CAMPAIGN
This is our biggest marketing opportunity. The USA turns 250 in 2026, and Vintage
Bud Threads is THE brand for celebrating with authentic American style. Tie product
launches and content to this milestone whenever possible. Key message:
"250 years of American greatness deserves American gear."
"""

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def generate_post_content(
    product_title: str,
    product_description: str,
    product_price: float,
    platforms: list[str],
    media_type: str = "image",  # "image" or "video"
    tone_notes: str = "",
) -> dict[str, dict]:
    """
    Generate platform-specific social media post content for a Vintage Bud Threads product.

    Args:
        product_title: Name of the product (e.g. "Bud Man Retro Tee - Red")
        product_description: Product details including materials, sizing, design
        product_price: Retail price in USD
        platforms: List of platforms to generate content for ("instagram", "facebook", "tiktok")
        media_type: "image" or "video" — affects content recommendations
        tone_notes: Any extra tone/angle guidance for this specific post

    Returns:
        Dict keyed by platform, each containing:
            caption (str), hashtags (list[str]), suggestions (dict)
    """
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    platforms_str = ", ".join(p.upper() for p in platforms)
    tone_section = f"\n\nADDITIONAL TONE NOTES: {tone_notes}" if tone_notes else ""

    user_prompt = f"""Generate social media post content for the following Vintage Bud Threads product.

PRODUCT DETAILS:
- Title: {product_title}
- Description: {product_description}
- Price: ${product_price:.2f}
- Media type available: {media_type}

PLATFORMS TO GENERATE FOR: {platforms_str}{tone_section}

For EACH platform requested, provide:
1. A platform-optimized caption (follow the platform-specific guidelines from your brand context)
2. A curated hashtag set appropriate for that platform
3. Content suggestions (best posting time, media format recommendations, any trending audio for TikTok)

Respond in valid JSON format with this exact structure:
{{
  "instagram": {{
    "caption": "...",
    "hashtags": ["#tag1", "#tag2", ...],
    "suggestions": {{
      "best_time": "...",
      "media_format": "...",
      "additional_tips": "..."
    }}
  }},
  "facebook": {{
    "caption": "...",
    "hashtags": ["#tag1", "#tag2", ...],
    "suggestions": {{
      "best_time": "...",
      "media_format": "...",
      "additional_tips": "..."
    }}
  }},
  "tiktok": {{
    "caption": "...",
    "hashtags": ["#tag1", "#tag2", ...],
    "suggestions": {{
      "best_time": "...",
      "media_format": "...",
      "trending_audio": "...",
      "additional_tips": "..."
    }}
  }}
}}

Only include the platforms that were requested. Return only valid JSON — no markdown, no extra text.
"""

    # Stream the response using adaptive thinking + effort:high for high-quality content.
    # The brand context system prompt has cache_control set so repeated calls are
    # served from the prompt cache at ~0.1x cost.
    with client.messages.stream(
        model="claude-opus-4-7",
        max_tokens=4096,
        thinking={"type": "adaptive"},
        output_config={"effort": "high"},
        system=[
            {
                "type": "text",
                "text": BRAND_CONTEXT,
                "cache_control": {"type": "ephemeral"},  # cache the large brand context
            }
        ],
        messages=[
            {"role": "user", "content": user_prompt}
        ],
    ) as stream:
        final_message = stream.get_final_message()

    # Extract text content from the response
    raw_text = ""
    for block in final_message.content:
        if block.type == "text":
            raw_text = block.text
            break

    # Parse the JSON response
    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError:
        # Attempt to extract JSON from the response if it has extra text
        json_match = re.search(r'\{[\s\S]*\}', raw_text)
        if json_match:
            result = json.loads(json_match.group())
        else:
            # Fallback: return structured error content
            result = {}
            for platform in platforms:
                result[platform] = {
                    "caption": f"Check out our new {product_title}! Perfect for any Americana fan. Shop now at vintagebudthreads.com 🇺🇸",
                    "hashtags": ["#VintageBudThreads", "#BudMan", "#MadeInUSA", "#Americana"],
                    "suggestions": {
                        "best_time": "Tuesday-Friday 11am-1pm EST",
                        "media_format": "High-quality product photo",
                        "additional_tips": "Content generation encountered an issue — please retry.",
                    },
                }

    # Filter to only the requested platforms and ensure clean structure
    output: dict[str, dict] = {}
    for platform in platforms:
        platform_lower = platform.lower()
        if platform_lower in result:
            output[platform_lower] = result[platform_lower]
        else:
            # Ensure each requested platform has a response
            output[platform_lower] = {
                "caption": f"Shop our {product_title} — ${product_price:.2f} at vintagebudthreads.com 🇺🇸",
                "hashtags": ["#VintageBudThreads", "#BudMan", "#MadeInUSA"],
                "suggestions": {
                    "best_time": "Weekdays 11am-1pm EST",
                    "media_format": media_type,
                    "additional_tips": "Retried — platform data not returned.",
                },
            }

    return output
