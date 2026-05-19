/**
 * One-time bridge for moving existing Soundfolio streams from Postgres to MongoDB.
 *
 * Required env:
 * - POSTGRES_DATABASE_URL: old Neon/Postgres connection string
 * - MONGODB_URI: new MongoDB Atlas connection string
 * - MONGODB_DB: optional, defaults to soundfolio
 *
 * Usage:
 *   POSTGRES_DATABASE_URL="postgresql://..." MONGODB_URI="mongodb+srv://..." npx tsx scripts/migrate-postgres-to-mongodb.ts
 */

import "dotenv/config";
import { Client } from "pg";
import { db } from "../lib/db";

const BATCH_SIZE = 1_000;

type PostgresStreamRow = {
  id: string;
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

async function main() {
  const connectionString = process.env.POSTGRES_DATABASE_URL;
  if (!connectionString) {
    throw new Error("Set POSTGRES_DATABASE_URL to the old Neon/Postgres connection string.");
  }

  await db.ensureIndexes();

  const pg = new Client({ connectionString });
  await pg.connect();

  let offset = 0;
  let migrated = 0;

  try {
    while (true) {
      const { rows } = await pg.query<PostgresStreamRow>(
        `select
          id,
          "trackId",
          "trackName",
          "artistName",
          "artistArt",
          "albumName",
          "albumArt",
          "durationMs",
          "playedAt",
          "isDemo"
        from "Stream"
        order by "playedAt" asc
        limit $1 offset $2`,
        [BATCH_SIZE, offset]
      );

      if (rows.length === 0) break;

      const result = await db.stream.createMany({
        data: rows.map((row) => ({
          id: row.id,
          trackId: row.trackId,
          trackName: row.trackName,
          artistName: row.artistName,
          artistArt: row.artistArt,
          albumName: row.albumName,
          albumArt: row.albumArt,
          durationMs: row.durationMs,
          playedAt: row.playedAt,
          isDemo: row.isDemo,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })),
        skipDuplicates: true,
      });

      migrated += result.count;
      offset += rows.length;
      console.log(`Scanned ${offset} Postgres rows, inserted ${migrated} MongoDB documents.`);
    }
  } finally {
    await pg.end();
    await db.$disconnect();
  }

  console.log(`Migration complete. Inserted ${migrated} streams.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
