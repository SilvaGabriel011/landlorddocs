"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Document = {
  id: string;
  name: string;
  file_path: string;
  mime_type: string;
  created_at: string;
};

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export default function DocumentManager({
  userId,
  documents,
}: {
  userId: string;
  documents: Document[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Only PDF, PNG, and JPEG files are supported.");
      return;
    }

    setUploading(true);
    const supabase = createClient();

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${userId}/${crypto.randomUUID()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file, { contentType: file.type });

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from("documents").insert({
      owner_id: userId,
      name: name.trim() || file.name,
      file_path: filePath,
      mime_type: file.type,
    });

    if (insertError) {
      // Roll back the orphaned file so storage stays consistent.
      await supabase.storage.from("documents").remove([filePath]);
      setError(`Could not save document: ${insertError.message}`);
      setUploading(false);
      return;
    }

    setName("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading(false);
    router.refresh();
  }

  async function handleDelete(doc: Document) {
    if (!confirm(`Delete "${doc.name}"? Landlords will no longer see it.`)) {
      return;
    }
    setDeletingId(doc.id);
    setError(null);

    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", doc.id);

    if (deleteError) {
      setError(`Could not delete: ${deleteError.message}`);
      setDeletingId(null);
      return;
    }

    await supabase.storage.from("documents").remove([doc.file_path]);
    setDeletingId(null);
    router.refresh();
  }

  return (
    <div className="stack">
      <form onSubmit={handleUpload} className="card stack">
        <h2>Add a document</h2>
        <div>
          <label htmlFor="doc-name">Document name (shown to landlords)</label>
          <input
            id="doc-name"
            type="text"
            placeholder="e.g. Pay stubs — June 2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="doc-file">File (PDF, PNG, or JPEG)</label>
          <input
            id="doc-file"
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div>
          <button className="btn" type="submit" disabled={uploading || !file}>
            {uploading ? "Uploading…" : "Upload"}
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
                    {doc.mime_type === "application/pdf" ? "PDF" : "Image"} ·
                    added {new Date(doc.created_at).toLocaleDateString()}
                  </div>
                </div>
                <button
                  className="btn btn-danger btn-small"
                  onClick={() => handleDelete(doc)}
                  disabled={deletingId === doc.id}
                >
                  {deletingId === doc.id ? "Deleting…" : "Delete"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
