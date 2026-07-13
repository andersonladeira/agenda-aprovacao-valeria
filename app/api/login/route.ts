import { NextRequest, NextResponse } from "next/server";
import { APPROVER_COOKIE_NAME, expectedSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { password, nome } = await request.json();

  const appPassword = process.env.APP_PASSWORD || "";
  if (!appPassword || password !== appPassword) {
    return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  const oneWeek = 60 * 60 * 24 * 7;

  response.cookies.set(SESSION_COOKIE_NAME, expectedSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: oneWeek,
  });

  response.cookies.set(APPROVER_COOKIE_NAME, encodeURIComponent(nome || "Sem nome"), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: oneWeek,
  });

  return response;
}
