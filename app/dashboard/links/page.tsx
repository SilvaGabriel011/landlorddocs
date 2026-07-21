import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LinkManager from "./LinkManager";

export default async function LinksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: documents }, { data: links }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, name")
      .order("created_at", { ascending: false }),
    supabase
      .from("share_links")
      .select(
        "id, token, label, expires_at, created_at, share_link_documents(document_id)"
      )
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="stack">
      <div>
        <h1>Share links</h1>
        <p className="muted">
          Create a link for each landlord, choose which documents it includes
          and how long it stays valid, then send them the link.
        </p>
      </div>
      <LinkManager
        userId={user.id}
        documents={documents ?? []}
        links={(links ?? []).map((l) => ({
          id: l.id,
          token: l.token,
          label: l.label,
          expires_at: l.expires_at,
          created_at: l.created_at,
          document_count: l.share_link_documents?.length ?? 0,
        }))}
      />
    </div>
  );
}
