"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type AcceptedType = "pdf" | "image" | "any";

type RequestedRow = { name: string; accepted_type: AcceptedType };

type Invite = {
  id: string;
  token: string;
  person_name: string;
  requested: {
    id: string;
    name: string;
    accepted_type: AcceptedType;
    uploaded: boolean;
  }[];
};

const TYPE_LABEL: Record<AcceptedType, string> = {
  pdf: "PDF",
  image: "Image (PNG/JPEG)",
  any: "PDF or image",
};

function generateToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function InviteManager({
  userId,
  invites,
}: {
  userId: string;
  invites: Invite[];
}) {
  const router = useRouter();
  const [personName, setPersonName] = useState("");
  const [rows, setRows] = useState<RequestedRow[]>([
    { name: "", accepted_type: "any" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<RequestedRow>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanRows = rows
      .map((r) => ({ ...r, name: r.name.trim() }))
      .filter((r) => r.name !== "");
    if (!personName.trim()) {
      setError("Enter the person's name.");
      return;
    }
    if (cleanRows.length === 0) {
      setError("Add at least one document to request.");
      return;
    }

    setCreating(true);
    const supabase = createClient();
    const token = generateToken();

    const { data: invite, error: inviteError } = await supabase
      .from("upload_invites")
      .insert({ owner_id: userId, token, person_name: personName.trim() })
      .select("id")
      .single();

    if (inviteError || !invite) {
      setError(`Could not create invite: ${inviteError?.message}`);
      setCreating(false);
      return;
    }

    const { error: rowsError } = await supabase
      .from("invite_requested_documents")
      .insert(
        cleanRows.map((r) => ({
          invite_id: invite.id,
          name: r.name,
          accepted_type: r.accepted_type,
        }))
      );

    if (rowsError) {
      await supabase.from("upload_invites").delete().eq("id", invite.id);
      setError(`Could not save the document list: ${rowsError.message}`);
      setCreating(false);
      return;
    }

    setPersonName("");
    setRows([{ name: "", accepted_type: "any" }]);
    setCreating(false);
    router.refresh();
  }

  async function handleCopy(invite: Invite) {
    const url = `${window.location.origin}/invite/${invite.token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleDelete(invite: Invite) {
    if (
      !confirm(
        `Delete the invite for "${invite.person_name}"? Documents they already uploaded will be kept; the invite link stops working.`
      )
    ) {
      return;
    }
    setDeletingId(invite.id);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("upload_invites")
      .delete()
      .eq("id", invite.id);
    if (deleteError) {
      setError(`Could not delete invite: ${deleteError.message}`);
    }
    setDeletingId(null);
    router.refresh();
  }

  return (
    <div className="stack">
      <form onSubmit={handleCreate} className="card stack">
        <h2>Invite someone</h2>

        <div>
          <label htmlFor="person-name">Person&apos;s name</label>
          <input
            id="person-name"
            type="text"
            placeholder="e.g. Maria"
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
          />
        </div>

        <div className="stack" style={{ gap: 8 }}>
          <label style={{ marginBottom: 0 }}>Documents to request</label>
          {rows.map((row, index) => (
            <div key={index} className="row" style={{ flexWrap: "nowrap" }}>
              <input
                type="text"
                placeholder={`e.g. Pay stubs — last 3 months`}
                value={row.name}
                onChange={(e) => updateRow(index, { name: e.target.value })}
                style={{ flex: 2, minWidth: 120 }}
              />
              <select
                value={row.accepted_type}
                onChange={(e) =>
                  updateRow(index, {
                    accepted_type: e.target.value as AcceptedType,
                  })
                }
                style={{ flex: 1, minWidth: 110, width: "auto" }}
              >
                <option value="any">PDF or image</option>
                <option value="pdf">PDF only</option>
                <option value="image">Image only</option>
              </select>
              <button
                type="button"
                className="btn btn-danger btn-small"
                onClick={() =>
                  setRows((prev) =>
                    prev.length === 1 ? prev : prev.filter((_, i) => i !== index)
                  )
                }
                disabled={rows.length === 1}
                aria-label="Remove document"
              >
                ✕
              </button>
            </div>
          ))}
          <div>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() =>
                setRows((prev) => [...prev, { name: "", accepted_type: "any" }])
              }
            >
              + Add another document
            </button>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <div>
          <button className="btn" type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create invite"}
          </button>
        </div>
      </form>

      <div className="stack">
        <h2>Your invites ({invites.length})</h2>
        {invites.length === 0 ? (
          <p className="muted">No invites yet.</p>
        ) : (
          <ul className="item-list">
            {invites.map((invite) => {
              const done = invite.requested.filter((r) => r.uploaded).length;
              return (
                <li key={invite.id} className="item">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="row">
                      <span className="item-title">{invite.person_name}</span>
                      <span
                        className={`badge ${
                          done === invite.requested.length
                            ? "badge-active"
                            : "badge-expired"
                        }`}
                      >
                        {done}/{invite.requested.length} uploaded
                      </span>
                    </div>
                    <ul className="muted" style={{ paddingLeft: 18 }}>
                      {invite.requested.map((r) => (
                        <li key={r.id}>
                          {r.name} · {TYPE_LABEL[r.accepted_type]} ·{" "}
                          {r.uploaded ? "uploaded ✓" : "waiting"}
                        </li>
                      ))}
                    </ul>
                    <code className="share-url">
                      {typeof window === "undefined"
                        ? `/invite/${invite.token}`
                        : `${window.location.origin}/invite/${invite.token}`}
                    </code>
                  </div>
                  <div className="row">
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => handleCopy(invite)}
                    >
                      {copiedId === invite.id ? "Copied!" : "Copy link"}
                    </button>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => handleDelete(invite)}
                      disabled={deletingId === invite.id}
                    >
                      {deletingId === invite.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
