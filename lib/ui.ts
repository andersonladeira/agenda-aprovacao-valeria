import { AgendaWithApproval, ApprovalStatus } from "./types";

export const STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
};

export const STATUS_COLORS: Record<ApprovalStatus, string> = {
  PENDENTE: "bg-slate-100 text-slate-700 border-slate-200",
  APROVADA: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJEITADA: "bg-red-50 text-red-700 border-red-200",
};

export const STATUS_DOT_COLORS: Record<ApprovalStatus, string> = {
  PENDENTE: "bg-slate-400",
  APROVADA: "bg-emerald-500",
  REJEITADA: "bg-red-500",
};

const VALID_STATUSES: ApprovalStatus[] = ["PENDENTE", "APROVADA", "REJEITADA"];

export const BAND_COLORS: Record<string, string> = {
  PRIORIDADE_MAXIMA: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ESTRATEGICA: "bg-yellow-50 text-yellow-700 border-yellow-200",
  INSTITUCIONAL: "bg-orange-50 text-orange-700 border-orange-200",
  REAVALIAR: "bg-red-50 text-red-700 border-red-200",
};

export function statusOf(item: AgendaWithApproval): ApprovalStatus {
  const status = item.approval?.status;
  // Normaliza status antigos/desconhecidos (ex.: "AGUARDAR_JURIDICO" gravado antes
  // dessa opção ser removida) de volta pra Pendente, em vez de quebrar a exibição.
  if (status && VALID_STATUSES.includes(status)) return status;
  return "PENDENTE";
}

export function formatCarimbo(carimbo: string): string {
  const match = carimbo.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!match) return carimbo;
  const [, dd, mm, yyyy, hh, min] = match;
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

/** Converte "DD/MM/AAAA" (campo Data da agenda) em {year, month, day}, ou null se inválido/vazio. */
export function parseAgendaDate(dataEvento: string): { year: number; month: number; day: number } | null {
  const match = (dataEvento || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return { year: Number(yyyy), month: Number(mm) - 1, day: Number(dd) };
}
