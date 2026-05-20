/**
 * Verify top tracks/artists/albums minutes = SUM(durationMs) for the same groups.
 *
 * Usage: MONGODB_URI=... npx tsx scripts/audit-top-minutes.ts
 */
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto as Crypto;

import "dotenv/config";
import { db } from "../lib/db";
import {
  getTopTracks,
  getTopArtists,
  getTopAlbums,
  getTotalStats,
  parseTimeRange,
} from "../lib/stats";
import { isLastFmStream } from "../lib/lastfm-listen-duration";

async function main() {
  const filter = parseTimeRange("ytd");
  const [totals, topTracks, topArtists, topAlbums] = await Promise.all([
    getTotalStats(filter),
    getTopTracks(10, filter),
    getTopArtists(10, filter),
    getTopAlbums(10, filter),
  ]);

  const all = await db.stream.findMany({
    where: { isDemo: false, playedAt: filter.since ? { gte: filter.since, lte: filter.until } : undefined },
    select: { trackName: true, artistName: true, albumName: true, durationMs: true, trackId: true },
  });

  let lfm = 0;
  let spotify = 0;
  let importAccurate = 0;
  for (const r of all) {
    if (isLastFmStream(r.trackId)) lfm++;
    else if (/^\d+$/.test(r.trackId) || r.trackId.length === 22) spotify++;
    else importAccurate++;
  }

  console.log("Filter:", filter.label);
  console.log("Rows:", all.length, "| Last.fm:", lfm, "| Spotify-ish:", spotify, "| Other/import:", importAccurate);
  console.log("Overview total minutes:", totals.totalMinutes, "| streams:", totals.totalStreams);

  const sumMs = all.reduce((s, r) => s + r.durationMs, 0);
  console.log("Manual SUM(durationMs) minutes:", Math.round(sumMs / 60000));

  let trackMismatches = 0;
  for (const t of topTracks) {
    const plays = all.filter((r) => r.trackName === t.trackName && r.artistName === t.artistName);
    const expectedMin = Math.round(plays.reduce((s, r) => s + r.durationMs, 0) / 60000);
    const ok = expectedMin === t.minutesListened && plays.length === t.streams;
    if (!ok) {
      trackMismatches++;
      console.log("TRACK mismatch:", t.artistName, "-", t.trackName, {
        reported: { streams: t.streams, min: t.minutesListened },
        actual: { streams: plays.length, min: expectedMin },
      });
    }
  }

  let artistMismatches = 0;
  for (const a of topArtists) {
    const plays = all.filter((r) => r.artistName === a.artistName);
    const expectedMin = Math.round(plays.reduce((s, r) => s + r.durationMs, 0) / 60000);
    const ok = expectedMin === a.minutesListened && plays.length === a.streams;
    if (!ok) {
      artistMismatches++;
      console.log("ARTIST mismatch:", a.artistName, {
        reported: { streams: a.streams, min: a.minutesListened },
        actual: { streams: plays.length, min: expectedMin },
      });
    }
  }

  let albumMismatches = 0;
  for (const al of topAlbums) {
    const plays = all.filter(
      (r) => r.albumName === al.albumName && r.artistName === al.artistName
    );
    const expectedMin = Math.round(plays.reduce((s, r) => s + r.durationMs, 0) / 60000);
    const ok = expectedMin === al.minutesListened && plays.length === al.streams;
    if (!ok) {
      albumMismatches++;
      console.log("ALBUM mismatch:", al.artistName, "-", al.albumName, {
        reported: { streams: al.streams, min: al.minutesListened },
        actual: { streams: plays.length, min: expectedMin },
      });
    }
  }

  if (trackMismatches + artistMismatches + albumMismatches === 0) {
    console.log("\nOK — top 10 tracks/artists/albums match SUM(durationMs) and play counts.");
  } else {
    console.log("\nMismatches:", { trackMismatches, artistMismatches, albumMismatches });
  }

  const top = topTracks[0];
  if (top) {
    const plays = all
      .filter((r) => r.trackName === top.trackName && r.artistName === top.artistName)
      .slice(0, 5);
    console.log("\nSample durations for #1 track (first 5 plays, ms):");
    for (const p of plays) {
      console.log(
        `  ${Math.round(p.durationMs / 1000)}s — ${p.trackId.slice(0, 20)} @ ${p.durationMs}`
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
