import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isLegacyAuthorized, SESSION_COOKIE } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (
    path.startsWith("/_next") ||
    path.startsWith("/favicon") ||
    path.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  const isApiStats = path.startsWith("/api/stats");
  const isProtectedPage =
    path === "/me" ||
    path.startsWith("/me/") ||
    path.startsWith("/history") ||
    path.startsWith("/top-") ||
    path === "/onboarding";
  const isProtectedApi =
    isApiStats ||
    path === "/api/sync-lastfm" ||
    path === "/api/import" ||
    path === "/api/backfill-art" ||
    path === "/api/backfill-artists";

  if (!isProtectedPage && !isProtectedApi) {
    return NextResponse.next();
  }

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const legacy = isLegacyAuthorized(request);

  if (path === "/onboarding") {
    if (!hasSession && !legacy) {
      return NextResponse.redirect(new URL("/auth", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession && !legacy) {
    if (isApiStats || isProtectedApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/auth", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/onboarding",
    "/me",
    "/me/:path*",
    "/history",
    "/history/:path*",
    "/top-:path*",
    "/api/stats/:path*",
    "/api/sync-lastfm",
    "/api/import",
    "/api/backfill-art",
    "/api/backfill-artists",
  ],
};
