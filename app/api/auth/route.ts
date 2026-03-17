import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "stats_auth";

export async function GET(request: NextRequest) {
  const key = process.env.AUTH_KEY;
  if (!key) {
    return NextResponse.redirect(new URL("/me", request.url));
  }

  const queryKey = request.nextUrl.searchParams.get("key");
  if (queryKey !== key) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  const res = NextResponse.redirect(new URL("/me", request.url));
  res.cookies.set(AUTH_COOKIE, key, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function POST(request: NextRequest) {
  const key = process.env.AUTH_KEY;
  if (!key) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  const body = await request.json();
  const submitted = body?.key?.trim();
  if (!submitted || submitted !== key) {
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, key, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
