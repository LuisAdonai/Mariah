"""Single store-password auth via an httpOnly JWT cookie."""

import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, Request

COOKIE = "mn_session"
ALGO = "HS256"


def make_token() -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=30)
    return jwt.encode({"sub": "loja", "exp": exp}, os.environ["JWT_SECRET"], algorithm=ALGO)


async def require_auth(request: Request) -> None:
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[ALGO])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Sessão inválida")
