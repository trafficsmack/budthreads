"""
TikTok Content Posting API integration for Vintage Bud Threads.

Uses the TikTok Content Posting API v2 to publish videos.

Setup requirements:
  - TIKTOK_CLIENT_KEY: Your TikTok app's client key from developers.tiktok.com
  - TIKTOK_CLIENT_SECRET: Your TikTok app's client secret
  - TIKTOK_ACCESS_TOKEN: OAuth access token (requires user authorization flow)

Getting a TikTok Access Token:
  1. Create a TikTok developer app at https://developers.tiktok.com
  2. Enable the "Content Posting API" product in your app
  3. Request the following scopes: video.upload, video.publish
  4. Implement the OAuth 2.0 authorization code flow:
     - Direct users to: https://www.tiktok.com/v2/auth/authorize/
       with params: client_key, scope, response_type=code, redirect_uri, state
     - Exchange the authorization code for an access token via:
       POST https://open.tiktokapis.com/v2/oauth/token/
  5. Store the access_token and refresh_token securely

TikTok Content Posting API Notes:
  - Only videos can be posted via API (no photo/carousel at time of writing)
  - Videos must be publicly accessible URLs or direct file uploads
  - The video must be between 3 seconds and 10 minutes
  - Required formats: .mp4, .mov, .mpeg, .3gp, .avi, .wmv
  - Caption must be under 2,200 characters
  - Hashtags are included in the caption text

API Reference:
  https://developers.tiktok.com/doc/content-posting-api-get-started
"""

import httpx
from app.config import get_settings

settings = get_settings()

TIKTOK_API_BASE = "https://open.tiktokapis.com/v2"


def is_configured(credentials: dict | None = None) -> bool:
    """Check if TikTok API credentials are configured."""
    if credentials:
        return bool(credentials.get("access_token") and credentials.get("client_key"))
    return bool(settings.tiktok_access_token and settings.tiktok_client_key)


async def post_to_tiktok(
    caption: str,
    hashtags: list[str],
    video_url: str,
    credentials: dict | None = None,
) -> dict:
    """
    Post a video to TikTok via the Content Posting API v2.

    The TikTok Content Posting API uses a two-step process for URL-based uploads:
      1. Initialize the upload and get a publish_id
      2. The video is processed asynchronously by TikTok

    Args:
        caption: The post caption text (max 2,200 characters)
        hashtags: List of hashtags to include (e.g. ["#BudMan", "#Americana"])
        video_url: Publicly accessible URL of the video to post (.mp4 recommended)

    Returns:
        dict with keys: success (bool), publish_id (str | None), error (str | None)
    """
    if not is_configured(credentials):
        return {
            "success": False,
            "publish_id": None,
            "error": (
                "TikTok API not configured. Add your TikTok credentials in Settings. "
                "See app/social/tiktok.py for full setup instructions."
            ),
        }

    access_token = (credentials or {}).get("access_token") or settings.tiktok_access_token

    # Build the caption with hashtags embedded
    hashtag_text = " ".join(hashtags) if hashtags else ""
    full_caption = f"{caption} {hashtag_text}".strip()

    # TikTok caption limit
    if len(full_caption) > 2200:
        full_caption = full_caption[:2197] + "..."

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json; charset=UTF-8",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            # Initialize the video upload via URL
            # TikTok Content Posting API v2 endpoint for URL-based video upload
            init_payload = {
                "post_info": {
                    "title": full_caption,
                    "privacy_level": "PUBLIC_TO_EVERYONE",
                    "disable_duet": False,
                    "disable_comment": False,
                    "disable_stitch": False,
                },
                "source_info": {
                    "source": "PULL_FROM_URL",
                    "video_url": video_url,
                },
            }

            response = await client.post(
                f"{TIKTOK_API_BASE}/post/publish/video/init/",
                headers=headers,
                json=init_payload,
            )
            data = response.json()

            # Check for TikTok API errors
            if response.status_code != 200:
                error_code = data.get("error", {}).get("code", "unknown")
                error_message = data.get("error", {}).get("message", "Unknown error")
                return {
                    "success": False,
                    "publish_id": None,
                    "error": f"TikTok API error ({error_code}): {error_message}",
                }

            publish_id = data.get("data", {}).get("publish_id")
            if not publish_id:
                return {
                    "success": False,
                    "publish_id": None,
                    "error": "TikTok API returned no publish_id",
                }

            return {
                "success": True,
                "publish_id": publish_id,
                "error": None,
                "platform": "tiktok",
                "status": "processing",
                "note": (
                    "TikTok video is being processed asynchronously. "
                    f"Check status at POST {TIKTOK_API_BASE}/post/publish/status/fetch/ "
                    f"with publish_id: {publish_id}"
                ),
            }

        except httpx.RequestError as e:
            return {
                "success": False,
                "publish_id": None,
                "error": f"TikTok API request failed: {str(e)}",
            }
        except Exception as e:
            return {
                "success": False,
                "publish_id": None,
                "error": f"Unexpected error posting to TikTok: {str(e)}",
            }


async def check_publish_status(publish_id: str) -> dict:
    """
    Check the processing status of a TikTok video publish job.

    After calling post_to_tiktok(), use this to monitor when the video goes live.

    Args:
        publish_id: The publish_id returned by post_to_tiktok()

    Returns:
        dict with keys: status (str), error (str | None)
        Possible statuses: PROCESSING_DOWNLOAD, PROCESSING_UPLOAD, SENDING_TO_USER_INBOX,
                           PUBLISH_COMPLETE, FAILED
    """
    if not is_configured():
        return {
            "status": "unknown",
            "error": "TikTok API not configured.",
        }

    headers = {
        "Authorization": f"Bearer {settings.tiktok_access_token or ''}",
        "Content-Type": "application/json; charset=UTF-8",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                f"{TIKTOK_API_BASE}/post/publish/status/fetch/",
                headers=headers,
                json={"publish_id": publish_id},
            )
            data = response.json()

            if response.status_code != 200:
                error_message = data.get("error", {}).get("message", "Unknown error")
                return {
                    "status": "unknown",
                    "error": f"TikTok status check failed: {error_message}",
                }

            status = data.get("data", {}).get("status", "unknown")
            return {
                "status": status,
                "error": None,
                "raw": data.get("data", {}),
            }

        except Exception as e:
            return {
                "status": "unknown",
                "error": f"TikTok status check error: {str(e)}",
            }
