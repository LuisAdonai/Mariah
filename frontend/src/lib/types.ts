// Hand-written mirrors of backend/models/schemas.py — keep in sync.
export type TrajeStatus = "disponivel" | "alugado" | "prova" | "lavanderia";
export type FichaStatus = "reservado" | "retirado" | "devolvido" | "cancelado";
export type EventoTipo = "saida" | "retorno" | "prova";

export interface Me {
  ok: boolean;
  loja: string;
}

export interface TrajeIn {
  codigo: string;
  nome: string;
  categoria: string;
  tamanho: string;
  cor: string;
  valor_locacao: number;
  status: TrajeStatus;
  foto_url: string;
  observacoes: string;
}

export interface Traje extends TrajeIn {
  id: string;
}

export interface Medidas {
  traje: string;
  calca: string;
  camisa: string;
  comp_manga: string;
  comp_calca: string;
  busto: string;
  cintura: string;
  observacoes: string;
}

export interface Pagamento {
  id: string;
  valor: number;
  forma: string;
  data: string;
}

export interface FichaIn {
  nome: string;
  endereco: string;
  numero_end: string;
  bairro: string;
  cpf: string;
  telefone: string;
  telefone2: string;
  traje_ids: string[];
  trajes_descricao: string;
  data_saida: string;
  data_retorno: string;
  data_prova: string | null;
  medidas: Medidas;
  total: number;
  sinal: number;
  forma_pagamento: string;
  observacoes: string;
}

export interface TrajeRef {
  id: string;
  codigo: string;
  nome: string;
}

export interface Ficha extends FichaIn {
  id: string;
  numero: number;
  status: FichaStatus;
  pagamentos: Pagamento[];
  created_at: string;
  saldo: number;
  trajes: TrajeRef[];
}

export interface AgendaEvento {
  ficha_id: string;
  numero: number;
  nome: string;
  telefone: string;
  tipo: EventoTipo;
  data: string;
  status: FichaStatus;
  saldo: number;
  trajes: string;
}

export interface Dashboard {
  hoje: string;
  saidas_hoje: AgendaEvento[];
  retornos_hoje: AgendaEvento[];
  provas_hoje: AgendaEvento[];
  atrasados: AgendaEvento[];
  proximos: AgendaEvento[];
  saldo_a_receber: number;
  fichas_ativas: number;
  trajes_total: number;
  trajes_disponiveis: number;
}
