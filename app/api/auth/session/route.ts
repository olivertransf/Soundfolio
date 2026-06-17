import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { formatFirebaseAdminError } from "@/lib/firebase/errors";
import {
  SESSION_COOKIE,
  establishUserSession,
  sessionCookieOptions,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken = body?.idToken?.trim();
    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    await getAdminAuth().verifyIdToken(idToken);
    const { sessionCookie } = await establishUserSession(idToken);

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, sessionCookie, sessionCookieOptions());
    return res;
  } catch (err) {
    const message = formatFirebaseAdminError(err);
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}
