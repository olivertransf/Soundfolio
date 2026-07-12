/**
 * Backfill Last.fm catalog durations in users/{uid}/streams via Admin SDK.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=... npx tsx scripts/backfill-lastfm-catalog-duration-firestore.ts --uid=YOUR_UID
 *   npm run db:backfill-lfm-duration -- --uid=YOUR_UID --dry-run
 */
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto as Crypto;

import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "../lib/firebase/admin";
import { resolveLastFmCatalogDurationMs } from "../lib/lastfm";

const dryRun = process.argv.includes("--dry-run");
const uidArg = process.argv.find((arg) => arg.startsWith("--uid="));
const uid = uidArg?.slice("--uid=".length).trim() || process.env.LEGACY_USER_ID?.trim();
const CONCURRENCY = 5;
const BATCH_LIMIT = 450;

async function main() {
  if (!uid) {
    throw new Error("Pass --uid=YOUR_FIREBASE_UID (or set LEGACY_USER_ID).");
  }

  const firestore = getAdminFirestore();
  const streamsRef = firestore.collection("users").doc(uid).collection("streams");
  const snap = await streamsRef.get();
  const rows = snap.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        trackId: String(data.trackId ?? ""),
        artistName: String(data.artistName ?? ""),
        trackName: String(data.trackName ?? ""),
        durationMs: Number(data.durationMs ?? 0),
        isDemo: Boolean(data.isDemo),
      };
    })
    .filter((row) => !row.isDemo && row.trackId.startsWith("lfm-"));

  console.log(`Loaded ${rows.length} Last.fm streams for users/${uid}/streams.`);

  const unique = new Map<string, { artist: string; track: string }>();
  for (const row of rows) {
    const key = `${row.artistName}\0${row.trackName}`;
    if (!unique.has(key)) unique.set(key, { artist: row.artistName, track: row.trackName });
  }

  const durationCache = new Map<string, number>();
  const list = [...unique.values()];
  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const batch = list.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(({ artist, track }) => resolveLastFmCatalogDurationMs(artist, track, durationCache))
    );
    if (i > 0 && i % 50 === 0) console.log(`Resolved ${i}/${list.length} tracks…`);
  }

  const writes: { id: string; durationMs: number }[] = [];
  for (const row of rows) {
    const ms = durationCache.get(`${row.artistName}\0${row.trackName}`)!;
    if (row.durationMs !== ms) writes.push({ id: row.id, durationMs: ms });
  }

  console.log(
    `${dryRun ? "[dry-run] " : ""}Would update ${writes.length} of ${rows.length} rows (${list.length} unique tracks).`
  );

  if (dryRun || writes.length === 0) return;

  let updated = 0;
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const chunk = writes.slice(i, i + BATCH_LIMIT);
    const batch = firestore.batch();
    const now = Timestamp.now();
    for (const write of chunk) {
      batch.set(
        streamsRef.doc(write.id),
        { durationMs: write.durationMs, updatedAt: now },
        { merge: true }
      );
    }
    await batch.commit();
    updated += chunk.length;
    console.log(`Updated ${updated}/${writes.length}…`);
  }
  console.log(`Done. Updated ${updated} rows.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
