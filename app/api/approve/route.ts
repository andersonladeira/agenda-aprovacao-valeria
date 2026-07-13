import { NextRequest, NextResponse } from "next/server";
import { upsertApproval } from "@/lib/sheets";
import { syncOfficialAgenda } from "@/lib/officialAgenda";
import { APPROVER_COOKIE_NAME } from "@/lib/auth";
import { ApprovalStatus } from "@/lib/types";

const VALID_STATUSES: ApprovalStatus[] = ["PENDENTE", "APROVADA", "REJEITADA"];

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { carimbo, nomeEvento, assessor, status, comentario, scoreBase, faixa, agenda, okRonaldo, okValeria } = body;

  if (!carimbo || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const approverCookie = request.cookies.get(APPROVER_COOKIE_NAME)?.value;
  const aprovador = approverCookie ? decodeURIComponent(approverCookie) : "Desconhecido";

  const approval = {
    carimbo,
    nomeEvento: nomeEvento ?? "",
    assessor: assessor ?? "",
    status: status as ApprovalStatus,
    aprovador,
    dataDecisao: new Date().toISOString(),
    comentario: comentario ?? "",
    scoreBase: Number(scoreBase ?? 0),
    faixa: faixa ?? "REAVALIAR",
    okRonaldo: Boolean(okRonaldo),
    okValeria: Boolean(okValeria),
  };

  await upsertApproval(approval);
  await syncOfficialAgenda(agenda ?? null, approval);

  return NextResponse.json({ ok: true });
}
