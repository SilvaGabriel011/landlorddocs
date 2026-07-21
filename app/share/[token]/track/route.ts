import { NextResponse } from "next/server";
import { logShareActivity, resolveShareToken } from "@/lib/share";

export const dynamic = "force-dynamic";

// Receives print-detection beacons from the landlord's browser. Only the
// "printed" action is accepted here; opens, views, and downloads are
// logged server-side and cannot be forged through this endpoint.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json().catch(() => null);
  const docId: string | undefined = body?.docId;
  const action: string | undefined = body?.action;

  if (action !== "printed") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const share = await resolveShareToken(token);
  if (share.status !== "active") {
    return NextResponse.json({ error: "Link not active" }, { status: 404 });
  }

  const doc = share.documents.find((d) => d.id === docId);
  await logShareActivity(share.linkId, "printed", doc);

  return NextResponse.json({ ok: true });
}
