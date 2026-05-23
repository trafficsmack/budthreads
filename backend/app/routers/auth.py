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
    if payload.password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Invalid password")
    return {"token": create_token(settings.secret_key)}


@router.get("/verify")
async def verify(token: str):
    settings = get_settings()
    return {"valid": verify_token(token, settings.secret_key)}
