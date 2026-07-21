import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveShareToken } from "@/lib/share";

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

  const fileUrl = `/share/${token}/file/${doc.id}`;
  const isPdf = doc.mime_type === "application/pdf";

  return (
    <main className="container">
      <div className="stack">
        <div className="spread">
          <h1>{doc.name}</h1>
          <Link href={`/share/${token}`} className="btn btn-secondary btn-small">
            ← All documents
          </Link>
        </div>

        {isPdf ? (
          <iframe src={fileUrl} className="viewer-frame" title={doc.name} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl} alt={doc.name} className="viewer-image" />
        )}

        <p className="muted">
          Having trouble viewing it?{" "}
          <a href={fileUrl} target="_blank" rel="noopener noreferrer">
            Open the file in a new tab
          </a>
          .
        </p>
      </div>
    </main>
  );
}
