import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTracks } from "@/lib/spotify";

export const maxDuration = 300;

export async function POST() {
  const missing = await db.stream.groupBy({
    by: ["trackId"],
    where: { albumArt: null },
  });

  const trackIds = missing.map((m) => m.trackId);
  if (trackIds.length === 0) {
    return NextResponse.json({ updated: 0, message: "No tracks missing artwork" });
  }

  let updated = 0;
  const BATCH_SIZE = 50;
  const DELAY_MS = 150;

  for (let i = 0; i < trackIds.length; i += BATCH_SIZE) {
    const batch = trackIds.slice(i, i + BATCH_SIZE);
    const tracks = await getTracks(batch);

    for (const t of tracks) {
      if (t.albumArt) {
        const result = await db.stream.updateMany({
          where: { trackId: t.id, albumArt: null },
          data: { albumArt: t.albumArt },
        });
        updated += result.count;
      }
    }

    if (i + BATCH_SIZE < trackIds.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  return NextResponse.json({ updated, total: trackIds.length });
}
