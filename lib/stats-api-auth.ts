import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthenticatedUser, isLegacyAuthorized } from "@/lib/auth";
import { userNeedsOnboarding } from "@/lib/users";

export function statsApiUnauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function requireStatsApiAuth(req: NextRequest): Promise<NextResponse | null> {
  if (isLegacyAuthorized(req)) return null;
  const user = await getAuthenticatedUser(req);
  if (!user) return statsApiUnauthorized();
  if (userNeedsOnboarding(user.profile)) {
    return NextResponse.json({ error: "Complete onboarding first" }, { status: 403 });
  }
  return null;
}

export async function getStatsApiUser(req: NextRequest) {
  if (isLegacyAuthorized(req)) {
    return { uid: process.env.LEGACY_USER_ID?.trim() || "legacy", isLegacy: true as const };
  }
  const user = await getAuthenticatedUser(req);
  if (!user) return null;
  if (userNeedsOnboarding(user.profile)) return null;
  return { uid: user.uid, isLegacy: false as const };
}
