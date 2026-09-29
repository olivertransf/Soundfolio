import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
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

async function firestoreFetch(url: string, init: RequestInit) {
  let delay = 1000;
  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await fetch(url, init);
    if (response.status !== 429) return response;
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay *= 2;
  }
  throw new Error("Firestore request failed (429).");
}

async function firestoreGet(path: string) {
  const token = await firebaseCliAccessToken();
  const response = await firestoreFetch(
    `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/${path}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!response.ok) {
    throw new Error(`Firestore request failed (${response.status}).`);
  }
  return response.json() as Promise<unknown>;
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

export async function getSoleDevUser(): Promise<DevLibraryUser> {
  assertDevelopment();
  const body = (await firestoreGet("users?pageSize=2")) as { documents?: FirestoreDocument[] };
  const documents = body.documents ?? [];
  if (documents.length !== 1) {
    throw new Error("Expected exactly one user.");
  }
  const document = documents[0];
  if (!document) throw new Error("Expected exactly one user.");
  const uid = document.name.split("/").pop() ?? "";
  const fields = document.fields ?? {};
  return {
    uid,
    displayName: nullableString(fields, "displayName"),
    lastfmUsername: nullableString(fields, "lastfmUsername")?.trim() || DEV_LASTFM_USERNAME,
  };
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
};

let memoryCache: LibraryCache | null = null;
let loadingLibrary: Promise<LibraryCache> | null = null;

function readDiskCache() {
  try {
    const cache = JSON.parse(readFileSync(libraryCachePath, "utf8")) as LibraryCache;
    if (Date.now() - cache.savedAt > 15 * 60 * 1000) return null;
    if (!cache.user?.uid || !Array.isArray(cache.streams) || cache.streams.length === 0) return null;
    return cache;
  } catch {
    return null;
  }
}

export function getDevLibrary() {
  if (memoryCache) return Promise.resolve(memoryCache);
  const disk = readDiskCache();
  if (disk) {
    memoryCache = disk;
    return Promise.resolve(disk);
  }
  if (!loadingLibrary) {
    loadingLibrary = (async () => {
      const user = await getSoleDevUser();
      const streams: DevStreamRow[] = [];
      let pageToken: string | undefined;
      do {
        const page = await getDevStreamPage(user.uid, pageToken);
        streams.push(...page.streams);
        pageToken = page.nextPageToken;
      } while (pageToken);
      const cache = { savedAt: Date.now(), user, streams };
      memoryCache = cache;
      writeFileSync(libraryCachePath, JSON.stringify(cache));
      return cache;
    })().finally(() => {
      loadingLibrary = null;
    });
  }
  return loadingLibrary;
}

export function invalidateDevLibraryCache() {
  memoryCache = null;
  try {
    unlinkSync(libraryCachePath);
  } catch {
    // cache file may not exist yet
  }
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

  invalidateDevLibraryCache();
  return written;
}
