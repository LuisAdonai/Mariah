import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import { apiGet } from "@/lib/api";
import { brl, dataBR, dataExtenso } from "@/lib/format";
import { LOJA, TERMOS } from "@/lib/store";
import type { Ficha } from "@/lib/types";
import { cn } from "@/lib/utils";

function Linha({ label, value, className }: { label: string; value?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-end gap-1.5 text-[11px] leading-tight", className)}>
      <span className="shrink-0 font-semibold">{label}:</span>
      <span className="dotted-line flex-1 truncate font-mono text-[11px]">{value || "\u00a0"}</span>
    </div>
  );
}

function Cabecalho({ numero, via, color }: { numero: number; via: string; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between rounded-md border-2 border-charcoal px-2 py-1">
        <span className="font-serif italic text-lg font-bold leading-none">{LOJA.nome}</span>
        <span className="text-[10px] tracking-wide">{LOJA.sub}</span>
      </div>
      <div className="mt-1.5 flex items-start justify-between gap-2">
        <div className="text-[9.5px] leading-snug font-semibold">
          <p>Aluguel e Venda</p>
          <p>de Roupas e Acessórios</p>
        </div>
        <p className="font-mono text-base font-bold" style={{ color }}>
          Nº {numero}
        </p>
      </div>
      <p className="text-[9.5px] font-semibold leading-snug">
        {LOJA.endereco} - Tel.: {LOJA.tel}
      </p>
      <p className="text-[9.5px] font-semibold text-center">vivo · WhatsApp {LOJA.whats}</p>
      <p className="mt-1 rounded-sm px-1 py-0.5 text-center text-[9px] font-bold uppercase tracking-[0.2em] text-white" style={{ background: color }}>
        {via}
      </p>
    </div>
  );
}

function Rodape({ f }: { f: Ficha }) {
  const d = dataExtenso(f.created_at);
  return (
    <div className="mt-auto space-y-2 pt-2">
      <div className="space-y-1 text-[9.5px] leading-snug">
        {TERMOS.map((t) => (
          <p key={t}>{t}</p>
        ))}
      </div>
      <Linha label="Ass." />
      <p className="text-[11px]">
        {LOJA.cidade}, <span className="font-mono">{d.dia}</span> de <span className="font-mono">{d.mes}</span> de{" "}
        <span className="font-mono">{d.ano}</span>
      </p>
    </div>
  );
}

export default function Impressao() {
  const { id = "" } = useParams();
  const q = useQuery({ queryKey: ["ficha", id], queryFn: () => apiGet<Ficha>(`/fichas/${id}`) });
  const f = q.isError ? undefined : q.data;
  const trajes = f ? [...f.trajes.map((t) => `${t.codigo} ${t.nome}`), f.trajes_descricao].filter(Boolean).join(", ") : "";

  return (
    <div className="min-h-screen bg-[#E9E4DC] print:bg-white">
      <div className="no-print sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-ivory/90 px-6 py-3 backdrop-blur">
        <Link to={f ? `/fichas/${f.id}` : "/fichas"} className={buttonVariants({ variant: "outline", size: "sm" })} data-testid="print-back-button">
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <p className="mr-auto text-sm text-muted-foreground">Formato A4 paisagem · 3 vias (Cliente, Loja, Costura). Use “Salvar como PDF” para gerar o arquivo.</p>
        <Button size="sm" onClick={() => window.print()} disabled={!f} data-testid="print-now-button">
          <Printer className="size-4" /> Imprimir / PDF
        </Button>
      </div>

      {!f ? (
        <p className="p-10 text-center text-muted-foreground" data-testid="print-loading">
          {q.isPending ? "Carregando ficha..." : "Ficha não encontrada."}
        </p>
      ) : (
        <div className="print-sheet mx-auto my-8 grid w-[287mm] grid-cols-3 bg-white text-charcoal shadow-xl" data-testid="print-sheet">
          {/* VIA 1 — CLIENTE */}
          <div className="flex h-[196mm] flex-col gap-1.5 border-r-2 border-dotted border-stone-400 p-4" data-testid="print-via-cliente">
            <Cabecalho numero={f.numero} via="Via 1 · Cliente" color="#721727" />
            <Linha label="Nome" value={f.nome} />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Linha label="End." value={f.endereco} />
              <Linha label="Nº" value={f.numero_end} className="w-20" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Linha label="Bairro" value={f.bairro} />
              <Linha label="Tel." value={f.telefone} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Linha label="CPF" value={f.cpf} />
              <Linha label="Tel." value={f.telefone2} />
            </div>
            <Linha label="Trajes" value={trajes} />
            <div className="grid grid-cols-2 gap-2">
              <Linha label="Saída" value={dataBR(f.data_saida)} />
              <Linha label="Retorno" value={dataBR(f.data_retorno)} />
            </div>
            <Linha label="Total" value={brl(f.total)} />
            <Linha label="Sinal" value={`${brl(f.sinal)}${f.forma_pagamento ? ` (${f.forma_pagamento})` : ""}`} />
            <Linha label="Saldo" value={brl(f.saldo)} />
            <Rodape f={f} />
          </div>

          {/* VIA 2 — LOJA */}
          <div className="flex h-[196mm] flex-col gap-1.5 border-r-2 border-dotted border-stone-400 p-4" data-testid="print-via-loja">
            <Cabecalho numero={f.numero} via="Via 2 · Loja" color="#854D0E" />
            <Linha label="Nome" value={f.nome} />
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Linha label="End." value={f.endereco} />
              <Linha label="Nº" value={f.numero_end} className="w-20" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Linha label="Bairro" value={f.bairro} />
              <Linha label="CPF" value={f.cpf} />
            </div>
            <Linha label="Tel." value={[f.telefone, f.telefone2].filter(Boolean).join(" / ")} />
            <Linha label="Trajes" value={trajes} />
            <div className="grid grid-cols-2 gap-2">
              <Linha label="Saída" value={dataBR(f.data_saida)} />
              <Linha label="Retorno" value={dataBR(f.data_retorno)} />
            </div>
            <Linha label="Prova" value={f.data_prova ? dataBR(f.data_prova) : ""} />
            <Linha label="Total" value={brl(f.total)} />
            <Linha label="Sinal" value={brl(f.sinal)} />
            {f.pagamentos.map((p) => (
              <Linha key={p.id} label={`Pago ${dataBR(p.data)}`} value={`${brl(p.valor)} ${p.forma}`} />
            ))}
            <Linha label="Saldo" value={brl(f.saldo)} />
            <Linha label="Obs." value={f.observacoes} />
            <Rodape f={f} />
          </div>

          {/* VIA 3 — COSTURA */}
          <div className="flex h-[196mm] flex-col gap-1.5 p-4" data-testid="print-via-costura">
            <Cabecalho numero={f.numero} via="Via 3 · Costura" color="#1E3A5F" />
            <Linha label="Nome" value={f.nome} />
            <Linha label="Saída" value={dataBR(f.data_saida)} />
            <Linha label="Retorno" value={dataBR(f.data_retorno)} />
            <Linha label="Prova" value={f.data_prova ? dataBR(f.data_prova) : ""} />
            <Linha label="Traje" value={f.medidas.traje || trajes} />
            <Linha label="Calça" value={f.medidas.calca} />
            <Linha label="Camisa" value={f.medidas.camisa} />
            <Linha label="Comp. manga" value={f.medidas.comp_manga} />
            <Linha label="Comp. calça" value={f.medidas.comp_calca} />
            <div className="grid grid-cols-2 gap-2">
              <Linha label="Busto" value={f.medidas.busto} />
              <Linha label="Cintura" value={f.medidas.cintura} />
            </div>
            <div className="text-[11px] font-semibold">Observações:</div>
            <div className="flex-1 whitespace-pre-wrap rounded border border-dotted border-stone-400 p-2 font-mono text-[11px] leading-relaxed">
              {f.medidas.observacoes}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
