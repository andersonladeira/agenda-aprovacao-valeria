import { NextRequest, NextResponse } from "next/server";
import { upsertApproval } from "@/lib/sheets";
import { APPROVER_COOKIE_NAME } from "@/lib/auth";
import { ApprovalStatus } from "@/lib/types";

const VALID_STATUSES: ApprovalStatus[] = [
  "PENDENTE",
  "APROVADA",
  "REJEITADA",
  "AGUARDAR_JURIDICO",
];

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { carimbo, nomeEvento, assessor, status, comentario, scoreBase, faixa } = body;

  if (!carimbo || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const approverCookie = request.cookies.get(APPROVER_COOKIE_NAME)?.value;
  const aprovador = approverCookie ? decodeURIComponent(approverCookie) : "Desconhecido";

  await upsertApproval({
    carimbo,
    nomeEvento: nomeEvento ?? "",
    assessor: assessor ?? "",
    status,
    aprovador,
    dataDecisao: new Date().toISOString(),
    comentario: comentario ?? "",
    scoreBase: Number(scoreBase ?? 0),
    faixa: faixa ?? "REAVALIAR",
  });

  return NextResponse.json({ ok: true });
}
