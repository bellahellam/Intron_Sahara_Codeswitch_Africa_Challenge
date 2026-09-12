import { NextResponse } from "next/server";
import { sessionFromCookieHeader } from "@/lib/auth/session";

export async function GET(req: Request) {
  const session = sessionFromCookieHeader(req.headers.get("cookie"));
  if (!session) return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json(
    { authenticated: true, role: session.role, ...(session.chpCode ? { chpCode: session.chpCode } : {}) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
