import { NextResponse } from "next/server";
import { getAgendas, getApprovals } from "@/lib/sheets";
import { computeScore } from "@/lib/score";
import { AgendaWithApproval } from "@/lib/types";

/** Converte "DD/MM/AAAA HH:MM:SS" (carimbo do Google Forms) em timestamp ordenável. */
function parseCarimbo(carimbo: string): number {
  const match = carimbo.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return 0;
  const [, dd, mm, yyyy, hh, min, ss] = match;
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss)).getTime();
}

export async function GET() {
  try {
    const [agendas, approvals] = await Promise.all([getAgendas(), getApprovals()]);

    const items: AgendaWithApproval[] = agendas
      .map((agenda) => ({
        agenda,
        score: computeScore(agenda),
        approval: approvals.get(agenda.carimbo) ?? null,
      }))
      // ordem de chegada (carimbo de data/hora), da mais antiga para a mais recente
      .sort((a, b) => parseCarimbo(a.agenda.carimbo) - parseCarimbo(b.agenda.carimbo));

    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
