import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Pencil, Plus, Printer, Trash2, Undo2, XCircle } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppLayout";
import { FichaStatusBadge } from "@/components/StatusBadge";
import WhatsAppMenu from "@/components/WhatsAppMenu";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { brl, dataBR, errMsg, FORMAS } from "@/lib/format";
import type { Ficha, FichaStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

function Info({ label, value, testid, mono }: { label: string; value: React.ReactNode; testid?: string; mono?: boolean }) {
  return (
    <div>
      <p className="label-caps">{label}</p>
      <p className={cn("mt-1 text-charcoal", mono && "font-mono")} data-testid={testid}>{value || "—"}</p>
    </div>
  );
}

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-border bg-white p-6 shadow-[0_4px_20px_rgba(43,11,20,0.05)] animate-rise", className)}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="gold-rule my-4" />
      {children}
    </section>
  );
}

export default function FichaDetalhe() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState("Pix");

  const q = useQuery({ queryKey: ["ficha", id], queryFn: () => apiGet<Ficha>(`/fichas/${id}`) });
  const refresh = (f: Ficha) => {
    qc.setQueryData(["ficha", id], f);
    qc.invalidateQueries({ queryKey: ["fichas"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["agenda"] });
    qc.invalidateQueries({ queryKey: ["trajes"] });
  };

  const status = useMutation({
    mutationFn: (s: FichaStatus) => apiPatch<Ficha>(`/fichas/${id}/status`, { status: s }),
    onSuccess: (f) => { refresh(f); toast.success("Status atualizado"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const pay = useMutation({
    mutationFn: () => apiPost<Ficha>(`/fichas/${id}/pagamentos`, { valor: Number(valor), forma }),
    onSuccess: (f) => { refresh(f); setPayOpen(false); setValor(""); toast.success("Pagamento registrado"); },
    onError: (e) => toast.error(errMsg(e, "Valor inválido")),
  });
  const del = useMutation({
    mutationFn: () => apiDelete<Ficha>(`/fichas/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fichas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Ficha excluída");
      navigate("/fichas");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const back = (
    <Link to="/fichas" className={buttonVariants({ variant: "outline" })} data-testid="ficha-back-button">
      <ArrowLeft className="size-4" /> Fichas
    </Link>
  );

  if (!q.data || q.isError) {
    return (
      <div>
        <PageHeader eyebrow="Ficha" title={q.isPending ? "Carregando..." : "Ficha não encontrada"}>{back}</PageHeader>
      </div>
    );
  }
  const f = q.data;
  const trajesTxt = [...f.trajes.map((t) => t.nome), f.trajes_descricao].filter(Boolean).join(", ");
  const pagos = f.pagamentos.reduce((s, p) => s + p.valor, 0);
  const m = f.medidas;

  return (
    <div>
      <PageHeader eyebrow={`Ficha Nº ${f.numero}`} title={f.nome}>
        {back}
        <Link to={`/fichas/${f.id}/editar`} className={buttonVariants({ variant: "outline" })} data-testid="ficha-edit-button">
          <Pencil className="size-4" /> Editar
        </Link>
        <WhatsAppMenu telefone={f.telefone} testid="ficha-whatsapp-button" data={{ ...f, trajes: trajesTxt }} />
        <Link to={`/impressao/${f.id}`} className={buttonVariants()} data-testid="ficha-print-button">
          <Printer className="size-4" /> Imprimir 3 vias
        </Link>
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-parchment px-5 py-4 animate-rise">
        <FichaStatusBadge status={f.status} testid="ficha-status-badge" />
        <span className="text-sm text-muted-foreground mr-auto">
          {f.status === "reservado" && "Aguardando retirada do cliente."}
          {f.status === "retirado" && "Traje com o cliente — aguardando devolução."}
          {f.status === "devolvido" && "Locação concluída."}
          {f.status === "cancelado" && "Locação cancelada."}
        </span>
        {f.status === "reservado" && (
          <Button size="sm" onClick={() => status.mutate("retirado")} disabled={status.isPending} data-testid="ficha-mark-retirado-button">
            <CheckCircle2 className="size-4" /> Registrar saída
          </Button>
        )}
        {f.status === "retirado" && (
          <Button size="sm" onClick={() => status.mutate("devolvido")} disabled={status.isPending} data-testid="ficha-mark-devolvido-button">
            <Undo2 className="size-4" /> Registrar devolução
          </Button>
        )}
        {f.status === "reservado" && (
          <Button size="sm" variant="outline" onClick={() => status.mutate("cancelado")} disabled={status.isPending} data-testid="ficha-mark-cancelado-button">
            <XCircle className="size-4" /> Cancelar
          </Button>
        )}
        {(f.status === "cancelado" || f.status === "devolvido") && (
          <Button size="sm" variant="outline" onClick={() => status.mutate("reservado")} disabled={status.isPending} data-testid="ficha-reopen-button">
            Reabrir
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card title="Cliente">
            <div className="grid gap-5 sm:grid-cols-3">
              <Info label="Nome" value={f.nome} testid="ficha-detail-nome" />
              <Info label="Telefone" value={[f.telefone, f.telefone2].filter(Boolean).join(" · ")} testid="ficha-detail-telefone" />
              <Info label="CPF" value={f.cpf} testid="ficha-detail-cpf" mono />
              <Info label="Endereço" value={[f.endereco, f.numero_end && `nº ${f.numero_end}`].filter(Boolean).join(", ")} testid="ficha-detail-endereco" />
              <Info label="Bairro" value={f.bairro} testid="ficha-detail-bairro" />
            </div>
          </Card>
          <Card title="Datas e trajes">
            <div className="grid gap-5 sm:grid-cols-3">
              <Info label="Prova" value={dataBR(f.data_prova)} testid="ficha-detail-prova" mono />
              <Info label="Saída" value={dataBR(f.data_saida)} testid="ficha-detail-saida" mono />
              <Info label="Retorno" value={dataBR(f.data_retorno)} testid="ficha-detail-retorno" mono />
            </div>
            <div className="mt-5 flex flex-wrap gap-2" data-testid="ficha-detail-trajes">
              {f.trajes.map((t) => (
                <span key={t.id} className="rounded-full border border-[#E6CA65] bg-gold-light px-3 py-1 text-sm">
                  <span className="font-mono text-xs text-[#854D0E] mr-1.5">{t.codigo}</span>{t.nome}
                </span>
              ))}
              {f.trajes_descricao && <span className="rounded-full border border-border px-3 py-1 text-sm">{f.trajes_descricao}</span>}
              {!trajesTxt && <span className="text-sm text-muted-foreground">Nenhum traje informado</span>}
            </div>
          </Card>
          <Card title="Medidas · Via costura">
            <div className="grid gap-5 grid-cols-2 sm:grid-cols-4">
              <Info label="Traje" value={m.traje} />
              <Info label="Calça" value={m.calca} mono />
              <Info label="Camisa" value={m.camisa} mono />
              <Info label="Comp. manga" value={m.comp_manga} mono />
              <Info label="Comp. calça" value={m.comp_calca} mono />
              <Info label="Busto" value={m.busto} mono />
              <Info label="Cintura" value={m.cintura} mono />
            </div>
            {m.observacoes && <p className="mt-5 rounded-md bg-parchment p-3 text-sm" data-testid="ficha-detail-medidas-obs">{m.observacoes}</p>}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Financeiro" className="border-[#E6CA65]">
            <div className="space-y-3 font-mono text-sm">
              <div className="flex justify-between"><span className="font-sans text-muted-foreground">Total</span><span data-testid="ficha-detail-total">{brl(f.total)}</span></div>
              <div className="flex justify-between"><span className="font-sans text-muted-foreground">Sinal {f.forma_pagamento && `(${f.forma_pagamento})`}</span><span data-testid="ficha-detail-sinal">− {brl(f.sinal)}</span></div>
              {pagos > 0 && <div className="flex justify-between"><span className="font-sans text-muted-foreground">Pagamentos posteriores</span><span>− {brl(pagos)}</span></div>}
            </div>
            <div className="mt-4 rounded-md bg-gold-light p-4">
              <p className="label-caps">Saldo</p>
              <p className={cn("mt-1 font-mono text-3xl font-semibold", f.saldo > 0 ? "text-wine" : "text-[#166534]")} data-testid="ficha-detail-saldo">
                {brl(f.saldo)}
              </p>
            </div>
            {f.pagamentos.length > 0 && (
              <ul className="mt-4 space-y-2 text-sm" data-testid="ficha-pagamentos-list">
                {f.pagamentos.map((p) => (
                  <li key={p.id} className="flex justify-between border-b border-dashed border-border pb-2">
                    <span>{dataBR(p.data)} · {p.forma || "—"}</span>
                    <span className="font-mono">{brl(p.valor)}</span>
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="outline" className="mt-4 w-full"
              onClick={() => { setValor(f.saldo > 0 ? String(f.saldo) : ""); setPayOpen(true); }}
              data-testid="ficha-add-pagamento-button"
            >
              <Plus className="size-4" /> Registrar pagamento
            </Button>
          </Card>
          {f.observacoes && (
            <Card title="Observações"><p className="text-sm" data-testid="ficha-detail-observacoes">{f.observacoes}</p></Card>
          )}
          <Button variant="ghost" className="text-destructive" onClick={() => setDelOpen(true)} data-testid="ficha-delete-button">
            <Trash2 className="size-4" /> Excluir ficha
          </Button>
        </div>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent data-testid="pagamento-dialog">
          <DialogHeader><DialogTitle className="font-serif text-xl">Registrar pagamento</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); pay.mutate(); }}>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input type="number" min={0.01} step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className="font-mono" data-testid="pagamento-valor-input" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FORMAS.map((fp) => (
                <button type="button" key={fp} onClick={() => setForma(fp)}
                  className={cn("rounded-full border px-3 py-1 text-xs transition-colors", forma === fp ? "border-wine bg-wine text-white" : "border-border hover:border-gold")}
                  data-testid={`pagamento-forma-${fp.split(" ")[0].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}${fp.includes("débito") ? "-debito" : fp.includes("crédito") ? "-credito" : ""}`}
                >{fp}</button>
              ))}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={!Number(valor) || pay.isPending} data-testid="pagamento-submit-button">Confirmar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent data-testid="delete-dialog">
          <DialogHeader><DialogTitle className="font-serif text-xl">Excluir ficha Nº {f.numero}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita. Para manter histórico, prefira cancelar.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelOpen(false)} data-testid="delete-cancel-button">Voltar</Button>
            <Button variant="destructive" onClick={() => del.mutate()} disabled={del.isPending} data-testid="delete-confirm-button">Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
