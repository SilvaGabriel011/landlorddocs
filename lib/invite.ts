import { createAdminClient } from "@/lib/supabase/admin";

export type RequestedDoc = {
  id: string;
  name: string;
  accepted_type: "pdf" | "image" | "any";
  uploaded: boolean;
};

export type ResolvedInvite =
  | { status: "not_found" }
  | {
      status: "active";
      inviteId: string;
      ownerId: string;
      personName: string;
      requested: RequestedDoc[];
    };

export const ACCEPTED_MIME: Record<string, string[]> = {
  pdf: ["application/pdf"],
  image: ["image/png", "image/jpeg"],
  any: ["application/pdf", "image/png", "image/jpeg"],
};

// Looks up an invite token for an invited person (who has no account).
export async function resolveInviteToken(
  token: string
): Promise<ResolvedInvite> {
  if (!/^[a-f0-9]{16,64}$/.test(token)) {
    return { status: "not_found" };
  }

  const supabase = createAdminClient();

  const { data: invite } = await supabase
    .from("upload_invites")
    .select(
      "id, owner_id, person_name, invite_requested_documents(id, name, accepted_type, created_at, documents(id))"
    )
    .eq("token", token)
    .maybeSingle();

  if (!invite) return { status: "not_found" };

  type Row = {
    id: string;
    name: string;
    accepted_type: "pdf" | "image" | "any";
    created_at: string;
    documents: { id: string }[] | { id: string } | null;
  };

  const requested = ((invite.invite_requested_documents ?? []) as Row[])
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((row) => ({
      id: row.id,
      name: row.name,
      accepted_type: row.accepted_type,
      uploaded: Array.isArray(row.documents)
        ? row.documents.length > 0
        : row.documents != null,
    }));

  return {
    status: "active",
    inviteId: invite.id,
    ownerId: invite.owner_id,
    personName: invite.person_name,
    requested,
  };
}
