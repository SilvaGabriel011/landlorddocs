import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApplicant } from "@/lib/tenant";
import Brand from "../../components/Brand";
import InspectionManager from "./InspectionManager";
import TenantSignOutButton from "../documents/TenantSignOutButton";

export const dynamic = "force-dynamic";

export default async function TenantInspectionsPage() {
  const applicant = await getApplicant();
  if (!applicant) redirect("/tenant");

  const supabase = createAdminClient();
  const { data: media } = await supabase
    .from("inspection_media")
    .select("id, name, room, mime_type, created_at")
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
            <p className="muted">
              <Link href="/tenant/documents">← Your documents</Link>
            </p>
            <h1>Property condition — before you move in</h1>
            <p className="muted">
              Add photos and videos of the house as you found it. Photos are
              labeled with the room they show automatically; for videos, pick
              the room yourself. The landlord sees everything you add here.
            </p>
          </div>
          <InspectionManager media={media ?? []} />
        </div>
      </main>
    </>
  );
}
