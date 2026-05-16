from sqlalchemy import String, DateTime, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
import enum
from app.database import Base


class PostStatus(str, enum.Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    FAILED = "failed"


class Platform(str, enum.Enum):
    INSTAGRAM = "instagram"
    FACEBOOK = "facebook"
    TIKTOK = "tiktok"


class Post(Base):
    __tablename__ = "posts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    product_id: Mapped[str | None] = mapped_column(String, nullable=True)
    platform: Mapped[str] = mapped_column(String)
    caption: Mapped[str] = mapped_column(Text)
    hashtags: Mapped[list] = mapped_column(JSON, default=list)
    media_urls: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String, default=PostStatus.DRAFT)
    platform_post_id: Mapped[str | None] = mapped_column(String, nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    engagement: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
