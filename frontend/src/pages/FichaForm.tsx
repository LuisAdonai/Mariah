import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Ruler, Shirt, User, Wallet } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppLayout";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { brl, errMsg, FORMAS } from "@/lib/format";
import type { Ficha, FichaIn, Medidas, Traje } from "@/lib/types";
import { cn } from "@/lib/utils";

const EMPTY_MEDIDAS: Medidas = {
  traje: "", calca: "", camisa: "", comp_manga: "", comp_calca: "", busto: "", cintura: "", observacoes: "",
};

const EMPTY: FichaIn = {
  nome: "", endereco: "", numero_end: "", bairro: "", cpf: "", telefone: "", telefone2: "",
  traje_ids: [], trajes_descricao: "", data_saida: "", data_retorno: "", data_prova: null,
  medidas: EMPTY_MEDIDAS, total: 0, sinal: 0, forma_pagamento: "", observacoes: "",
};

function toInput(f: Ficha): FichaIn {
  return {
    nome: f.nome, endereco: f.endereco, numero_end: f.numero_end, bairro: f.bairro, cpf: f.cpf,
    telefone: f.telefone, telefone2: f.telefone2, traje_ids: f.traje_ids, trajes_descricao: f.trajes_descricao,
    data_saida: f.data_saida, data_retorno: f.data_retorno, data_prova: f.data_prova, medidas: { ...EMPTY_MEDIDAS, ...f.medidas },
    total: f.total, sinal: f.sinal, forma_pagamento: f.forma_pagamento, observacoes: f.observacoes,
  };
}

export default function FichaForm() {
  const { id } = useParams();
  const ficha = useQuery({ queryKey: ["ficha", id], queryFn: () => apiGet<Ficha>(`/fichas/${id}`), enabled: !!id });
  if (id && !ficha.data) {
    return <p className="text-muted-foreground" data-testid="ficha-form-loading">{ficha.isError ? "Ficha não encontrada." : "Carregando ficha..."}</p>;
  }
  return <FichaFormInner key={id ?? "nova"} id={id} numero={ficha.data?.numero} initial={ficha.data ? toInput(ficha.data) : EMPTY} />;
}

function Section({ icon: Icon, n, title, children }: { icon: typeof User; n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-white p-6 shadow-[0_4px_20px_rgba(43,11,20,0.05)] animate-rise">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full border border-[#E6CA65] bg-gold-light text-wine">
          <Icon className="size-4" />
        </span>
        <div>
          <p className="label-caps">{n}</p>
          <h2 className="text-xl font-semibold leading-tight">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function FichaFormInner({ id, numero, initial }: { id?: string; numero?: number; initial: FichaIn }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState<FichaIn>(initial);
  const [totalTouched, setTotalTouched] = useState(!!id);
  const set = <K extends keyof FichaIn>(k: K, v: FichaIn[K]) => setF((p) => ({ ...p, [k]: v }));
  const setM = (k: keyof Medidas, v: string) => setF((p) => ({ ...p, medidas: { ...p.medidas, [k]: v } }));

  const trajes = useQuery({ queryKey: ["trajes"], queryFn: () => apiGet<Traje[]>("/trajes") });
  const datesOk = !!f.data_saida && !!f.data_retorno && f.data_retorno >= f.data_saida;
  const ocupados = useQuery({
    queryKey: ["ocupados", f.data_saida, f.data_retorno, id ?? ""],
    queryFn: () =>
      apiGet<string[]>(`/trajes/ocupados?saida=${f.data_saida}&retorno=${f.data_retorno}${id ? `&exclude=${id}` : ""}`),
    enabled: datesOk,
  });
  const busy = new Set(ocupados.data ?? []);
  const lista = trajes.isError ? [] : (trajes.data ?? []);

  const toggleTraje = (t: Traje) => {
    setF((p) => {
      const ids = p.traje_ids.includes(t.id) ? p.traje_ids.filter((x) => x !== t.id) : [...p.traje_ids, t.id];
      const total = totalTouched
        ? p.total
        : lista.filter((x) => ids.includes(x.id)).reduce((s, x) => s + x.valor_locacao, 0);
      return { ...p, traje_ids: ids, total };
    });
  };

  const save = useMutation({
    mutationFn: () => {
      const body: FichaIn = { ...f, data_prova: f.data_prova || null };
      return id ? apiPut<Ficha>(`/fichas/${id}`, body) : apiPost<Ficha>("/fichas", body);
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["fichas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
      qc.setQueryData(["ficha", saved.id], saved);
      toast.success(id ? "Ficha atualizada" : `Ficha Nº ${saved.numero} criada`);
      navigate(`/fichas/${saved.id}`);
    },
    onError: (e) => toast.error(errMsg(e, "Não foi possível salvar a ficha")),
  });

  const saldo = f.total - f.sinal;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!datesOk) {
          toast.error("Informe saída e retorno (retorno igual ou depois da saída)");
          return;
        }
        save.mutate();
      }}
      data-testid="ficha-form"
    >
      <PageHeader eyebrow={id ? `Ficha Nº ${numero}` : "Nova locação"} title={id ? "Editar ficha" : "Nova ficha"}>
        <Link to={id ? `/fichas/${id}` : "/fichas"} className={buttonVariants({ variant: "outline" })} data-testid="ficha-form-back">
          <ArrowLeft className="size-4" /> Voltar
        </Link>
      </PageHeader>

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Section icon={User} n="Via 1 · Cliente" title="Dados do cliente">
            <div className="grid gap-4 sm:grid-cols-6">
              <Field label="Nome *" className="sm:col-span-6">
                <Input required value={f.nome} onChange={(e) => set("nome", e.target.value)} data-testid="ficha-nome-input" />
              </Field>
              <Field label="Endereço" className="sm:col-span-4">
                <Input value={f.endereco} onChange={(e) => set("endereco", e.target.value)} data-testid="ficha-endereco-input" />
              </Field>
              <Field label="Nº" className="sm:col-span-2">
                <Input value={f.numero_end} onChange={(e) => set("numero_end", e.target.value)} data-testid="ficha-numero-end-input" />
              </Field>
              <Field label="Bairro" className="sm:col-span-3">
                <Input value={f.bairro} onChange={(e) => set("bairro", e.target.value)} data-testid="ficha-bairro-input" />
              </Field>
              <Field label="CPF" className="sm:col-span-3">
                <Input value={f.cpf} onChange={(e) => set("cpf", e.target.value)} data-testid="ficha-cpf-input" />
              </Field>
              <Field label="Telefone / WhatsApp" className="sm:col-span-3">
                <Input value={f.telefone} placeholder="(11) 90000-0000" onChange={(e) => set("telefone", e.target.value)} data-testid="ficha-telefone-input" />
              </Field>
              <Field label="Telefone 2" className="sm:col-span-3">
                <Input value={f.telefone2} onChange={(e) => set("telefone2", e.target.value)} data-testid="ficha-telefone2-input" />
              </Field>
            </div>
          </Section>

          <Section icon={Shirt} n="Datas & trajes" title="Saída, retorno, prova e trajes">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Prova">
                <Input type="date" value={f.data_prova ?? ""} onChange={(e) => set("data_prova", e.target.value || null)} data-testid="ficha-data-prova-input" />
              </Field>
              <Field label="Saída *">
                <Input type="date" required value={f.data_saida} onChange={(e) => set("data_saida", e.target.value)} data-testid="ficha-data-saida-input" />
              </Field>
              <Field label="Retorno *">
                <Input type="date" required value={f.data_retorno} onChange={(e) => set("data_retorno", e.target.value)} data-testid="ficha-data-retorno-input" />
              </Field>
            </div>

            <p className="label-caps mt-6 mb-3">Trajes do estoque {datesOk ? "· disponibilidade no período" : "· informe as datas para ver a disponibilidade"}</p>
            <div className="grid gap-2 sm:grid-cols-2 max-h-80 overflow-y-auto pr-1" data-testid="ficha-trajes-list">
              {lista.map((t) => {
                const selected = f.traje_ids.includes(t.id);
                const ocupado = busy.has(t.id);
                return (
                  <button
                    type="button"
                    key={t.id}
                    disabled={ocupado && !selected}
                    onClick={() => toggleTraje(t)}
                    data-testid={`ficha-traje-option-${t.codigo}`}
                    className={cn(
                      "flex items-center gap-3 rounded-md border p-2 text-left transition-[border-color,background-color] duration-150",
                      selected ? "border-wine bg-[#FBE9EC]" : "border-border bg-white hover:border-gold",
                      ocupado && !selected && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    {t.foto_url ? (
                      <img src={t.foto_url} alt="" className="size-11 rounded object-cover" />
                    ) : (
                      <span className="grid size-11 place-items-center rounded bg-parchment"><Shirt className="size-4 text-muted-foreground" /></span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{t.nome}</span>
                      <span className="block text-xs text-muted-foreground">
                        <span className="font-mono">{t.codigo}</span> · Tam. {t.tamanho || "—"} · {brl(t.valor_locacao)}
                      </span>
                      {ocupado && <span className="text-xs font-medium text-wine">Reservado neste período</span>}
                    </span>
                    {selected && <Check className="size-4 text-wine shrink-0" />}
                  </button>
                );
              })}
              {lista.length === 0 && <p className="text-sm text-muted-foreground">Nenhum traje cadastrado no estoque.</p>}
            </div>
            <Field label="Outros trajes / acessórios (descrição livre)" className="mt-4">
              <Input value={f.trajes_descricao} onChange={(e) => set("trajes_descricao", e.target.value)} placeholder="Ex.: gravata vinho, colete, sapato 42" data-testid="ficha-trajes-descricao-input" />
            </Field>
          </Section>

          <Section icon={Ruler} n="Via 3 · Costura" title="Medidas e ajustes">
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
              <Field label="Traje" className="col-span-2 sm:col-span-4">
                <Input value={f.medidas.traje} onChange={(e) => setM("traje", e.target.value)} data-testid="medida-traje-input" />
              </Field>
              {([
                ["calca", "Calça"], ["camisa", "Camisa"], ["comp_manga", "Comp. manga"], ["comp_calca", "Comp. calça"],
                ["busto", "Busto"], ["cintura", "Cintura"],
              ] as [keyof Medidas, string][]).map(([k, label]) => (
                <Field key={k} label={label}>
                  <Input value={f.medidas[k]} onChange={(e) => setM(k, e.target.value)} data-testid={`medida-${k.replace("_", "-")}-input`} />
                </Field>
              ))}
              <Field label="Observações da costura" className="col-span-2 sm:col-span-4">
                <Textarea rows={3} value={f.medidas.observacoes} onChange={(e) => setM("observacoes", e.target.value)} data-testid="medida-observacoes-input" />
              </Field>
            </div>
          </Section>
        </div>

        <aside className="xl:sticky xl:top-8 h-fit">
          <Section icon={Wallet} n="Via 2 · Loja" title="Valores">
            <div className="space-y-4">
              <Field label="Total (R$)">
                <Input
                  type="number" min={0} step="0.01" value={String(f.total)}
                  onChange={(e) => { setTotalTouched(true); set("total", Number(e.target.value) || 0); }}
                  className="font-mono" data-testid="ficha-total-input"
                />
              </Field>
              <Field label="Sinal (R$)">
                <Input
                  type="number" min={0} step="0.01" value={String(f.sinal)}
                  onChange={(e) => set("sinal", Number(e.target.value) || 0)}
                  className="font-mono" data-testid="ficha-sinal-input"
                />
              </Field>
              <Field label="Forma de pagamento do sinal">
                <div className="flex flex-wrap gap-1.5">
                  {FORMAS.map((fp) => (
                    <button
                      type="button" key={fp} onClick={() => set("forma_pagamento", fp)}
                      data-testid={`ficha-forma-${fp.toLowerCase().replace(/\s+/g, "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-colors",
                        f.forma_pagamento === fp ? "border-wine bg-wine text-white" : "border-border hover:border-gold",
                      )}
                    >
                      {fp}
                    </button>
                  ))}
                </div>
              </Field>
              <div className="rounded-md border border-[#E6CA65] bg-gold-light p-4">
                <p className="label-caps">Saldo</p>
                <p className={cn("mt-1 font-mono text-3xl font-semibold", saldo > 0 ? "text-wine" : "text-[#166534]")} data-testid="ficha-saldo-preview">
                  {brl(saldo)}
                </p>
              </div>
              <Field label="Observações gerais">
                <Textarea rows={3} value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} data-testid="ficha-observacoes-input" />
              </Field>
              <Button type="submit" className="h-11 w-full active:scale-[0.98] transition-transform" disabled={save.isPending} data-testid="ficha-submit-button">
                {save.isPending ? "Salvando..." : id ? "Salvar alterações" : "Criar ficha"}
              </Button>
            </div>
          </Section>
        </aside>
      </div>
    </form>
  );
}
