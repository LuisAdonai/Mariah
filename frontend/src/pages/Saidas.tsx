import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, ChevronLeft, ChevronRight, Printer, Undo2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppLayout";
import { FichaStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet, apiPatch } from "@/lib/api";
import { brl, dataBR, errMsg } from "@/lib/format";
import type { Dashboard, Ficha, FichaStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Friday of the weekend that contains / follows `iso` (Mon–Thu → next Fri; Fri–Sun → this Fri). */
function sextaDoFimDeSemana(iso: string): Date {
  const d = parseISO(iso);
  const dow = d.getDay(); // 0 dom … 6 sáb
  const delta = dow === 0 ? -2 : dow === 6 ? -1 : 5 - dow;
  return addDays(d, delta);
}

export default function Saidas() {
  const qc = useQueryClient();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => apiGet<Dashboard>("/dashboard") });
  const hoje = dash.data?.hoje ?? format(new Date(), "yyyy-MM-dd");
  const [offset, setOffset] = useState(0);

  const sexta = addDays(sextaDoFimDeSemana(hoje), offset * 7);
  const domingo = addDays(sexta, 2);
  const inicio = format(sexta, "yyyy-MM-dd");
  const fim = format(domingo, "yyyy-MM-dd");

  const q = useQuery({
    queryKey: ["fichas", "saidas", inicio, fim],
    queryFn: () => apiGet<Ficha[]>(`/fichas?saida_de=${inicio}&saida_ate=${fim}`),
  });
  const rows = (q.isError ? [] : (q.data ?? [])).slice().sort((a, b) => a.data_saida.localeCompare(b.data_saida) || a.numero - b.numero);

  const status = useMutation({
    mutationFn: ({ id, s }: { id: string; s: FichaStatus }) => apiPatch<Ficha>(`/fichas/${id}/status`, { status: s }),
    onSuccess: (f) => {
      qc.invalidateQueries({ queryKey: ["fichas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.invalidateQueries({ queryKey: ["trajes"] });
      qc.setQueryData(["ficha", f.id], f);
      toast.success(`Ficha Nº ${f.numero}: ${f.status === "devolvido" ? "devolvida" : f.status === "retirado" ? "retirada" : "reaberta"}`);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const aReceber = rows.reduce((s, f) => s + Math.max(f.saldo, 0), 0);
  const devolvidas = rows.filter((f) => f.status === "devolvido").length;
  const titulo = `${format(sexta, "d 'de' MMM", { locale: ptBR })} a ${format(domingo, "d 'de' MMM yyyy", { locale: ptBR })}`;

  return (
    <div>
      <PageHeader eyebrow="Planilha do final de semana · sexta a domingo" title="Saídas">
        <Button variant="outline" size="icon-sm" onClick={() => setOffset((o) => o - 1)} data-testid="saidas-prev-weekend"><ChevronLeft className="size-4" /></Button>
        <Button variant="outline" size="sm" onClick={() => setOffset(0)} data-testid="saidas-this-weekend">Este fim de semana</Button>
        <Button variant="outline" size="icon-sm" onClick={() => setOffset((o) => o + 1)} data-testid="saidas-next-weekend"><ChevronRight className="size-4" /></Button>
        <Button onClick={() => window.print()} data-testid="saidas-print-button"><Printer className="size-4" /> Imprimir planilha</Button>
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 animate-rise">
        <h2 className="text-2xl font-semibold" data-testid="saidas-periodo">{titulo}</h2>
        <div className="flex gap-6 text-sm">
          <p><span className="label-caps block">Saídas</span><span className="font-mono text-xl font-semibold" data-testid="saidas-total">{rows.length}</span></p>
          <p><span className="label-caps block">Devolvidas</span><span className="font-mono text-xl font-semibold text-[#166534]" data-testid="saidas-devolvidas">{devolvidas}</span></p>
          <p><span className="label-caps block">A receber</span><span className="font-mono text-xl font-semibold text-wine" data-testid="saidas-a-receber">{brl(aReceber)}</span></p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white shadow-[0_4px_20px_rgba(43,11,20,0.05)] animate-rise print:shadow-none">
        <Table data-testid="saidas-table">
          <TableHeader>
            <TableRow className="bg-parchment hover:bg-parchment">
              <TableHead>Retirada</TableHead>
              <TableHead>Nº contrato</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Traje</TableHead>
              <TableHead>Retorno</TableHead>
              <TableHead className="text-right">Restante</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="no-print">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((f) => {
              const traje = [...f.trajes.map((t) => `${t.codigo} ${t.nome}`), f.trajes_descricao].filter(Boolean).join(", ") || "—";
              const busy = status.isPending && status.variables?.id === f.id;
              return (
                <TableRow key={f.id} className={cn("transition-colors", f.status === "devolvido" && "bg-[#F3FAF5] text-muted-foreground")} data-testid={`saida-row-${f.numero}`}>
                  <TableCell className="whitespace-nowrap">
                    <span className="font-mono">{dataBR(f.data_saida)}</span>
                    <span className="block text-xs capitalize text-muted-foreground">{format(parseISO(f.data_saida), "EEEE", { locale: ptBR })}</span>
                  </TableCell>
                  <TableCell>
                    <Link to={`/fichas/${f.id}`} className="font-mono font-semibold text-wine hover:underline" data-testid={`saida-row-${f.numero}-link`}>{f.numero}</Link>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-charcoal">{f.nome}</p>
                    <p className="text-xs text-muted-foreground">{f.telefone}</p>
                  </TableCell>
                  <TableCell className="max-w-64 whitespace-normal break-words text-sm">{traje}</TableCell>
                  <TableCell className="font-mono whitespace-nowrap">{dataBR(f.data_retorno)}</TableCell>
                  <TableCell className="text-right" data-testid={`saida-row-${f.numero}-saldo`}>
                    {f.saldo > 0 ? (
                      <span className="font-mono font-semibold text-wine">{brl(f.saldo)}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#B7DCC3] bg-[#E8F3EC] px-2.5 py-0.5 text-xs font-medium text-[#166534]">
                        <CheckCircle2 className="size-3" /> Pago
                      </span>
                    )}
                  </TableCell>
                  <TableCell><FichaStatusBadge status={f.status} testid={`saida-row-${f.numero}-status`} /></TableCell>
                  <TableCell className="no-print">
                    <div className="flex flex-wrap gap-1.5">
                      {f.status === "reservado" && (
                        <Button size="xs" variant="outline" disabled={busy} onClick={() => status.mutate({ id: f.id, s: "retirado" })} data-testid={`saida-row-${f.numero}-retirado`}>
                          Retirou
                        </Button>
                      )}
                      {(f.status === "reservado" || f.status === "retirado") && (
                        <Button size="xs" disabled={busy} onClick={() => status.mutate({ id: f.id, s: "devolvido" })} data-testid={`saida-row-${f.numero}-devolvido`}>
                          <CheckCircle2 className="size-3" /> Devolvido
                        </Button>
                      )}
                      {f.status === "devolvido" && (
                        <Button size="xs" variant="ghost" disabled={busy} onClick={() => status.mutate({ id: f.id, s: "retirado" })} data-testid={`saida-row-${f.numero}-desfazer`}>
                          <Undo2 className="size-3" /> Desfazer
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-14 text-center text-muted-foreground" data-testid="saidas-empty">
                  {q.isPending ? "Carregando..." : "Nenhuma saída neste final de semana."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5} className="font-medium">Total a receber no fim de semana</TableCell>
                <TableCell className="text-right font-mono font-semibold text-wine">{brl(aReceber)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  );
}
