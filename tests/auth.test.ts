import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { canAccessChp, signSession, verifySession } from "@/lib/auth/session";
import { proxy } from "@/proxy";

describe("role sessions", () => {
  it("accepts a signed normal-user session only with its own CHP scope", () => {
    const token = signSession({ role: "user", chpCode: "KWG-012", expiresAt: Date.now() + 60_000 });
    const session = verifySession(token);

    expect(session).toMatchObject({ role: "user", chpCode: "KWG-012" });
    expect(session && canAccessChp(session, "KWG-012")).toBe(true);
    expect(session && canAccessChp(session, "KSM-005")).toBe(false);
  });

  it("permits administrators across CHP scopes", () => {
    const token = signSession({ role: "admin", expiresAt: Date.now() + 60_000 });
    const session = verifySession(token);

    expect(session?.role).toBe("admin");
    expect(session && canAccessChp(session, "KSM-005")).toBe(true);
  });

  it("rejects tampered or expired role tokens", () => {
    const token = signSession({ role: "admin", expiresAt: Date.now() + 60_000 });
    const expired = signSession({ role: "user", chpCode: "KWG-012", expiresAt: Date.now() - 1 });

    expect(verifySession(`${token}x`)).toBeNull();
    expect(verifySession(expired)).toBeNull();
  });

  it("redirects normal users away from administrator-only pages", () => {
    const userToken = signSession({ role: "user", chpCode: "KWG-012", expiresAt: Date.now() + 60_000 });
    const userRequest = new NextRequest("http://localhost/sahara", {
      headers: { cookie: `mama_sauti_session=${userToken}` },
    });
    const adminToken = signSession({ role: "admin", expiresAt: Date.now() + 60_000 });
    const adminRequest = new NextRequest("http://localhost/sahara", {
      headers: { cookie: `mama_sauti_session=${adminToken}` },
    });

    expect(proxy(userRequest).headers.get("location")).toBe("http://localhost/");
    expect(proxy(adminRequest).status).toBe(200);
  });
});
