import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyDocument } from "@/lib/classify";
import { getApplicant } from "@/lib/tenant";

export const dynamic = "force-dynamic";
// Uploading + classifying several documents can take a while.
export const maxDuration = 60;

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];
const MAX_SIZE = 15 * 1024 * 1024; // 15 MB, keeps the AI call within limits

// Uploads one or more documents for the signed-in applicant. Each file is
// stored in the private bucket, then classified by the AI (when configured)
// so the landlord sees a category summary.
export async function POST(request: Request) {
  const applicant = await getApplicant();
  if (!applicant) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter(
    (f): f is File => f instanceof File
  );

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

  const results = await Promise.all(
    files.map(async (file) => {
      const buffer = Buffer.from(await file.arrayBuffer());

      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `applicants/${applicant.id}/${crypto.randomUUID()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, buffer, { contentType: file.type });
      if (uploadError) {
        return { file: file.name, error: uploadError.message };
      }

      const classification = await classifyDocument(
        buffer,
        file.type,
        file.name
      );

      const { error: insertError } = await supabase.from("documents").insert({
        applicant_id: applicant.id,
        name: classification?.title || file.name,
        file_path: filePath,
        mime_type: file.type,
        doc_type: classification?.docType ?? null,
      });

      if (insertError) {
        await supabase.storage.from("documents").remove([filePath]);
        return { file: file.name, error: "could not be saved" };
      }
      return { file: file.name };
    })
  );

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
