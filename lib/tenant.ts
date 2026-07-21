import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Applicants (people applying to rent) don't have Supabase auth accounts.
// They sign up with name + email + a 4-digit PIN and get an HMAC-signed
// session cookie. Everything here is server-only.

export const TENANT_COOKIE = "tenant_session";
const SESSION_DAYS = 30;

export type Applicant = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
};

function secret(): string {
  const s =
    process.env.SESSION_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) {
    throw new Error("Set SESSION_SECRET or SUPABASE_SERVICE_ROLE_KEY");
  }
  return s;
}

// ---------- Names ----------

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function nameKey(name: string): string {
  return normalizeName(name).toLowerCase();
}

// ---------- PIN hashing (scrypt, salt:hash hex) ----------

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(pin, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length &&
    timingSafeEqual(candidate, expected)
  );
}

// ---------- Session tokens: "<applicantId>.<expiresMs>.<hmac>" ----------

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function createSessionToken(applicantId: string): string {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${applicantId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [applicantId, expires, mac] = parts;
  const expected = Buffer.from(sign(`${applicantId}.${expires}`));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  const expiresMs = Number(expires);
  if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) return null;
  return applicantId;
}

export function sessionCookie(token: string) {
  return {
    name: TENANT_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export function clearedSessionCookie() {
  return { ...sessionCookie(""), maxAge: 0 };
}

// Reads the session cookie and returns the signed-in applicant, or null.
export async function getApplicant(): Promise<Applicant | null> {
  const store = await cookies();
  const token = store.get(TENANT_COOKIE)?.value;
  if (!token) return null;

  const applicantId = verifySessionToken(token);
  if (!applicantId) return null;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("applicants")
    .select("id, name, email, phone, created_at")
    .eq("id", applicantId)
    .maybeSingle();

  return data ?? null;
}

// ---------- Login throttling ----------
// A 4-digit PIN is easy to brute force, so failed sign-ins are throttled
// per name. In-memory only (resets on redeploy / per serverless instance),
// which is enough to make guessing impractical for an app this size.

const MAX_FAILURES = 5;
const LOCKOUT_MS = 60 * 1000;

const failures = new Map<string, { count: number; lockedUntil: number }>();

export function isLoginLocked(key: string): boolean {
  const entry = failures.get(key);
  return !!entry && entry.lockedUntil > Date.now();
}

export function recordLoginFailure(key: string) {
  const entry = failures.get(key) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_FAILURES) {
    entry.count = 0;
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  failures.set(key, entry);
}

export function clearLoginFailures(key: string) {
  failures.delete(key);
}
