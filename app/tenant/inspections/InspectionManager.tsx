"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ROOMS } from "@/lib/rooms";

type InspectionMedia = {
  id: string;
  name: string;
  room: string | null;
  mime_type: string;
  created_at: string;
};

const UNLABELED = "Unlabeled";

export default function InspectionManager({
  media,
}: {
  media: InspectionMedia[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  // Room picked for each selected video, keyed by its index in `files`.
  const [videoRooms, setVideoRooms] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleSelect(selected: File[]) {
    setFiles(selected);
    setVideoRooms({});
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;

    setError(null);
    setUploading(true);

    const form = new FormData();
    files.forEach((file, index) => {
      form.append("files", file);
      // Index-aligned with "files": the chosen room for videos, "" for
      // photos (the AI labels those) and unlabeled videos.
      form.append(
        "rooms",
        file.type.startsWith("video/") ? (videoRooms[index] ?? "") : ""
      );
    });

    const res = await fetch("/api/tenant/inspections", {
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
    setVideoRooms({});
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading(false);
    router.refresh();
  }

  async function handleDelete(item: InspectionMedia) {
    if (!confirm(`Delete "${item.name}"? The landlord will no longer see it.`)) {
      return;
    }
    setDeletingId(item.id);
    setError(null);

    const res = await fetch("/api/tenant/inspections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaId: item.id }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not delete the file.");
    }
    setDeletingId(null);
    router.refresh();
  }

  // Group the gallery by room, in ROOMS order, unlabeled last.
  const byRoom = new Map<string, InspectionMedia[]>();
  for (const item of media) {
    const key = item.room ?? UNLABELED;
    const list = byRoom.get(key) ?? [];
    list.push(item);
    byRoom.set(key, list);
  }
  const roomOrder = (room: string) => {
    const i = (ROOMS as readonly string[]).indexOf(room);
    return i === -1 ? ROOMS.length : i;
  };
  const groups = Array.from(byRoom.entries()).sort(
    ([a], [b]) => roomOrder(a) - roomOrder(b)
  );

  return (
    <div className="stack">
      <form onSubmit={handleUpload} className="card stack">
        <h2>Add photos & videos</h2>
        <div>
          <label htmlFor="inspection-files">
            Photos (PNG, JPEG, WebP — labeled by room automatically) and
            videos (MP4, WebM, MOV — pick the room below)
          </label>
          <input
            id="inspection-files"
            ref={fileInputRef}
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.webp,.mp4,.webm,.mov,image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
            onChange={(e) => handleSelect(Array.from(e.target.files ?? []))}
            required
          />
        </div>
        {files.length > 0 && (
          <ul className="item-list">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="item">
                <div>
                  <div className="item-title">{file.name}</div>
                  <div className="muted">
                    {file.type.startsWith("video/")
                      ? "Video"
                      : "Photo — room detected automatically"}
                  </div>
                </div>
                {file.type.startsWith("video/") && (
                  <select
                    aria-label={`Room shown in ${file.name}`}
                    value={videoRooms[index] ?? ""}
                    onChange={(e) =>
                      setVideoRooms((prev) => ({
                        ...prev,
                        [index]: e.target.value,
                      }))
                    }
                    style={{ width: "auto" }}
                  >
                    <option value="">No room label</option>
                    {ROOMS.map((room) => (
                      <option key={room} value={room}>
                        {room}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
        )}
        {error && <p className="error-text">{error}</p>}
        <div>
          <button
            className="btn"
            type="submit"
            disabled={uploading || files.length === 0}
          >
            {uploading ? "Uploading & labeling…" : "Upload"}
          </button>
        </div>
      </form>

      <div className="stack">
        <h2>
          Inspection media ({media.length})
        </h2>
        {media.length === 0 ? (
          <p className="muted">
            Nothing here yet. Photos and videos of the property&apos;s
            condition protect your bond.
          </p>
        ) : (
          groups.map(([room, items]) => (
            <div key={room} className="stack">
              <h2 style={{ fontSize: "1rem" }}>
                {room} ({items.length})
              </h2>
              <div className="media-grid">
                {items.map((item) => (
                  <div key={item.id} className="media-tile">
                    {item.mime_type.startsWith("video/") ? (
                      <video
                        className="media-thumb"
                        src={`/api/tenant/inspection-file/${item.id}`}
                        controls
                        preload="metadata"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="media-thumb"
                        src={`/api/tenant/inspection-file/${item.id}`}
                        alt={item.name}
                        loading="lazy"
                      />
                    )}
                    <div className="media-tile-meta">
                      <div className="item-title">{item.name}</div>
                      <div className="muted">
                        added {new Date(item.created_at).toLocaleDateString()}
                      </div>
                      <button
                        className="btn btn-danger btn-small"
                        style={{ marginTop: 6 }}
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
