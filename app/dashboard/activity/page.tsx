import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ACTION_LABEL: Record<string, string> = {
  link_opened: "Opened the link",
  viewed: "Viewed",
  downloaded: "Downloaded",
  printed: "Printed",
};

export default async function ActivityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: events } = await supabase
    .from("share_activity")
    .select("id, action, document_name, created_at, share_links!inner(label)")
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (events ?? []).map((e) => ({
    id: e.id,
    action: e.action,
    document_name: e.document_name,
    created_at: e.created_at,
    label: Array.isArray(e.share_links)
      ? (e.share_links[0]?.label ?? "")
      : ((e.share_links as { label: string } | null)?.label ?? ""),
  }));

  return (
    <div className="stack">
      <div>
        <h1>Activity</h1>
        <p className="muted">
          What landlords did with your share links: when they opened a link,
          and which documents they viewed, downloaded, or printed. (Printing
          is only detected when done in the browser — if a landlord downloads
          a file first, printing it later cannot be seen.) Opening your own
          links to preview them is recorded too.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="muted">
          No activity yet. Once a landlord opens one of your share links, it
          will show up here.
        </p>
      ) : (
        <ul className="item-list">
          {rows.map((event) => (
            <li key={event.id} className="item">
              <div>
                <div className="item-title">
                  {ACTION_LABEL[event.action] ?? event.action}
                  {event.document_name ? `: ${event.document_name}` : ""}
                </div>
                <div className="muted">Link: {event.label}</div>
              </div>
              <div className="muted">
                {new Date(event.created_at).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
