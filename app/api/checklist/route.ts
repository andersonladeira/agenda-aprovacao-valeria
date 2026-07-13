import { NextRequest, NextResponse } from "next/server";
import { updateChecklistField } from "@/lib/sheets";

const VALID_FIELDS = ["okRonaldo", "okValeria"] as const;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { carimbo, nomeEvento, assessor, scoreBase, faixa, field, value } = body;

  if (!carimbo || !VALID_FIELDS.includes(field) || typeof value !== "boolean") {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  await updateChecklistField(
    { carimbo, nomeEvento: nomeEvento ?? "", assessor: assessor ?? "", scoreBase: Number(scoreBase ?? 0), faixa: faixa ?? "REAVALIAR" },
    field,
    value
  );

  return NextResponse.json({ ok: true });
}
