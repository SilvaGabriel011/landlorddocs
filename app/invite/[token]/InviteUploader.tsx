"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { RequestedDoc } from "@/lib/invite";

const ACCEPT_ATTR: Record<RequestedDoc["accepted_type"], string> = {
  pdf: ".pdf,application/pdf",
  image: ".png,.jpg,.jpeg,image/png,image/jpeg",
  any: ".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg",
};

const TYPE_LABEL: Record<RequestedDoc["accepted_type"], string> = {
  pdf: "PDF",
  image: "Image (PNG or JPEG)",
  any: "PDF or image",
};

export default function InviteUploader({
  token,
  requested,
}: {
  token: string;
  requested: RequestedDoc[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [justUploaded, setJustUploaded] = useState<Record<string, boolean>>({});

  async function handleFile(reqDoc: RequestedDoc, file: File) {
    setBusyId(reqDoc.id);
    setErrors((prev) => ({ ...prev, [reqDoc.id]: "" }));

    try {
      const startRes = await fetch(`/api/invite/${token}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedDocId: reqDoc.id,
          fileName: file.name,
          mimeType: file.type,
        }),
      });
      const startData = await startRes.json();
      if (!startRes.ok) {
        throw new Error(startData.error ?? "Could not start the upload.");
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .uploadToSignedUrl(startData.path, startData.uploadToken, file, {
          contentType: file.type,
        });
      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const completeRes = await fetch(`/api/invite/${token}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedDocId: reqDoc.id,
          path: startData.path,
          mimeType: file.type,
        }),
      });
      const completeData = await completeRes.json();
      if (!completeRes.ok) {
        throw new Error(completeData.error ?? "Could not save the document.");
      }

      setJustUploaded((prev) => ({ ...prev, [reqDoc.id]: true }));
      router.refresh();
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [reqDoc.id]: err instanceof Error ? err.message : "Something went wrong.",
      }));
    } finally {
      setBusyId(null);
    }
  }

  const doneCount = requested.filter(
    (r) => r.uploaded || justUploaded[r.id]
  ).length;

  return (
    <div className="stack">
      <p className="muted">
        {doneCount} of {requested.length} document
        {requested.length === 1 ? "" : "s"} uploaded.
      </p>
      <ul className="item-list">
        {requested.map((reqDoc) => {
          const uploaded = reqDoc.uploaded || justUploaded[reqDoc.id];
          return (
            <li key={reqDoc.id} className="item">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="row">
                  <span className="item-title">{reqDoc.name}</span>
                  <span
                    className={`badge ${uploaded ? "badge-active" : "badge-expired"}`}
                  >
                    {uploaded ? "Uploaded ✓" : "Waiting"}
                  </span>
                </div>
                <div className="muted">{TYPE_LABEL[reqDoc.accepted_type]}</div>
                {errors[reqDoc.id] && (
                  <p className="error-text">{errors[reqDoc.id]}</p>
                )}
              </div>
              <div>
                <label
                  className="btn btn-secondary btn-small"
                  style={{ marginBottom: 0 }}
                >
                  {busyId === reqDoc.id
                    ? "Uploading…"
                    : uploaded
                      ? "Replace file"
                      : "Choose file"}
                  <input
                    type="file"
                    accept={ACCEPT_ATTR[reqDoc.accepted_type]}
                    style={{ display: "none" }}
                    disabled={busyId !== null}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(reqDoc, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </li>
          );
        })}
      </ul>
      {doneCount === requested.length && requested.length > 0 && (
        <p className="success-text">
          All done — thank you! You can close this page.
        </p>
      )}
    </div>
  );
}
