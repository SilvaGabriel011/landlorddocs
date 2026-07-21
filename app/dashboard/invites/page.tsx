import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InviteManager from "./InviteManager";

export default async function InvitesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: invites } = await supabase
    .from("upload_invites")
    .select(
      "id, token, person_name, created_at, invite_requested_documents(id, name, accepted_type, created_at, documents(id))"
    )
    .order("created_at", { ascending: false });

  return (
    <div className="stack">
      <div>
        <h1>Invites</h1>
        <p className="muted">
          Invite another person (a partner, roommate, guarantor…) to upload
          documents. You decide which documents they must send, with the name
          and file type of each one. Their documents can then be included in
          your share links.
        </p>
      </div>
      <InviteManager
        userId={user.id}
        invites={(invites ?? []).map((inv) => ({
          id: inv.id,
          token: inv.token,
          person_name: inv.person_name,
          requested: (inv.invite_requested_documents ?? [])
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((r) => ({
              id: r.id,
              name: r.name,
              accepted_type: r.accepted_type as "pdf" | "image" | "any",
              uploaded: Array.isArray(r.documents)
                ? r.documents.length > 0
                : r.documents != null,
            })),
        }))}
      />
    </div>
  );
}
