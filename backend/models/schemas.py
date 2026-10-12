"""Pydantic models — mirrored by hand in frontend/src/lib/types.ts."""

import uuid
from typing import Literal

from pydantic import BaseModel, Field

TrajeStatus = Literal["disponivel", "alugado", "prova", "lavanderia"]
FichaStatus = Literal["reservado", "retirado", "devolvido", "cancelado"]
EventoTipo = Literal["saida", "retorno", "prova"]


def new_id() -> str:
    return str(uuid.uuid4())


# ---------- Auth ----------
class LoginIn(BaseModel):
    password: str


class Me(BaseModel):
    ok: bool = True
    loja: str = "Mariáh Noivas"


# ---------- Estoque ----------
class TrajeIn(BaseModel):
    codigo: str = Field(min_length=1)
    nome: str = Field(min_length=1)
    categoria: str = "Festa"
    tamanho: str = ""
    cor: str = ""
    valor_locacao: float = Field(default=0, ge=0)
    status: TrajeStatus = "disponivel"
    foto_url: str = ""
    observacoes: str = ""


class Traje(TrajeIn):
    id: str = Field(default_factory=new_id)


# ---------- Fichas ----------
class Medidas(BaseModel):
    traje: str = ""
    calca: str = ""
    camisa: str = ""
    comp_manga: str = ""
    comp_calca: str = ""
    busto: str = ""
    cintura: str = ""
    observacoes: str = ""


class Pagamento(BaseModel):
    id: str = Field(default_factory=new_id)
    valor: float
    forma: str = ""
    data: str


class PagamentoIn(BaseModel):
    valor: float = Field(gt=0)
    forma: str = ""


class StatusIn(BaseModel):
    status: FichaStatus


class FichaIn(BaseModel):
    nome: str = Field(min_length=1)
    endereco: str = ""
    numero_end: str = ""
    bairro: str = ""
    cpf: str = ""
    telefone: str = ""
    telefone2: str = ""
    traje_ids: list[str] = []
    trajes_descricao: str = ""
    data_saida: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    data_retorno: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    data_prova: str | None = None
    medidas: Medidas = Medidas()
    total: float = Field(default=0, ge=0)
    sinal: float = Field(default=0, ge=0)
    forma_pagamento: str = ""
    observacoes: str = ""


class TrajeRef(BaseModel):
    id: str
    codigo: str
    nome: str


class Ficha(FichaIn):
    id: str
    numero: int
    status: FichaStatus = "reservado"
    pagamentos: list[Pagamento] = []
    created_at: str
    saldo: float = 0
    trajes: list[TrajeRef] = []


# ---------- Agenda / Dashboard ----------
class AgendaEvento(BaseModel):
    ficha_id: str
    numero: int
    nome: str
    telefone: str
    tipo: EventoTipo
    data: str
    status: FichaStatus
    saldo: float
    trajes: str


class Dashboard(BaseModel):
    hoje: str
    saidas_hoje: list[AgendaEvento]
    retornos_hoje: list[AgendaEvento]
    provas_hoje: list[AgendaEvento]
    atrasados: list[AgendaEvento]
    proximos: list[AgendaEvento]
    saldo_a_receber: float
    fichas_ativas: int
    trajes_total: int
    trajes_disponiveis: int
