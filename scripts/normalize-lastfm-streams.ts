import "dotenv/config";
import { db, mongoDb, type Stream } from "../lib/db";
import { getOffsetMs, getStatsTimeZone } from "../lib/stats-timezone";
import { lastFmTrackId } from "../lib/stream-ids";

async function main() {
  const database = await mongoDb();
  const collection = database.collection<Omit<Stream, "id"> & { _id: string }>("streams");
  const now = Date.now();
  const timeZone = getStatsTimeZone();
  const legacyRows = await collection
    .find({ trackId: /^lfm-\d+$/ })
    .project<Pick<Stream, "trackId" | "trackName" | "artistName" | "albumName" | "playedAt"> & { _id: string }>({
      _id: 1,
      trackId: 1,
      trackName: 1,
      artistName: 1,
      albumName: 1,
      playedAt: 1,
    })
    .toArray();

  if (legacyRows.length === 0) {
    console.log("No legacy Last.fm rows to normalize.");
    return;
  }

  const writes = legacyRows.map((row) => {
    const playedAt =
      row.playedAt.getTime() > now + 5 * 60 * 1000
        ? new Date(row.playedAt.getTime() + getOffsetMs(row.playedAt, timeZone))
        : row.playedAt;

    return {
      updateOne: {
        filter: { _id: row._id },
        update: {
          $set: {
            trackId: lastFmTrackId(row.artistName, row.trackName, row.albumName),
            playedAt,
            updatedAt: new Date(),
          },
        },
      },
    };
  });

  const result = await collection.bulkWrite(writes, { ordered: false });
  console.log(`Normalized ${result.modifiedCount} Last.fm rows.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
