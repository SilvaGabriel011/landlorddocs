"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type DocumentOption = { id: string; name: string };

type ShareLink = {
  id: string;
  token: string;
  label: string;
  expires_at: string;
  created_at: string;
  document_count: number;
};

const DURATION_OPTIONS = [
  { value: "1", label: "1 day" },
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "custom", label: "Custom date and time" },
];

function generateToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export default function LinkManager({
  userId,
  documents,
  links,
}: {
  userId: string;
  documents: DocumentOption[];
  links: ShareLink[];
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [duration, setDuration] = useState("7");
  const [customExpiry, setCustomExpiry] = useState("");
  const [selectedDocs, setSelectedDocs] = useState<string[]>(
    documents.map((d) => d.id)
  );
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function toggleDoc(id: string) {
    setSelectedDocs((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  }

  function computeExpiry(): Date | null {
    if (duration === "custom") {
      if (!customExpiry) return null;
      const date = new Date(customExpiry);
      return isNaN(date.getTime()) ? null : date;
    }
    const date = new Date();
    date.setDate(date.getDate() + Number(duration));
    return date;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selectedDocs.length === 0) {
      setError("Select at least one document to share.");
      return;
    }

    const expiresAt = computeExpiry();
    if (!expiresAt) {
      setError("Choose a valid expiration date.");
      return;
    }
    if (expiresAt.getTime() <= Date.now()) {
      setError("The expiration date must be in the future.");
      return;
    }

    setCreating(true);
    const supabase = createClient();
    const token = generateToken();

    const { data: link, error: linkError } = await supabase
      .from("share_links")
      .insert({
        owner_id: userId,
        token,
        label: label.trim() || "Landlord",
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();

    if (linkError || !link) {
      setError(`Could not create link: ${linkError?.message}`);
      setCreating(false);
      return;
    }

    const { error: docsError } = await supabase
      .from("share_link_documents")
      .insert(
        selectedDocs.map((docId) => ({
          share_link_id: link.id,
          document_id: docId,
        }))
      );

    if (docsError) {
      await supabase.from("share_links").delete().eq("id", link.id);
      setError(`Could not attach documents: ${docsError.message}`);
      setCreating(false);
      return;
    }

    setLabel("");
    setCreating(false);
    router.refresh();
  }

  async function handleCopy(link: ShareLink) {
    const url = `${window.location.origin}/share/${link.token}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleDelete(link: ShareLink) {
    if (
      !confirm(
        `Delete the link for "${link.label}"? Anyone with this link will lose access immediately.`
      )
    ) {
      return;
    }
    setDeletingId(link.id);
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("share_links")
      .delete()
      .eq("id", link.id);
    if (deleteError) {
      setError(`Could not delete link: ${deleteError.message}`);
    }
    setDeletingId(null);
    router.refresh();
  }

  return (
    <div className="stack">
      <form onSubmit={handleCreate} className="card stack">
        <h2>Create a share link</h2>

        <div>
          <label htmlFor="link-label">Name (for you, e.g. the landlord)</label>
          <input
            id="link-label"
            type="text"
            placeholder="e.g. Mr. Smith — Oak Street apartment"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="link-duration">Link is valid for</label>
          <select
            id="link-duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          >
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {duration === "custom" && (
          <div>
            <label htmlFor="link-expiry">Expires on</label>
            <input
              id="link-expiry"
              type="datetime-local"
              value={customExpiry}
              onChange={(e) => setCustomExpiry(e.target.value)}
            />
          </div>
        )}

        <div>
          <label>Documents to include</label>
          {documents.length === 0 ? (
            <p className="muted">
              You have no documents yet — upload some on the{" "}
              <a href="/dashboard">Documents</a> page first.
            </p>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {documents.map((doc) => (
                <label
                  key={doc.id}
                  className="row"
                  style={{ fontWeight: 400, color: "inherit" }}
                >
                  <input
                    type="checkbox"
                    checked={selectedDocs.includes(doc.id)}
                    onChange={() => toggleDoc(doc.id)}
                  />
                  {doc.name}
                </label>
              ))}
            </div>
          )}
        </div>

        {error && <p className="error-text">{error}</p>}

        <div>
          <button
            className="btn"
            type="submit"
            disabled={creating || documents.length === 0}
          >
            {creating ? "Creating…" : "Create link"}
          </button>
        </div>
      </form>

      <div className="stack">
        <h2>Your links ({links.length})</h2>
        {links.length === 0 ? (
          <p className="muted">No share links yet.</p>
        ) : (
          <ul className="item-list">
            {links.map((link) => {
              const expired = new Date(link.expires_at).getTime() <= Date.now();
              return (
                <li key={link.id} className="item">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="row">
                      <span className="item-title">{link.label}</span>
                      <span
                        className={`badge ${expired ? "badge-expired" : "badge-active"}`}
                      >
                        {expired ? "Expired" : "Active"}
                      </span>
                    </div>
                    <div className="muted">
                      {link.document_count} document
                      {link.document_count === 1 ? "" : "s"} ·{" "}
                      {expired ? "expired" : "expires"}{" "}
                      {new Date(link.expires_at).toLocaleString()}
                    </div>
                    <code className="share-url">
                      {typeof window === "undefined"
                        ? `/share/${link.token}`
                        : `${window.location.origin}/share/${link.token}`}
                    </code>
                  </div>
                  <div className="row">
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => handleCopy(link)}
                    >
                      {copiedId === link.id ? "Copied!" : "Copy link"}
                    </button>
                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => handleDelete(link)}
                      disabled={deletingId === link.id}
                    >
                      {deletingId === link.id ? "Deleting…" : "Delete"}
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
