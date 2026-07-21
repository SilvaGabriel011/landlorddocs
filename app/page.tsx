import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getApplicant } from "@/lib/tenant";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const applicant = await getApplicant();
  if (applicant) redirect("/tenant/documents");

  return (
    <main className="center-page">
      <div className="stack" style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ textAlign: "center" }}>
          <h1>LandlordDocs</h1>
          <p className="muted">Rental application documents, in one place.</p>
        </div>
        <Link href="/tenant" className="doc-link">
          I&apos;m applying to rent
          <div className="muted" style={{ fontWeight: 400 }}>
            Create an account and upload your documents.
          </div>
        </Link>
        <Link href="/login" className="doc-link">
          I&apos;m the landlord
          <div className="muted" style={{ fontWeight: 400 }}>
            Sign in to review each applicant&apos;s documents.
          </div>
        </Link>
      </div>
    </main>
  );
}
