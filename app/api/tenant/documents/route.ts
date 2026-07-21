import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyDocument } from "@/lib/classify";
import { getApplicant } from "@/lib/tenant";
import { cleanPersonName, samePerson } from "@/lib/people";

export const dynamic = "force-dynamic";
// Uploading + classifying several documents can take a while.
export const maxDuration = 60;

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const MAX_SIZE = 15 * 1024 * 1024; // 15 MB, keeps the AI call within limits

// Sent as the "person" field when the AI should figure out who each
// document belongs to.
const AUTO_PERSON = "__auto__";

// Uploads one or more documents for the signed-in applicant. Each file is
// stored in the private bucket, then classified by the AI (when configured).
// With person="__auto__", the AI also decides who each file belongs to.
export async function POST(request: Request) {
  const applicant = await getApplicant();
  if (!applicant) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter(
    (f): f is File => f instanceof File
  );

  const personField = String(form?.get("person") ?? "").trim();
  const autoAssign = personField === AUTO_PERSON;
  // Manual mode: which household member this batch belongs to. Empty
  // means the account holder (main applicant).
  const personName = autoAssign ? null : cleanPersonName(personField) || null;
  const roleRaw = String(form?.get("role") ?? "");
  const personRole =
    !autoAssign &&
    personName &&
    (roleRaw === "resident" || roleRaw === "supporter")
      ? roleRaw
      : null;

  if (files.length === 0) {
    return NextResponse.json({ error: "No files sent" }, { status: 400 });
  }
  for (const file of files) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `"${file.name}": only PDF, PNG, and JPEG are supported.` },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `"${file.name}" is too large (max 15 MB).` },
        { status: 400 }
      );
    }
  }

  const supabase = createAdminClient();

  // In automatic mode the AI matches against people already on the
  // application, so spellings stay consistent across batches.
  let knownPeople: string[] = [];
  if (autoAssign) {
    const { data: existing } = await supabase
      .from("documents")
      .select("person_name")
      .eq("applicant_id", applicant.id)
      .not("person_name", "is", null);
    knownPeople = Array.from(
      new Set((existing ?? []).map((r) => r.person_name as string))
    );
  }

  // Maps the AI's answer to: null (main applicant), an existing person's
  // exact name, or a brand-new person. knownPeople grows as the batch is
  // processed so every variant of a new name lands in one group.
  function resolvePerson(aiName: string | null): string | null {
    if (!aiName) return null;
    if (samePerson(aiName, applicant!.name)) return null;
    for (const p of knownPeople) {
      if (samePerson(aiName, p)) return p;
    }
    const cleaned = cleanPersonName(aiName);
    knownPeople.push(cleaned);
    return cleaned;
  }

  // Stage 1 (parallel): store the file and classify it.
  const staged = await Promise.all(
    files.map(async (file) => {
      const buffer = Buffer.from(await file.arrayBuffer());

      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `applicants/${applicant.id}/${crypto.randomUUID()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, buffer, { contentType: file.type });
      if (uploadError) {
        return {
          file: file.name,
          error: uploadError.message,
          filePath: "",
          mimeType: file.type,
          classification: null,
        };
      }

      const classification = await classifyDocument(
        buffer,
        file.type,
        file.name,
        autoAssign
          ? { applicantName: applicant!.name, knownPeople }
          : undefined
      );

      return {
        file: file.name,
        error: "",
        filePath,
        mimeType: file.type,
        classification,
      };
    })
  );

  // Stage 2 (serial): resolve who each document belongs to — serial so
  // that name variants inside the same batch resolve consistently.
  const results: { file: string; error?: string }[] = [];
  for (const item of staged) {
    if (item.error) {
      results.push({ file: item.file, error: item.error });
      continue;
    }

    const resolvedPerson = autoAssign
      ? resolvePerson(item.classification?.personName ?? null)
      : personName;
    const resolvedRole = autoAssign
      ? resolvedPerson
        ? (item.classification?.personRole ?? null)
        : null
      : personRole;

    const { error: insertError } = await supabase.from("documents").insert({
      applicant_id: applicant.id,
      name: item.classification?.title || item.file,
      file_path: item.filePath,
      mime_type: item.mimeType,
      doc_type: item.classification?.docType ?? null,
      person_name: resolvedPerson,
      person_role: resolvedRole,
    });

    if (insertError) {
      await supabase.storage.from("documents").remove([item.filePath]);
      results.push({ file: item.file, error: "could not be saved" });
      continue;
    }
    results.push({ file: item.file });
  }

  const failed = results.filter((r) => "error" in r && r.error);
  if (failed.length > 0) {
    return NextResponse.json(
      {
        error: `Some files failed: ${failed
          .map((f) => `${f.file} (${f.error})`)
          .join(", ")}`,
        uploaded: results.length - failed.length,
      },
      { status: failed.length === results.length ? 500 : 207 }
    );
  }

  return NextResponse.json({ ok: true, uploaded: results.length });
}

// Deletes one of the applicant's own documents.
export async function DELETE(request: Request) {
  const applicant = await getApplicant();
  if (!applicant) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const docId = String(body?.docId ?? "");
  if (!docId) {
    return NextResponse.json({ error: "Missing docId" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("id, file_path")
    .eq("id", docId)
    .eq("applicant_id", applicant.id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  await supabase.from("documents").delete().eq("id", doc.id);
  await supabase.storage.from("documents").remove([doc.file_path]);

  return NextResponse.json({ ok: true });
}
