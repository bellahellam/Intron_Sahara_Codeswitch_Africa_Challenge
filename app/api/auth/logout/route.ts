import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0, sameSite: "lax" });
  return response;
}
