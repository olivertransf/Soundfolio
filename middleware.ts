import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "stats_auth";

export function middleware(request: NextRequest) {
  const key = process.env.AUTH_KEY;
  if (!key) return NextResponse.next();

  const path = request.nextUrl.pathname;
  const isMe = path === "/me" || path.startsWith("/me/");
  if (!isMe) return NextResponse.next();

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
  matcher: ["/me", "/me/:path*"],
};
