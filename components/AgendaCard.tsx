"use client";

import { useState } from "react";
import { AgendaWithApproval, ApprovalStatus } from "@/lib/types";
import { BAND_LABELS } from "@/lib/score";

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
  AGUARDAR_JURIDICO: "Aguardar Jurídico",
};

const STATUS_COLORS: Record<ApprovalStatus, string> = {
  PENDENTE: "bg-slate-100 text-slate-700 border-slate-200",
  APROVADA: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJEITADA: "bg-red-50 text-red-700 border-red-200",
  AGUARDAR_JURIDICO: "bg-amber-50 text-amber-700 border-amber-200",
};

const BAND_COLORS: Record<string, string> = {
  PRIORIDADE_MAXIMA: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ESTRATEGICA: "bg-yellow-50 text-yellow-700 border-yellow-200",
  INSTITUCIONAL: "bg-orange-50 text-orange-700 border-orange-200",
  REAVALIAR: "bg-red-50 text-red-700 border-red-200",
};

function formatCarimbo(carimbo: string): string {
  const match = carimbo.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (!match) return carimbo;
  const [, dd, mm, yyyy, hh, min] = match;
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

export function AgendaCard({
  item,
  onDecided,
}: {
  item: AgendaWithApproval;
  onDecided: () => void;
}) {
  const { agenda, score, approval } = item;
  const [comentario, setComentario] = useState(approval?.comentario ?? "");
  const [saving, setSaving] = useState<ApprovalStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentStatus: ApprovalStatus =
    approval?.status ?? (score.legalHold ? "AGUARDAR_JURIDICO" : "PENDENTE");

  async function decide(status: ApprovalStatus) {
    setSaving(status);
    setError(null);
    try {
      const res = await fetch("/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carimbo: agenda.carimbo,
          nomeEvento: agenda.nomeEvento,
          assessor: agenda.assessor,
          status,
          comentario,
          scoreBase: score.scoreBase,
          faixa: score.band,
        }),
      });
      if (!res.ok) throw new Error("Falha ao salvar a decisão.");
      onDecided();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900 leading-tight">
            {agenda.nomeEvento || "(sem nome de evento)"}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Recebido em {formatCarimbo(agenda.carimbo)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[currentStatus]}`}
        >
          {STATUS_LABELS[currentStatus]}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        <span>
          <strong className="text-slate-800 font-medium">Assessora:</strong> {agenda.assessor || "—"}
        </span>
        <span>
          <strong className="text-slate-800 font-medium">Cidade:</strong> {agenda.cidade || "—"}
        </span>
        <span>
          <strong className="text-slate-800 font-medium">Data do evento:</strong>{" "}
          {agenda.dataEvento ? `${agenda.dataEvento} ${agenda.horarioInicio || ""}`.trim() : "não informada"}
        </span>
      </div>

      {agenda.raw["Explique por que essa agenda é importante."] && (
        <p className="text-sm text-slate-600 border-t border-slate-100 pt-3">
          {agenda.raw["Explique por que essa agenda é importante."]}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        {score.isTest ? (
          <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
            ⚠️ Dado de teste — não avaliado
          </span>
        ) : score.isIncomplete ? (
          <span className="rounded-full border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
            ⚠️ Registro incompleto — não avaliado
          </span>
        ) : (
          <>
            <span className="rounded-full border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-800">
              Score: {score.scoreBase}/100
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${BAND_COLORS[score.band]}`}>
              {BAND_LABELS[score.band]}
            </span>
          </>
        )}
        {score.legalHold && (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
            🔒 {score.legalHoldReasons[0]}
          </span>
        )}
      </div>

      {approval && (
        <p className="text-xs text-slate-400">
          Última decisão: {STATUS_LABELS[approval.status]} por {approval.aprovador || "—"} em{" "}
          {approval.dataDecisao ? new Date(approval.dataDecisao).toLocaleString("pt-BR") : "—"}
        </p>
      )}

      <div className="pt-2 border-t border-slate-100 space-y-2">
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Comentário da decisão (opcional)"
          rows={2}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => decide("APROVADA")}
            disabled={saving !== null}
            className="rounded-lg bg-emerald-600 text-white text-sm font-medium px-3 py-1.5 hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving === "APROVADA" ? "Salvando..." : "Aprovar"}
          </button>
          <button
            onClick={() => decide("REJEITADA")}
            disabled={saving !== null}
            className="rounded-lg bg-red-600 text-white text-sm font-medium px-3 py-1.5 hover:bg-red-700 disabled:opacity-60"
          >
            {saving === "REJEITADA" ? "Salvando..." : "Rejeitar"}
          </button>
          <button
            onClick={() => decide("AGUARDAR_JURIDICO")}
            disabled={saving !== null}
            className="rounded-lg bg-amber-500 text-white text-sm font-medium px-3 py-1.5 hover:bg-amber-600 disabled:opacity-60"
          >
            {saving === "AGUARDAR_JURIDICO" ? "Salvando..." : "Aguardar Jurídico"}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
