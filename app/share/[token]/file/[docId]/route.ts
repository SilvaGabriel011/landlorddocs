import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveShareToken } from "@/lib/share";

export const dynamic = "force-dynamic";

// Streams no file itself: validates the share token, then redirects to a
// short-lived signed URL for the private storage object. If the link has
// expired (or was deleted), the landlord gets a 403/404 instead of the file.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; docId: string }> }
) {
  const { token, docId } = await params;
  const share = await resolveShareToken(token);

  if (share.status === "not_found") {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }
  if (share.status === "expired") {
    return NextResponse.json({ error: "Link expired" }, { status: 403 });
  }

  const doc = share.documents.find((d) => d.id === docId);
  if (!doc) {
    return NextResponse.json(
      { error: "Document not found in this link" },
      { status: 404 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.file_path, 300);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "Could not open the file" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(data.signedUrl, 307);
}
