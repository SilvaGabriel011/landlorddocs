import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLandlord } from "@/lib/landlord";

export const dynamic = "force-dynamic";

// Serves an applicant's inspection photo/video to the landlord.
// - ?download=1  redirects to a signed URL that forces a download
// - default      redirects to a short-lived signed URL
// <img> and <video> follow the redirect transparently, and Range
// requests (video seeking) go straight to the signed URL, so no
// same-origin proxying is needed.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ mediaId: string }> }
) {
  if (!(await isLandlord())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { mediaId } = await params;
  const supabase = createAdminClient();

  const { data: media } = await supabase
    .from("inspection_media")
    .select("id, file_path")
    .eq("id", mediaId)
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
