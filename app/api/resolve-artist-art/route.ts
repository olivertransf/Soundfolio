import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/auth/verify-id-token";
import { cleanEntityLabel } from "@/lib/entity-normalize";
import { resolveArtistArt } from "@/lib/resolve-art";
import { isUsableArtUrl } from "@/lib/stats-compute";

export const maxDuration = 60;

const MAX_ARTISTS_PER_REQUEST = 10;
/** Discogs is picky about rate; keep lookups sequential with a short pause. */
const DELAY_MS = 400;

type ResolveBody = {
  artists?: string[];
};

function bearerToken(request: NextRequest) {
  const bearer = request.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ")) return null;
  return bearer.slice("Bearer ".length).trim();
}

export async function POST(req: NextRequest) {
  const token = bearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await verifyFirebaseIdToken(token);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid token";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as ResolveBody;
  const artists = (body.artists ?? [])
    .map((name) => cleanEntityLabel(name))
    .filter(Boolean)
    .slice(0, MAX_ARTISTS_PER_REQUEST);

  if (artists.length === 0) {
    return NextResponse.json({ arts: {} });
  }

  const arts: Record<string, string | null> = {};
  for (let i = 0; i < artists.length; i++) {
    const artist = artists[i];
    try {
      const art = await resolveArtistArt(artist);
      arts[artist] = isUsableArtUrl(art) ? art : null;
    } catch {
      arts[artist] = null;
    }
    if (i < artists.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  return NextResponse.json({
    resolved: Object.values(arts).filter(Boolean).length,
    arts,
  });
}
