import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getArtistArtFromDiscogs } from "@/lib/discogs";
import { getArtistArtFromDeezer } from "@/lib/deezer";
import { getArtistArt } from "@/lib/lastfm";
import { isRequestAuthorized } from "@/lib/auth";

export const maxDuration = 60;

const MAX_PER_RUN = 25;
const DELAY_MS = 2100;

async function getArtistImage(artistName: string): Promise<string | null> {
  const discogs = await getArtistArtFromDiscogs(artistName);
  if (discogs) return discogs;
  const deezer = await getArtistArtFromDeezer(artistName);
  if (deezer) return deezer;
  return getArtistArt(artistName);
}

export async function POST(req: NextRequest) {
  if (!isRequestAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const missing = await db.stream.groupBy({
      by: ["artistName"],
      where: { artistArt: null },
    });

    if (missing.length === 0) {
      return NextResponse.json({
        updated: 0,
        total: 0,
        remaining: 0,
        message: "No artists missing artwork",
      });
    }

    const toProcess = missing.slice(0, MAX_PER_RUN);
    const remaining = missing.length - toProcess.length;
    let updated = 0;

    for (const m of toProcess) {
      let art: string | null = null;
      try {
        art = await getArtistImage(m.artistName);
      } catch (e) {
        console.warn("Artist image lookup failed:", m.artistName, e);
      }
      if (art) {
        const result = await db.stream.updateMany({
          where: { artistName: m.artistName, artistArt: null },
          data: { artistArt: art },
        });
        updated += result.count;
      }
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    return NextResponse.json({
      updated,
      total: toProcess.length,
      remaining,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backfill failed";
    console.error("Backfill artists error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
