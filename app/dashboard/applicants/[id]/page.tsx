import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLandlord } from "@/lib/landlord";
import CopyButton from "./CopyButton";

export const dynamic = "force-dynamic";

type Doc = {
  id: string;
  name: string;
  mime_type: string;
  doc_type: string | null;
  person_name: string | null;
  person_role: string | null;
  created_at: string;
};

function roleLabel(role: string | null): string | null {
  if (role === "resident") return "moving in";
  if (role === "supporter") return "supporter (guarantor / co-signer)";
  return null;
}

export default async function ApplicantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isLandlord())) redirect("/login");

  const { id } = await params;
  const supabase = createAdminClient();

  const { data: applicant } = await supabase
    .from("applicants")
    .select("id, name, email, phone, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!applicant) notFound();

  const { data: documents } = await supabase
    .from("documents")
    .select("id, name, mime_type, doc_type, person_name, person_role, created_at")
    .eq("applicant_id", id)
    .order("created_at", { ascending: false });

  const docs = (documents ?? []) as Doc[];

  const { data: contactRows } = await supabase
    .from("application_people")
    .select("person_name, email, phone")
    .eq("applicant_id", id);
  const contacts = new Map(
    (contactRows ?? []).map((c) => [
      c.person_name as string,
      { email: c.email as string | null, phone: c.phone as string | null },
    ])
  );

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
    .map(([person, personDocs]) => {
      const role = roleLabel(
        personDocs.find((d) => d.person_role)?.person_role ?? null
      );
      const label =
        person === ""
          ? `${applicant.name} (main applicant)`
          : role
            ? `${person} — ${role}`
            : person;
      const contact =
        person === ""
          ? { email: applicant.email, phone: applicant.phone }
          : (contacts.get(person) ?? { email: null, phone: null });
      return { label, docs: personDocs, contact };
    });

  return (
    <div className="stack">
      <div>
        <p className="muted">
          <Link href="/dashboard">← All applications</Link>
        </p>
        <h1>{applicant.name}</h1>
        <p className="muted">
          <a href={`mailto:${applicant.email}`}>{applicant.email}</a> ·
          registered {new Date(applicant.created_at).toLocaleDateString()}
          {groups.length > 1
            ? ` · ${groups.length} people on this application`
            : " · applying alone"}
        </p>
      </div>

      <h2>Documents ({docs.length})</h2>
      {docs.length === 0 ? (
        <p className="muted">This applicant hasn&apos;t uploaded anything yet.</p>
      ) : (
        groups.map((group) => (
          <div key={group.label} className="stack">
            <div className="spread">
              <h2 style={{ fontSize: "1rem" }}>
                {group.label} ({group.docs.length})
              </h2>
              {(group.contact.email || group.contact.phone) && (
                <span className="row" style={{ gap: 8 }}>
                  {group.contact.email && (
                    <a
                      className="muted"
                      href={`mailto:${group.contact.email}`}
                    >
                      {group.contact.email}
                    </a>
                  )}
                  {group.contact.phone && (
                    <>
                      <span className="muted">{group.contact.phone}</span>
                      <CopyButton text={group.contact.phone} />
                    </>
                  )}
                </span>
              )}
            </div>
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
                    <Link
                      className="btn btn-secondary btn-small"
                      href={`/dashboard/view/${doc.id}`}
                    >
                      View
                    </Link>
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
