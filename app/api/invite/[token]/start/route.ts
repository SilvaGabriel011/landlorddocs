import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACCEPTED_MIME, resolveInviteToken } from "@/lib/invite";

export const dynamic = "force-dynamic";

// Step 1 of an invited upload: validate the invite and the file type,
// then hand the browser a one-time signed URL so it can upload the file
// straight to the private storage bucket (no account needed, and no
// request-size limits on the app server).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json().catch(() => null);
  const requestedDocId: string | undefined = body?.requestedDocId;
  const fileName: string | undefined = body?.fileName;
  const mimeType: string | undefined = body?.mimeType;

  if (!requestedDocId || !fileName || !mimeType) {
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
    return NextResponse.json(
      {
        error:
          requested.accepted_type === "pdf"
            ? "This document must be a PDF."
            : requested.accepted_type === "image"
              ? "This document must be a PNG or JPEG image."
              : "Only PDF, PNG, and JPEG files are supported.",
      },
      { status: 400 }
    );
  }

  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
  const path = `${invite.ownerId}/invited/${invite.inviteId}/${requestedDocId}-${crypto.randomUUID()}-${safeFileName}`;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { error: "Could not prepare the upload" },
      { status: 500 }
    );
  }

  return NextResponse.json({ path: data.path, uploadToken: data.token });
}
