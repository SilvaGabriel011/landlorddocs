import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApplicant } from "@/lib/tenant";
import Brand from "../../components/Brand";
import TenantDocumentManager from "./TenantDocumentManager";
import TenantSignOutButton from "./TenantSignOutButton";

export default async function TenantDocumentsPage() {
  const applicant = await getApplicant();
  if (!applicant) redirect("/tenant");

  const supabase = createAdminClient();
  const { data: documents } = await supabase
    .from("documents")
    .select("id, name, mime_type, doc_type, created_at")
    .eq("applicant_id", applicant.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <nav className="topnav">
        <div className="topnav-inner">
          <span className="brand">
            <Brand />
          </span>
          <div className="row">
            <span className="muted">{applicant.name}</span>
            <TenantSignOutButton />
          </div>
        </div>
      </nav>
      <main className="container">
        <div className="stack">
          <div>
            <h1>Your documents</h1>
            <p className="muted">
              Upload the documents for your rental application (PDF, PNG, or
              JPEG — several at once is fine). They are organized
              automatically and shared with the landlord.
            </p>
          </div>
          <TenantDocumentManager documents={documents ?? []} />
        </div>
      </main>
    </>
  );
}
