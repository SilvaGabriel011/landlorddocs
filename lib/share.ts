import { createAdminClient } from "@/lib/supabase/admin";

export type SharedDocument = {
  id: string;
  name: string;
  file_path: string;
  mime_type: string;
};

export type ResolvedShare =
  | { status: "not_found" }
  | { status: "expired"; label: string }
  | {
      status: "active";
      label: string;
      expiresAt: string;
      documents: SharedDocument[];
    };

// Looks up a share token for a landlord (who has no account). Uses the
// service role client because these tables are locked down by RLS.
export async function resolveShareToken(token: string): Promise<ResolvedShare> {
  if (!/^[a-f0-9]{16,64}$/.test(token)) {
    return { status: "not_found" };
  }

  const supabase = createAdminClient();

  const { data: link } = await supabase
    .from("share_links")
    .select(
      "id, label, expires_at, share_link_documents(documents(id, name, file_path, mime_type))"
    )
    .eq("token", token)
    .maybeSingle();

  if (!link) return { status: "not_found" };

  if (new Date(link.expires_at).getTime() <= Date.now()) {
    return { status: "expired", label: link.label };
  }

  const documents = (link.share_link_documents ?? [])
    .map((row: { documents: SharedDocument | SharedDocument[] | null }) =>
      Array.isArray(row.documents) ? row.documents[0] : row.documents
    )
    .filter((d): d is SharedDocument => d != null)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    status: "active",
    label: link.label,
    expiresAt: link.expires_at,
    documents,
  };
}
