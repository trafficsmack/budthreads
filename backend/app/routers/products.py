"""
Products router for Vintage Bud Threads.

Endpoints:
  GET  /api/products          — list all products from the database
  POST /api/products/sync     — pull products from Shopify and upsert into DB
  POST /api/products          — manually create a product
  GET  /api/products/{id}     — fetch a single product by DB id
"""

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.product import Product
from app.shopify.client import get_products as shopify_get_products, is_configured as shopify_is_configured

router = APIRouter(prefix="/api/products", tags=["products"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    title: str
    description: str = ""
    price: float = 0.0
    image_urls: list[str] = []
    video_urls: list[str] = []
    tags: list[str] = []
    product_type: str | None = None
    shopify_id: str | None = None


class ProductOut(BaseModel):
    id: str
    shopify_id: str | None
    title: str
    description: str | None
    price: float
    image_urls: list[Any]
    video_urls: list[Any]
    tags: list[Any]
    product_type: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ProductOut])
async def list_products(db: AsyncSession = Depends(get_db)):
    """Return all products stored in the database."""
    result = await db.execute(select(Product).order_by(Product.created_at.desc()))
    products = result.scalars().all()
    return products


@router.post("/sync")
async def sync_products_from_shopify(db: AsyncSession = Depends(get_db)):
    """
    Pull all active products from Shopify and upsert them into the local database.

    If SHOPIFY_ACCESS_TOKEN is not configured, returns a 400 with setup instructions.
    Existing products are matched by shopify_id and updated; new ones are inserted.
    """
    if not shopify_is_configured():
        raise HTTPException(
            status_code=400,
            detail=(
                "Shopify API not configured. Set SHOPIFY_STORE_DOMAIN and "
                "SHOPIFY_ACCESS_TOKEN in your .env file. "
                "Create a custom app at https://admin.shopify.com and grant "
                "the read_products scope."
            ),
        )

    try:
        shopify_products = await shopify_get_products(limit=250)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    upserted = 0
    for product_data in shopify_products:
        shopify_id = product_data.get("shopify_id")

        # Check if product already exists in DB
        existing = None
        if shopify_id:
            result = await db.execute(
                select(Product).where(Product.shopify_id == shopify_id)
            )
            existing = result.scalar_one_or_none()

        now = datetime.utcnow()

        if existing:
            existing.title = product_data["title"]
            existing.description = product_data.get("description", "")
            existing.price = product_data.get("price", 0.0)
            existing.image_urls = product_data.get("image_urls", [])
            existing.video_urls = product_data.get("video_urls", [])
            existing.tags = product_data.get("tags", [])
            existing.product_type = product_data.get("product_type")
            existing.updated_at = now
        else:
            new_product = Product(
                id=str(uuid.uuid4()),
                shopify_id=shopify_id,
                title=product_data["title"],
                description=product_data.get("description", ""),
                price=product_data.get("price", 0.0),
                image_urls=product_data.get("image_urls", []),
                video_urls=product_data.get("video_urls", []),
                tags=product_data.get("tags", []),
                product_type=product_data.get("product_type"),
                created_at=now,
                updated_at=now,
            )
            db.add(new_product)

        upserted += 1

    await db.commit()

    return {
        "success": True,
        "synced": upserted,
        "message": f"Synced {upserted} product(s) from Shopify.",
    }


@router.post("", response_model=ProductOut, status_code=201)
async def create_product(
    payload: ProductCreate,
    db: AsyncSession = Depends(get_db),
):
    """Manually create a product in the local database."""
    now = datetime.utcnow()
    product = Product(
        id=str(uuid.uuid4()),
        shopify_id=payload.shopify_id,
        title=payload.title,
        description=payload.description,
        price=payload.price,
        image_urls=payload.image_urls,
        video_urls=payload.video_urls,
        tags=payload.tags,
        product_type=payload.product_type,
        created_at=now,
        updated_at=now,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: str, db: AsyncSession = Depends(get_db)):
    """Fetch a single product by its database ID."""
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product
