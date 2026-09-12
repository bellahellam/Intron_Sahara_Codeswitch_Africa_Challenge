import { createHmac, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE = "mama_sauti_session";
export const AUTH_ROLES = ["user", "admin"] as const;

export type AuthRole = (typeof AUTH_ROLES)[number];

export interface AuthSession {
  role: AuthRole;
  /** A normal user is scoped to this CHP code. Admin sessions are not. */
  chpCode?: string;
  expiresAt: number;
}

function sessionSecret(): string {
  const configured = process.env.AUTH_SESSION_SECRET;
  if (configured) return configured;

  // A fixed fallback is only suitable for the local prototype. Production must provide a secret.
  if (process.env.NODE_ENV !== "production") return "mama-sauti-local-development-only";
  throw new Error("AUTH_SESSION_SECRET must be configured in production.");
}

function signature(value: string): string {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

export function signSession(session: AuthSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifySession(token: string | undefined): AuthSession | null {
  if (!token) return null;
  const [payload, suppliedSignature, ...extra] = token.split(".");
  if (!payload || !suppliedSignature || extra.length > 0) return null;

  const expectedSignature = signature(payload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const candidate = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<AuthSession>;
    if (
      (candidate.role !== "user" && candidate.role !== "admin") ||
      typeof candidate.expiresAt !== "number" ||
      candidate.expiresAt <= Date.now()
    ) {
      return null;
    }
    if (candidate.role === "user" && (!candidate.chpCode || typeof candidate.chpCode !== "string")) return null;

    return {
      role: candidate.role,
      ...(candidate.chpCode ? { chpCode: candidate.chpCode } : {}),
      expiresAt: candidate.expiresAt,
    };
  } catch {
    return null;
  }
}

export function sessionFromCookieHeader(cookieHeader: string | null): AuthSession | null {
  if (!cookieHeader) return null;
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE}=`))
    ?.slice(AUTH_COOKIE.length + 1);
  return verifySession(token);
}

function configuredPassword(role: AuthRole): string | null {
  const environmentValue = role === "admin" ? process.env.AUTH_ADMIN_PASSWORD : process.env.AUTH_USER_PASSWORD;
  if (environmentValue) return environmentValue;

  // These make the locally checked-in prototype reviewable. They are not accepted in production.
  if (process.env.NODE_ENV !== "production") return role === "admin" ? "demo-admin" : "demo-user";
  return null;
}

export function credentialsAreConfigured(role: AuthRole): boolean {
  return configuredPassword(role) !== null;
}

export function passwordMatches(role: AuthRole, password: string): boolean {
  const expectedPassword = configuredPassword(role);
  if (!expectedPassword) return false;
  const supplied = Buffer.from(password);
  const expected = Buffer.from(expectedPassword);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function canAccessChp(session: AuthSession, chpCode: string): boolean {
  return session.role === "admin" || session.chpCode === chpCode.toUpperCase();
}
