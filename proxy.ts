import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isLegacyAuthorized } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (
    path.startsWith("/_next") ||
    path.startsWith("/favicon") ||
    path.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }

  const legacyAdminPaths =
    path === "/api/import" ||
    path === "/api/backfill-art" ||
    path === "/api/backfill-artists";

  if (legacyAdminPaths && !isLegacyAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/import",
    "/api/backfill-art",
    "/api/backfill-artists",
  ],
};
