from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from jose import jwt
from pydantic import BaseModel

from app.config import get_settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginPayload(BaseModel):
    password: str


def create_token(secret_key: str) -> str:
    return jwt.encode(
        {"exp": datetime.utcnow() + timedelta(days=30), "iat": datetime.utcnow()},
        secret_key,
        algorithm="HS256",
    )


def verify_token(token: str, secret_key: str) -> bool:
    try:
        jwt.decode(token, secret_key, algorithms=["HS256"])
        return True
    except Exception:
        return False


@router.post("/login")
async def login(payload: LoginPayload):
    settings = get_settings()
    if payload.password.strip() != settings.admin_password.strip():
        raise HTTPException(status_code=401, detail="Invalid password")
    return {"token": create_token(settings.secret_key)}


@router.get("/verify")
async def verify(token: str):
    settings = get_settings()
    return {"valid": verify_token(token, settings.secret_key)}


@router.get("/debug-password")
async def debug_password():
    """Temporary: shows password length and whether it's the default, without exposing it."""
    from functools import lru_cache
    # Bypass lru_cache by creating a fresh Settings instance
    from app.config import Settings
    fresh = Settings()
    pwd = fresh.admin_password
    return {
        "length": len(pwd),
        "is_default": pwd.strip() == "changeme",
        "first_char": pwd[0] if pwd else "",
        "last_char": pwd[-1] if pwd else "",
        "has_whitespace": pwd != pwd.strip(),
    }
