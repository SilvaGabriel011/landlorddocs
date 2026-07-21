import { redirect } from "next/navigation";
import { isLandlord, landlordCode } from "@/lib/landlord";
import LandlordCodeForm from "./LandlordCodeForm";

// LANDLORD_CODE is read at request time, so this page can never be
// prerendered (a build without the env var would bake in the redirect).
export const dynamic = "force-dynamic";

// The landlord has no account: with no LANDLORD_CODE configured this page
// just forwards to the dashboard; with one, it asks for the code once.
export default async function LoginPage() {
  if (!landlordCode() || (await isLandlord())) redirect("/dashboard");

  return (
    <main className="center-page">
      <LandlordCodeForm />
    </main>
  );
}
