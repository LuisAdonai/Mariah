"""Idempotent seed: stock of trajes + a few fichas around today. Run: python seed.py"""

import asyncio
from datetime import date, datetime, timedelta, timezone

from lib.dates import today_iso
from lib.db import db, ensure_indexes
from models.schemas import Traje, new_id

U = "https://images.unsplash.com/"
IMG = {
    "noiva1": U + "photo-1594552072238-b8a33785b261?w=800&q=80",
    "noiva2": U + "photo-1549417229-7686ac5595fd?w=800&q=80",
    "noiva3": U + "photo-1549416878-b9ca95e26903?w=800&q=80",
    "terno1": U + "photo-1617127365659-c47fa864d8bc?w=800&q=80",
    "terno2": U + "photo-1598808503746-f34c53b9323e?w=800&q=80",
    "terno3": U + "photo-1522968439036-e6338d0ed84f?w=800&q=80",
}

TRAJES = [
    ("N-001", "Vestido Noiva Princesa Renda", "Noiva", "40", "Off-white", 1800, "noiva1"),
    ("N-002", "Vestido Noiva Sereia Gala", "Noiva", "38", "Branco", 2200, "noiva2"),
    ("N-003", "Vestido Noiva Clássico Véu Longo", "Noiva", "42", "Marfim", 1500, "noiva3"),
    ("T-101", "Traje Slim Noivo Preto", "Noivo", "50", "Preto", 450, "terno1"),
    ("T-102", "Smoking Lapela Xale Cetim", "Padrinho", "48", "Preto", 380, "terno2"),
    ("T-103", "Smoking Black Tie Gravata Borboleta", "Padrinho", "52", "Preto", 380, "terno3"),
    ("D-201", "Vestido Debutante Rosé", "Debutante", "36", "Rosé", 900, "noiva2"),
    ("F-301", "Vestido Festa Longo Marsala", "Festa", "40", "Marsala", 320, "noiva1"),
]


async def main() -> None:
    await ensure_indexes()
    if await db.trajes.count_documents({}) == 0:
        for codigo, nome, cat, tam, cor, valor, img in TRAJES:
            t = Traje(codigo=codigo, nome=nome, categoria=cat, tamanho=tam, cor=cor, valor_locacao=valor, foto_url=IMG[img])
            await db.trajes.insert_one(t.model_dump())
        print("trajes seeded")

    if await db.fichas.count_documents({}) == 0:
        hoje = date.fromisoformat(today_iso())
        d = lambda n: (hoje + timedelta(days=n)).isoformat()  # noqa: E731
        ids = {t["codigo"]: t["id"] async for t in db.trajes.find({}, {"codigo": 1, "id": 1})}
        fichas = [
            dict(nome="Ana Beatriz Souza", telefone="11975962646", cpf="123.456.789-00", endereco="Rua das Flores",
                 numero_end="120", bairro="Jardim Ângela", traje_ids=[ids["N-001"]], data_prova=d(0),
                 data_saida=d(3), data_retorno=d(5), total=1800, sinal=600, forma_pagamento="Pix", status="reservado",
                 medidas=dict(traje="Vestido Princesa", busto="88", cintura="70", observacoes="Subir barra 3cm")),
            dict(nome="Carlos Henrique Lima", telefone="11959276231", cpf="987.654.321-00", endereco="Av. Interlagos",
                 numero_end="45", bairro="Interlagos", traje_ids=[ids["T-101"]], data_prova=d(-3),
                 data_saida=d(0), data_retorno=d(2), total=450, sinal=200, forma_pagamento="Cartão", status="reservado",
                 medidas=dict(traje="Slim preto", calca="44", camisa="3", comp_manga="62", comp_calca="104")),
            dict(nome="Roberto Alves", telefone="11988887777", cpf="111.222.333-44", endereco="Rua Ipê",
                 numero_end="9", bairro="Capela do Socorro", traje_ids=[ids["T-102"]], data_prova=d(-8),
                 data_saida=d(-5), data_retorno=d(-1), total=380, sinal=380, forma_pagamento="Dinheiro", status="retirado",
                 medidas=dict(traje="Smoking xale", calca="46", camisa="4", comp_manga="64", comp_calca="106")),
        ]
        for i, f in enumerate(fichas, start=1):
            await db.fichas.insert_one({
                **f, "id": new_id(), "numero": 6936 + i, "telefone2": "", "trajes_descricao": "",
                "observacoes": "", "pagamentos": [], "created_at": datetime.now(timezone.utc).isoformat(),
                "medidas": {**{k: "" for k in ("traje", "calca", "camisa", "comp_manga", "comp_calca", "busto", "cintura", "observacoes")}, **f["medidas"]},
            })
        await db.counters.update_one({"_id": "ficha"}, {"$set": {"seq": len(fichas)}}, upsert=True)
        print("fichas seeded")


if __name__ == "__main__":
    asyncio.run(main())
