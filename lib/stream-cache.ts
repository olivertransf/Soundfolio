import type { Stream } from "@/lib/types/stream";

const CACHE_VERSION = 2;
const CACHE_LIMIT = 4_000;
/** Skip Firestore when cache is this fresh (saves daily read quota). */
export const STREAM_CACHE_TTL_MS = 30 * 60 * 1000;

type CachedStream = Omit<Stream, "playedAt" | "createdAt" | "updatedAt"> & {
  playedAt: string;
  createdAt: string;
  updatedAt: string;
};

type CacheEnvelopeV2 = {
  v: number;
  savedAt: number;
  streams: CachedStream[];
};

function cacheKey(uid: string) {
  return `soundfolio:streams:v${CACHE_VERSION}:${uid}`;
}

function serialize(stream: Stream): CachedStream {
  return {
    ...stream,
    playedAt: stream.playedAt.toISOString(),
    createdAt: stream.createdAt.toISOString(),
    updatedAt: stream.updatedAt.toISOString(),
  };
}

function revive(row: CachedStream): Stream {
  return {
    ...row,
    playedAt: new Date(row.playedAt),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export type StreamCacheSnapshot = {
  streams: Stream[];
  savedAt: number | null;
};

export function readStreamCache(uid: string): StreamCacheSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelopeV2 | CachedStream[];
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return null;
      return { streams: parsed.map(revive), savedAt: null };
    }
    if (!parsed?.streams?.length) return null;
    return {
      streams: parsed.streams.map(revive),
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : null,
    };
  } catch {
    return null;
  }
}

export function writeStreamCache(uid: string, streams: Stream[]) {
  if (typeof window === "undefined") return;
  try {
    const envelope: CacheEnvelopeV2 = {
      v: CACHE_VERSION,
      savedAt: Date.now(),
      streams: streams.slice(0, CACHE_LIMIT).map(serialize),
    };
    localStorage.setItem(cacheKey(uid), JSON.stringify(envelope));
  } catch {
    // Ignore quota errors.
  }
}

export function clearStreamCache(uid: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(cacheKey(uid));
  } catch {
    // Ignore.
  }
}

export function isStreamCacheFresh(savedAt: number | null, ttlMs = STREAM_CACHE_TTL_MS) {
  if (!savedAt) return false;
  return Date.now() - savedAt < ttlMs;
}

export function mergeStreamLists(existing: Stream[], incoming: Stream[]): Stream[] {
  if (incoming.length === 0) return existing;
  const byId = new Map(existing.map((stream) => [stream.id, stream]));
  for (const stream of incoming) {
    byId.set(stream.id, stream);
  }
  return [...byId.values()].sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime());
}
