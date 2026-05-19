/**
 * Backfill artist images for streams missing artwork.
 * Tries Discogs → Deezer → Last.fm (LASTFM_API_KEY helps Last.fm).
 *
 * Usage: npx tsx scripts/backfill-artists.ts
 */

import "dotenv/config";
import { db } from "../lib/db";
import { getArtistArtFromDiscogs } from "../lib/discogs";
import { getArtistArtFromDeezer } from "../lib/deezer";
import { getArtistArt } from "../lib/lastfm";

const MAX_PER_RUN = 25;
const DELAY_MS = 2100;

async function getArtistImage(artistName: string): Promise<string | null> {
  const discogs = await getArtistArtFromDiscogs(artistName);
  if (discogs) return discogs;
  const deezer = await getArtistArtFromDeezer(artistName);
  if (deezer) return deezer;
  return getArtistArt(artistName);
}

async function run() {
  const missing = await db.stream.groupBy({
    by: ["artistName"],
    where: { artistArt: null },
  });

  if (missing.length === 0) return true;

  const toProcess = missing.slice(0, MAX_PER_RUN);
  const remaining = missing.length - toProcess.length;
  let updated = 0;

  console.log(`Processing ${toProcess.length} artists (${remaining} remaining)...`);

  for (const m of toProcess) {
    const art = await getArtistImage(m.artistName);
    if (art) {
      const result = await db.stream.updateMany({
        where: { artistName: m.artistName, artistArt: null },
        data: { artistArt: art },
      });
      updated += result.count;
    }
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log(`Updated ${updated} streams. ${remaining} remaining.\n`);
  return false;
}

async function main() {
  let round = 0;
  const maxRounds = Number(process.env.BACKFILL_MAX_ROUNDS ?? 10);
  while (round < maxRounds) {
    round++;
    console.log(`--- Round ${round} ---`);
    const done = await run();
    if (done) {
      console.log("No artists missing artwork. Done.");
      break;
    }
  }
  if (round >= maxRounds) {
    console.log(`Stopped after ${maxRounds} rounds. Some artists may not have resolvable artwork.`);
  }
}

main()
  .catch((err) => {
    console.error("Backfill error:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
