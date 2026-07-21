import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DocumentManager from "./DocumentManager";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: documents } = await supabase
    .from("documents")
    .select("id, name, file_path, mime_type, person_name, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="stack">
      <div>
        <h1>Your documents</h1>
        <p className="muted">
          Upload the PDFs and images you want to share with landlords, then
          create a share link on the{" "}
          <a href="/dashboard/links">Share links</a> page.
        </p>
      </div>
      <DocumentManager userId={user.id} documents={documents ?? []} />
    </div>
  );
}
