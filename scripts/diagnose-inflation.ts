import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto as Crypto;

import "dotenv/config";
import { mongoDb } from "../lib/db";
import { formatCalendarDateInZone, getStatsTimeZone } from "../lib/stats-timezone";
import { scrobbleIdentityKey } from "../lib/stream-ids";

async function main() {
  const db = await mongoDb();
  const col = db.collection("streams");
  const tz = getStatsTimeZone();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const rows = await col
    .find({ isDemo: false, playedAt: { $gte: since } })
    .project({
      trackId: 1,
      trackName: 1,
      artistName: 1,
      playedAt: 1,
      durationMs: 1,
    })
    .toArray();

  const byDay: Record<
    string,
    { plays: number; minutes: number; lfm: number; spotify: number; other: number }
  > = {};

  const durHist: Record<number, number> = {};
  const identity = new Map<string, number>();
  const nearDupes: { key: string; n: number; gapSec: number }[] = [];
  const byArtistTrack = new Map<string, { times: number[]; count: number }>();

  for (const s of rows) {
    const day = formatCalendarDateInZone(s.playedAt, tz);
    if (!byDay[day]) byDay[day] = { plays: 0, minutes: 0, lfm: 0, spotify: 0, other: 0 };
    byDay[day].plays++;
    const min = Math.round(s.durationMs / 60000);
    byDay[day].minutes += min;

    const isLfm = /^lfm-/.test(s.trackId);
    const isSpotify = !isLfm && s.trackId.length > 10 && !s.trackId.startsWith("lfm");
    if (isLfm) byDay[day].lfm++;
    else if (isSpotify || /^[a-zA-Z0-9]{22}$/.test(s.trackId)) byDay[day].spotify++;
    else byDay[day].other++;

    durHist[s.durationMs] = (durHist[s.durationMs] ?? 0) + 1;

    const idKey = scrobbleIdentityKey(s.artistName, s.trackName, s.playedAt);
    identity.set(idKey, (identity.get(idKey) ?? 0) + 1);

    const atKey = `${s.artistName.trim().toLowerCase()}\0${s.trackName.trim().toLowerCase()}`;
    const bucket = byArtistTrack.get(atKey) ?? { times: [], count: 0 };
    bucket.times.push(s.playedAt.getTime());
    bucket.count++;
    byArtistTrack.set(atKey, bucket);
  }

  let exactDupes = 0;
  for (const n of identity.values()) if (n > 1) exactDupes += n - 1;

  // Near-duplicates: same artist+track within 90s
  let nearDupeRows = 0;
  for (const [, { times }] of byArtistTrack) {
    if (times.length < 2) continue;
    times.sort((a, b) => a - b);
    for (let i = 1; i < times.length; i++) {
      const gap = (times[i] - times[i - 1]) / 1000;
      if (gap > 0 && gap < 90) nearDupeRows++;
    }
  }

  console.log("Timezone:", tz);
  console.log(`Rows last 14d: ${rows.length}`);
  console.log(`Exact duplicate identity keys: ${exactDupes} extra rows`);
  console.log(`Near-duplicate plays (same song <90s apart): ${nearDupeRows} gaps\n`);

  console.log("Minutes by day:");
  for (const [day, v] of Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b))) {
    const implied3m = v.plays * 3;
    console.log(
      `  ${day}: ${v.plays} plays, ${v.minutes} min (lfm ${v.lfm}, spotify ${v.spotify}) — at 3m/play would be ${implied3m}m`
    );
  }

  console.log("\nTop durationMs values:");
  for (const [ms, n] of Object.entries(durHist)
    .sort((a, b) => Number(b) - Number(a))
    .slice(0, 8)) {
    console.log(`  ${ms} ms (${Math.round(Number(ms) / 60000)} min): ${n} rows`);
  }

  // Cross-source overlap sample: same artist+track+minute
  const minuteBuckets = new Map<string, Set<string>>();
  for (const s of rows) {
    const t = s.playedAt;
    const bucket = `${s.artistName}\0${s.trackName}\0${formatCalendarDateInZone(t, tz)}T${String(getHour(t, tz)).padStart(2, "0")}:${String(getMin(t, tz)).padStart(2, "0")}`;
    const sources = minuteBuckets.get(bucket) ?? new Set();
    sources.add(/^lfm-/.test(s.trackId) ? "lfm" : "spotify");
    minuteBuckets.set(bucket, sources);
  }
  let bothSources = 0;
  for (const s of minuteBuckets.values()) if (s.has("lfm") && s.has("spotify")) bothSources++;

  console.log(`\nMinute buckets with BOTH Last.fm and Spotify: ${bothSources}`);

  const inflated = rows.filter((r) => r.durationMs > 240_000);
  if (inflated.length > 0) {
    console.log(`\nStill >4min duration: ${inflated.length} rows`);
    for (const s of inflated.slice(0, 5)) {
      console.log(`  ${Math.round(s.durationMs / 60000)}m ${s.artistName} - ${s.trackName}`);
    }
  }
}

function getHour(d: Date, tz: string) {
  return parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(d),
    10
  );
}

function getMin(d: Date, tz: string) {
  return parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, minute: "numeric" }).format(d),
    10
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
