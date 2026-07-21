import { redirect } from "next/navigation";
import { getApplicant } from "@/lib/tenant";
import TenantAuthForm from "./TenantAuthForm";

export default async function TenantPage() {
  const applicant = await getApplicant();
  if (applicant) redirect("/tenant/documents");

  return (
    <main className="center-page">
      <TenantAuthForm />
    </main>
  );
}
