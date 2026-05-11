/**
 * Export stats JSON for the Obsidian plugin "spotify-stats-view" (no auth).
 *
 * Usage (from repo root, DATABASE_URL in .env):
 *   npx tsx scripts/export-obsidian-stats.ts [range] [output.json]
 *
 * range: ytd | all | 30d | 3m | 6m | 1y  (default: ytd)
 * output: default ./spotify-stats-export.json
 */

import "dotenv/config";
import { writeFileSync } from "fs";
import { format, parse } from "date-fns";
import {
  parseTimeRange,
  getTotalStats,
  getTopTracks,
  getTopArtists,
  getStreamsByMonth,
} from "../lib/stats";

async function main() {
  const rangeArg = process.argv[2] ?? "ytd";
  const outPath = process.argv[3] ?? "spotify-stats-export.json";

  const filter = parseTimeRange(rangeArg);
  const [totals, topTracks, topArtists, monthlyRaw] = await Promise.all([
    getTotalStats(filter),
    getTopTracks(20, filter),
    getTopArtists(20, filter),
    getStreamsByMonth(12, filter),
  ]);

  const monthly = monthlyRaw.map((row) => {
    const d = parse(`${row.month}-01`, "yyyy-MM-dd", new Date());
    return {
      label: format(d, "MMM yyyy"),
      minutes: row.minutes,
      streams: row.streams,
    };
  });

  const payload = {
    version: 1,
    rangeLabel: filter.label,
    generatedAt: new Date().toISOString(),
    totals: {
      totalMinutes: totals.totalMinutes,
      totalStreams: totals.totalStreams,
      totalHours: totals.totalHours,
    },
    monthly,
    topTracks: topTracks.map((t) => ({
      trackName: t.trackName,
      artistName: t.artistName,
      streams: t.streams,
      albumArtUrl: t.albumArt ?? "",
    })),
    topArtists: topArtists.map((a) => ({
      artistName: a.artistName,
      streams: a.streams,
      minutesListened: a.minutesListened,
      artistArtUrl: a.artistArt ?? "",
    })),
  };

  writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${outPath} (${filter.label})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
