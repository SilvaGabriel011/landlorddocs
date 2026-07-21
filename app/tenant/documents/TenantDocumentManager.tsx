"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Document = {
  id: string;
  name: string;
  mime_type: string;
  doc_type: string | null;
  person_name: string | null;
  person_role: string | null;
  created_at: string;
};

const NEW_PERSON = "__new__";
const AUTO_PERSON = "__auto__";

export function roleLabel(role: string | null): string | null {
  if (role === "resident") return "will live here";
  if (role === "supporter") return "supporter";
  return null;
}

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
  const [person, setPerson] = useState(AUTO_PERSON);
  const [newPerson, setNewPerson] = useState("");
  const [role, setRole] = useState("resident");
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
    if (person === NEW_PERSON) form.append("role", role);
    // AUTO_PERSON goes through as-is: the server asks the AI to figure
    // out who each file belongs to.

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
    setPerson(AUTO_PERSON);
    setNewPerson("");
    setRole("resident");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading(false);
    router.refresh();
  }

  const [personBusy, setPersonBusy] = useState<string | null>(null);

  async function patchPerson(
    from: string,
    changes: { to?: string | null; role?: string | null }
  ) {
    setPersonBusy(from);
    setError(null);
    const res = await fetch("/api/tenant/people", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, ...changes }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not update this person.");
    }
    setPersonBusy(null);
    router.refresh();
  }

  function handleRename(from: string) {
    const to = prompt(
      "New name for this person (their documents move with them; using your own name merges them into you):",
      from
    );
    if (to === null) return;
    patchPerson(from, { to: to.trim() });
  }

  function handleMakeMe(from: string) {
    if (
      !confirm(
        `Move all of "${from}"'s documents to you (${applicantName})? Use this when the AI split your own documents under a different name.`
      )
    ) {
      return;
    }
    patchPerson(from, { to: null });
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

  // Group the list by person, the main applicant first. A person's role
  // comes from the first of their documents that has one.
  const byPerson = new Map<string, Document[]>();
  for (const doc of documents) {
    const key = doc.person_name ?? "";
    const list = byPerson.get(key) ?? [];
    list.push(doc);
    byPerson.set(key, list);
  }
  const groups = Array.from(byPerson.entries())
    .sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)))
    .map(([key, docs]) => {
      const label =
        key === ""
          ? `${applicantName} (you)`
          : [key, roleLabel(docs.find((d) => d.person_role)?.person_role ?? null)]
              .filter(Boolean)
              .join(" — ");
      return { label, docs };
    });

  // People overview for the manage section: name, role and doc count.
  const people = groups.map((g) => {
    const raw = g.docs[0]?.person_name ?? null;
    return {
      key: g.label,
      name: raw,
      isMain: raw === null,
      role: g.docs.find((d) => d.person_role)?.person_role ?? null,
      count: g.docs.length,
    };
  });

  return (
    <div className="stack">
      {people.length > 0 && (
        <div className="card stack">
          <div>
            <h2>People on this application</h2>
            <p className="muted">
              Fix a name, merge duplicates (rename one to the other&apos;s
              name, or use &quot;This is me&quot;), and tag each person.
            </p>
          </div>
          <ul className="item-list">
            {people.map((p) => (
              <li key={p.key} className="item">
                <div>
                  <div className="item-title">
                    {p.isMain ? `${applicantName} (you)` : p.name}
                  </div>
                  <div className="muted">
                    {p.isMain
                      ? "Main applicant"
                      : p.role === "resident"
                        ? "Moving in"
                        : p.role === "supporter"
                          ? "Supporter"
                          : "No tag yet"}{" "}
                    · {p.count} document{p.count === 1 ? "" : "s"}
                  </div>
                </div>
                {!p.isMain && p.name && (
                  <div className="row">
                    <select
                      aria-label={`Tag for ${p.name}`}
                      value={p.role ?? ""}
                      disabled={personBusy === p.name}
                      onChange={(e) =>
                        patchPerson(p.name!, { role: e.target.value || null })
                      }
                      style={{ width: "auto" }}
                    >
                      <option value="">No tag</option>
                      <option value="resident">Moving in</option>
                      <option value="supporter">Supporter</option>
                    </select>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => handleRename(p.name!)}
                      disabled={personBusy === p.name}
                    >
                      Rename
                    </button>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => handleMakeMe(p.name!)}
                      disabled={personBusy === p.name}
                    >
                      This is me
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleUpload} className="card stack">
        <h2>Add documents</h2>
        <div>
          <label htmlFor="doc-person">Whose documents are these?</label>
          <select
            id="doc-person"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
          >
            <option value={AUTO_PERSON}>
              Automatic — let the AI sort them by person
            </option>
            <option value="">{applicantName} (me)</option>
            {knownPeople.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value={NEW_PERSON}>Someone else…</option>
          </select>
          {person === AUTO_PERSON && (
            <p className="muted" style={{ marginTop: 4 }}>
              Mix everyone&apos;s files in one upload — the AI reads each
              document and files it under the right person.
            </p>
          )}
        </div>
        {person === NEW_PERSON && (
          <>
            <div>
              <label htmlFor="doc-person-name">Their name</label>
              <input
                id="doc-person-name"
                type="text"
                placeholder="e.g. Ana Souza"
                value={newPerson}
                onChange={(e) => setNewPerson(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="doc-person-role">They are…</label>
              <select
                id="doc-person-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="resident">moving in with me</option>
                <option value="supporter">
                  a supporter (guarantor / co-signer)
                </option>
              </select>
            </div>
          </>
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
