import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { formatFirebaseAdminError } from "@/lib/firebase/errors";
import { claimLegacyStreamsIfEligible } from "@/lib/legacy-migration";
import { updateUserLastfmUsername } from "@/lib/users";

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const lastfmUsername = body?.lastfmUsername?.trim();
  if (!lastfmUsername) {
    return NextResponse.json({ error: "Last.fm username is required" }, { status: 400 });
  }

  try {
    const profile = await updateUserLastfmUsername(user.uid, lastfmUsername);
    await claimLegacyStreamsIfEligible(user.uid, user.email);
    return NextResponse.json({ ok: true, profile });
  } catch (err) {
    const message = formatFirebaseAdminError(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
