import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Doc = {
  id: string;
  name: string;
  mime_type: string;
  doc_type: string | null;
  person_name: string | null;
  created_at: string;
};

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
    .select("id, name, mime_type, doc_type, person_name, created_at")
    .eq("applicant_id", id)
    .order("created_at", { ascending: false });

  const docs = (documents ?? []) as Doc[];

  // Group by person on the application, the main applicant first.
  const byPerson = new Map<string, Doc[]>();
  for (const doc of docs) {
    const key = doc.person_name ?? "";
    const list = byPerson.get(key) ?? [];
    list.push(doc);
    byPerson.set(key, list);
  }
  const groups = Array.from(byPerson.entries())
    .sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)))
    .map(([person, personDocs]) => ({
      label:
        person === "" ? `${applicant.name} (main applicant)` : person,
      docs: personDocs,
    }));

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

      <h2>Documents ({docs.length})</h2>
      {docs.length === 0 ? (
        <p className="muted">This applicant hasn&apos;t uploaded anything yet.</p>
      ) : (
        groups.map((group) => (
          <div key={group.label} className="stack">
            <h2 style={{ fontSize: "1rem" }}>
              {group.label} ({group.docs.length})
            </h2>
            <ul className="item-list">
              {group.docs.map((doc) => (
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
          </div>
        ))
      )}
    </div>
  );
}
