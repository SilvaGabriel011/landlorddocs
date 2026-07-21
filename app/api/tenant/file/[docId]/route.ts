import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApplicant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Lets a signed-in applicant open one of their OWN files: checks the
// session cookie, then redirects to a short-lived signed URL.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const applicant = await getApplicant();
  if (!applicant) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { docId } = await params;
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

  const isDownload =
    new URL(request.url).searchParams.get("download") === "1";
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.file_path, 300, isDownload ? { download: true } : {});

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "Could not open the file" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(data.signedUrl, 307);
}
