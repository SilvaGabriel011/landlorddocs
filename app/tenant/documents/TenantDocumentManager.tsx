"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Document = {
  id: string;
  name: string;
  mime_type: string;
  doc_type: string | null;
  person_name: string | null;
  created_at: string;
};

const NEW_PERSON = "__new__";

export default function TenantDocumentManager({
  applicantName,
  documents,
}: {
  applicantName: string;
  documents: Document[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [person, setPerson] = useState("");
  const [newPerson, setNewPerson] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Names already used on this account, for the "who is this for" select.
  const knownPeople = Array.from(
    new Set(
      documents
        .map((d) => d.person_name)
        .filter((n): n is string => n != null)
    )
  ).sort((a, b) => a.localeCompare(b));

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;

    const personName = person === NEW_PERSON ? newPerson.trim() : person;
    if (person === NEW_PERSON && !personName) {
      setError("Enter the name of the person these documents belong to.");
      return;
    }

    setError(null);
    setUploading(true);

    const form = new FormData();
    for (const file of files) form.append("files", file);
    form.append("person", personName);

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
    setPerson("");
    setNewPerson("");
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

  // Group the list by person, the main applicant first.
  const groups: { label: string; docs: Document[] }[] = [];
  const byPerson = new Map<string, Document[]>();
  for (const doc of documents) {
    const key = doc.person_name ?? "";
    const list = byPerson.get(key) ?? [];
    list.push(doc);
    byPerson.set(key, list);
  }
  for (const [key, docs] of Array.from(byPerson.entries()).sort(([a], [b]) =>
    a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)
  )) {
    groups.push({ label: key === "" ? `${applicantName} (you)` : key, docs });
  }

  return (
    <div className="stack">
      <form onSubmit={handleUpload} className="card stack">
        <h2>Add documents</h2>
        <div>
          <label htmlFor="doc-person">Whose documents are these?</label>
          <select
            id="doc-person"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
          >
            <option value="">{applicantName} (me)</option>
            {knownPeople.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value={NEW_PERSON}>Someone else…</option>
          </select>
        </div>
        {person === NEW_PERSON && (
          <div>
            <label htmlFor="doc-person-name">Their name</label>
            <input
              id="doc-person-name"
              type="text"
              placeholder="e.g. Ana Souza (spouse)"
              value={newPerson}
              onChange={(e) => setNewPerson(e.target.value)}
              required
            />
          </div>
        )}
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
          groups.map((group) => (
            <div key={group.label} className="stack">
              <h2 style={{ fontSize: "1rem" }}>
                {group.label} ({group.docs.length})
              </h2>
              <ul className="item-list">
                {group.docs.map((doc) => (
                  <li key={doc.id} className="item">
                    <div>
                      <div className="item-title">{doc.name}</div>
                      <div className="muted">
                        {doc.doc_type ?? "Uncategorized"} ·{" "}
                        {doc.mime_type === "application/pdf"
                          ? "PDF"
                          : "Image"}{" "}
                        · added {new Date(doc.created_at).toLocaleDateString()}
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
            </div>
          ))
        )}
      </div>
    </div>
  );
}
