import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/auth";
import { getUserProfile, userNeedsOnboarding, type UserProfile } from "@/lib/users";

export type ServerSession = {
  uid: string;
  email: string | null;
  profile: UserProfile | null;
};

export async function getServerSession(): Promise<ServerSession | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (!session) return null;

  try {
    const decoded = await verifySessionCookie(session);
    const profile = await getUserProfile(decoded.uid);
    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      profile,
    };
  } catch {
    return null;
  }
}

export async function requireServerSession(nextPath = "/me"): Promise<ServerSession> {
  const session = await getServerSession();
  if (!session) {
    redirect(`/auth?next=${encodeURIComponent(nextPath)}`);
  }
  return session;
}

export async function requireOnboardedSession(nextPath = "/me"): Promise<ServerSession & { profile: UserProfile }> {
  const session = await requireServerSession(nextPath);
  if (userNeedsOnboarding(session.profile)) {
    redirect(`/onboarding?next=${encodeURIComponent(nextPath)}`);
  }
  return { ...session, profile: session.profile! };
}

export async function getServerUserId(): Promise<string | undefined> {
  const session = await getServerSession();
  return session?.uid;
}

export async function revokeServerSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE)?.value;
  if (session) {
    try {
      const decoded = await verifySessionCookie(session);
      await getAdminAuth().revokeRefreshTokens(decoded.sub);
    } catch {
      // ignore invalid session during sign-out
    }
  }
}
