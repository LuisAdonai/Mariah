"""Permanent client registry (by CPF) + CEP address lookup."""

import re
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException

from lib.auth import require_auth
from lib.db import db
from models.schemas import CepOut, Cliente, FichaIn

router = APIRouter(tags=["clientes"], dependencies=[Depends(require_auth)])

CLIENTE_FIELDS = ["nome", "cpf", "cep", "endereco", "numero_end", "complemento", "bairro", "telefone", "telefone2", "medidas"]


def digits(v: str) -> str:
    return re.sub(r"\D", "", v or "")


async def upsert_cliente(body: FichaIn) -> None:
    """Every saved ficha with a CPF refreshes that client's permanent record."""
    cpf = digits(body.cpf)
    if len(cpf) != 11:
        return
    data = {k: v for k, v in body.model_dump().items() if k in CLIENTE_FIELDS}
    data.update(cpf_digits=cpf, updated_at=datetime.now(timezone.utc).isoformat())
    await db.clientes.update_one({"cpf_digits": cpf}, {"$set": data}, upsert=True)


@router.get("/clientes/cpf/{cpf}", response_model=Cliente)
async def cliente_por_cpf(cpf: str):
    d = digits(cpf)
    if len(d) != 11:
        raise HTTPException(status_code=400, detail="CPF deve ter 11 dígitos")
    doc = await db.clientes.find_one({"cpf_digits": d}, {"_id": 0})
    if not doc:  # clients from fichas created before the registry existed
        async for f in db.fichas.find({"cpf": {"$nin": ["", None]}}, {"_id": 0}).sort("numero", -1):
            if digits(f.get("cpf", "")) == d:
                doc = {k: f.get(k) for k in CLIENTE_FIELDS if f.get(k) is not None}
                break
    if not doc:
        raise HTTPException(status_code=404, detail="Cliente não cadastrado")
    return Cliente(**doc)


@router.get("/cep/{cep}", response_model=CepOut)
async def buscar_cep(cep: str):
    d = digits(cep)
    if len(d) != 8:
        raise HTTPException(status_code=400, detail="CEP deve ter 8 dígitos")
    try:
        async with httpx.AsyncClient(timeout=8) as http:
            r = await http.get(f"https://viacep.com.br/ws/{d}/json/")
            data = r.json()
    except Exception:
        raise HTTPException(status_code=503, detail="Sem conexão para consultar o CEP — preencha o endereço manualmente")
    if r.status_code != 200 or data.get("erro"):
        raise HTTPException(status_code=404, detail="CEP não encontrado — preencha o endereço manualmente")
    return CepOut(
        cep=f"{d[:5]}-{d[5:]}", endereco=data.get("logradouro", ""), bairro=data.get("bairro", ""),
        cidade=data.get("localidade", ""), uf=data.get("uf", ""),
    )
