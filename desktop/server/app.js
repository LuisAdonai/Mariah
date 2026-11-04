// Local backend for the desktop app — a faithful port of backend/routers/*.py
// (same /api routes, same JSON shapes, same business rules), backed by a local file DB.
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const express = require("express");
const { Store } = require("./store");

const MIN_NUMERO = 7001;
const STORE_PASSWORD = "mariah2026";
const COOKIE = "mn_session";
const ACTIVE = ["reservado", "retirado"];
const TRAJE_STATUS = ["disponivel", "alugado", "prova", "lavanderia"];
const FICHA_STATUS = ["reservado", "retirado", "devolvido", "cancelado"];
const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;
const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif" };

class HttpError extends Error {
  constructor(status, detail) {
    super(typeof detail === "string" ? detail : "erro");
    this.status = status;
    this.detail = detail;
  }
}
const uuid = () => crypto.randomUUID();
const round2 = (n) => Math.round(n * 100) / 100;
const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// ---------- validation helpers (mirror the Pydantic models) ----------
const str = (v) => (v === undefined || v === null ? "" : String(v));
function num(v, field, { gt } = {}) {
  const n = v === undefined || v === null || v === "" ? 0 : Number(v);
  if (!Number.isFinite(n) || n < 0 || (gt !== undefined && n <= gt)) throw new HttpError(422, [{ loc: ["body", field], msg: "valor inválido" }]);
  return n;
}
function required(v, field) {
  const s = str(v);
  if (!s) throw new HttpError(422, [{ loc: ["body", field], msg: "campo obrigatório" }]);
  return s;
}

function parseTraje(b) {
  const status = b.status ?? "disponivel";
  if (!TRAJE_STATUS.includes(status)) throw new HttpError(422, [{ loc: ["body", "status"], msg: "status inválido" }]);
  return {
    codigo: required(b.codigo, "codigo"),
    nome: required(b.nome, "nome"),
    categoria: b.categoria === undefined ? "Festa" : str(b.categoria),
    tamanho: str(b.tamanho),
    cor: str(b.cor),
    valor_locacao: num(b.valor_locacao, "valor_locacao"),
    status,
    foto_url: str(b.foto_url),
    observacoes: str(b.observacoes),
  };
}

const MEDIDAS = ["traje", "calca", "camisa", "comp_manga", "comp_calca", "busto", "cintura", "observacoes"];
function parseFicha(b) {
  const m = b.medidas || {};
  for (const k of ["data_saida", "data_retorno"]) {
    if (!DATE_RX.test(str(b[k]))) throw new HttpError(422, [{ loc: ["body", k], msg: "data inválida" }]);
  }
  return {
    nome: required(b.nome, "nome"),
    endereco: str(b.endereco),
    numero_end: str(b.numero_end),
    bairro: str(b.bairro),
    cpf: str(b.cpf),
    cep: str(b.cep),
    complemento: str(b.complemento),
    telefone: str(b.telefone),
    telefone2: str(b.telefone2),
    traje_ids: Array.isArray(b.traje_ids) ? b.traje_ids.map(String) : [],
    trajes_descricao: str(b.trajes_descricao),
    data_saida: b.data_saida,
    data_retorno: b.data_retorno,
    data_prova: b.data_prova ? str(b.data_prova) : null,
    medidas: Object.fromEntries(MEDIDAS.map((k) => [k, str(m[k])])),
    total: num(b.total, "total"),
    sinal: num(b.sinal, "sinal"),
    forma_pagamento: str(b.forma_pagamento),
    observacoes: str(b.observacoes),
  };
}

// ---------- auth (HMAC-signed httpOnly cookie, 30 days) ----------
function makeToken(secret) {
  const payload = Buffer.from(JSON.stringify({ sub: "loja", exp: Date.now() + 30 * 864e5 })).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
function validToken(token, secret) {
  if (!token || !token.includes(".")) return false;
  const [payload, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now();
  } catch {
    return false;
  }
}
function getCookie(req, name) {
  for (const part of (req.headers.cookie || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

function createApp({ dataDir, backupsDir = null, staticDir = null, seedFile = null }) {
  fs.mkdirSync(dataDir, { recursive: true });
  const store = new Store(dataDir);
  const configFile = path.join(dataDir, "config.json");
  let config = {};
  try { config = JSON.parse(fs.readFileSync(configFile, "utf8")); } catch { /* first run */ }
  if (!config.secret) {
    config.secret = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(configFile, JSON.stringify(config));
  }
  const firstRun = !store.exists();
  const db = () => store.data;
  db().clientes = Array.isArray(db().clientes) ? db().clientes : [];

  // numbering: counters.ultimo = last number issued; never below MIN_NUMERO
  const maxExisting = () => db().fichas.reduce((m, f) => Math.max(m, Number(f.numero) || 0), 0);
  const ultimoNumero = () => Math.max(Number(db().counters.ultimo) || 0, maxExisting());
  const proximoNumero = () => Math.max(MIN_NUMERO, ultimoNumero() + 1);

  // permanent client registry by CPF
  const digits = (v) => str(v).replace(/\D/g, "");
  const CLIENTE_FIELDS = ["nome", "cpf", "cep", "endereco", "numero_end", "complemento", "bairro", "telefone", "telefone2", "medidas"];
  function upsertCliente(body) {
    const cpf = digits(body.cpf);
    if (cpf.length !== 11) return;
    const data = Object.fromEntries(CLIENTE_FIELDS.map((k) => [k, body[k]]));
    const rec = { ...data, cpf_digits: cpf, updated_at: new Date().toISOString() };
    const i = db().clientes.findIndex((c) => c.cpf_digits === cpf);
    if (i >= 0) db().clientes[i] = rec; else db().clientes.push(rec);
  }

  // ---------- shared domain logic ----------
  const trajesMap = () => new Map(db().trajes.map((t) => [t.id, { id: t.id, codigo: t.codigo, nome: t.nome }]));
  function toFicha(doc, tmap) {
    const pagos = (doc.pagamentos || []).reduce((s, p) => s + p.valor, 0);
    return {
      ...doc,
      saldo: round2((doc.total || 0) - (doc.sinal || 0) - pagos),
      trajes: (doc.traje_ids || []).filter((t) => tmap.has(t)).map((t) => tmap.get(t)),
    };
  }
  const trajesLabel = (f) => [...f.trajes.map((t) => t.nome), ...(f.trajes_descricao ? [f.trajes_descricao] : [])].join(", ");
  const evento = (f, tipo, data) => ({
    ficha_id: f.id, numero: f.numero, nome: f.nome, telefone: f.telefone, tipo, data,
    status: f.status, saldo: f.saldo, trajes: trajesLabel(f),
  });
  function busyTrajeIds(saida, retorno, exclude) {
    const busy = new Set();
    for (const f of db().fichas) {
      if (!ACTIVE.includes(f.status) || f.id === exclude) continue;
      if (f.data_saida <= retorno && f.data_retorno >= saida) (f.traje_ids || []).forEach((t) => busy.add(t));
    }
    return busy;
  }
  function validate(body, exclude) {
    if (body.data_retorno < body.data_saida) throw new HttpError(400, "A data de retorno deve ser igual ou posterior à saída");
    if (body.traje_ids.length) {
      const busy = busyTrajeIds(body.data_saida, body.data_retorno, exclude);
      const hit = body.traje_ids.filter((t) => busy.has(t));
      if (hit.length) {
        const tmap = trajesMap();
        throw new HttpError(409, `Traje já reservado neste período: ${hit.filter((t) => tmap.has(t)).map((t) => tmap.get(t).nome).join(", ")}`);
      }
    }
  }
  const getDoc = (id) => {
    const doc = db().fichas.find((f) => f.id === id);
    if (!doc) throw new HttpError(404, "Ficha não encontrada");
    return doc;
  };
  function eventosBetween(inicio, fim) {
    const tmap = trajesMap();
    const out = [];
    for (const d of db().fichas) {
      if (d.status === "cancelado") continue;
      const f = toFicha(d, tmap);
      for (const [tipo, data] of [["prova", f.data_prova], ["saida", f.data_saida], ["retorno", f.data_retorno]]) {
        if (data && inicio <= data && data <= fim) out.push(evento(f, tipo, data));
      }
    }
    return out.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.tipo < b.tipo ? -1 : a.tipo > b.tipo ? 1 : a.numero - b.numero));
  }

  // ---------- backup format (shared with backend/routers/backup.py) ----------
  function exportBackup() {
    const fotos = {};
    for (const name of fs.readdirSync(store.fotosDir)) {
      fotos[name] = fs.readFileSync(path.join(store.fotosDir, name)).toString("base64");
    }
    return {
      formato: "mariah-backup",
      versao: 1,
      gerado_em: new Date().toISOString(),
      trajes: db().trajes,
      fichas: db().fichas,
      clientes: db().clientes,
      counters: { ultimo: ultimoNumero() },
      fotos,
    };
  }
  function importBackup(b, { safetyCopy = true } = {}) {
    if (!b || b.formato !== "mariah-backup" || !Array.isArray(b.trajes) || !Array.isArray(b.fichas)) {
      throw new HttpError(400, "Arquivo de backup inválido");
    }
    if (backupsDir && safetyCopy) writeBackupFile("antes-de-restaurar");
    const fotos = b.fotos || {};
    for (const [name, data] of Object.entries(fotos)) {
      const safe = path.basename(name);
      fs.writeFileSync(path.join(store.fotosDir, safe), Buffer.from(data, "base64"));
    }
    const maxNumero = b.fichas.reduce((m, f) => Math.max(m, Number(f.numero) || 0), 0);
    const ultimo = Math.max(Number(b.counters?.ultimo) || 0, maxNumero);
    store.replaceAll({
      trajes: b.trajes.map((t) => ({ id: t.id || uuid(), ...parseTraje(t) })),
      fichas: b.fichas.map((f) => ({
        ...parseFicha(f), id: f.id || uuid(), numero: Number(f.numero), status: FICHA_STATUS.includes(f.status) ? f.status : "reservado",
        pagamentos: Array.isArray(f.pagamentos) ? f.pagamentos : [], created_at: f.created_at || new Date().toISOString(),
      })),
      clientes: Array.isArray(b.clientes) ? b.clientes : [],
      counters: { ultimo },
    });
    return { trajes: store.data.trajes.length, fichas: store.data.fichas.length, proximo_numero: proximoNumero() };
  }
  function writeBackupFile(prefix = "auto") {
    if (!backupsDir) return null;
    fs.mkdirSync(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
    const file = path.join(backupsDir, `${prefix}-mariah-backup-${stamp}.json`);
    fs.writeFileSync(file, JSON.stringify(exportBackup()));
    // keep only the 30 most recent automatic backups
    const autos = fs.readdirSync(backupsDir).filter((n) => n.startsWith("auto-")).sort();
    for (const old of autos.slice(0, Math.max(0, autos.length - 30))) fs.rmSync(path.join(backupsDir, old), { force: true });
    return file;
  }

  if (firstRun && seedFile && fs.existsSync(seedFile)) {
    importBackup(JSON.parse(fs.readFileSync(seedFile, "utf8")), { safetyCopy: false });
    console.log("Dados iniciais carregados.");
  }

  // ---------- HTTP ----------
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1gb", strict: false }));
  const api = express.Router();
  const h = (fn) => (req, res, next) => {
    try {
      const out = fn(req, res);
      if (out !== undefined) res.json(out);
    } catch (e) {
      next(e);
    }
  };
  const auth = (req, _res, next) =>
    validToken(getCookie(req, COOKIE), config.secret) ? next() : next(new HttpError(401, getCookie(req, COOKIE) ? "Sessão inválida" : "Não autenticado"));

  api.get("/", h(() => ({ message: "Hello World" })));

  // auth
  api.post("/auth/login", h((req, res) => {
    const pw = str(req.body?.password);
    const a = Buffer.from(pw), b = Buffer.from(STORE_PASSWORD);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(401, "Senha incorreta");
    res.cookie(COOKIE, makeToken(config.secret), { httpOnly: true, sameSite: "lax", maxAge: 30 * 864e5, path: "/" });
    return { ok: true, loja: "Mariáh Noivas" };
  }));
  api.post("/auth/logout", h((_req, res) => {
    res.clearCookie(COOKIE, { path: "/" });
    return { ok: false, loja: "Mariáh Noivas" };
  }));
  api.get("/auth/me", auth, h(() => ({ ok: true, loja: "Mariáh Noivas" })));

  // trajes
  api.get("/trajes", auth, h(() => [...db().trajes].sort((a, b) => a.codigo.localeCompare(b.codigo))));
  api.get("/trajes/ocupados", auth, h((req) => {
    const { saida, retorno, exclude } = req.query;
    if (!saida || !retorno) throw new HttpError(422, "saida e retorno são obrigatórios");
    return [...busyTrajeIds(String(saida), String(retorno), exclude ? String(exclude) : undefined)].sort();
  }));
  api.post("/trajes", auth, h((req, res) => {
    const t = { id: uuid(), ...parseTraje(req.body || {}) };
    db().trajes.push(t);
    store.save();
    res.status(201);
    return t;
  }));
  api.put("/trajes/:id", auth, h((req) => {
    const i = db().trajes.findIndex((t) => t.id === req.params.id);
    if (i < 0) throw new HttpError(404, "Traje não encontrado");
    db().trajes[i] = { id: req.params.id, ...parseTraje(req.body || {}) };
    store.save();
    return db().trajes[i];
  }));
  api.delete("/trajes/:id", auth, h((req) => {
    const i = db().trajes.findIndex((t) => t.id === req.params.id);
    if (i < 0) throw new HttpError(404, "Traje não encontrado");
    const [t] = db().trajes.splice(i, 1);
    store.save();
    return t;
  }));

  // fichas
  api.get("/fichas", auth, h((req) => {
    const q = str(req.query.q).trim().toLowerCase();
    const status = str(req.query.status);
    const de = str(req.query.saida_de), ate = str(req.query.saida_ate);
    const tmap = trajesMap();
    return db().fichas
      .filter((f) => !status || f.status === status)
      .filter((f) => (!de && !ate) || ((status || f.status !== "cancelado") && (!de || f.data_saida >= de) && (!ate || f.data_saida <= ate)))
      .filter((f) => !q || [f.nome, f.cpf, f.telefone].some((v) => str(v).toLowerCase().includes(q)) || (/^\d+$/.test(q) && f.numero === Number(q)))
      .sort((a, b) => b.numero - a.numero)
      .map((f) => toFicha(f, tmap));
  }));
  api.get("/fichas/:id", auth, h((req) => toFicha(getDoc(req.params.id), trajesMap())));
  api.post("/fichas", auth, h((req, res) => {
    const body = parseFicha(req.body || {});
    validate(body);
    const numero = proximoNumero();
    db().counters.ultimo = numero;
    const doc = {
      ...body, id: uuid(), numero, status: "reservado",
      pagamentos: [], created_at: new Date().toISOString(),
    };
    db().fichas.push(doc);
    upsertCliente(body);
    store.save();
    res.status(201);
    return toFicha(doc, trajesMap());
  }));
  api.put("/fichas/:id", auth, h((req) => {
    const doc = getDoc(req.params.id);
    const body = parseFicha(req.body || {});
    validate(body, doc.id);
    Object.assign(doc, body);
    upsertCliente(body);
    store.save();
    return toFicha(doc, trajesMap());
  }));
  api.patch("/fichas/:id/status", auth, h((req) => {
    const doc = getDoc(req.params.id);
    const status = req.body?.status;
    if (!FICHA_STATUS.includes(status)) throw new HttpError(422, [{ loc: ["body", "status"], msg: "status inválido" }]);
    doc.status = status;
    const ts = { retirado: "alugado", devolvido: "lavanderia" }[status];
    if (ts) for (const t of db().trajes) if ((doc.traje_ids || []).includes(t.id)) t.status = ts;
    store.save();
    return toFicha(doc, trajesMap());
  }));
  api.post("/fichas/:id/pagamentos", auth, h((req) => {
    const doc = getDoc(req.params.id);
    const valor = num(req.body?.valor, "valor", { gt: 0 });
    doc.pagamentos = [...(doc.pagamentos || []), { id: uuid(), valor, forma: str(req.body?.forma), data: todayIso() }];
    store.save();
    return toFicha(doc, trajesMap());
  }));
  api.delete("/fichas/:id", auth, h((req) => {
    const doc = getDoc(req.params.id);
    const tmap = trajesMap();
    store.data.fichas = db().fichas.filter((f) => f.id !== doc.id);
    store.save();
    return toFicha(doc, tmap);
  }));

  // agenda + dashboard
  api.get("/agenda", auth, h((req) => {
    const { inicio, fim } = req.query;
    if (!inicio || !fim) throw new HttpError(422, "inicio e fim são obrigatórios");
    return eventosBetween(String(inicio), String(fim));
  }));
  api.get("/dashboard", auth, h(() => {
    const hoje = todayIso();
    const eventos = eventosBetween(hoje, addDays(hoje, 7));
    const hojeEv = eventos.filter((e) => e.data === hoje);
    const tmap = trajesMap();
    const ativos = db().fichas.filter((f) => ACTIVE.includes(f.status)).map((f) => toFicha(f, tmap));
    return {
      hoje,
      saidas_hoje: hojeEv.filter((e) => e.tipo === "saida" && e.status === "reservado"),
      retornos_hoje: hojeEv.filter((e) => e.tipo === "retorno" && e.status !== "devolvido"),
      provas_hoje: hojeEv.filter((e) => e.tipo === "prova" && e.status === "reservado"),
      atrasados: ativos.filter((f) => f.status === "retirado" && f.data_retorno < hoje).map((f) => evento(f, "retorno", f.data_retorno)),
      proximos: eventos.filter((e) => e.data > hoje && ACTIVE.includes(e.status)),
      saldo_a_receber: round2(ativos.reduce((s, f) => s + Math.max(f.saldo, 0), 0)),
      fichas_ativas: ativos.length,
      trajes_total: db().trajes.length,
      trajes_disponiveis: db().trajes.filter((t) => t.status === "disponivel").length,
    };
  }));

  // clientes + CEP
  api.get("/clientes/cpf/:cpf", auth, h((req) => {
    const d = digits(req.params.cpf);
    if (d.length !== 11) throw new HttpError(400, "CPF deve ter 11 dígitos");
    let c = db().clientes.find((x) => x.cpf_digits === d);
    if (!c) {
      const f = [...db().fichas].sort((a, b) => b.numero - a.numero).find((x) => digits(x.cpf) === d);
      if (f) c = Object.fromEntries(CLIENTE_FIELDS.map((k) => [k, f[k]]));
    }
    if (!c) throw new HttpError(404, "Cliente não cadastrado");
    const m = c.medidas || {};
    return {
      ...Object.fromEntries(CLIENTE_FIELDS.filter((k) => k !== "medidas").map((k) => [k, str(c[k])])),
      medidas: Object.fromEntries(MEDIDAS.map((k) => [k, str(m[k])])),
    };
  }));
  api.get("/cep/:cep", auth, async (req, res, next) => {
    try {
      const d = digits(req.params.cep);
      if (d.length !== 8) throw new HttpError(400, "CEP deve ter 8 dígitos");
      let data;
      try {
        const r = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: AbortSignal.timeout(8000) });
        data = r.ok ? await r.json() : { erro: true };
      } catch {
        throw new HttpError(503, "Sem internet para consultar o CEP — preencha o endereço manualmente");
      }
      if (data.erro) throw new HttpError(404, "CEP não encontrado — preencha o endereço manualmente");
      res.json({ cep: `${d.slice(0, 5)}-${d.slice(5)}`, endereco: str(data.logradouro), bairro: str(data.bairro), cidade: str(data.localidade), uf: str(data.uf) });
    } catch (e) { next(e); }
  });

  // local photo storage
  api.post("/uploads", auth, h((req) => {
    const m = /^data:(image\/[a-z+]+);base64,(.+)$/s.exec(str(req.body?.data_url));
    if (!m) throw new HttpError(400, "Envie uma imagem (JPG, PNG ou WEBP)");
    const ext = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" }[m[1]] || ".jpg";
    const name = `${uuid()}${ext}`;
    fs.writeFileSync(path.join(store.fotosDir, name), Buffer.from(m[2], "base64"));
    return { url: `/api/uploads/${name}` };
  }));
  api.get("/uploads/:name", (req, res, next) => {
    const file = path.join(store.fotosDir, path.basename(req.params.name));
    if (!fs.existsSync(file)) return next(new HttpError(404, "Foto não encontrada"));
    res.type(MIME[path.extname(file).toLowerCase()] || "application/octet-stream").send(fs.readFileSync(file));
  });

  // backup / restore
  api.get("/backup/info", auth, h(() => ({
    desktop: true,
    pasta_dados: dataDir,
    pasta_backups: backupsDir || "",
    backups: backupsDir && fs.existsSync(backupsDir) ? fs.readdirSync(backupsDir).filter((n) => n.endsWith(".json")).sort().reverse().slice(0, 10) : [],
    proximo_numero: proximoNumero(),
  })));
  api.get("/backup/export", auth, (req, res, next) => {
    try {
      res.setHeader("Content-Disposition", `attachment; filename="mariah-backup-${todayIso()}.json"`);
      res.json(exportBackup());
    } catch (e) { next(e); }
  });
  api.post("/backup/import", auth, h((req) => importBackup(req.body)));
  api.post("/backup/agora", auth, h(() => {
    const file = writeBackupFile("manual");
    if (!file) throw new HttpError(400, "Pasta de backups indisponível");
    return { arquivo: file };
  }));

  app.use("/api", api);
  app.use("/api", (_req, _res, next) => next(new HttpError(404, "Not Found")));

  if (staticDir) {
    app.use(express.static(staticDir, { index: false }));
    app.get("*", (_req, res) => res.sendFile(path.join(staticDir, "index.html")));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ detail: err.detail });
    if (err.type === "entity.parse.failed") return res.status(422).json({ detail: "JSON inválido" });
    console.error(err);
    res.status(500).json({ detail: "Erro interno" });
  });

  return { app, store, writeBackupFile };
}

function startServer(opts, port = 0) {
  const ctx = createApp(opts);
  return new Promise((resolve, reject) => {
    const server = ctx.app.listen(port, "127.0.0.1", () => resolve({ ...ctx, server, port: server.address().port }));
    server.on("error", reject);
  });
}

module.exports = { createApp, startServer };
