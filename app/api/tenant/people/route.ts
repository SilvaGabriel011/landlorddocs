import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApplicant } from "@/lib/tenant";
import { cleanPersonName, samePerson } from "@/lib/people";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanEmail(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  const s = String(v ?? "").trim();
  if (!s) return null;
  return EMAIL_RE.test(s) ? s.slice(0, 120) : undefined;
}

function cleanPhone(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  const s = String(v ?? "")
    .trim()
    .replace(/[^\d+()\-\s]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 25);
  return s || null;
}

// Edits a person on the application:
// - { from: "" }               targets the main applicant (contact only)
// - { from, to: "New Name" }   rename (onto an existing person or the
//                              account holder's own name = merge)
// - { from, to: null }         fold into the main applicant ("this is me")
// - { from, role }             tag as 'resident' | 'supporter' | null
// - { from, email, phone }     contact info, shown to the landlord
// Fields can be combined; role/contact apply to the resulting person.
export async function PATCH(request: Request) {
  const applicant = await getApplicant();
  if (!applicant) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = cleanEmail(body.email);
  const phone = cleanPhone(body.phone);
  if ("email" in body && email === undefined) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const from = cleanPersonName(String(body.from ?? ""));

  // Main applicant: only their contact info can change here.
  if (!from) {
    const updates: { email?: string; phone?: string | null } = {};
    if (email !== undefined && email !== null) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from("applicants")
        .update(updates)
        .eq("id", applicant.id);
      if (error) {
        return NextResponse.json(
          { error: "Could not save the contact info" },
          { status: 500 }
        );
      }
    }
    return NextResponse.json({ ok: true });
  }

  const { data: existing } = await supabase
    .from("documents")
    .select("id")
    .eq("applicant_id", applicant.id)
    .eq("person_name", from)
    .limit(1);
  if (!existing || existing.length === 0) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 });
  }

  let target: string | null = from;

  if ("to" in body) {
    const toRaw = body.to;
    const to =
      toRaw === null || toRaw === undefined ? "" : cleanPersonName(String(toRaw));

    // Empty name or the account holder's own name = fold into the main
    // applicant.
    target = to && !samePerson(to, applicant.name) ? to : null;

    const { error } = await supabase
      .from("documents")
      .update(
        target === null
          ? { person_name: null, person_role: null }
          : { person_name: target }
      )
      .eq("applicant_id", applicant.id)
      .eq("person_name", from);
    if (error) {
      return NextResponse.json({ error: "Could not rename" }, { status: 500 });
    }

    // Move the contact row along with the person. When merging into a
    // person that already has contact info, theirs wins.
    if (target !== from) {
      const { data: fromContact } = await supabase
        .from("application_people")
        .select("email, phone")
        .eq("applicant_id", applicant.id)
        .eq("person_name", from)
        .maybeSingle();
      await supabase
        .from("application_people")
        .delete()
        .eq("applicant_id", applicant.id)
        .eq("person_name", from);
      if (target !== null && fromContact) {
        await supabase.from("application_people").upsert(
          {
            applicant_id: applicant.id,
            person_name: target,
            email: fromContact.email,
            phone: fromContact.phone,
          },
          { onConflict: "applicant_id,person_name", ignoreDuplicates: true }
        );
      }
    }
  }

  if ("role" in body && target !== null) {
    const role =
      body.role === "resident" || body.role === "supporter" ? body.role : null;
    const { error } = await supabase
      .from("documents")
      .update({ person_role: role })
      .eq("applicant_id", applicant.id)
      .eq("person_name", target);
    if (error) {
      return NextResponse.json(
        { error: "Could not update the tag" },
        { status: 500 }
      );
    }
  }

  if ((email !== undefined || phone !== undefined) && target !== null) {
    const { data: current } = await supabase
      .from("application_people")
      .select("email, phone")
      .eq("applicant_id", applicant.id)
      .eq("person_name", target)
      .maybeSingle();
    const { error } = await supabase.from("application_people").upsert(
      {
        applicant_id: applicant.id,
        person_name: target,
        email: email !== undefined ? email : (current?.email ?? null),
        phone: phone !== undefined ? phone : (current?.phone ?? null),
      },
      { onConflict: "applicant_id,person_name" }
    );
    if (error) {
      return NextResponse.json(
        { error: "Could not save the contact info" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
