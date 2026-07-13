import { NextResponse } from "next/server";

// Endpoint de diagnóstico temporário — não expõe a chave, só o formato dela.
// Remover depois de resolver o problema da GOOGLE_PRIVATE_KEY.
export async function GET() {
  const raw = process.env.GOOGLE_PRIVATE_KEY || "";
  return NextResponse.json({
    length: raw.length,
    startsWithQuote: raw.startsWith('"') || raw.startsWith("'"),
    endsWithQuote: raw.endsWith('"') || raw.endsWith("'"),
    includesLiteralBackslashN: raw.includes("\\n"),
    includesRealNewline: raw.includes("\n"),
    hasEmail: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL),
  });
}
