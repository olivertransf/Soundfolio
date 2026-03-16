import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRecentlyPlayed } from "@/lib/spotify";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runSync();
}

export async function GET() {
  return runSync();
}

async function runSync() {
  try {
    const latest = await db.stream.findFirst({
      orderBy: { playedAt: "desc" },
      select: { playedAt: true },
    });

    const after = latest?.playedAt
      ? String(latest.playedAt.getTime())
      : undefined;

    const data = await getRecentlyPlayed(after);

    if (!data.items || !data.items.length) {
      return NextResponse.json({
        synced: 0,
        message: "No new tracks",
        lastSync: latest?.playedAt?.toISOString() ?? null,
      });
    }

    const result = await db.stream.createMany({
      data: data.items.map((item) => ({
        trackId: item.track.id,
        trackName: item.track.name,
        artistName: item.track.artists[0]?.name ?? "Unknown",
        albumName: item.track.album.name,
        albumArt: item.track.album.images[0]?.url ?? null,
        durationMs: item.track.duration_ms,
        playedAt: new Date(item.played_at),
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      synced: result.count,
      fetched: data.items.length,
      lastStream: data.items[0]?.played_at ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Sync error:", err);
    return NextResponse.json(
      { error: "Sync failed", detail: msg },
      { status: 500 }
    );
  }
}
