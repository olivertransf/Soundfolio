/**
 * Fixes inflated recent stats from duplicate Last.fm rows and catalog-length durations.
 *
 * 1. Groups real streams by artist + track + playedAt; keeps one row per group.
 * 2. Caps absurd durationMs values (bad Last.fm metadata).
 *
 * Usage: MONGODB_URI=... npx tsx scripts/repair-inflated-streams.ts
 * Add --dry-run to preview without writes.
 */
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto as Crypto;

import "dotenv/config";
import type { Document, Filter } from "mongodb";
import { mongoDb } from "../lib/db";
import { LASTFM_MAX_CATALOG_MS } from "../lib/lastfm";
import { scrobbleIdentityKey } from "../lib/stream-ids";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const db = await mongoDb();
  const col = db.collection("streams");

  const rows = await col
    .find({ isDemo: false })
    .project({
      _id: 1,
      trackId: 1,
      artistName: 1,
      trackName: 1,
      playedAt: 1,
      durationMs: 1,
    })
    .toArray();

  const groups = new Map<
    string,
    { _id: string; trackId: string; durationMs: number; isLastFm: boolean }[]
  >();

  for (const row of rows) {
    const key = scrobbleIdentityKey(row.artistName, row.trackName, row.playedAt);
    const list = groups.get(key) ?? [];
    const isLastFm = /^lfm-/.test(row.trackId);
    list.push({ _id: row._id, trackId: row.trackId, durationMs: row.durationMs, isLastFm });
    groups.set(key, list);
  }

  const toDelete: string[] = [];
  const toCap = new Set<string>();

  for (const list of groups.values()) {
    if (list.length > 1) {
      list.sort((a, b) => {
        const aSpotify = !a.isLastFm ? 0 : 1;
        const bSpotify = !b.isLastFm ? 0 : 1;
        if (aSpotify !== bSpotify) return aSpotify - bSpotify;
        if (a.durationMs !== b.durationMs) return a.durationMs - b.durationMs;
        return a._id.localeCompare(b._id);
      });
      for (const dup of list.slice(1)) toDelete.push(dup._id);
    }
  }

  const inflated = await col
    .find({ isDemo: false, durationMs: { $gt: LASTFM_MAX_CATALOG_MS } })
    .project({ _id: 1 })
    .toArray();
  for (const row of inflated) toCap.add(row._id);

  console.log(
    dryRun ? "[dry-run] " : "",
    `Would delete ${toDelete.length} duplicate rows, cap ${toCap.size} rows above catalog max.`
  );

  if (dryRun) return;

  if (toDelete.length > 0) {
    const del = await col.deleteMany({ _id: { $in: toDelete } } as unknown as Filter<Document>);
    console.log(`Deleted ${del.deletedCount} duplicates.`);
  }

  const capIds = [...toCap];
  if (capIds.length > 0) {
    const upd = await col.updateMany(
      { _id: { $in: capIds } } as unknown as Filter<Document>,
      { $set: { durationMs: LASTFM_MAX_CATALOG_MS, updatedAt: new Date() } }
    );
    console.log(`Capped ${upd.modifiedCount} rows to ${LASTFM_MAX_CATALOG_MS / 60000} min max.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
