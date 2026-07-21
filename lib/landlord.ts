import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// The landlord has no account. Access to the dashboard is either:
// - open (LANDLORD_CODE not set): anyone with the URL can view, or
// - gated by a single shared code (LANDLORD_CODE set): typed once,
//   then remembered in an HMAC-signed cookie. Changing the code
//   invalidates existing cookies.

export const LANDLORD_COOKIE = "landlord_session";
const SESSION_DAYS = 90;

export function landlordCode(): string | null {
  return process.env.LANDLORD_CODE || null;
}

function secret(): string {
  const s =
    process.env.SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) {
    throw new Error("Set SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY");
  }
  return s;
}

function codeSignature(code: string): Buffer {
  return createHmac("sha256", secret()).update(`landlord:${code}`).digest();
}

export function verifyLandlordCode(code: string): boolean {
  const expected = landlordCode();
  if (!expected) return true;
  return timingSafeEqual(codeSignature(code), codeSignature(expected));
}

export function landlordCookie() {
  const value = codeSignature(landlordCode() ?? "").toString("hex");
  return {
    name: LANDLORD_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export function clearedLandlordCookie() {
  return { ...landlordCookie(), value: "", maxAge: 0 };
}

// True when the visitor may see the landlord dashboard.
export async function isLandlord(): Promise<boolean> {
  if (!landlordCode()) return true;

  const store = await cookies();
  const value = store.get(LANDLORD_COOKIE)?.value;
  if (!value) return false;

  const expected = codeSignature(landlordCode()!).toString("hex");
  return (
    value.length === expected.length &&
    timingSafeEqual(Buffer.from(value), Buffer.from(expected))
  );
}
