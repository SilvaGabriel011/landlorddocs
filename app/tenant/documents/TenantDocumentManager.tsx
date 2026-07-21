"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Document = {
  id: string;
  name: string;
  mime_type: string;
  doc_type: string | null;
  created_at: string;
};

export default function TenantDocumentManager({
  documents,
}: {
  documents: Document[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;
    setError(null);
    setUploading(true);

    const form = new FormData();
    for (const file of files) form.append("files", file);

    const res = await fetch("/api/tenant/documents", {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Upload failed. Please try again.");
      setUploading(false);
      router.refresh();
      return;
    }

    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading(false);
    router.refresh();
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Delete "${doc.name}"? The landlord will no longer see it.`)) {
      return;
    }
    setDeletingId(doc.id);
    setError(null);

    const res = await fetch("/api/tenant/documents", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docId: doc.id }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not delete the document.");
    }
    setDeletingId(null);
    router.refresh();
  }

  return (
    <div className="stack">
      <form onSubmit={handleUpload} className="card stack">
        <h2>Add documents</h2>
        <div>
          <label htmlFor="doc-files">
            Files (PDF, PNG, or JPEG — you can select several)
          </label>
          <input
            id="doc-files"
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            required
          />
          {files.length > 0 && (
            <p className="muted" style={{ marginTop: 4 }}>
              {files.length} file{files.length > 1 ? "s" : ""} selected
            </p>
          )}
        </div>
        {error && <p className="error-text">{error}</p>}
        <div>
          <button
            className="btn"
            type="submit"
            disabled={uploading || files.length === 0}
          >
            {uploading ? "Uploading & organizing…" : "Upload"}
          </button>
        </div>
      </form>

      <div className="stack">
        <h2>Uploaded documents ({documents.length})</h2>
        {documents.length === 0 ? (
          <p className="muted">
            Nothing here yet. Upload your first document above.
          </p>
        ) : (
          <ul className="item-list">
            {documents.map((doc) => (
              <li key={doc.id} className="item">
                <div>
                  <div className="item-title">{doc.name}</div>
                  <div className="muted">
                    {doc.doc_type ?? "Uncategorized"} ·{" "}
                    {doc.mime_type === "application/pdf" ? "PDF" : "Image"} ·
                    added {new Date(doc.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="row">
                  <a
                    className="btn btn-secondary btn-small"
                    href={`/api/tenant/file/${doc.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View
                  </a>
                  <button
                    className="btn btn-danger btn-small"
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                  >
                    {deletingId === doc.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
