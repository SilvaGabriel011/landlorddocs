import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLandlord } from "@/lib/landlord";

export const dynamic = "force-dynamic";

export default async function InspectionMediaViewPage({
  params,
}: {
  params: Promise<{ mediaId: string }>;
}) {
  if (!(await isLandlord())) redirect("/login");

  const { mediaId } = await params;
  const supabase = createAdminClient();

  const { data: media } = await supabase
    .from("inspection_media")
    .select("id, name, room, mime_type, created_at, applicant_id")
    .eq("id", mediaId)
    .maybeSingle();

  if (!media) notFound();

  const { data: applicant } = await supabase
    .from("applicants")
    .select("id, name")
    .eq("id", media.applicant_id)
    .maybeSingle();

  const isVideo = media.mime_type.startsWith("video/");
  const fileUrl = `/dashboard/inspection-file/${media.id}`;

  return (
    <div className="stack">
      <div>
        <p className="muted">
          <Link href="/dashboard/inspections">← Inspections prior living</Link>
        </p>
        <h1>{media.name}</h1>
        <p className="muted">
          {applicant?.name ?? "Applicant"} · {media.room ?? "Unlabeled"} ·{" "}
          {new Date(media.created_at).toLocaleDateString()}
        </p>
      </div>
      <div className="row">
        <a className="btn btn-secondary btn-small" href={`${fileUrl}?download=1`}>
          Download
        </a>
      </div>
      {isVideo ? (
        <video className="viewer-video" src={fileUrl} controls />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="viewer-image" src={fileUrl} alt={media.name} />
      )}
    </div>
  );
}
