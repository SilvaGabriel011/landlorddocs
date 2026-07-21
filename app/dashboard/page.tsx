import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLandlord } from "@/lib/landlord";

export const dynamic = "force-dynamic";

type DocRow = {
  doc_type: string | null;
  person_name: string | null;
  person_role: string | null;
};

type ApplicantRow = {
  id: string;
  name: string;
  email: string;
  created_at: string;
  documents: DocRow[];
};

function roleLabel(role: string | null): string | null {
  if (role === "resident") return "moving in";
  if (role === "supporter") return "supporter";
  return null;
}

// "Pay stub × 2 · Bank statement × 1" for one person's documents.
function typeSummary(documents: DocRow[]): string {
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

// One summary line per person on the application, main applicant first.
function personSummaries(applicant: ApplicantRow): string[] {
  const byPerson = new Map<string, DocRow[]>();
  for (const doc of applicant.documents) {
    const key = doc.person_name ?? "";
    const list = byPerson.get(key) ?? [];
    list.push(doc);
    byPerson.set(key, list);
  }
  return Array.from(byPerson.entries())
    .sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)))
    .map(([person, docs]) => {
      const role = roleLabel(
        docs.find((d) => d.person_role)?.person_role ?? null
      );
      const who =
        person === "" ? applicant.name : role ? `${person} (${role})` : person;
      return `${who}: ${typeSummary(docs)}`;
    });
}

export default async function DashboardPage() {
  if (!(await isLandlord())) redirect("/login");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("applicants")
    .select(
      "id, name, email, created_at, documents(doc_type, person_name, person_role)"
    )
    .order("created_at", { ascending: false });

  const applicants = (data ?? []) as ApplicantRow[];

  return (
    <div className="stack">
      <div>
        <h1>Applications</h1>
        <p className="muted">
          Everyone who registered to send you documents — alone or with the
          people applying with them. Tap a name to see the files.
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
          {applicants.map((applicant) => {
            const people = new Set(
              applicant.documents.map((d) => d.person_name ?? "")
            ).size;
            return (
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
                      {people > 1 ? ` · ${people} people` : ""}
                    </span>
                  </div>
                  <div className="muted" style={{ fontWeight: 400 }}>
                    {applicant.email} · registered{" "}
                    {new Date(applicant.created_at).toLocaleDateString()}
                  </div>
                  {personSummaries(applicant).map((line) => (
                    <div
                      key={line}
                      className="muted"
                      style={{ fontWeight: 400 }}
                    >
                      {line}
                    </div>
                  ))}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
