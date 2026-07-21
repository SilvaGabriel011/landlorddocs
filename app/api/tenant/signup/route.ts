import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createSessionToken,
  hashPin,
  nameKey,
  normalizeName,
  sessionCookie,
} from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Creates an applicant account: name + email + a 4-digit PIN chosen by
// the applicant. The name (case-insensitive) is the sign-in identifier.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = normalizeName(String(body?.name ?? ""));
  const email = String(body?.email ?? "").trim();
  const pin = String(body?.pin ?? "");

  if (name.length < 2 || name.length > 80) {
    return NextResponse.json(
      { error: "Please enter your full name." },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }
  if (!/^\d{4}$/.test(pin)) {
    return NextResponse.json(
      { error: "The PIN must be exactly 4 digits." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: applicant, error } = await supabase
    .from("applicants")
    .insert({ name, name_key: nameKey(name), email })
    .select("id")
    .single();

  if (error || !applicant) {
    if (error?.code === "23505") {
      return NextResponse.json(
        {
          error:
            "That name is already registered. Sign in with your PIN, or use a different name.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Could not create the account. Please try again." },
      { status: 500 }
    );
  }

  const { error: credError } = await supabase
    .from("applicant_credentials")
    .insert({ applicant_id: applicant.id, pin_hash: hashPin(pin) });

  if (credError) {
    await supabase.from("applicants").delete().eq("id", applicant.id);
    return NextResponse.json(
      { error: "Could not create the account. Please try again." },
      { status: 500 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie(createSessionToken(applicant.id)));
  return response;
}
