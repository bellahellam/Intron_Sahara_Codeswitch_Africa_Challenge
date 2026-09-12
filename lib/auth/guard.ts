import "server-only";

import { NextResponse } from "next/server";
import { sessionFromCookieHeader, type AuthSession } from "@/lib/auth/session";

export function getRequestAuth(req: Request): AuthSession | null {
  return sessionFromCookieHeader(req.headers.get("cookie"));
}

export function authenticationRequired() {
  return NextResponse.json({ error: "unauthenticated", message: "Sign in is required." }, { status: 401 });
}

export function accessDenied() {
  return NextResponse.json({ error: "forbidden", message: "This account cannot access that workspace." }, { status: 403 });
}
