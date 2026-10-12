import { ApiError } from "@/lib/api";
import type { EventoTipo, FichaStatus, TrajeStatus } from "@/lib/types";

const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brl = (n: number) => brlFmt.format(n || 0);

/** "2026-05-12" → "12/05/2026" (string math — no timezone shifts). */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function dataExtenso(iso: string): { dia: string; mes: string; ano: string } {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return { dia: d, mes: MESES[Number(m) - 1] ?? "", ano: y };
}

export function waLink(phone: string, msg: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits && !digits.startsWith("55")) digits = `55${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
}

export function errMsg(e: unknown, fallback = "Algo deu errado"): string {
  if (e instanceof ApiError) {
    const body = e.body as { detail?: unknown } | null;
    if (body && typeof body.detail === "string") return body.detail;
    if (e.status === 422) return "Verifique os campos obrigatórios";
  }
  return fallback;
}

export const FICHA_STATUS: Record<FichaStatus, { label: string; cls: string }> = {
  reservado: { label: "Reservado", cls: "bg-gold-light text-[#854D0E] border-[#E6CA65]" },
  retirado: { label: "Retirado", cls: "bg-[#FBE9EC] text-wine border-[#E8B4BF]" },
  devolvido: { label: "Devolvido", cls: "bg-[#E8F3EC] text-[#166534] border-[#B7DCC3]" },
  cancelado: { label: "Cancelado", cls: "bg-stone-100 text-stone-500 border-stone-300" },
};

export const TRAJE_STATUS: Record<TrajeStatus, { label: string; cls: string }> = {
  disponivel: { label: "Disponível", cls: "bg-[#E8F3EC] text-[#166534] border-[#B7DCC3]" },
  alugado: { label: "Alugado", cls: "bg-[#FBE9EC] text-wine border-[#E8B4BF]" },
  prova: { label: "Em prova", cls: "bg-gold-light text-[#854D0E] border-[#E6CA65]" },
  lavanderia: { label: "Lavanderia", cls: "bg-[#E6EDF5] text-navy border-[#B9C9DC]" },
};

export const EVENTO: Record<EventoTipo, { label: string; dot: string; chip: string }> = {
  saida: { label: "Saída", dot: "bg-wine", chip: "bg-[#FBE9EC] text-wine" },
  retorno: { label: "Retorno", dot: "bg-navy", chip: "bg-[#E6EDF5] text-navy" },
  prova: { label: "Prova", dot: "bg-gold", chip: "bg-gold-light text-[#854D0E]" },
};

export const CATEGORIAS = ["Noiva", "Noivo", "Debutante", "Padrinho", "Madrinha", "Dama/Pajem", "Festa", "Acessório"];
export const FORMAS = ["Dinheiro", "Pix", "Cartão de crédito", "Cartão de débito"];
