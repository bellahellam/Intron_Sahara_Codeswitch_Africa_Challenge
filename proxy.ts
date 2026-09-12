import { NextResponse, type NextRequest } from "next/server";
import { sessionFromCookieHeader } from "@/lib/auth/session";

const ADMIN_ONLY_PATHS = ["/admin", "/sahara"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth/")) return NextResponse.next();

  const session = sessionFromCookieHeader(request.headers.get("cookie"));
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthenticated", message: "Sign in is required." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session.role !== "admin" && ADMIN_ONLY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
