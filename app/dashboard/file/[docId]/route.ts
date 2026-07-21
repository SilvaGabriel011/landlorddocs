import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Lets the signed-in landlord open any applicant's file: checks the auth
// session, then redirects to a short-lived signed URL for the private
// storage object.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { docId } = await params;

  // RLS allows authenticated users (landlords) to read documents.
  const { data: doc } = await supabase
    .from("documents")
    .select("id, file_path")
    .eq("id", docId)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const isDownload =
    new URL(request.url).searchParams.get("download") === "1";

  const admin = createAdminClient();
  const { data, error } = await admin.storage
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
