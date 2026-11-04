"""Ficha numbering: counters.ficha.ultimo = last number issued; new fichas never go below MIN_NUMERO."""

from pymongo import ReturnDocument

from lib.db import db

MIN_NUMERO = 7001


async def _max_existing() -> int:
    doc = await db.fichas.find_one({}, {"numero": 1}, sort=[("numero", -1)])
    return int(doc["numero"]) if doc else 0


async def next_numero() -> int:
    floor = max(MIN_NUMERO - 1, await _max_existing())
    await db.counters.update_one({"_id": "ficha"}, {"$max": {"ultimo": floor}}, upsert=True)
    c = await db.counters.find_one_and_update({"_id": "ficha"}, {"$inc": {"ultimo": 1}}, return_document=ReturnDocument.AFTER)
    return int(c["ultimo"])


async def ultimo_numero() -> int:
    c = await db.counters.find_one({"_id": "ficha"})
    return max(int((c or {}).get("ultimo", 0)), await _max_existing())


async def proximo_numero() -> int:
    return max(MIN_NUMERO, await ultimo_numero() + 1)
