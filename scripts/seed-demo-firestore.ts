/**
 * Seed public demo streams into Firestore `demo_streams`.
 *
 *   FIREBASE_SERVICE_ACCOUNT_JSON=... npm run db:seed-demo-firestore
 */
import "dotenv/config";
import { getAdminFirestore } from "../lib/firebase/admin";
import { getDemoStreams } from "../lib/demo-seed";
import { Timestamp } from "firebase-admin/firestore";

const BATCH_LIMIT = 450;

async function main() {
  const firestore = getAdminFirestore();
  const collection = firestore.collection("demo_streams");
  const streams = getDemoStreams();

  const existing = await collection.limit(1).get();
  if (!existing.empty && !process.argv.includes("--force")) {
    console.log("demo_streams already has data. Pass --force to replace.");
    return;
  }

  if (process.argv.includes("--force")) {
    const snap = await collection.get();
    let batch = firestore.batch();
    let count = 0;
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      count += 1;
      if (count >= BATCH_LIMIT) {
        await batch.commit();
        batch = firestore.batch();
        count = 0;
      }
    }
    if (count > 0) await batch.commit();
    console.log(`Removed ${snap.size} existing demo documents.`);
  }

  let batch = firestore.batch();
  let batchCount = 0;
  let written = 0;

  for (const stream of streams) {
    const ref = collection.doc(stream.id);
    batch.set(ref, {
      trackId: stream.trackId,
      trackName: stream.trackName,
      artistName: stream.artistName,
      artistArt: stream.artistArt,
      albumName: stream.albumName,
      albumArt: stream.albumArt,
      durationMs: stream.durationMs,
      playedAt: Timestamp.fromDate(stream.playedAt),
      isDemo: true,
      createdAt: Timestamp.fromDate(stream.playedAt),
      updatedAt: Timestamp.fromDate(stream.playedAt),
    });
    batchCount += 1;
    written += 1;

    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      console.log(`Seeded ${written}/${streams.length}...`);
      batch = firestore.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) await batch.commit();
  console.log(`Done. Seeded ${written} demo streams.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
