"""
Meta Graph API integration for Vintage Bud Threads.

Handles posting to Instagram and Facebook via the Meta Graph API.

Setup requirements:
  - META_APP_ID: Your Meta App ID from developers.facebook.com
  - META_APP_SECRET: Your Meta App Secret
  - META_ACCESS_TOKEN: A long-lived Page Access Token (not a User Token)
    → Generate via: https://developers.facebook.com/tools/explorer/
    → Required permissions: pages_manage_posts, pages_read_engagement,
      instagram_basic, instagram_content_publish
  - META_INSTAGRAM_ACCOUNT_ID: Your Instagram Business/Creator Account ID
    → Find via: GET /{page-id}?fields=instagram_business_account
  - META_FACEBOOK_PAGE_ID: Your Facebook Page ID

Note on Instagram posting:
  - Only Business and Creator accounts can post via API
  - Images must be publicly accessible URLs (not local files)
  - For video: use video_url parameter and expect async processing
  - Reels/Stories require additional API setup

Note on Facebook posting:
  - Only Pages can post via API (not personal profiles)
  - The access token must be a Page Access Token
"""

import httpx
from app.config import get_settings

settings = get_settings()

GRAPH_API_BASE = "https://graph.facebook.com/v21.0"


def is_configured() -> bool:
    """Check if Meta API credentials are configured."""
    return all([
        settings.meta_access_token,
        settings.meta_instagram_account_id,
        settings.meta_facebook_page_id,
    ])


async def post_to_instagram(
    caption: str,
    hashtags: list[str],
    image_url: str,
    video_url: str | None = None,
) -> dict:
    """
    Post content to Instagram via the Meta Graph API.

    Instagram uses a two-step process:
      1. Create a media container (returns container_id)
      2. Publish the container (makes it live)

    Args:
        caption: The post caption text
        hashtags: List of hashtags to append (e.g. ["#BudMan", "#MadeInUSA"])
        image_url: Publicly accessible URL of the image to post
        video_url: Optional publicly accessible URL of a video (for Reels)

    Returns:
        dict with keys: success (bool), post_id (str | None), error (str | None)
    """
    if not is_configured():
        return {
            "success": False,
            "post_id": None,
            "error": (
                "Meta API not configured. Set META_ACCESS_TOKEN, "
                "META_INSTAGRAM_ACCOUNT_ID, and META_FACEBOOK_PAGE_ID in your .env file. "
                "See app/social/meta.py for setup instructions."
            ),
        }

    hashtag_text = " ".join(hashtags) if hashtags else ""
    full_caption = f"{caption}\n\n{hashtag_text}".strip()
    account_id = settings.meta_instagram_account_id
    access_token = settings.meta_access_token

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # Step 1: Create the media container
            container_payload: dict = {
                "caption": full_caption,
                "access_token": access_token,
            }

            if video_url:
                # Video / Reels post
                container_payload["video_url"] = video_url
                container_payload["media_type"] = "REELS"
            else:
                # Photo post
                container_payload["image_url"] = image_url

            container_response = await client.post(
                f"{GRAPH_API_BASE}/{account_id}/media",
                data=container_payload,
            )
            container_data = container_response.json()

            if "error" in container_data:
                return {
                    "success": False,
                    "post_id": None,
                    "error": f"Instagram container creation failed: {container_data['error'].get('message', 'Unknown error')}",
                }

            container_id = container_data.get("id")
            if not container_id:
                return {
                    "success": False,
                    "post_id": None,
                    "error": "Instagram container creation returned no ID",
                }

            # Step 2: Publish the container
            publish_response = await client.post(
                f"{GRAPH_API_BASE}/{account_id}/media_publish",
                data={
                    "creation_id": container_id,
                    "access_token": access_token,
                },
            )
            publish_data = publish_response.json()

            if "error" in publish_data:
                return {
                    "success": False,
                    "post_id": None,
                    "error": f"Instagram publish failed: {publish_data['error'].get('message', 'Unknown error')}",
                }

            post_id = publish_data.get("id")
            return {
                "success": True,
                "post_id": post_id,
                "error": None,
                "platform": "instagram",
                "container_id": container_id,
            }

        except httpx.RequestError as e:
            return {
                "success": False,
                "post_id": None,
                "error": f"Instagram API request failed: {str(e)}",
            }
        except Exception as e:
            return {
                "success": False,
                "post_id": None,
                "error": f"Unexpected error posting to Instagram: {str(e)}",
            }


async def post_to_facebook(
    caption: str,
    hashtags: list[str],
    image_url: str,
    video_url: str | None = None,
) -> dict:
    """
    Post content to a Facebook Page via the Meta Graph API.

    Facebook Pages support single-step posting to /page_id/photos or /page_id/videos.

    Args:
        caption: The post caption/message text
        hashtags: List of hashtags to append (e.g. ["#BudMan", "#Americana"])
        image_url: Publicly accessible URL of the image to post
        video_url: Optional publicly accessible URL of a video

    Returns:
        dict with keys: success (bool), post_id (str | None), error (str | None)
    """
    if not is_configured():
        return {
            "success": False,
            "post_id": None,
            "error": (
                "Meta API not configured. Set META_ACCESS_TOKEN, "
                "META_INSTAGRAM_ACCOUNT_ID, and META_FACEBOOK_PAGE_ID in your .env file. "
                "See app/social/meta.py for setup instructions."
            ),
        }

    hashtag_text = " ".join(hashtags) if hashtags else ""
    full_message = f"{caption}\n\n{hashtag_text}".strip()
    page_id = settings.meta_facebook_page_id
    access_token = settings.meta_access_token

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            if video_url:
                # Video post: POST /page_id/videos
                endpoint = f"{GRAPH_API_BASE}/{page_id}/videos"
                payload = {
                    "description": full_message,
                    "file_url": video_url,
                    "access_token": access_token,
                }
            else:
                # Photo post: POST /page_id/photos
                endpoint = f"{GRAPH_API_BASE}/{page_id}/photos"
                payload = {
                    "message": full_message,
                    "url": image_url,
                    "access_token": access_token,
                }

            response = await client.post(endpoint, data=payload)
            data = response.json()

            if "error" in data:
                return {
                    "success": False,
                    "post_id": None,
                    "error": f"Facebook post failed: {data['error'].get('message', 'Unknown error')}",
                }

            post_id = data.get("post_id") or data.get("id")
            return {
                "success": True,
                "post_id": post_id,
                "error": None,
                "platform": "facebook",
            }

        except httpx.RequestError as e:
            return {
                "success": False,
                "post_id": None,
                "error": f"Facebook API request failed: {str(e)}",
            }
        except Exception as e:
            return {
                "success": False,
                "post_id": None,
                "error": f"Unexpected error posting to Facebook: {str(e)}",
            }
