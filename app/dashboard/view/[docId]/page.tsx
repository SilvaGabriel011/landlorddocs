import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLandlord } from "@/lib/landlord";
import Viewer from "./Viewer";

export const dynamic = "force-dynamic";

export default async function DocumentViewPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  if (!(await isLandlord())) redirect("/login");

  const { docId } = await params;
  const supabase = createAdminClient();

  const { data: doc } = await supabase
    .from("documents")
    .select("id, name, mime_type, doc_type, person_name, applicant_id")
    .eq("id", docId)
    .maybeSingle();

  if (!doc) notFound();

  const { data: applicant } = await supabase
    .from("applicants")
    .select("id, name")
    .eq("id", doc.applicant_id)
    .maybeSingle();

  return (
    <div className="stack">
      <div className="no-print">
        <p className="muted">
          <Link href={`/dashboard/applicants/${doc.applicant_id}`}>
            ← {applicant?.name ?? "Applicant"}
          </Link>
        </p>
        <h1>{doc.name}</h1>
        <p className="muted">
          {doc.person_name ?? applicant?.name}
          {doc.doc_type ? ` · ${doc.doc_type}` : ""}
        </p>
      </div>
      <Viewer
        fileUrl={`/dashboard/file/${doc.id}?raw=1`}
        downloadUrl={`/dashboard/file/${doc.id}?download=1`}
        mimeType={doc.mime_type}
        name={doc.name}
      />
    </div>
  );
}
