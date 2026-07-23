import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApplicant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Lets a signed-in applicant open one of their OWN inspection
// photos/videos: checks the session cookie, then redirects to a
// short-lived signed URL. <img> and <video> follow the redirect
// transparently, and Range requests (video seeking) go straight to
// the signed URL, so no same-origin proxying is needed.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  const applicant = await getApplicant();
  if (!applicant) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { mediaId } = await params;
  const supabase = createAdminClient();

  const { data: media } = await supabase
    .from("inspection_media")
    .select("id, file_path")
    .eq("id", mediaId)
    .eq("applicant_id", applicant.id)
    .maybeSingle();

  if (!media) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const isDownload =
    new URL(request.url).searchParams.get("download") === "1";
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(media.file_path, 300, isDownload ? { download: true } : {});

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "Could not open the file" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(data.signedUrl, 307);
}
