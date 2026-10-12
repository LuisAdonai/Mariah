import { useQuery } from "@tanstack/react-query";
import { FilePlus2, Printer, Search } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/AppLayout";
import { FichaStatusBadge } from "@/components/StatusBadge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { brl, dataBR, FICHA_STATUS } from "@/lib/format";
import type { Ficha, FichaStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS: { value: "" | FichaStatus; label: string }[] = [
  { value: "", label: "Todas" },
  ...(Object.keys(FICHA_STATUS) as FichaStatus[]).map((s) => ({ value: s, label: FICHA_STATUS[s].label })),
];

export default function Fichas() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | FichaStatus>("");
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (status) params.set("status", status);
  const fichas = useQuery({
    queryKey: ["fichas", q.trim(), status],
    queryFn: () => apiGet<Ficha[]>(`/fichas?${params.toString()}`),
  });
  const rows = fichas.isError ? [] : (fichas.data ?? []);

  return (
    <div>
      <PageHeader eyebrow="Bloco de locação" title="Fichas">
        <Link to="/fichas/nova" className={buttonVariants()} data-testid="fichas-new-button">
          <FilePlus2 className="size-4" /> Nova ficha
        </Link>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, CPF, telefone ou Nº"
            className="pl-9 h-10 bg-white"
            data-testid="fichas-search-input"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value || "todas"}
              onClick={() => setStatus(f.value)}
              data-testid={`fichas-filter-${f.value || "todas"}`}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors duration-150",
                status === f.value ? "border-wine bg-wine text-white" : "border-border bg-white hover:border-gold",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-white shadow-[0_4px_20px_rgba(43,11,20,0.05)] animate-rise">
        <Table data-testid="fichas-table">
          <TableHeader>
            <TableRow className="bg-parchment hover:bg-parchment">
              <TableHead>Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Trajes</TableHead>
              <TableHead>Saída</TableHead>
              <TableHead>Retorno</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((f) => (
              <TableRow
                key={f.id}
                className="cursor-pointer transition-colors hover:bg-ivory"
                onClick={() => navigate(`/fichas/${f.id}`)}
                data-testid={`ficha-row-${f.numero}`}
              >
                <TableCell className="font-mono font-semibold text-wine">{f.numero}</TableCell>
                <TableCell>
                  <p className="font-medium">{f.nome}</p>
                  <p className="text-xs text-muted-foreground">{f.telefone}</p>
                </TableCell>
                <TableCell className="max-w-56 truncate text-sm">
                  {[...f.trajes.map((t) => t.nome), f.trajes_descricao].filter(Boolean).join(", ") || "—"}
                </TableCell>
                <TableCell>{dataBR(f.data_saida)}</TableCell>
                <TableCell>{dataBR(f.data_retorno)}</TableCell>
                <TableCell className="text-right font-mono">{brl(f.total)}</TableCell>
                <TableCell className={cn("text-right font-mono font-semibold", f.saldo > 0 ? "text-wine" : "text-[#166534]")}>
                  {brl(f.saldo)}
                </TableCell>
                <TableCell>
                  <FichaStatusBadge status={f.status} />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Link
                    to={`/impressao/${f.id}`}
                    className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
                    title="Imprimir 3 vias"
                    data-testid={`ficha-row-${f.numero}-print`}
                  >
                    <Printer className="size-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-14 text-center text-muted-foreground" data-testid="fichas-empty">
                  {fichas.isPending ? "Carregando fichas..." : "Nenhuma ficha encontrada."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
