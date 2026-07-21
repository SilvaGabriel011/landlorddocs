import { NextResponse } from "next/server";
import { clearedLandlordCookie } from "@/lib/landlord";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearedLandlordCookie());
  return response;
}
