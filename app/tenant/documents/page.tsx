import Link from "next/link";
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
    .select("id, name, mime_type, doc_type, person_name, person_role, created_at")
    .eq("applicant_id", applicant.id)
    .order("created_at", { ascending: false });

  const { data: contacts } = await supabase
    .from("application_people")
    .select("person_name, email, phone")
    .eq("applicant_id", applicant.id);

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
              JPEG — several at once is fine). You can also add documents for
              the people applying with you (spouse, guarantor…). Everything is
              organized automatically and shared with the landlord.
            </p>
          </div>
          <Link href="/tenant/inspections" className="doc-link">
            Inspection — property condition
            <div className="muted" style={{ fontWeight: 400 }}>
              Add photos and videos of the house before you move in. Photos
              are labeled by room automatically.
            </div>
          </Link>
          <TenantDocumentManager
            applicantName={applicant.name}
            selfContact={{ email: applicant.email, phone: applicant.phone }}
            contacts={contacts ?? []}
            documents={documents ?? []}
          />
        </div>
      </main>
    </>
  );
}
