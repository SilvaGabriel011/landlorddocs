import Link from "next/link";
import { resolveShareToken } from "@/lib/share";

export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const share = await resolveShareToken(token);

  if (share.status === "not_found") {
    return (
      <main className="center-page">
        <div className="card stack" style={{ maxWidth: 440 }}>
          <h1>Link not found</h1>
          <p className="muted">
            This document link does not exist. Please check the address or ask
            for a new link.
          </p>
        </div>
      </main>
    );
  }

  if (share.status === "expired") {
    return (
      <main className="center-page">
        <div className="card stack" style={{ maxWidth: 440 }}>
          <h1>This link has expired</h1>
          <p className="muted">
            Access to these documents is no longer available. Please ask for a
            new link.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="stack">
        <div>
          <h1>Shared documents</h1>
          <p className="muted">
            Click a document to view it. This link is available until{" "}
            {new Date(share.expiresAt).toLocaleString()}.
          </p>
        </div>

        {share.documents.length === 0 ? (
          <p className="muted">No documents are attached to this link.</p>
        ) : (
          <ul className="item-list">
            {share.documents.map((doc) => (
              <li key={doc.id}>
                <Link
                  href={`/share/${token}/view/${doc.id}`}
                  className="doc-link"
                >
                  <span className="spread">
                    <span>{doc.name}</span>
                    <span className="muted">
                      {doc.mime_type === "application/pdf" ? "PDF" : "Image"} →
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
