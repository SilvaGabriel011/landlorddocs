import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLandlord } from "@/lib/landlord";
import { ROOMS } from "@/lib/rooms";

export const dynamic = "force-dynamic";

type MediaRow = {
  id: string;
  name: string;
  room: string | null;
  mime_type: string;
  created_at: string;
};

type ApplicantRow = {
  id: string;
  name: string;
  email: string;
  inspection_media: MediaRow[];
};

const UNLABELED = "Unlabeled";

// Groups one applicant's media by room, in ROOMS order, unlabeled last.
function byRoom(media: MediaRow[]): [string, MediaRow[]][] {
  const groups = new Map<string, MediaRow[]>();
  for (const item of media) {
    const key = item.room ?? UNLABELED;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  const order = (room: string) => {
    const i = (ROOMS as readonly string[]).indexOf(room);
    return i === -1 ? ROOMS.length : i;
  };
  return Array.from(groups.entries()).sort(([a], [b]) => order(a) - order(b));
}

export default async function InspectionsPage() {
  if (!(await isLandlord())) redirect("/login");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("applicants")
    .select(
      "id, name, email, inspection_media(id, name, room, mime_type, created_at)"
    )
    .order("created_at", { ascending: false });

  const applicants = ((data ?? []) as ApplicantRow[]).filter(
    (a) => a.inspection_media.length > 0
  );

  return (
    <div className="stack">
      <div>
        <h1>Inspections prior living</h1>
        <p className="muted">
          Photos and videos of the property&apos;s condition, added by each
          applicant before moving in. Photos are grouped by the room the AI
          detected; tap one to see it full size.
        </p>
      </div>

      {applicants.length === 0 ? (
        <p className="muted">
          No inspection media yet. Applicants add photos and videos of the
          property&apos;s condition from their portal.
        </p>
      ) : (
        applicants.map((applicant) => (
          <div key={applicant.id} className="stack">
            <h2>
              {applicant.name} ({applicant.inspection_media.length})
            </h2>
            {byRoom(applicant.inspection_media).map(([room, items]) => (
              <div key={room} className="stack">
                <h2 style={{ fontSize: "1rem" }}>
                  {room} ({items.length})
                </h2>
                <div className="media-grid">
                  {items.map((item) => (
                    <Link
                      key={item.id}
                      href={`/dashboard/inspections/view/${item.id}`}
                      className="media-tile"
                    >
                      {item.mime_type.startsWith("video/") ? (
                        <video
                          className="media-thumb"
                          src={`/dashboard/inspection-file/${item.id}`}
                          preload="metadata"
                          muted
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className="media-thumb"
                          src={`/dashboard/inspection-file/${item.id}`}
                          alt={item.name}
                          loading="lazy"
                        />
                      )}
                      <div className="media-tile-meta">
                        <div className="item-title">{item.name}</div>
                        <div className="muted" style={{ fontWeight: 400 }}>
                          {item.mime_type.startsWith("video/")
                            ? "Video"
                            : "Photo"}{" "}
                          · {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
