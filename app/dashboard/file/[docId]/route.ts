import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLandlord } from "@/lib/landlord";

export const dynamic = "force-dynamic";

// Serves an applicant's file to the landlord.
// - ?download=1  redirects to a signed URL that forces a download
// - ?raw=1       streams the bytes same-origin (used by the viewer page,
//                so its Print button can print the embedded PDF)
// - default      redirects to a short-lived signed URL
export async function GET(
  request: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  if (!(await isLandlord())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { docId } = await params;
  const supabase = createAdminClient();

  const { data: doc } = await supabase
    .from("documents")
    .select("id, name, file_path, mime_type")
    .eq("id", docId)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const isDownload = url.searchParams.get("download") === "1";
  const isRaw = url.searchParams.get("raw") === "1";

  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.file_path, 300, isDownload ? { download: true } : {});

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "Could not open the file" },
      { status: 500 }
    );
  }

  if (!isRaw) {
    return NextResponse.redirect(data.signedUrl, 307);
  }

  const upstream = await fetch(data.signedUrl);
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: "Could not open the file" },
      { status: 500 }
    );
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": doc.mime_type,
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=300",
    },
  });
}
