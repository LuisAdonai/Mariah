import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Shirt, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppLayout";
import { TrajeStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { brl, CATEGORIAS, errMsg, TRAJE_STATUS } from "@/lib/format";
import type { Traje, TrajeIn, TrajeStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const EMPTY: TrajeIn = {
  codigo: "", nome: "", categoria: "Noiva", tamanho: "", cor: "", valor_locacao: 0, status: "disponivel", foto_url: "", observacoes: "",
};

function Chip({ active, onClick, children, testid }: { active: boolean; onClick: () => void; children: React.ReactNode; testid: string }) {
  return (
    <button type="button" onClick={onClick} data-testid={testid}
      className={cn("rounded-full border px-3 py-1 text-xs transition-colors duration-150", active ? "border-wine bg-wine text-white" : "border-border bg-white hover:border-gold")}>
      {children}
    </button>
  );
}

export default function Estoque() {
  const qc = useQueryClient();
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Traje | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TrajeIn>(EMPTY);
  const set = <K extends keyof TrajeIn>(k: K, v: TrajeIn[K]) => setForm((p) => ({ ...p, [k]: v }));

  const trajes = useQuery({ queryKey: ["trajes"], queryFn: () => apiGet<Traje[]>("/trajes") });
  const all = trajes.isError ? [] : (trajes.data ?? []);
  const term = q.trim().toLowerCase();
  const lista = all.filter(
    (t) => (!cat || t.categoria === cat) && (!term || `${t.codigo} ${t.nome} ${t.cor}`.toLowerCase().includes(term)),
  );

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (t: Traje) => { setEditing(t); setForm({ ...t }); setOpen(true); };
  const done = (msg: string) => {
    qc.invalidateQueries({ queryKey: ["trajes"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    setOpen(false);
    toast.success(msg);
  };

  const save = useMutation({
    mutationFn: () => (editing ? apiPut<Traje>(`/trajes/${editing.id}`, form) : apiPost<Traje>("/trajes", form)),
    onSuccess: () => done(editing ? "Traje atualizado" : "Traje cadastrado"),
    onError: (e) => toast.error(errMsg(e, "Preencha código e nome")),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete<Traje>(`/trajes/${id}`),
    onSuccess: () => done("Traje removido"),
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div>
      <PageHeader eyebrow={`${all.length} peças no acervo`} title="Estoque de trajes">
        <Button onClick={openNew} data-testid="estoque-new-button"><Plus className="size-4" /> Novo traje</Button>
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar código, nome ou cor" className="pl-9 h-10 bg-white" data-testid="estoque-search-input" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={!cat} onClick={() => setCat("")} testid="estoque-cat-todas">Todas</Chip>
          {CATEGORIAS.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)} testid={`estoque-cat-${c.toLowerCase().replace("/", "-")}`}>{c}</Chip>
          ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4" data-testid="estoque-grid">
        {lista.map((t, i) => (
          <article
            key={t.id}
            style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            className="group overflow-hidden rounded-lg border border-border bg-white shadow-[0_4px_20px_rgba(43,11,20,0.05)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(43,11,20,0.1)] animate-rise"
            data-testid={`traje-card-${t.codigo}`}
          >
            <div className="relative aspect-[4/5] bg-parchment overflow-hidden">
              {t.foto_url ? (
                <img src={t.foto_url} alt={t.nome} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
              ) : (
                <div className="grid h-full place-items-center"><Shirt className="size-10 text-stone-300" /></div>
              )}
              <div className="absolute left-3 top-3"><TrajeStatusBadge status={t.status} testid={`traje-card-${t.codigo}-status`} /></div>
              <span className="absolute right-3 top-3 rounded bg-charcoal/80 px-2 py-0.5 font-mono text-xs text-[#E6CA65]">{t.codigo}</span>
            </div>
            <div className="p-4">
              <p className="label-caps">{t.categoria}</p>
              <h3 className="mt-1 text-lg font-semibold leading-snug">{t.nome}</h3>
              <p className="mt-1 text-sm text-muted-foreground">Tam. {t.tamanho || "—"} · {t.cor || "—"}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-mono font-semibold text-wine">{brl(t.valor_locacao)}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(t)} data-testid={`traje-card-${t.codigo}-edit`}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="icon-sm" className="text-destructive"
                    onClick={() => { if (window.confirm(`Remover ${t.nome}?`)) del.mutate(t.id); }}
                    data-testid={`traje-card-${t.codigo}-delete`}><Trash2 className="size-4" /></Button>
                </div>
              </div>
            </div>
          </article>
        ))}
        {lista.length === 0 && (
          <p className="col-span-full py-16 text-center text-muted-foreground" data-testid="estoque-empty">
            {trajes.isPending ? "Carregando estoque..." : "Nenhum traje encontrado."}
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg" data-testid="traje-dialog">
          <DialogHeader><DialogTitle className="font-serif text-xl">{editing ? "Editar traje" : "Novo traje"}</DialogTitle></DialogHeader>
          <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="space-y-1.5"><Label>Código *</Label><Input required value={form.codigo} onChange={(e) => set("codigo", e.target.value)} data-testid="traje-codigo-input" /></div>
            <div className="space-y-1.5"><Label>Valor locação (R$)</Label><Input type="number" min={0} step="0.01" value={String(form.valor_locacao)} onChange={(e) => set("valor_locacao", Number(e.target.value) || 0)} className="font-mono" data-testid="traje-valor-input" /></div>
            <div className="col-span-2 space-y-1.5"><Label>Nome *</Label><Input required value={form.nome} onChange={(e) => set("nome", e.target.value)} data-testid="traje-nome-input" /></div>
            <div className="space-y-1.5"><Label>Tamanho</Label><Input value={form.tamanho} onChange={(e) => set("tamanho", e.target.value)} data-testid="traje-tamanho-input" /></div>
            <div className="space-y-1.5"><Label>Cor</Label><Input value={form.cor} onChange={(e) => set("cor", e.target.value)} data-testid="traje-cor-input" /></div>
            <div className="col-span-2 space-y-1.5">
              <Label>Categoria</Label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIAS.map((c) => (
                  <Chip key={c} active={form.categoria === c} onClick={() => set("categoria", c)} testid={`traje-categoria-${c.toLowerCase().replace("/", "-")}`}>{c}</Chip>
                ))}
              </div>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Status</Label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(TRAJE_STATUS) as TrajeStatus[]).map((s) => (
                  <Chip key={s} active={form.status === s} onClick={() => set("status", s)} testid={`traje-status-${s}`}>{TRAJE_STATUS[s].label}</Chip>
                ))}
              </div>
            </div>
            <div className="col-span-2 space-y-1.5"><Label>URL da foto</Label><Input value={form.foto_url} onChange={(e) => set("foto_url", e.target.value)} placeholder="https://..." data-testid="traje-foto-input" /></div>
            <div className="col-span-2 space-y-1.5"><Label>Observações</Label><Textarea rows={2} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} data-testid="traje-observacoes-input" /></div>
            <DialogFooter className="col-span-2">
              <Button type="submit" disabled={save.isPending} data-testid="traje-submit-button">{editing ? "Salvar" : "Cadastrar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
