import "dotenv/config";
import { getRecentTracks, isLastFmConfigured } from "../lib/lastfm";
import {
  filterNovelScrobbles,
  prepareLastFmScrobbleStreams,
} from "../lib/lastfm-sync";
import { getAdminFirestore } from "../lib/firebase/admin";
import { streamDocumentId } from "../lib/types/stream";
import { Timestamp } from "firebase-admin/firestore";

async function main() {
  const username = process.env.LASTFM_USER?.trim();
  const uid = process.env.LEGACY_USER_ID?.trim();
  if (!isLastFmConfigured() || !username || !uid) {
    console.error("Set LASTFM_USER, LASTFM_API_KEY, and LEGACY_USER_ID in .env");
    process.exit(1);
  }

  const firestore = getAdminFirestore();
  const streamsRef = firestore.collection("users").doc(uid).collection("streams");
  const latestSnap = await streamsRef.orderBy("playedAt", "desc").limit(1).get();
  const latest = latestSnap.docs[0]?.data()?.playedAt as Timestamp | undefined;

  const fromTimestamp = latest
    ? Math.max(0, latest.toDate().getTime() / 1000 - 120)
    : undefined;

  const tracks = await getRecentTracks(username, 200, fromTimestamp);
  const readyTracks = tracks.filter((track) => track.playedAt.getTime() <= Date.now() + 5 * 60 * 1000);
  if (readyTracks.length === 0) {
    console.log("No scrobbles ready to import.");
    return;
  }

  const existingSnap = await streamsRef
    .where("playedAt", ">=", readyTracks.reduce((min, t) => (t.playedAt < min ? t.playedAt : min), readyTracks[0].playedAt))
    .get();
  const existing = existingSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      artistName: String(data.artistName ?? ""),
      trackName: String(data.trackName ?? ""),
      playedAt: (data.playedAt as Timestamp).toDate(),
    };
  });

  const novel = filterNovelScrobbles(readyTracks, existing);
  const batch = [...novel].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const prepared = prepareLastFmScrobbleStreams(batch, undefined, { fast: true });
  let totalWritten = 0;
  const BATCH = 450;
  let writeBatch = firestore.batch();
  let batchCount = 0;

  for (const stream of prepared) {
    const id = streamDocumentId({ userId: uid, trackId: stream.trackId, playedAt: stream.playedAt });
    writeBatch.set(streamsRef.doc(id), {
      ...stream,
      playedAt: Timestamp.fromDate(stream.playedAt),
      createdAt: Timestamp.fromDate(stream.playedAt),
      updatedAt: Timestamp.fromDate(stream.playedAt),
    }, { merge: true });
    batchCount += 1;
    totalWritten += 1;
    if (batchCount >= BATCH) {
      await writeBatch.commit();
      writeBatch = firestore.batch();
      batchCount = 0;
    }
  }
  if (batchCount > 0) await writeBatch.commit();

  console.log(`Synced ${totalWritten} new scrobbles (${novel.length} novel / ${readyTracks.length} ready).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
