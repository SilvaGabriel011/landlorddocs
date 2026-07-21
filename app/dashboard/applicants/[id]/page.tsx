import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ApplicantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: applicant } = await supabase
    .from("applicants")
    .select("id, name, email, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!applicant) notFound();

  const { data: documents } = await supabase
    .from("documents")
    .select("id, name, mime_type, doc_type, created_at")
    .eq("applicant_id", id)
    .order("created_at", { ascending: false });

  const docs = documents ?? [];

  return (
    <div className="stack">
      <div>
        <p className="muted">
          <Link href="/dashboard">← All applicants</Link>
        </p>
        <h1>{applicant.name}</h1>
        <p className="muted">
          {applicant.email} · registered{" "}
          {new Date(applicant.created_at).toLocaleDateString()}
        </p>
      </div>

      <h2>
        Documents ({docs.length})
      </h2>
      {docs.length === 0 ? (
        <p className="muted">This applicant hasn&apos;t uploaded anything yet.</p>
      ) : (
        <ul className="item-list">
          {docs.map((doc) => (
            <li key={doc.id} className="item">
              <div>
                <div className="item-title">{doc.name}</div>
                <div className="muted">
                  {doc.doc_type ?? "Uncategorized"} ·{" "}
                  {doc.mime_type === "application/pdf" ? "PDF" : "Image"} ·
                  added {new Date(doc.created_at).toLocaleDateString()}
                </div>
              </div>
              <div className="row">
                <a
                  className="btn btn-secondary btn-small"
                  href={`/dashboard/file/${doc.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View
                </a>
                <a
                  className="btn btn-secondary btn-small"
                  href={`/dashboard/file/${doc.id}?download=1`}
                >
                  Download
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
