import { NextResponse } from "next/server";
import { APPROVER_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  response.cookies.delete(APPROVER_COOKIE_NAME);
  return response;
}
