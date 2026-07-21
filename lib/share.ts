import { createAdminClient } from "@/lib/supabase/admin";

export type SharedDocument = {
  id: string;
  name: string;
  file_path: string;
  mime_type: string;
  person_name: string | null;
};

export type ResolvedShare =
  | { status: "not_found" }
  | { status: "expired"; label: string }
  | {
      status: "active";
      linkId: string;
      label: string;
      expiresAt: string;
      documents: SharedDocument[];
    };

export type ShareAction = "link_opened" | "viewed" | "downloaded" | "printed";

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
      "id, label, expires_at, share_link_documents(documents(id, name, file_path, mime_type, person_name))"
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
    linkId: link.id,
    label: link.label,
    expiresAt: link.expires_at,
    documents,
  };
}

// Records what a landlord did with a link. Uses the service role client;
// browsers never write to share_activity directly.
export async function logShareActivity(
  linkId: string,
  action: ShareAction,
  doc?: { id: string; name: string }
) {
  const supabase = createAdminClient();
  await supabase.from("share_activity").insert({
    share_link_id: linkId,
    action,
    document_id: doc?.id ?? null,
    document_name: doc?.name ?? null,
  });
}

// Groups shared documents by the person they belong to, with the
// account owner ("Main applicant") always listed first.
export function groupByPerson(documents: SharedDocument[]) {
  const groups = new Map<string, SharedDocument[]>();
  for (const doc of documents) {
    const key = doc.person_name ?? "";
    const list = groups.get(key) ?? [];
    list.push(doc);
    groups.set(key, list);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)))
    .map(([person, docs]) => ({
      person: person === "" ? "Main applicant" : person,
      docs,
    }));
}
