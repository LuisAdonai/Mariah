import { brl, dataBR } from "@/lib/format";

export const LOJA = {
  nome: "Mariáh Noivas",
  sub: "Trajes a Rigor",
  linha: "Aluguel e Venda de Roupas e Acessórios",
  endereco: "Av. Senador Teotônio Vilela, 7228",
  tel: "5927-6231",
  whats: "9 7596-2646",
  cidade: "São Paulo",
};

export const TERMOS = [
  "Caso houver desistência não devolvemos o valor.",
  "Estou ciente de que a não devolução na data prevista implicará na cobrança de multa por dia de atraso.",
  "Em caso de sujeira e danos cobraremos taxa.",
];

interface MsgData {
  nome: string;
  numero: number;
  trajes: string;
  data_saida: string;
  data_retorno: string;
  data_prova: string | null;
  saldo: number;
}

export function waTemplates(f: MsgData) {
  const nome = f.nome.split(" ")[0];
  const traje = f.trajes || "seu traje";
  const list = [
    {
      key: "prova",
      label: "Lembrete de prova",
      msg: `Olá ${nome}! Aqui é da ${LOJA.nome}. Lembramos que a sua prova de ajuste (${traje}) está agendada para ${dataBR(f.data_prova)}. Qualquer dúvida nos avise!`,
      enabled: !!f.data_prova,
    },
    {
      key: "retirada",
      label: "Aviso de retirada",
      msg: `Olá ${nome}! Seu traje (${traje}) está pronto! A retirada está prevista para ${dataBR(f.data_saida)}. Saldo restante: ${brl(f.saldo)}. Te esperamos na ${LOJA.endereco}.`,
      enabled: true,
    },
    {
      key: "devolucao",
      label: "Lembrete de devolução",
      msg: `Olá ${nome}! Esperamos que sua festa tenha sido inesquecível! Lembramos que a devolução do traje está agendada para ${dataBR(f.data_retorno)}. Após essa data é cobrada multa por dia de atraso.`,
      enabled: true,
    },
    {
      key: "saldo",
      label: "Cobrança de saldo",
      msg: `Olá ${nome}! Passando para lembrar do saldo de ${brl(f.saldo)} referente à ficha Nº ${f.numero} da ${LOJA.nome}.`,
      enabled: f.saldo > 0,
    },
  ];
  return list.filter((t) => t.enabled);
}
