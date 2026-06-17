/**
 * One-time migration: copy MongoDB `streams` into Firestore `users/{uid}/streams/{id}`.
 *
 * Usage:
 *   MONGODB_URI=... FIREBASE_SERVICE_ACCOUNT_JSON=... npm run db:migrate-firestore -- --uid=lLqJcmE1iYbrHx9OUmLaXriCGAi1
 *   npm run db:migrate-firestore -- --dry-run --uid=YOUR_FIREBASE_UID
 */
import "dotenv/config";
import { MongoClient } from "mongodb";
import { getAdminFirestore } from "../lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { streamDocumentId } from "../lib/types/stream";

type MongoStream = {
  _id: string;
  userId?: string;
  trackId: string;
  trackName: string;
  artistName: string;
  artistArt: string | null;
  albumName: string;
  albumArt: string | null;
  durationMs: number;
  playedAt: Date;
  isDemo: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

const BATCH_LIMIT = 450;

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  const uidArg = process.argv.find((arg) => arg.startsWith("--uid="));
  const uid = uidArg?.slice("--uid=".length).trim() || process.env.LEGACY_USER_ID?.trim();
  return { dryRun, uid };
}

function getMongoUri() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("Missing MONGODB_URI for source MongoDB export.");
  }
  return uri;
}

function toFirestoreData(doc: MongoStream) {
  return {
    trackId: doc.trackId,
    trackName: doc.trackName,
    artistName: doc.artistName,
    artistArt: doc.artistArt,
    albumName: doc.albumName,
    albumArt: doc.albumArt,
    durationMs: doc.durationMs,
    playedAt: Timestamp.fromDate(doc.playedAt),
    isDemo: doc.isDemo,
    createdAt: Timestamp.fromDate(doc.createdAt ?? doc.playedAt),
    updatedAt: Timestamp.fromDate(doc.updatedAt ?? doc.playedAt),
  };
}

function targetDocId(doc: MongoStream, uid: string) {
  return (
    doc._id ||
    streamDocumentId({
      userId: uid,
      trackId: doc.trackId,
      playedAt: doc.playedAt,
    })
  );
}

async function main() {
  const { dryRun, uid } = parseArgs();
  if (!uid) {
    throw new Error("Pass --uid=YOUR_FIREBASE_UID (or set LEGACY_USER_ID).");
  }

  const mongo = new MongoClient(getMongoUri(), { appName: "SoundfolioFirestoreMigration" });
  await mongo.connect();

  const dbName = process.env.MONGODB_DB?.trim() || "soundfolio";
  const collection = mongo.db(dbName).collection<MongoStream>("streams");
  const total = await collection.countDocuments({ isDemo: false });
  console.log(`Found ${total} non-demo MongoDB stream documents.`);

  if (dryRun) {
    console.log(`Dry run only. Would migrate to users/${uid}/streams/*.`);
    await mongo.close();
    return;
  }

  const firestore = getAdminFirestore();
  let migrated = 0;
  let batch = firestore.batch();
  let batchCount = 0;

  const cursor = collection.find({ isDemo: false }).batchSize(500);
  for await (const doc of cursor) {
    const id = targetDocId(doc, uid);
    const ref = firestore.collection("users").doc(uid).collection("streams").doc(id);
    batch.set(ref, toFirestoreData(doc), { merge: true });
    batchCount += 1;
    migrated += 1;

    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      console.log(`Migrated ${migrated}/${total}...`);
      batch = firestore.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  await mongo.close();
  console.log(`Done. Migrated ${migrated} streams to users/${uid}/streams.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
