import hmac
import os

from fastapi import APIRouter, Depends, HTTPException, Response

from lib.auth import COOKIE, make_token, require_auth
from models.schemas import LoginIn, Me

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=Me)
async def login(body: LoginIn, response: Response):
    if not hmac.compare_digest(body.password, os.environ["STORE_PASSWORD"]):
        raise HTTPException(status_code=401, detail="Senha incorreta")
    response.set_cookie(
        COOKIE, make_token(), httponly=True, samesite="lax", secure=True, max_age=60 * 60 * 24 * 30, path="/"
    )
    return Me()


@router.post("/logout", response_model=Me)
async def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")
    return Me(ok=False)


@router.get("/me", response_model=Me, dependencies=[Depends(require_auth)])
async def me():
    return Me()
