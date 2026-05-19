import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const key = process.env.AUTH_KEY;
  if (!key) return NextResponse.next();

  const path = request.nextUrl.pathname;
  const protectedPath =
    path === "/me" ||
    path.startsWith("/me/") ||
    path.startsWith("/history") ||
    path.startsWith("/top-") ||
    path.startsWith("/api/stats");
  if (!protectedPath) return NextResponse.next();

  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  const queryKey = request.nextUrl.searchParams.get("key");

  if (cookie === key || queryKey === key) {
    if (queryKey === key) {
      const url = new URL(request.url);
      url.searchParams.delete("key");
      const res = NextResponse.redirect(url);
      res.cookies.set(AUTH_COOKIE, key, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
      return res;
    }
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/auth", request.url));
}

export const config = {
  matcher: ["/me", "/me/:path*", "/history", "/history/:path*", "/top-:path*", "/api/stats/:path*"],
};
