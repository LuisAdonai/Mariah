import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, FilePlus2, Ruler, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/AppLayout";
import { buttonVariants } from "@/components/ui/button";
import WhatsAppMenu from "@/components/WhatsAppMenu";
import { apiGet } from "@/lib/api";
import { brl, dataBR, EVENTO } from "@/lib/format";
import type { AgendaEvento, Dashboard as DashboardT } from "@/lib/types";
import { cn } from "@/lib/utils";

function EventRow({ e, testid }: { e: AgendaEvento; testid: string }) {
  const ev = EVENTO[e.tipo];
  return (
    <div className="group flex items-center gap-3 py-3 border-b border-border last:border-0" data-testid={testid}>
      <span className={cn("size-2 rounded-full shrink-0", ev.dot)} />
      <Link to={`/fichas/${e.ficha_id}`} className="min-w-0 flex-1" data-testid={`${testid}-link`}>
        <p className="truncate font-medium text-charcoal group-hover:text-wine transition-colors">
          <span className="font-mono text-xs text-muted-foreground mr-2">Nº {e.numero}</span>
          {e.nome}
        </p>
        <p className="truncate text-xs text-muted-foreground">{e.trajes || "—"}</p>
      </Link>
      <div className="text-right shrink-0">
        <span className={cn("rounded-full px-2 py-0.5 text-[0.7rem] font-medium", ev.chip)}>{ev.label}</span>
        <p className="mt-1 text-xs text-muted-foreground">{dataBR(e.data)}</p>
      </div>
      <WhatsAppMenu
        size="icon-sm"
        telefone={e.telefone}
        testid={`${testid}-whatsapp`}
        data={{ ...e, data_saida: e.data, data_retorno: e.data, data_prova: e.data }}
      />
    </div>
  );
}

function Panel({ title, items, empty, testid, accent }: { title: string; items: AgendaEvento[]; empty: string; testid: string; accent: string }) {
  return (
    <section className="rounded-lg border border-border bg-white p-5 shadow-[0_4px_20px_rgba(43,11,20,0.05)] animate-rise" data-testid={testid}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className={cn("font-mono text-sm font-semibold", accent)} data-testid={`${testid}-count`}>
          {items.length}
        </span>
      </div>
      <div className="mt-2">
        {items.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">{empty}</p>
        ) : (
          items.map((e, i) => <EventRow key={`${e.ficha_id}-${e.tipo}`} e={e} testid={`${testid}-item-${i}`} />)
        )}
      </div>
    </section>
  );
}

export default function Dashboard() {
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => apiGet<DashboardT>("/dashboard") });
  const d = q.isError ? undefined : q.data;

  const kpis = [
    { label: "Saídas hoje", value: String(d?.saidas_hoje.length ?? "–"), icon: ArrowUpRight, id: "saidas", tone: "text-wine" },
    { label: "Retornos hoje", value: String(d?.retornos_hoje.length ?? "–"), icon: ArrowDownLeft, id: "retornos", tone: "text-navy" },
    { label: "Provas hoje", value: String(d?.provas_hoje.length ?? "–"), icon: Ruler, id: "provas", tone: "text-[#854D0E]" },
    { label: "Saldo a receber", value: d ? brl(d.saldo_a_receber) : "–", icon: Wallet, id: "saldo", tone: "text-charcoal" },
  ];

  return (
    <div>
      <PageHeader eyebrow={d ? `Hoje · ${dataBR(d.hoje)}` : "Painel do dia"} title="Painel do atelier">
        <Link to="/fichas/nova" className={cn(buttonVariants(), "active:scale-[0.98]")} data-testid="dashboard-new-ficha-button">
          <FilePlus2 className="size-4" /> Nova ficha
        </Link>
      </PageHeader>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map((k, i) => (
          <div
            key={k.id}
            style={{ animationDelay: `${i * 60}ms` }}
            className={cn(
              "relative overflow-hidden rounded-lg border border-border bg-white p-5 animate-rise",
              i === 3 && "border-[#E6CA65] bg-gradient-to-br from-white to-gold-light",
            )}
            data-testid={`kpi-${k.id}`}
          >
            <div className="flex items-center justify-between">
              <p className="label-caps">{k.label}</p>
              <k.icon className={cn("size-4", k.tone)} />
            </div>
            <p className={cn("mt-3 font-mono text-3xl font-semibold", k.tone)} data-testid={`kpi-${k.id}-value`}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {d && d.atrasados.length > 0 && (
        <div className="mt-6 rounded-lg border border-[#E8B4BF] bg-[#FBE9EC] p-5 animate-rise" data-testid="atrasados-alert">
          <div className="flex items-center gap-2 text-wine">
            <AlertTriangle className="size-5" />
            <h3 className="text-lg font-semibold">Devoluções atrasadas ({d.atrasados.length})</h3>
          </div>
          <div className="mt-2">
            {d.atrasados.map((e, i) => (
              <EventRow key={e.ficha_id} e={e} testid={`atrasado-item-${i}`} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Saídas de hoje" items={d?.saidas_hoje ?? []} empty="Nenhuma retirada para hoje." testid="panel-saidas" accent="text-wine" />
        <Panel title="Retornos de hoje" items={d?.retornos_hoje ?? []} empty="Nenhuma devolução para hoje." testid="panel-retornos" accent="text-navy" />
        <Panel title="Provas de hoje" items={d?.provas_hoje ?? []} empty="Nenhuma prova agendada hoje." testid="panel-provas" accent="text-[#854D0E]" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Panel title="Próximos 7 dias" items={d?.proximos ?? []} empty="Agenda livre nos próximos dias." testid="panel-proximos" accent="text-charcoal" />
        <section className="rounded-lg bg-charcoal p-6 text-[#F5F5F4] animate-rise" data-testid="estoque-resumo">
          <p className="label-caps text-[#E6CA65]!">Estoque</p>
          <p className="mt-4 font-mono text-5xl font-semibold">
            {d?.trajes_disponiveis ?? "–"}
            <span className="text-xl text-stone-500">/{d?.trajes_total ?? "–"}</span>
          </p>
          <p className="mt-1 text-sm text-stone-400">trajes disponíveis</p>
          <div className="my-6 h-px bg-gradient-to-r from-[#D4AF37] to-transparent" />
          <p className="font-mono text-3xl font-semibold">{d?.fichas_ativas ?? "–"}</p>
          <p className="mt-1 text-sm text-stone-400">fichas ativas (reservadas ou retiradas)</p>
          <Link to="/estoque" className="mt-6 inline-block text-sm text-[#E6CA65] hover:underline" data-testid="dashboard-estoque-link">
            Ver estoque →
          </Link>
        </section>
      </div>
    </div>
  );
}
