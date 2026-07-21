import { resolveInviteToken } from "@/lib/invite";
import InviteUploader from "./InviteUploader";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await resolveInviteToken(token);

  if (invite.status !== "active") {
    return (
      <main className="center-page">
        <div className="card stack" style={{ maxWidth: 440 }}>
          <h1>Invite not found</h1>
          <p className="muted">
            This invite link does not exist or was removed. Please check the
            address or ask for a new link.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="container">
      <div className="stack">
        <div>
          <h1>Hi {invite.personName}!</h1>
          <p className="muted">
            You have been asked to upload the documents below for a rental
            application. Your files are stored privately and only shared with
            landlords through protected links.
          </p>
        </div>
        <InviteUploader token={token} requested={invite.requested} />
      </div>
    </main>
  );
}
