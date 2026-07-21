import Link from "next/link";
import { groupByPerson, logShareActivity, resolveShareToken } from "@/lib/share";

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

  await logShareActivity(share.linkId, "link_opened");

  const groups = groupByPerson(share.documents);

  return (
    <main className="container">
      <div className="stack">
        <div>
          <h1>Shared documents</h1>
          <p className="muted">
            This application includes {groups.length}{" "}
            {groups.length === 1 ? "person" : "people"}
            {groups.length > 1 &&
              `: ${groups.map((g) => g.person).join(", ")}`}
            . Click a document to view it. This link is available until{" "}
            {new Date(share.expiresAt).toLocaleString()}.
          </p>
        </div>

        {share.documents.length === 0 ? (
          <p className="muted">No documents are attached to this link.</p>
        ) : (
          groups.map((group) => (
            <div key={group.person} className="stack" style={{ gap: 10 }}>
              <h2>
                {group.person}{" "}
                <span className="muted">
                  ({group.docs.length} document
                  {group.docs.length === 1 ? "" : "s"})
                </span>
              </h2>
              <ul className="item-list">
                {group.docs.map((doc) => (
                  <li key={doc.id}>
                    <Link
                      href={`/share/${token}/view/${doc.id}`}
                      className="doc-link"
                    >
                      <span className="spread">
                        <span>{doc.name}</span>
                        <span className="muted">
                          {doc.mime_type === "application/pdf"
                            ? "PDF"
                            : "Image"}{" "}
                          →
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
