import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/auth/verify-id-token";
import { cleanEntityLabel } from "@/lib/entity-normalize";
import { resolveAlbumArt } from "@/lib/resolve-art";
import { isUsableArtUrl } from "@/lib/stats-compute";

export const maxDuration = 60;

const MAX_ALBUMS_PER_REQUEST = 10;
const DELAY_MS = 250;

type AlbumQuery = {
  key?: string;
  artist?: string;
  album?: string;
  track?: string;
};

type ResolveBody = {
  albums?: AlbumQuery[];
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
  const albums = (body.albums ?? [])
    .map((row) => ({
      key: row.key?.trim() || "",
      artist: cleanEntityLabel(row.artist ?? ""),
      album: cleanEntityLabel(row.album ?? ""),
      track: cleanEntityLabel(row.track ?? ""),
    }))
    .filter((row) => row.key && row.artist && (row.album || row.track))
    .slice(0, MAX_ALBUMS_PER_REQUEST);

  if (albums.length === 0) {
    return NextResponse.json({ arts: {} });
  }

  const arts: Record<string, string | null> = {};
  for (let i = 0; i < albums.length; i++) {
    const row = albums[i];
    try {
      const art = await resolveAlbumArt({
        artistName: row.artist,
        albumName: row.album,
        trackName: row.track,
      });
      arts[row.key] = isUsableArtUrl(art) ? art : null;
    } catch {
      arts[row.key] = null;
    }
    if (i < albums.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  return NextResponse.json({
    resolved: Object.values(arts).filter(Boolean).length,
    arts,
  });
}
