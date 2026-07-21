import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  clearLoginFailures,
  createSessionToken,
  isLoginLocked,
  nameKey,
  recordLoginFailure,
  sessionCookie,
  verifyPin,
} from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Signs an applicant in with name + 4-digit PIN.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const key = nameKey(String(body?.name ?? ""));
  const pin = String(body?.pin ?? "");

  if (!key || !/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { error: "Enter your name and your 4-digit PIN." },
      { status: 400 }
    );
  }

  if (isLoginLocked(key)) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a minute and try again." },
      { status: 429 }
    );
  }

  const supabase = createAdminClient();
  const { data: applicant } = await supabase
    .from("applicants")
    .select("id")
    .eq("name_key", key)
    .maybeSingle();

  const { data: creds } = applicant
    ? await supabase
        .from("applicant_credentials")
        .select("pin_hash")
        .eq("applicant_id", applicant.id)
        .maybeSingle()
    : { data: null };

  if (!applicant || !creds?.pin_hash || !verifyPin(pin, creds.pin_hash)) {
    recordLoginFailure(key);
    return NextResponse.json(
      { error: "Wrong name or PIN." },
      { status: 401 }
    );
  }

  clearLoginFailures(key);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie(createSessionToken(applicant.id)));
  return response;
}
