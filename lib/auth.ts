import type { NextRequest } from "next/server";
import { getAdminAuth } from "@/lib/firebase/admin";
import { claimLegacyStreamsIfEligible } from "@/lib/legacy-migration";
import { ensureUserProfile, getUserProfile, type UserProfile } from "@/lib/users";

export const SESSION_COOKIE = "soundfolio_session";
const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 14 * 1000;

export type AuthenticatedUser = {
  uid: string;
  email: string | null;
  profile: UserProfile | null;
};

export function sessionCookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  };
}

export async function createSessionCookie(idToken: string) {
  const auth = getAdminAuth();
  return auth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });
}

export async function verifySessionCookie(cookieValue: string) {
  const auth = getAdminAuth();
  return auth.verifySessionCookie(cookieValue, true);
}

function bearerIdToken(request: NextRequest) {
  const bearer = request.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ")) return null;
  const token = bearer.slice("Bearer ".length).trim();
  if (!token) return null;
  const legacyKey = process.env.AUTH_KEY?.trim();
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (token === legacyKey || token === cronSecret) return null;
  return token;
}

async function userFromDecodedToken(decoded: {
  uid: string;
  email?: string;
}) {
  const profile = await getUserProfile(decoded.uid);
  return {
    uid: decoded.uid,
    email: decoded.email ?? null,
    profile,
  } satisfies AuthenticatedUser;
}

export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (session) {
    try {
      const decoded = await verifySessionCookie(session);
      return userFromDecodedToken(decoded);
    } catch {
      // fall through to bearer token
    }
  }

  const idToken = bearerIdToken(request);
  if (!idToken) return null;

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    return userFromDecodedToken(decoded);
  } catch {
    return null;
  }
}

export async function establishUserSession(idToken: string) {
  const auth = getAdminAuth();
  const decoded = await auth.verifyIdToken(idToken);
  const profile = await ensureUserProfile({
    uid: decoded.uid,
    email: decoded.email ?? null,
    displayName: decoded.name ?? null,
    photoURL: decoded.picture ?? null,
  });
  await claimLegacyStreamsIfEligible(decoded.uid, decoded.email ?? null);
  const sessionCookie = await createSessionCookie(idToken);
  return { sessionCookie, profile, uid: decoded.uid };
}

/** Legacy shared-key access for cron scripts and optional admin override. */
export function isLegacyAuthorized(request: NextRequest) {
  const key = process.env.AUTH_KEY?.trim();
  if (!key) return false;

  const queryKey = request.nextUrl.searchParams.get("key");
  const bearer = request.headers.get("authorization");
  const headerKey = request.headers.get("x-soundfolio-key");
  const cronSecret = process.env.CRON_SECRET?.trim();

  return (
    queryKey === key ||
    headerKey === key ||
    bearer === `Bearer ${key}` ||
    (cronSecret ? bearer === `Bearer ${cronSecret}` : false)
  );
}

export async function isRequestAuthorized(request: NextRequest) {
  if (isLegacyAuthorized(request)) return true;
  const user = await getAuthenticatedUser(request);
  return user !== null;
}
