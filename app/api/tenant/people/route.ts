import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApplicant } from "@/lib/tenant";
import { cleanPersonName, samePerson } from "@/lib/people";

export const dynamic = "force-dynamic";

// Edits a person on the application (all of their documents at once):
// - { from, to: "New Name" }   rename (renaming onto an existing person
//                              or onto the account holder's name merges)
// - { from, to: null }         fold into the main applicant ("this is me")
// - { from, role }             tag as 'resident' | 'supporter' | null
// to and role can be combined; role applies to the resulting person.
export async function PATCH(request: Request) {
  const applicant = await getApplicant();
  if (!applicant) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const from = cleanPersonName(String(body.from ?? ""));
  if (!from) {
    return NextResponse.json({ error: "Missing person" }, { status: 400 });
  }

  const supabase = createAdminClient();

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

  return NextResponse.json({ ok: true });
}
