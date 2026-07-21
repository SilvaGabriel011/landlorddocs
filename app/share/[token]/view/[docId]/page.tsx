import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { logShareActivity, resolveShareToken } from "@/lib/share";
import ViewerTools from "./ViewerTools";

export const dynamic = "force-dynamic";

export default async function DocumentViewPage({
  params,
}: {
  params: Promise<{ token: string; docId: string }>;
}) {
  const { token, docId } = await params;
  const share = await resolveShareToken(token);

  if (share.status === "not_found") notFound();
  if (share.status === "expired") redirect(`/share/${token}`);

  const doc = share.documents.find((d) => d.id === docId);
  if (!doc) notFound();

  await logShareActivity(share.linkId, "viewed", doc);

  const fileUrl = `/share/${token}/file/${doc.id}`;
  const isPdf = doc.mime_type === "application/pdf";

  return (
    <main className="container">
      <div className="stack">
        <div className="spread">
          <div>
            <h1>{doc.name}</h1>
            {doc.person_name && <p className="muted">From {doc.person_name}</p>}
          </div>
          <div className="row">
            <ViewerTools token={token} docId={doc.id} fileUrl={fileUrl} />
            <Link
              href={`/share/${token}`}
              className="btn btn-secondary btn-small"
            >
              ← All documents
            </Link>
          </div>
        </div>

        {isPdf ? (
          <iframe src={fileUrl} className="viewer-frame" title={doc.name} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl} alt={doc.name} className="viewer-image" />
        )}
      </div>
    </main>
  );
}
