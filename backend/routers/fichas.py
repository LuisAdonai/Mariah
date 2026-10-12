import re
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pymongo import ReturnDocument

from lib.auth import require_auth
from lib.dates import today_iso
from lib.db import db
from models.schemas import (
    AgendaEvento,
    Dashboard,
    Ficha,
    FichaIn,
    Pagamento,
    PagamentoIn,
    StatusIn,
    TrajeRef,
    new_id,
)
from routers.trajes import busy_traje_ids

router = APIRouter(tags=["fichas"], dependencies=[Depends(require_auth)])

FIRST_NUMERO = 6937


async def trajes_map() -> dict[str, TrajeRef]:
    docs = await db.trajes.find({}, {"_id": 0, "id": 1, "codigo": 1, "nome": 1}).to_list(5000)
    return {d["id"]: TrajeRef(**d) for d in docs}


def to_ficha(doc: dict, tmap: dict[str, TrajeRef]) -> Ficha:
    doc = {k: v for k, v in doc.items() if k != "_id"}
    pagos = sum(p["valor"] for p in doc.get("pagamentos", []))
    doc["saldo"] = round(doc.get("total", 0) - doc.get("sinal", 0) - pagos, 2)
    doc["trajes"] = [tmap[t] for t in doc.get("traje_ids", []) if t in tmap]
    return Ficha(**doc)


def trajes_label(f: Ficha) -> str:
    parts = [t.nome for t in f.trajes]
    if f.trajes_descricao:
        parts.append(f.trajes_descricao)
    return ", ".join(parts)


def evento(f: Ficha, tipo: str, data: str) -> AgendaEvento:
    return AgendaEvento(
        ficha_id=f.id, numero=f.numero, nome=f.nome, telefone=f.telefone, tipo=tipo,  # type: ignore[arg-type]
        data=data, status=f.status, saldo=f.saldo, trajes=trajes_label(f),
    )


async def validate(body: FichaIn, exclude: str | None = None) -> None:
    if body.data_retorno < body.data_saida:
        raise HTTPException(status_code=400, detail="A data de retorno deve ser igual ou posterior à saída")
    if body.traje_ids:
        busy = await busy_traje_ids(body.data_saida, body.data_retorno, exclude) & set(body.traje_ids)
        if busy:
            tmap = await trajes_map()
            nomes = ", ".join(tmap[t].nome for t in busy if t in tmap)
            raise HTTPException(status_code=409, detail=f"Traje já reservado neste período: {nomes}")


async def get_doc(id: str) -> dict:
    doc = await db.fichas.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Ficha não encontrada")
    return doc


@router.get("/fichas", response_model=list[Ficha])
async def list_fichas(q: str | None = None, status: str | None = None):
    query: dict = {}
    if status:
        query["status"] = status
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        ors: list[dict] = [{"nome": rx}, {"cpf": rx}, {"telefone": rx}]
        if q.isdigit():
            ors.append({"numero": int(q)})
        query["$or"] = ors
    docs = await db.fichas.find(query, {"_id": 0}).sort("numero", -1).to_list(2000)
    tmap = await trajes_map()
    return [to_ficha(d, tmap) for d in docs]


@router.get("/fichas/{id}", response_model=Ficha)
async def get_ficha(id: str):
    return to_ficha(await get_doc(id), await trajes_map())


@router.post("/fichas", response_model=Ficha, status_code=201)
async def create_ficha(body: FichaIn):
    await validate(body)
    counter = await db.counters.find_one_and_update(
        {"_id": "ficha"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    numero = FIRST_NUMERO - 1 + counter["seq"]
    doc = {
        **body.model_dump(), "id": new_id(), "numero": numero, "status": "reservado",
        "pagamentos": [], "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.fichas.insert_one(dict(doc))
    return to_ficha(doc, await trajes_map())


@router.put("/fichas/{id}", response_model=Ficha)
async def update_ficha(id: str, body: FichaIn):
    await get_doc(id)
    await validate(body, exclude=id)
    await db.fichas.update_one({"id": id}, {"$set": body.model_dump()})
    return to_ficha(await get_doc(id), await trajes_map())


@router.patch("/fichas/{id}/status", response_model=Ficha)
async def set_status(id: str, body: StatusIn):
    doc = await get_doc(id)
    await db.fichas.update_one({"id": id}, {"$set": {"status": body.status}})
    traje_status = {"retirado": "alugado", "devolvido": "lavanderia"}.get(body.status)
    if traje_status and doc.get("traje_ids"):
        await db.trajes.update_many({"id": {"$in": doc["traje_ids"]}}, {"$set": {"status": traje_status}})
    return to_ficha(await get_doc(id), await trajes_map())


@router.post("/fichas/{id}/pagamentos", response_model=Ficha)
async def add_pagamento(id: str, body: PagamentoIn):
    await get_doc(id)
    pag = Pagamento(valor=body.valor, forma=body.forma, data=today_iso())
    await db.fichas.update_one({"id": id}, {"$push": {"pagamentos": pag.model_dump()}})
    return to_ficha(await get_doc(id), await trajes_map())


@router.delete("/fichas/{id}", response_model=Ficha)
async def delete_ficha(id: str):
    doc = await get_doc(id)
    tmap = await trajes_map()
    await db.fichas.delete_one({"id": id})
    return to_ficha(doc, tmap)


async def eventos_between(inicio: str, fim: str) -> list[AgendaEvento]:
    query = {
        "status": {"$ne": "cancelado"},
        "$or": [
            {"data_saida": {"$gte": inicio, "$lte": fim}},
            {"data_retorno": {"$gte": inicio, "$lte": fim}},
            {"data_prova": {"$gte": inicio, "$lte": fim}},
        ],
    }
    docs = await db.fichas.find(query, {"_id": 0}).to_list(5000)
    tmap = await trajes_map()
    out: list[AgendaEvento] = []
    for d in docs:
        f = to_ficha(d, tmap)
        for tipo, data in (("prova", f.data_prova), ("saida", f.data_saida), ("retorno", f.data_retorno)):
            if data and inicio <= data <= fim:
                out.append(evento(f, tipo, data))
    out.sort(key=lambda e: (e.data, e.tipo, e.numero))
    return out


@router.get("/agenda", response_model=list[AgendaEvento])
async def agenda(inicio: str, fim: str):
    return await eventos_between(inicio, fim)


@router.get("/dashboard", response_model=Dashboard)
async def dashboard():
    hoje = today_iso()
    fim = (date.fromisoformat(hoje) + timedelta(days=7)).isoformat()
    eventos = await eventos_between(hoje, fim)
    hoje_ev = [e for e in eventos if e.data == hoje]
    tmap = await trajes_map()
    ativos = [to_ficha(d, tmap) async for d in db.fichas.find({"status": {"$in": ["reservado", "retirado"]}}, {"_id": 0})]
    atrasados = [evento(f, "retorno", f.data_retorno) for f in ativos if f.status == "retirado" and f.data_retorno < hoje]
    return Dashboard(
        hoje=hoje,
        saidas_hoje=[e for e in hoje_ev if e.tipo == "saida" and e.status == "reservado"],
        retornos_hoje=[e for e in hoje_ev if e.tipo == "retorno" and e.status != "devolvido"],
        provas_hoje=[e for e in hoje_ev if e.tipo == "prova" and e.status == "reservado"],
        atrasados=atrasados,
        proximos=[e for e in eventos if e.data > hoje and e.status in ("reservado", "retirado")],
        saldo_a_receber=round(sum(max(f.saldo, 0) for f in ativos), 2),
        fichas_ativas=len(ativos),
        trajes_total=await db.trajes.count_documents({}),
        trajes_disponiveis=await db.trajes.count_documents({"status": "disponivel"}),
    )
