import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AUTH_COOKIE,
  AUTH_ROLES,
  credentialsAreConfigured,
  passwordMatches,
  signSession,
  type AuthRole,
} from "@/lib/auth/session";

export const runtime = "nodejs";

const loginSchema = z.object({
  role: z.enum(AUTH_ROLES),
  password: z.string().min(1).max(256),
  chpCode: z.string().trim().min(2).max(32).optional(),
});

export async function POST(req: Request) {
  const result = loginSchema.safeParse(await req.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json({ error: "invalid_request", message: "Enter the requested sign-in details." }, { status: 400 });
  }

  const { role, password } = result.data;
  const chpCode = result.data.chpCode?.toUpperCase();
  if (role === "user" && !chpCode) {
    return NextResponse.json({ error: "missing_chp", message: "Enter your CHP code." }, { status: 400 });
  }
  if (!credentialsAreConfigured(role as AuthRole)) {
    return NextResponse.json({ error: "not_configured", message: "Sign-in has not been configured on this deployment." }, { status: 503 });
  }
  if (!passwordMatches(role as AuthRole, password)) {
    return NextResponse.json({ error: "invalid_credentials", message: "The access details do not match." }, { status: 401 });
  }

  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  const token = signSession({ role, ...(role === "user" ? { chpCode } : {}), expiresAt });
  const response = NextResponse.json({ role, ...(chpCode ? { chpCode } : {}) });
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
  return response;
}
