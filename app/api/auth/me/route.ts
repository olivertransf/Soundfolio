import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { claimLegacyStreamsIfEligible } from "@/lib/legacy-migration";
import { getUserProfile, userNeedsOnboarding } from "@/lib/users";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await claimLegacyStreamsIfEligible(user.uid, user.email);
  const profile = await getUserProfile(user.uid);

  return NextResponse.json({
    uid: user.uid,
    email: user.email,
    profile,
    needsOnboarding: userNeedsOnboarding(profile),
  });
}
