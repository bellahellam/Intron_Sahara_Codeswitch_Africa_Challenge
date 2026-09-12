import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, type AuthSession, verifySession } from "@/lib/auth/session";

export async function getAuthSession(): Promise<AuthSession | null> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  return verifySession(token);
}

export async function requireAdmin(): Promise<AuthSession> {
  const session = await getAuthSession();
  if (!session) redirect("/login?next=/admin");
  if (session.role !== "admin") redirect("/");
  return session;
}
