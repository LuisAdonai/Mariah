import { useQuery } from "@tanstack/react-query";
import {
  addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, parseISO, startOfMonth, startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/AppLayout";
import { FichaStatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import WhatsAppMenu from "@/components/WhatsAppMenu";
import { apiGet } from "@/lib/api";
import { dataBR, EVENTO } from "@/lib/format";
import type { AgendaEvento, Dashboard, EventoTipo } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIPOS: EventoTipo[] = ["prova", "saida", "retorno"];
const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function Agenda() {
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => apiGet<Dashboard>("/dashboard") });
  const hoje = dash.data?.hoje ?? format(new Date(), "yyyy-MM-dd");
  const [offset, setOffset] = useState(0);
  const [tipos, setTipos] = useState<Set<EventoTipo>>(new Set(TIPOS));
  const [selected, setSelected] = useState<string | null>(null);
  const dia = selected ?? hoje;

  const month = addMonths(startOfMonth(parseISO(hoje)), offset);
  const gridStart = startOfWeek(month);
  const gridEnd = endOfWeek(endOfMonth(month));
  const inicio = format(gridStart, "yyyy-MM-dd");
  const fim = format(gridEnd, "yyyy-MM-dd");

  const ag = useQuery({
    queryKey: ["agenda", inicio, fim],
    queryFn: () => apiGet<AgendaEvento[]>(`/agenda?inicio=${inicio}&fim=${fim}`),
  });
  const eventos = (ag.isError ? [] : (ag.data ?? [])).filter((e) => tipos.has(e.tipo));
  const byDay = new Map<string, AgendaEvento[]>();
  for (const e of eventos) byDay.set(e.data, [...(byDay.get(e.data) ?? []), e]);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const doDia = byDay.get(dia) ?? [];

  const toggle = (t: EventoTipo) =>
    setTipos((p) => {
      const n = new Set(p);
      if (n.has(t)) n.delete(t); else n.add(t);
      return n;
    });

  return (
    <div>
      <PageHeader eyebrow="Provas · Saídas · Retornos" title="Agenda">
        {TIPOS.map((t) => (
          <button
            key={t}
            onClick={() => toggle(t)}
            data-testid={`agenda-filter-${t}`}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-[opacity,border-color] duration-150",
              tipos.has(t) ? "border-charcoal/20 bg-white" : "border-border bg-transparent opacity-50",
            )}
          >
            <span className={cn("size-2 rounded-full", EVENTO[t].dot)} />
            {EVENTO[t].label}
          </button>
        ))}
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <section className="rounded-lg border border-border bg-white p-5 shadow-[0_4px_20px_rgba(43,11,20,0.05)] animate-rise">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold first-letter:uppercase" data-testid="agenda-month-label">
              {format(month, "MMMM yyyy", { locale: ptBR })}
            </h2>
            <div className="flex gap-1">
              <Button variant="outline" size="icon-sm" onClick={() => setOffset((o) => o - 1)} data-testid="agenda-prev-month"><ChevronLeft className="size-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => { setOffset(0); setSelected(null); }} data-testid="agenda-today-button">Hoje</Button>
              <Button variant="outline" size="icon-sm" onClick={() => setOffset((o) => o + 1)} data-testid="agenda-next-month"><ChevronRight className="size-4" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-l border-t border-border text-sm" data-testid="agenda-grid">
            {SEMANA.map((s) => (
              <div key={s} className="border-r border-b border-border bg-parchment px-2 py-1.5 label-caps">{s}</div>
            ))}
            {days.map((d) => {
              const iso = format(d, "yyyy-MM-dd");
              const evs = byDay.get(iso) ?? [];
              return (
                <button
                  key={iso}
                  onClick={() => setSelected(iso)}
                  data-testid={`agenda-day-${iso}`}
                  className={cn(
                    "min-h-24 border-r border-b border-border p-1.5 text-left align-top transition-colors duration-150 hover:bg-ivory",
                    !isSameMonth(d, month) && "bg-stone-50 text-stone-400",
                    iso === dia && "bg-gold-light/60 hover:bg-gold-light/60",
                  )}
                >
                  <span className={cn("inline-grid size-6 place-items-center rounded-full text-xs font-medium", iso === hoje && "bg-wine text-white")}>
                    {format(d, "d")}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {evs.slice(0, 3).map((e) => (
                      <div key={`${e.ficha_id}-${e.tipo}`} className={cn("truncate rounded px-1 py-0.5 text-[0.68rem] leading-tight", EVENTO[e.tipo].chip)}>
                        {e.nome.split(" ")[0]} · {EVENTO[e.tipo].label}
                      </div>
                    ))}
                    {evs.length > 3 && <div className="text-[0.68rem] text-muted-foreground">+{evs.length - 3}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="rounded-lg bg-charcoal p-5 text-[#F5F5F4] h-fit animate-rise" data-testid="agenda-day-panel">
          <p className="label-caps text-[#E6CA65]!">Dia selecionado</p>
          <h3 className="mt-1 text-2xl font-semibold first-letter:uppercase" data-testid="agenda-day-title">
            {format(parseISO(dia), "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h3>
          <div className="my-4 h-px bg-gradient-to-r from-[#D4AF37] to-transparent" />
          {doDia.length === 0 && <p className="text-sm text-stone-400" data-testid="agenda-day-empty">Nenhum compromisso.</p>}
          <div className="space-y-3">
            {doDia.map((e, i) => (
              <div key={`${e.ficha_id}-${e.tipo}`} className="rounded-md bg-[#2A2420] p-3" data-testid={`agenda-event-${i}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-[0.7rem] font-medium", EVENTO[e.tipo].chip)}>{EVENTO[e.tipo].label}</span>
                  <FichaStatusBadge status={e.status} />
                </div>
                <Link to={`/fichas/${e.ficha_id}`} className="mt-2 block font-medium hover:text-[#E6CA65] transition-colors" data-testid={`agenda-event-${i}-link`}>
                  <span className="font-mono text-xs text-stone-400 mr-1.5">Nº {e.numero}</span>{e.nome}
                </Link>
                <p className="text-xs text-stone-400 truncate">{e.trajes || "—"}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-stone-400">{dataBR(e.data)}</span>
                  <WhatsAppMenu size="sm" telefone={e.telefone} testid={`agenda-event-${i}-whatsapp`}
                    data={{ ...e, data_saida: e.data, data_retorno: e.data, data_prova: e.data }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-stone-500">Próximo dia: {dataBR(format(addDays(parseISO(dia), 1), "yyyy-MM-dd"))}</p>
        </aside>
      </div>
    </div>
  );
}
