import { createHmac, timingSafeEqual } from "crypto";

const SESSION_COOKIE = "agenda_session";
const APPROVER_COOKIE = "agenda_approver";

function secret(): string {
  return process.env.SESSION_SECRET || "dev-secret-troque-em-producao";
}

export function expectedSessionToken(): string {
  const password = process.env.APP_PASSWORD || "";
  return createHmac("sha256", secret()).update(password).digest("hex");
}

export function isValidSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const expected = expectedSessionToken();
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
export const APPROVER_COOKIE_NAME = APPROVER_COOKIE;
