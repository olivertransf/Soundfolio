"use client";

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
  orderBy,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { type Stream, type StreamInput, streamDocumentId } from "@/lib/types/stream";

const BATCH_LIMIT = 450;
/** Recent plays per Firestore page — keep low to protect daily read quota. */
export const STREAMS_PAGE_SIZE = 400;

function userStreamsRef(uid: string) {
  return collection(getFirebaseFirestore(), "users", uid, "streams");
}

function toTimestamp(value: Date) {
  return Timestamp.fromDate(value);
}

function fromDoc(id: string, data: Record<string, unknown>): Stream {
  return {
    id,
    trackId: String(data.trackId ?? ""),
    trackName: String(data.trackName ?? ""),
    artistName: String(data.artistName ?? ""),
    artistArt: (data.artistArt as string | null | undefined) ?? null,
    albumName: String(data.albumName ?? ""),
    albumArt: (data.albumArt as string | null | undefined) ?? null,
    durationMs: Number(data.durationMs ?? 0),
    playedAt: (data.playedAt as Timestamp).toDate(),
    isDemo: Boolean(data.isDemo),
    createdAt: (data.createdAt as Timestamp | undefined)?.toDate() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp | undefined)?.toDate() ?? new Date(),
  };
}

function toFirestoreData(stream: StreamInput) {
  const now = new Date();
  return {
    trackId: stream.trackId,
    trackName: stream.trackName,
    artistName: stream.artistName,
    artistArt: stream.artistArt ?? null,
    albumName: stream.albumName,
    albumArt: stream.albumArt ?? null,
    durationMs: stream.durationMs,
    playedAt: toTimestamp(stream.playedAt),
    isDemo: stream.isDemo ?? false,
    createdAt: toTimestamp(stream.createdAt ?? now),
    updatedAt: toTimestamp(stream.updatedAt ?? now),
  };
}

export async function fetchUserStreamsPage(
  uid: string,
  pageSize = STREAMS_PAGE_SIZE,
  cursor?: QueryDocumentSnapshot
): Promise<{
  streams: Stream[];
  lastDoc?: QueryDocumentSnapshot;
  hasMore: boolean;
}> {
  const q = cursor
    ? query(userStreamsRef(uid), orderBy("playedAt", "desc"), startAfter(cursor), limit(pageSize))
    : query(userStreamsRef(uid), orderBy("playedAt", "desc"), limit(pageSize));
  const snap = await getDocs(q);
  const streams = snap.docs.map((entry) => fromDoc(entry.id, entry.data() as Record<string, unknown>));
  const lastDoc = snap.docs[snap.docs.length - 1];
  return {
    streams,
    lastDoc,
    hasMore: snap.docs.length === pageSize,
  };
}

export async function fetchUserStreams(uid: string): Promise<Stream[]> {
  const all: Stream[] = [];
  let cursor: QueryDocumentSnapshot | undefined;
  let hasMore = true;
  while (hasMore) {
    const page = await fetchUserStreamsPage(uid, STREAMS_PAGE_SIZE, cursor);
    all.push(...page.streams);
    hasMore = page.hasMore;
    cursor = page.lastDoc;
  }
  return all;
}

export async function fetchLatestPlayAt(uid: string): Promise<Date | null> {
  const snap = await getDocs(
    query(userStreamsRef(uid), orderBy("playedAt", "desc"), limit(1))
  );
  const docSnap = snap.docs[0];
  if (!docSnap) return null;
  return fromDoc(docSnap.id, docSnap.data() as Record<string, unknown>).playedAt;
}

export async function writeUserStreams(uid: string, streams: StreamInput[], skipExisting = true) {
  if (streams.length === 0) return 0;

  const db = getFirebaseFirestore();
  let written = 0;

  for (let i = 0; i < streams.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    let batchCount = 0;

    for (const stream of streams.slice(i, i + BATCH_LIMIT)) {
      const id = streamDocumentId({ ...stream, userId: uid });
      const ref = doc(userStreamsRef(uid), id);
      batch.set(ref, toFirestoreData(stream), { merge: skipExisting });
      batchCount += 1;
    }

    if (batchCount > 0) {
      await batch.commit();
      written += batchCount;
    }
  }

  return written;
}

export async function countUserStreams(uid: string) {
  const snap = await getDocs(query(userStreamsRef(uid), limit(1)));
  return snap.size;
}

export async function fetchDemoStreams(): Promise<Stream[]> {
  const snap = await getDocs(
    query(collection(getFirebaseFirestore(), "demo_streams"), orderBy("playedAt", "desc"))
  );
  return snap.docs.map((entry) => fromDoc(entry.id, entry.data() as Record<string, unknown>));
}
