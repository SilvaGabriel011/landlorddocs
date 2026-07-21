import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACCEPTED_MIME, resolveInviteToken } from "@/lib/invite";

export const dynamic = "force-dynamic";

// Step 2 of an invited upload: after the browser has uploaded the file to
// the signed URL, register it as a document. Replaces any earlier upload
// for the same requested document.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json().catch(() => null);
  const requestedDocId: string | undefined = body?.requestedDocId;
  const path: string | undefined = body?.path;
  const mimeType: string | undefined = body?.mimeType;

  if (!requestedDocId || !path || !mimeType) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const invite = await resolveInviteToken(token);
  if (invite.status !== "active") {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  const requested = invite.requested.find((r) => r.id === requestedDocId);
  if (!requested) {
    return NextResponse.json(
      { error: "This document is not part of the invite" },
      { status: 404 }
    );
  }

  if (!ACCEPTED_MIME[requested.accepted_type].includes(mimeType)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  // The path must be one this invite's /start endpoint could have issued.
  const expectedPrefix = `${invite.ownerId}/invited/${invite.inviteId}/${requestedDocId}-`;
  if (!path.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Confirm the file really was uploaded.
  const dir = path.substring(0, path.lastIndexOf("/"));
  const fileName = path.substring(path.lastIndexOf("/") + 1);
  const { data: found } = await supabase.storage
    .from("documents")
    .list(dir, { search: fileName });
  if (!found?.some((f) => f.name === fileName)) {
    return NextResponse.json(
      { error: "The uploaded file was not found" },
      { status: 400 }
    );
  }

  // Replace any earlier upload for this requested document.
  const { data: existing } = await supabase
    .from("documents")
    .select("id, file_path")
    .eq("requested_doc_id", requestedDocId);

  const { error: insertError } = await supabase.from("documents").insert({
    owner_id: invite.ownerId,
    name: requested.name,
    file_path: path,
    mime_type: mimeType,
    person_name: invite.personName,
    invite_id: invite.inviteId,
    requested_doc_id: requestedDocId,
  });

  if (insertError) {
    await supabase.storage.from("documents").remove([path]);
    return NextResponse.json(
      { error: "Could not save the document" },
      { status: 500 }
    );
  }

  if (existing && existing.length > 0) {
    await supabase
      .from("documents")
      .delete()
      .in(
        "id",
        existing.map((d) => d.id)
      );
    await supabase.storage
      .from("documents")
      .remove(existing.map((d) => d.file_path));
  }

  return NextResponse.json({ ok: true });
}
