import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ApplicantRow = {
  id: string;
  name: string;
  email: string;
  created_at: string;
  documents: { doc_type: string | null }[];
};

// Turns a person's documents into a "Pay stub × 2 · Bank statement × 1"
// summary line.
function summarize(documents: { doc_type: string | null }[]): string {
  const counts = new Map<string, number>();
  for (const doc of documents) {
    const type = doc.doc_type ?? "Uncategorized";
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => `${type} × ${count}`)
    .join(" · ");
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase
    .from("applicants")
    .select("id, name, email, created_at, documents(doc_type)")
    .order("created_at", { ascending: false });

  const applicants = (data ?? []) as ApplicantRow[];

  return (
    <div className="stack">
      <div>
        <h1>Applicants</h1>
        <p className="muted">
          Everyone who registered to send you documents. Click a name to see
          their files.
        </p>
      </div>

      {applicants.length === 0 ? (
        <p className="muted">
          Nobody has registered yet. Send applicants to your app&apos;s home
          page — they create an account with their name, email, and a 4-digit
          PIN, then upload their documents.
        </p>
      ) : (
        <ul className="item-list">
          {applicants.map((applicant) => (
            <li key={applicant.id}>
              <Link
                href={`/dashboard/applicants/${applicant.id}`}
                className="doc-link"
              >
                <div className="spread">
                  <span>{applicant.name}</span>
                  <span className="badge badge-active">
                    {applicant.documents.length} document
                    {applicant.documents.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="muted" style={{ fontWeight: 400 }}>
                  {applicant.email} · registered{" "}
                  {new Date(applicant.created_at).toLocaleDateString()}
                </div>
                {applicant.documents.length > 0 && (
                  <div className="muted" style={{ fontWeight: 400 }}>
                    {summarize(applicant.documents)}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
