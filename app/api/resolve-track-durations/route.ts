import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseIdToken } from "@/lib/auth/verify-id-token";
import { resolveLastFmCatalogDurationMs } from "@/lib/lastfm";
import { cleanEntityLabel } from "@/lib/entity-normalize";

export const maxDuration = 60;

const MAX_TRACKS_PER_REQUEST = 40;
const CONCURRENCY = 5;

type ResolveBody = {
  tracks?: Array<{ artist?: string; track?: string }>;
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

  const apiKey = process.env.LASTFM_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Last.fm not configured",
        detail: "Set LASTFM_API_KEY in server environment variables.",
      },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as ResolveBody;
  const incoming = (body.tracks ?? [])
    .map((row) => ({
      artist: cleanEntityLabel(row.artist ?? ""),
      track: cleanEntityLabel(row.track ?? ""),
    }))
    .filter((row) => row.artist && row.track)
    .slice(0, MAX_TRACKS_PER_REQUEST);

  if (incoming.length === 0) {
    return NextResponse.json({ durations: {} });
  }

  const unique = new Map<string, { artist: string; track: string }>();
  for (const row of incoming) {
    const key = `${row.artist}\0${row.track}`;
    if (!unique.has(key)) unique.set(key, row);
  }

  const cache = new Map<string, number>();
  const list = [...unique.values()];
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const batch = list.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(({ artist, track }) => resolveLastFmCatalogDurationMs(artist, track, cache))
    );
  }

  const durations: Record<string, number> = {};
  for (const [key, ms] of cache) {
    durations[key] = ms;
  }

  return NextResponse.json({
    resolved: Object.keys(durations).length,
    durations,
  });
}
