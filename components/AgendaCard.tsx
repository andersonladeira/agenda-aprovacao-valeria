"use client";

import { useState } from "react";
import { AgendaWithApproval, ApprovalStatus } from "@/lib/types";
import { BAND_LABELS } from "@/lib/score";
import { STATUS_LABELS, STATUS_COLORS, BAND_COLORS, formatCarimbo } from "@/lib/ui";

function Field({ label, value }: { label: string; value?: string }) {
  const display = value && value.trim().length > 0 ? value : "—";
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800">{display}</dd>
    </div>
  );
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

  const currentStatus: ApprovalStatus = approval?.status ?? "PENDENTE";

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
          agenda,
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

      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
        <Field label="Tipo de agenda" value={agenda.raw["Tipo de agenda"]} />
        <Field label="Local" value={agenda.raw["Local"]} />
        <Field label="Endereço completo" value={agenda.raw["Endereço completo"]} />
        <Field
          label="Quem vai receber"
          value={agenda.raw["Quem é o responsável por receber a Deputada e equipe?"]}
        />
        <Field
          label="Contato de quem recebe"
          value={agenda.raw["Contato do Responsaável"] || agenda.raw["Contato do Responsável"]}
        />
        <Field label="Público estimado" value={agenda.raw["Público estimado"]} />
        <Field label="Lideranças presentes" value={agenda.raw["Quantas lideranças estarão presentes?"]} />
        <Field label="Autoridades confirmadas" value={agenda.raw["Autoridades confirmadas"]} />
        <Field label="A deputada falará?" value={agenda.raw["A deputada falará?"]} />
        <Field label="Tempo previsto de fala" value={agenda.raw["Tempo previsto de fala"]} />
        <Field
          label="Quem convidou"
          value={[agenda.raw["Nome"], agenda.raw["Cargo"]].filter(Boolean).join(" — ")}
        />
        <Field label="Perfil de quem convidou" value={agenda.raw["Essa pessoa é:"]} />
        <Field label="Inauguração de obra pública?" value={agenda.raw["O evento é inauguração de obra pública?"]} />
        <Field label="Pedido de discurso?" value={agenda.raw["Existe pedido para discurso?"]} />
        <Field label="Entrega pública prevista?" value={agenda.raw["Existe alguma entrega pública prevista?"]} />
      </dl>

      {agenda.raw["OBSERVAÇÕES"] && (
        <p className="text-sm text-slate-600 border-t border-slate-100 pt-3">
          <strong className="text-slate-800 font-medium">Observações:</strong> {agenda.raw["OBSERVAÇÕES"]}
        </p>
      )}

      {(() => {
        const duvida = agenda.raw["Existe alguma dúvida jurídica relacionada a essa agenda?"];
        const temDuvida = duvida && !["não", "nao", "nenhuma", "não há", "nao ha"].includes(duvida.trim().toLowerCase());
        if (!temDuvida) return null;
        return (
          <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <strong className="font-medium">Dúvida jurídica registrada:</strong> {duvida}
          </p>
        );
      })()}

      <div className="flex flex-wrap items-center gap-2 pt-1">
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
        {score.legalHold &&
          score.legalHoldReasons.map((reason, i) => (
            <span
              key={i}
              className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
            >
              🔒 {reason}
            </span>
          ))}
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
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
