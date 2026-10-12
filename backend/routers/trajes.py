from fastapi import APIRouter, Depends, HTTPException

from lib.auth import require_auth
from lib.db import db
from models.schemas import Traje, TrajeIn

router = APIRouter(prefix="/trajes", tags=["trajes"], dependencies=[Depends(require_auth)])

ACTIVE = ["reservado", "retirado"]


async def busy_traje_ids(saida: str, retorno: str, exclude: str | None = None) -> set[str]:
    query: dict = {"status": {"$in": ACTIVE}, "data_saida": {"$lte": retorno}, "data_retorno": {"$gte": saida}}
    if exclude:
        query["id"] = {"$ne": exclude}
    busy: set[str] = set()
    async for f in db.fichas.find(query, {"traje_ids": 1}):
        busy.update(f.get("traje_ids", []))
    return busy


@router.get("", response_model=list[Traje])
async def list_trajes():
    docs = await db.trajes.find({}, {"_id": 0}).sort("codigo", 1).to_list(2000)
    return [Traje(**d) for d in docs]


@router.get("/ocupados", response_model=list[str])
async def ocupados(saida: str, retorno: str, exclude: str | None = None):
    return sorted(await busy_traje_ids(saida, retorno, exclude))


@router.post("", response_model=Traje, status_code=201)
async def create_traje(body: TrajeIn):
    traje = Traje(**body.model_dump())
    await db.trajes.insert_one(traje.model_dump())
    return traje


@router.put("/{id}", response_model=Traje)
async def update_traje(id: str, body: TrajeIn):
    res = await db.trajes.update_one({"id": id}, {"$set": body.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Traje não encontrado")
    return Traje(id=id, **body.model_dump())


@router.delete("/{id}", response_model=Traje)
async def delete_traje(id: str):
    doc = await db.trajes.find_one_and_delete({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Traje não encontrado")
    return Traje(**doc)
