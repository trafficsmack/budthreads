"""
Shopify Admin API client for Vintage Bud Threads.

Uses the Shopify Admin REST API to fetch products from the store.

Setup requirements:
  - SHOPIFY_STORE_DOMAIN: Your myshopify domain (e.g. vintagebudthreads.myshopify.com)
  - SHOPIFY_ACCESS_TOKEN: Private app access token or custom app token
    → Create a custom app at: https://admin.shopify.com/store/{store}/settings/apps
    → Grant the "read_products" Admin API scope

API Reference:
  https://shopify.dev/docs/api/admin-rest/latest/resources/product
"""

import httpx
from app.config import get_settings

settings = get_settings()

SHOPIFY_API_VERSION = "2024-01"


def is_configured(access_token: str = "") -> bool:
    token = access_token or settings.shopify_access_token
    return bool(settings.shopify_store_domain and token)


def _get_headers(access_token: str = "") -> dict:
    token = access_token or settings.shopify_access_token
    return {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
    }


def _api_base() -> str:
    return f"https://{settings.shopify_store_domain}/admin/api/{SHOPIFY_API_VERSION}"


def _parse_product(raw: dict) -> dict:
    """
    Normalize a raw Shopify product object into the shape expected by the app.

    Returns a flat dict compatible with the Product SQLAlchemy model fields.
    """
    images = raw.get("images", [])
    image_urls = [img["src"] for img in images if img.get("src")]

    # Shopify doesn't have a dedicated video field in REST; media is in GraphQL.
    # For now we surface the first image as the primary and leave video_urls empty
    # unless a metafield or product media URL is available.
    video_urls: list[str] = []

    # Price comes from the first variant
    variants = raw.get("variants", [])
    price = 0.0
    if variants:
        try:
            price = float(variants[0].get("price", "0") or "0")
        except (ValueError, TypeError):
            price = 0.0

    tags_raw = raw.get("tags", "")
    tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []

    return {
        "shopify_id": str(raw.get("id", "")),
        "title": raw.get("title", ""),
        "description": raw.get("body_html", "") or "",
        "price": price,
        "image_urls": image_urls,
        "video_urls": video_urls,
        "tags": tags,
        "product_type": raw.get("product_type") or None,
    }


async def get_products(limit: int = 50, access_token: str = "") -> list[dict]:
    """
    Fetch all published products from the Shopify store.

    Args:
        limit: Max products to return per page (Shopify max is 250)
        access_token: Override token (falls back to env var)

    Returns:
        List of normalized product dicts. Returns empty list if not configured
        or if the API call fails.
    """
    if not is_configured(access_token):
        return []

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(
                f"{_api_base()}/products.json",
                headers=_get_headers(access_token),
                params={
                    "limit": min(limit, 250),
                    "fields": "id,title,body_html,variants,images,tags,product_type,status",
                },
            )
            response.raise_for_status()
            data = response.json()
            products = data.get("products", [])
            return [_parse_product(p) for p in products]

        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                f"Shopify API error {e.response.status_code}: {e.response.text}"
            ) from e
        except httpx.RequestError as e:
            raise RuntimeError(f"Shopify API request failed: {str(e)}") from e


async def get_product(shopify_product_id: str) -> dict | None:
    """
    Fetch a single product by its Shopify product ID.

    Args:
        shopify_product_id: The numeric Shopify product ID as a string

    Returns:
        Normalized product dict, or None if not found / not configured.
    """
    if not is_configured():
        return None

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.get(
                f"{_api_base()}/products/{shopify_product_id}.json",
                headers=_get_headers(),
                params={
                    "fields": "id,title,body_html,variants,images,tags,product_type",
                },
            )
            if response.status_code == 404:
                return None
            response.raise_for_status()
            data = response.json()
            raw = data.get("product")
            if not raw:
                return None
            return _parse_product(raw)

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise RuntimeError(
                f"Shopify API error {e.response.status_code}: {e.response.text}"
            ) from e
        except httpx.RequestError as e:
            raise RuntimeError(f"Shopify API request failed: {str(e)}") from e
