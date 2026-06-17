import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveArtistArt } from "@/lib/resolve-art";
import { isRequestAuthorized } from "@/lib/auth";

export const maxDuration = 60;

const MAX_PER_RUN = 25;
const DELAY_MS = 2100;

export async function POST(req: NextRequest) {
  if (!(await isRequestAuthorized(req))) {
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
        art = await resolveArtistArt(m.artistName);
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
      source: "lastfm_discogs_deezer",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backfill failed";
    console.error("Backfill artists error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
