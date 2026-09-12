import { NextResponse } from "next/server";
import { accessDenied, authenticationRequired, getRequestAuth } from "@/lib/auth/guard";
import { getAdminOverview } from "@/lib/admin/get-admin-data";

export const runtime = "nodejs";

/**
 * JSON counterpart to the server-rendered /admin page — same query, same auth guard, so a
 * dashboard refresh never sees a different rule than the page that gated it.
 */
export async function GET(req: Request) {
  const session = getRequestAuth(req);
  if (!session) return authenticationRequired();
  if (session.role !== "admin") return accessDenied();

  return NextResponse.json(await getAdminOverview());
}
