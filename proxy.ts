import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, isRequestAuthorized } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const key = process.env.AUTH_KEY;
  if (!key) return NextResponse.next();

  const path = request.nextUrl.pathname;
  const isApiStats = path.startsWith("/api/stats");
  const protectedPath =
    path === "/me" ||
    path.startsWith("/me/") ||
    path.startsWith("/history") ||
    path.startsWith("/top-") ||
    isApiStats;
  if (!protectedPath) return NextResponse.next();

  if (isRequestAuthorized(request)) {
    const queryKey = request.nextUrl.searchParams.get("key");
    if (!isApiStats && queryKey === key) {
      const url = new URL(request.url);
      url.searchParams.delete("key");
      const res = NextResponse.redirect(url);
      res.cookies.set(AUTH_COOKIE, key, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }
    return NextResponse.next();
  }

  if (isApiStats) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.redirect(new URL("/auth", request.url));
}

export const config = {
  matcher: ["/me", "/me/:path*", "/history", "/history/:path*", "/top-:path*", "/api/stats/:path*"],
};
