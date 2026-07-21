import { NextResponse } from "next/server";
import { landlordCode, landlordCookie, verifyLandlordCode } from "@/lib/landlord";
import { isLoginLocked, recordLoginFailure, clearLoginFailures } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const THROTTLE_KEY = "__landlord__";

// Grants landlord access. With no LANDLORD_CODE configured the dashboard
// is open and this endpoint is never needed.
export async function POST(request: Request) {
  if (!landlordCode()) {
    return NextResponse.json({ ok: true });
  }

  if (isLoginLocked(THROTTLE_KEY)) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a minute and try again." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const code = String(body?.code ?? "");

  if (!code || !verifyLandlordCode(code)) {
    recordLoginFailure(THROTTLE_KEY);
    return NextResponse.json({ error: "Wrong access code." }, { status: 401 });
  }

  clearLoginFailures(THROTTLE_KEY);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(landlordCookie());
  return response;
}
