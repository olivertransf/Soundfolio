import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { clearStreamCache as clearLegacyStreamCache, readStreamCache as readLegacyStreamCache } from "@/lib/stream-cache";
import type { Stream } from "@/lib/types/stream";

const DB_NAME = "soundfolio-stream-cache";
const DB_VERSION = 1;
const STREAM_STORE = "streams";
const META_STORE = "meta";
const CACHE_VERSION = 1;

type CachedStream = Omit<Stream, "playedAt" | "createdAt" | "updatedAt"> & {
  playedAt: string;
  playedAtMs: number;
  createdAt: string;
  updatedAt: string;
};

type StreamRow = CachedStream & {
  uid: string;
};

export type StreamCacheMeta = {
  uid: string;
  v: number;
  savedAt: number;
  fullyLoaded: boolean;
  lastDocId?: string;
  newestPlayedAt?: string;
  oldestPlayedAt?: string;
  streamCount: number;
};

export type StreamCacheSnapshot = {
  streams: Stream[];
  meta: StreamCacheMeta | null;
};

export type StreamCachePagination = {
  hasMore: boolean;
  lastDocId?: string;
};

type SoundfolioCacheDb = DBSchema & {
  [STREAM_STORE]: {
    key: [string, string];
    value: StreamRow;
    indexes: {
      "by-uid": string;
      "by-uid-playedAt": [string, number];
    };
  };
  [META_STORE]: {
    key: string;
    value: StreamCacheMeta;
  };
};

let dbPromise: Promise<IDBPDatabase<SoundfolioCacheDb>> | null = null;

function getDb() {
  if (typeof window === "undefined") return null;
  dbPromise ??= openDB<SoundfolioCacheDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STREAM_STORE)) {
        const streams = db.createObjectStore(STREAM_STORE, { keyPath: ["uid", "id"] });
        streams.createIndex("by-uid", "uid");
        streams.createIndex("by-uid-playedAt", ["uid", "playedAtMs"]);
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "uid" });
      }
    },
  });
  return dbPromise;
}

function serialize(uid: string, stream: Stream): StreamRow {
  return {
    ...stream,
    uid,
    playedAt: stream.playedAt.toISOString(),
    playedAtMs: stream.playedAt.getTime(),
    createdAt: stream.createdAt.toISOString(),
    updatedAt: stream.updatedAt.toISOString(),
  };
}

function revive(row: StreamRow): Stream {
  const stream: CachedStream = row;
  return {
    ...stream,
    playedAt: new Date(row.playedAt),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function metaFromStreams(
  uid: string,
  streams: Stream[],
  pagination?: StreamCachePagination,
  previous?: StreamCacheMeta | null
): StreamCacheMeta {
  const sorted = [...streams].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());
  return {
    uid,
    v: CACHE_VERSION,
    savedAt: Date.now(),
    fullyLoaded: pagination ? !pagination.hasMore : previous?.fullyLoaded ?? false,
    lastDocId: pagination?.lastDocId ?? previous?.lastDocId ?? sorted[sorted.length - 1]?.id,
    newestPlayedAt: sorted[0]?.playedAt.toISOString() ?? previous?.newestPlayedAt,
    oldestPlayedAt: sorted[sorted.length - 1]?.playedAt.toISOString() ?? previous?.oldestPlayedAt,
    streamCount: sorted.length,
  };
}

async function migrateLegacyCache(uid: string) {
  const db = getDb();
  if (!db) return;
  const existingMeta = await (await db).get(META_STORE, uid);
  if (existingMeta) return;

  const legacy = readLegacyStreamCache(uid);
  if (!legacy?.streams.length) return;

  await writeStreamCache(uid, legacy.streams, {
    hasMore: legacy.hasMore ?? true,
    lastDocId: legacy.lastDocId,
  });
  clearLegacyStreamCache(uid);
}

export async function readStreamCache(uid: string): Promise<StreamCacheSnapshot | null> {
  const dbPromise = getDb();
  if (!dbPromise) return null;

  await migrateLegacyCache(uid);
  const db = await dbPromise;
  const [rows, meta] = await Promise.all([
    db.getAllFromIndex(STREAM_STORE, "by-uid", uid),
    db.get(META_STORE, uid),
  ]);

  if (rows.length === 0) return null;
  const streams = rows.map(revive).sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());
  return {
    streams,
    meta: meta
      ? { ...meta, streamCount: streams.length }
      : metaFromStreams(uid, streams, { hasMore: true }),
  };
}

export async function upsertStreamCache(
  uid: string,
  streams: Stream[],
  pagination?: StreamCachePagination
): Promise<StreamCacheMeta | null> {
  const dbPromise = getDb();
  if (!dbPromise || streams.length === 0) return null;

  const db = await dbPromise;
  const tx = db.transaction([STREAM_STORE, META_STORE], "readwrite");
  const previous = await tx.objectStore(META_STORE).get(uid);
  await Promise.all(streams.map((stream) => tx.objectStore(STREAM_STORE).put(serialize(uid, stream))));

  const allRows = await tx.objectStore(STREAM_STORE).index("by-uid").getAll(uid);
  const allStreams = allRows.map(revive);
  const meta = metaFromStreams(uid, allStreams, pagination, previous);
  await tx.objectStore(META_STORE).put(meta);
  await tx.done;
  return meta;
}

export async function writeStreamCache(
  uid: string,
  streams: Stream[],
  pagination?: StreamCachePagination
): Promise<StreamCacheMeta | null> {
  return upsertStreamCache(uid, streams, pagination);
}

export async function updateStreamCacheMeta(
  uid: string,
  patch: Partial<Omit<StreamCacheMeta, "uid" | "v">>
): Promise<StreamCacheMeta | null> {
  const dbPromise = getDb();
  if (!dbPromise) return null;
  const db = await dbPromise;
  const existing = await db.get(META_STORE, uid);
  if (!existing) return null;
  const next = { ...existing, ...patch, uid, v: CACHE_VERSION };
  await db.put(META_STORE, next);
  return next;
}

export async function clearStreamCache(uid: string) {
  const dbPromise = getDb();
  clearLegacyStreamCache(uid);
  if (!dbPromise) return;

  const db = await dbPromise;
  const tx = db.transaction([STREAM_STORE, META_STORE], "readwrite");
  const rows = await tx.objectStore(STREAM_STORE).index("by-uid").getAllKeys(uid);
  await Promise.all(rows.map((key) => tx.objectStore(STREAM_STORE).delete(key)));
  await tx.objectStore(META_STORE).delete(uid);
  await tx.done;
}
