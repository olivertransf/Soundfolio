import { readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { DEV_LASTFM_USERNAME } from "@/lib/dev-lastfm-user";
import { streamDocumentId, type StreamInput } from "@/lib/types/stream";

const FIREBASE_TOOLS_CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";
const FIREBASE_TOOLS_CLIENT_SECRET = "j9iVZfS8kkCEFUPaAeJV0sAi";

type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  booleanValue?: boolean;
  timestampValue?: string;
  nullValue?: null;
};

type FirestoreDocument = {
  name: string;
  fields?: Record<string, FirestoreValue>;
};

let cachedToken: { value: string; expiresAt: number } | null = null;

function projectId() {
  const id = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID;
  if (!id) throw new Error("Firebase project id is not configured.");
  return id;
}

function assertDevelopment() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Dev library access is only available in development.");
  }
}

async function firebaseCliAccessToken() {
  assertDevelopment();
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const configPath = join(homedir(), ".config/configstore/firebase-tools.json");
  const config = JSON.parse(readFileSync(configPath, "utf8")) as {
    tokens?: { refresh_token?: string };
  };
  const refreshToken = config.tokens?.refresh_token;
  if (!refreshToken) {
    throw new Error("Firebase CLI is not logged in.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: FIREBASE_TOOLS_CLIENT_ID,
      client_secret: FIREBASE_TOOLS_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) {
    throw new Error("Could not refresh the Firebase CLI session.");
  }
  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) {
    throw new Error("Firebase CLI session did not return an access token.");
  }
  cachedToken = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return body.access_token;
}

let firestoreChain: Promise<unknown> = Promise.resolve();

async function firestoreFetch(url: string, init: RequestInit) {
  const run = async () => {
    let delay = 1000;
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(url, init);
      if (response.status !== 429) return response;
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
    throw new Error("Firestore request failed (429).");
  };
  const result = firestoreChain.then(run, run);
  firestoreChain = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function stringField(fields: Record<string, FirestoreValue>, key: string) {
  return fields[key]?.stringValue ?? "";
}

function nullableString(fields: Record<string, FirestoreValue>, key: string) {
  const value = fields[key];
  if (!value || "nullValue" in value) return null;
  return value.stringValue ?? null;
}

export type DevLibraryUser = {
  uid: string;
  displayName: string | null;
  lastfmUsername: string | null;
};

const DEV_UID = "lLqJcmE1iYbrHx9OUmLaXriCGAi1";

export async function getDevUser(): Promise<DevLibraryUser> {
  assertDevelopment();
  return {
    uid: DEV_UID,
    displayName: null,
    lastfmUsername: DEV_LASTFM_USERNAME,
  };
}

export async function getSoleDevUser(): Promise<DevLibraryUser> {
  return getDevUser();
}

export type DevStreamRow = {
  id: string;
  trackId: string;
  trackName: string;
  artistName: string;
  artistArt: string | null;
  albumName: string;
  albumArt: string | null;
  durationMs: number;
  playedAt: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
};

const STREAM_PAGE_SIZE = 1000;

function mapStream(document: FirestoreDocument): DevStreamRow {
  const fields = document.fields ?? {};
  const playedAt = fields.playedAt?.timestampValue ?? new Date(0).toISOString();
  return {
    id: document.name.split("/").pop() ?? "",
    trackId: stringField(fields, "trackId"),
    trackName: stringField(fields, "trackName"),
    artistName: stringField(fields, "artistName"),
    artistArt: nullableString(fields, "artistArt"),
    albumName: stringField(fields, "albumName"),
    albumArt: nullableString(fields, "albumArt"),
    durationMs: Number(fields.durationMs?.integerValue ?? 0),
    playedAt,
    isDemo: fields.isDemo?.booleanValue ?? false,
    createdAt: fields.createdAt?.timestampValue ?? playedAt,
    updatedAt: fields.updatedAt?.timestampValue ?? playedAt,
  };
}

export async function getDevStreamPage(uid: string, pageToken?: string) {
  assertDevelopment();
  const cursor = pageToken
    ? (JSON.parse(Buffer.from(pageToken, "base64url").toString("utf8")) as {
        playedAt: string;
        name: string;
      })
    : null;
  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: "streams" }],
    orderBy: [
      { field: { fieldPath: "playedAt" }, direction: "DESCENDING" },
      { field: { fieldPath: "__name__" }, direction: "DESCENDING" },
    ],
    limit: STREAM_PAGE_SIZE,
  };
  if (cursor) {
    structuredQuery.startAt = {
      values: [{ timestampValue: cursor.playedAt }, { referenceValue: cursor.name }],
      before: false,
    };
  }

  const token = await firebaseCliAccessToken();
  const response = await firestoreFetch(
    `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/users/${uid}:runQuery`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ structuredQuery }),
    }
  );
  if (!response.ok) {
    throw new Error(`Firestore request failed (${response.status}).`);
  }
  const rows = (await response.json()) as Array<{ document?: FirestoreDocument }>;
  const documents = rows.flatMap((row) => (row.document ? [row.document] : []));
  const streams = documents.map(mapStream);
  const last = documents[documents.length - 1];
  const nextPageToken =
    documents.length === STREAM_PAGE_SIZE && last?.fields?.playedAt?.timestampValue
      ? Buffer.from(
          JSON.stringify({
            playedAt: last.fields.playedAt.timestampValue,
            name: last.name,
          })
        ).toString("base64url")
      : undefined;

  return { streams, nextPageToken };
}

const libraryCachePath = join(tmpdir(), "soundfolio-dev-library.json");

type LibraryCache = {
  savedAt: number;
  user: DevLibraryUser;
  streams: DevStreamRow[];
  nextPageToken?: string;
  complete: boolean;
  expectedTotal?: number;
};

let memoryCache: LibraryCache | null = null;
let appending: Promise<void> | null = null;
let filling: Promise<void> | null = null;
let counting: Promise<void> | null = null;
let fillPausedUntil = 0;
let headRefreshPausedUntil = 0;
let refreshingHead: Promise<void> | null = null;

const COMPLETE_CACHE_REFRESH_AFTER_MS = 15 * 60 * 1000;

function refreshNewestPage(cache: LibraryCache) {
  if (!cache.complete || refreshingHead || Date.now() < headRefreshPausedUntil) return;
  if (Date.now() - cache.savedAt < COMPLETE_CACHE_REFRESH_AFTER_MS) return;
  refreshingHead = (async () => {
    try {
      const page = await getDevStreamPage(cache.user.uid);
      const seen = new Set(cache.streams.map((row) => row.id));
      const fresh = page.streams.filter((row) => !seen.has(row.id));
      if (fresh.length > 0) cache.streams.unshift(...fresh);
      cache.savedAt = Date.now();
      writeDiskCache(cache);
    } catch {
      headRefreshPausedUntil = Date.now() + 60_000;
    }
  })().finally(() => {
    refreshingHead = null;
  });
}
let pagesSinceWrite = 0;

function readDiskCache() {
  try {
    const cache = JSON.parse(readFileSync(libraryCachePath, "utf8")) as LibraryCache;
    if (!cache.user?.uid || !Array.isArray(cache.streams) || cache.streams.length === 0) return null;
    if (cache.complete === undefined) cache.complete = true;
    return cache;
  } catch {
    return null;
  }
}

function writeDiskCache(cache: LibraryCache) {
  writeFileSync(libraryCachePath, JSON.stringify(cache));
}

function currentCache(user: DevLibraryUser) {
  if (!memoryCache) {
    memoryCache =
      readDiskCache() ?? {
        savedAt: Date.now(),
        user,
        streams: [],
        complete: false,
      };
  }
  return memoryCache;
}

function persistCache(cache: LibraryCache) {
  pagesSinceWrite += 1;
  if (!cache.complete && pagesSinceWrite < 4) return;
  pagesSinceWrite = 0;
  cache.savedAt = Date.now();
  writeDiskCache(cache);
}

async function countDevStreams(uid: string) {
  const token = await firebaseCliAccessToken();
  const response = await firestoreFetch(
    `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/users/${uid}:runAggregationQuery`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        structuredAggregationQuery: {
          structuredQuery: { from: [{ collectionId: "streams" }] },
          aggregations: [{ alias: "total", count: {} }],
        },
      }),
    }
  );
  if (!response.ok) {
    throw new Error(`Firestore request failed (${response.status}).`);
  }
  const rows = (await response.json()) as Array<{
    result?: { aggregateFields?: { total?: { integerValue?: string } } };
  }>;
  const raw = rows[0]?.result?.aggregateFields?.total?.integerValue;
  const total = raw ? Number(raw) : 0;
  return Number.isFinite(total) ? total : 0;
}

function scheduleCount(cache: LibraryCache, uid: string) {
  if (cache.complete || cache.expectedTotal || counting) return;
  counting = countDevStreams(uid)
    .then((total) => {
      cache.expectedTotal = total;
    })
    .catch(() => undefined)
    .finally(() => {
      counting = null;
    });
}

async function appendNextPage() {
  const user = await getDevUser();
  const cache = currentCache(user);
  if (cache.complete) return;
  if (!appending) {
    appending = (async () => {
      const page = await getDevStreamPage(user.uid, cache.nextPageToken);
      const seen = new Set(cache.streams.map((row) => row.id));
      cache.streams.push(...page.streams.filter((row) => !seen.has(row.id)));
      cache.nextPageToken = page.nextPageToken;
      cache.complete = !page.nextPageToken;
      cache.user = user;
      persistCache(cache);
    })().finally(() => {
      appending = null;
    });
  }
  await appending;
}

async function fillLibrary() {
  const user = await getDevUser();
  const cache = currentCache(user);
  while (!cache.complete && Date.now() >= fillPausedUntil) {
    const before = cache.streams.length;
    try {
      await appendNextPage();
    } catch {
      fillPausedUntil = Date.now() + 8_000;
      break;
    }
    if (cache.streams.length === before) break;
  }
}

function scheduleFill() {
  const cache = memoryCache;
  if (!cache || cache.complete || filling || Date.now() < fillPausedUntil) return;
  filling = fillLibrary().finally(() => {
    filling = null;
  });
}

export async function readDevLibrarySlice(start: number) {
  assertDevelopment();
  const user = await getDevUser();
  const cache = currentCache(user);
  if (cache.streams.length === 0 && !cache.complete) {
    try {
      await appendNextPage();
    } catch (error) {
      if (cache.streams.length === 0) {
        throw error instanceof Error ? error : new Error("Firestore request failed (429).");
      }
    }
  }
  scheduleCount(cache, user.uid);
  scheduleFill();
  refreshNewestPage(cache);
  const streams = cache.streams.slice(start);
  const loaded = cache.streams.length;
  const consumed = start + streams.length;
  const caughtUp = consumed >= loaded;
  const nextOffset = cache.complete ? (caughtUp ? null : consumed) : caughtUp ? loaded : consumed;
  return {
    user,
    streams,
    nextOffset,
    loaded,
    total: cache.complete ? loaded : (cache.expectedTotal ?? null),
    complete: cache.complete,
    partial: !cache.complete && caughtUp,
  };
}

export async function getDevLibrary() {
  const user = await getDevUser();
  const cache = currentCache(user);
  while (!cache.complete) {
    await appendNextPage();
  }
  return cache;
}

function firestoreValue(value: string | number | boolean | Date | null) {
  if (value === null) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return { integerValue: String(Math.round(value)) };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  return { stringValue: value };
}

export async function writeDevStreams(uid: string, streams: StreamInput[]) {
  assertDevelopment();
  if (streams.length === 0) return 0;
  const token = await firebaseCliAccessToken();
  const project = projectId();
  let written = 0;

  for (let index = 0; index < streams.length; index += 200) {
    const batch = streams.slice(index, index + 200);
    const writes = batch.map((stream) => {
      const id = streamDocumentId({ ...stream, userId: uid });
      const playedAt = stream.playedAt;
      return {
        update: {
          name: `projects/${project}/databases/(default)/documents/users/${uid}/streams/${id}`,
          fields: {
            trackId: firestoreValue(stream.trackId),
            trackName: firestoreValue(stream.trackName),
            artistName: firestoreValue(stream.artistName),
            artistArt: firestoreValue(stream.artistArt ?? null),
            albumName: firestoreValue(stream.albumName),
            albumArt: firestoreValue(stream.albumArt ?? null),
            durationMs: firestoreValue(stream.durationMs),
            playedAt: firestoreValue(playedAt),
            isDemo: firestoreValue(stream.isDemo ?? false),
            createdAt: firestoreValue(stream.createdAt ?? playedAt),
            updatedAt: firestoreValue(stream.updatedAt ?? playedAt),
          },
        },
      };
    });
    const response = await firestoreFetch(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:commit`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ writes }),
      }
    );
    if (!response.ok) {
      throw new Error(`Firestore request failed (${response.status}).`);
    }
    written += batch.length;
  }

  if (memoryCache) {
    const rows = streams.map((stream) => inputToDevRow(uid, stream));
    const seen = new Set(rows.map((row) => row.id));
    memoryCache.streams = [...rows, ...memoryCache.streams.filter((row) => !seen.has(row.id))];
    memoryCache.savedAt = Date.now();
    writeDiskCache(memoryCache);
  }
  return written;
}

function inputToDevRow(uid: string, stream: StreamInput): DevStreamRow {
  const playedAt = stream.playedAt.toISOString();
  return {
    id: streamDocumentId({ ...stream, userId: uid }),
    trackId: stream.trackId,
    trackName: stream.trackName,
    artistName: stream.artistName,
    artistArt: stream.artistArt ?? null,
    albumName: stream.albumName,
    albumArt: stream.albumArt ?? null,
    durationMs: stream.durationMs,
    playedAt,
    isDemo: stream.isDemo ?? false,
    createdAt: (stream.createdAt ?? stream.playedAt).toISOString(),
    updatedAt: (stream.updatedAt ?? stream.playedAt).toISOString(),
  };
}
