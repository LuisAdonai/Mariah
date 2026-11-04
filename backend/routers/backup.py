"""Local photo uploads + backup export/import (same file format as the desktop app)."""

import base64
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from lib.auth import require_auth
from lib.dates import today_iso
from lib.db import db
from lib.numeracao import proximo_numero, ultimo_numero

UPLOADS = Path(__file__).resolve().parent.parent / "uploads"
UPLOADS.mkdir(exist_ok=True)
EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}

router = APIRouter(tags=["backup"])


class UploadIn(BaseModel):
    data_url: str


class UploadOut(BaseModel):
    url: str


class BackupInfo(BaseModel):
    desktop: bool
    pasta_dados: str = ""
    pasta_backups: str = ""
    backups: list[str] = []
    proximo_numero: int


class ImportResult(BaseModel):
    trajes: int
    fichas: int
    proximo_numero: int


@router.post("/uploads", response_model=UploadOut, dependencies=[Depends(require_auth)])
async def upload(body: UploadIn):
    m = re.match(r"^data:(image/[a-z+]+);base64,(.+)$", body.data_url, re.S)
    if not m:
        raise HTTPException(status_code=400, detail="Envie uma imagem (JPG, PNG ou WEBP)")
    name = f"{uuid.uuid4()}{EXT.get(m.group(1), '.jpg')}"
    (UPLOADS / name).write_bytes(base64.b64decode(m.group(2)))
    return UploadOut(url=f"/api/uploads/{name}")


@router.get("/uploads/{name}")
async def get_upload(name: str):
    path = UPLOADS / os.path.basename(name)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Foto não encontrada")
    return FileResponse(path)


async def _seq() -> int:
    return await ultimo_numero()


@router.get("/backup/info", response_model=BackupInfo, dependencies=[Depends(require_auth)])
async def info():
    return BackupInfo(desktop=False, proximo_numero=await proximo_numero())


@router.get("/backup/export", dependencies=[Depends(require_auth)])
async def export():
    """Full copy: trajes, fichas (clientes, pagamentos, histórico), counter and every photo embedded."""
    trajes = await db.trajes.find({}, {"_id": 0}).to_list(10000)
    fichas = await db.fichas.find({}, {"_id": 0}).to_list(100000)
    fotos: dict[str, str] = {}
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as http:
        for t in trajes:
            url = t.get("foto_url") or ""
            try:
                if url.startswith("/api/uploads/"):
                    name = os.path.basename(url)
                    fotos[name] = base64.b64encode((UPLOADS / name).read_bytes()).decode()
                elif url.startswith("http"):
                    r = await http.get(url)
                    r.raise_for_status()
                    ext = EXT.get(r.headers.get("content-type", "").split(";")[0], ".jpg")
                    name = f"{t['id']}{ext}"
                    fotos[name] = base64.b64encode(r.content).decode()
                    t["foto_url"] = f"/api/uploads/{name}"
            except Exception:  # keep the original link if the photo can't be fetched
                pass
    payload: dict[str, Any] = {
        "formato": "mariah-backup",
        "versao": 1,
        "gerado_em": datetime.now(timezone.utc).isoformat(),
        "trajes": trajes,
        "fichas": fichas,
        "clientes": await db.clientes.find({}, {"_id": 0}).to_list(100000),
        "counters": {"ultimo": await _seq()},
        "fotos": fotos,
    }
    return JSONResponse(payload, headers={"Content-Disposition": f'attachment; filename="mariah-backup-{today_iso()}.json"'})


@router.post("/backup/import", response_model=ImportResult, dependencies=[Depends(require_auth)])
async def import_backup(body: dict[str, Any]):
    if body.get("formato") != "mariah-backup" or not isinstance(body.get("trajes"), list) or not isinstance(body.get("fichas"), list):
        raise HTTPException(status_code=400, detail="Arquivo de backup inválido")
    for name, data in (body.get("fotos") or {}).items():
        (UPLOADS / os.path.basename(name)).write_bytes(base64.b64decode(data))
    fichas = body["fichas"]
    clientes = body.get("clientes") if isinstance(body.get("clientes"), list) else []
    max_num = max((int(f.get("numero", 0)) for f in fichas), default=0)
    ultimo = max(int((body.get("counters") or {}).get("ultimo", 0)), max_num)
    await db.trajes.delete_many({})
    await db.fichas.delete_many({})
    await db.clientes.delete_many({})
    if body["trajes"]:
        await db.trajes.insert_many([{k: v for k, v in t.items() if k != "_id"} for t in body["trajes"]])
    if fichas:
        await db.fichas.insert_many([{k: v for k, v in f.items() if k != "_id"} for f in fichas])
    if clientes:
        await db.clientes.insert_many([{k: v for k, v in c.items() if k != "_id"} for c in clientes])
    await db.counters.update_one({"_id": "ficha"}, {"$set": {"ultimo": ultimo}, "$unset": {"seq": ""}}, upsert=True)
    return ImportResult(trajes=len(body["trajes"]), fichas=len(fichas), proximo_numero=await proximo_numero())
