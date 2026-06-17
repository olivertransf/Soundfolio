import { getAdminFirestore } from "@/lib/firebase/admin";
import {
  lastFmDefaultDurationMs,
  LASTFM_MAX_CATALOG_MS,
  LASTFM_MIN_CATALOG_MS,
} from "@/lib/lastfm";
import {
  FieldPath,
  FieldValue,
  Timestamp,
  type Query,
} from "firebase-admin/firestore";

export interface Stream {
  id: string;
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
  createdAt: Date;
  updatedAt: Date;
}

export type StreamWhere = Partial<Record<keyof Stream, unknown>> & {
  OR?: StreamWhere[];
};

type StreamSelect = Partial<Record<keyof Stream, boolean>>;
type StreamOrderBy = Partial<Record<keyof Stream, "asc" | "desc">>;

type StreamRecord = Omit<Stream, "id">;

const STREAMS_COLLECTION = "streams";
const ABSOLUTE_MAX_DURATION_MS = 60 * 60 * 1000;
const BATCH_LIMIT = 450;

const globalForDb = globalThis as unknown as {
  soundfolioDb?: SoundfolioDb;
};

function streamsCollection() {
  return getAdminFirestore().collection(STREAMS_COLLECTION);
}

function toTimestamp(value: Date | Timestamp | undefined | null) {
  if (!value) return null;
  if (value instanceof Timestamp) return value;
  return Timestamp.fromDate(value);
}

function fromTimestamp(value: Timestamp | Date | undefined | null) {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  return value.toDate();
}

export function normalizeDurationMs(stream: Partial<Stream>): number {
  const trackId = stream.trackId ?? "";
  let ms = stream.durationMs ?? 0;
  if (trackId.startsWith("lfm-")) {
    const v = ms || lastFmDefaultDurationMs();
    return Math.min(Math.max(v, LASTFM_MIN_CATALOG_MS), LASTFM_MAX_CATALOG_MS);
  }
  if (ms <= 0) return 0;
  if (ms > ABSOLUTE_MAX_DURATION_MS) ms = ABSOLUTE_MAX_DURATION_MS;
  return ms;
}

function prepareDocument(stream: Partial<Stream>): StreamRecord & { id: string } {
  const now = new Date();
  const playedAt = stream.playedAt ?? now;
  const trackId = stream.trackId ?? "";
  const userId = stream.userId;
  const id =
    stream.id ??
    `${userId ?? "legacy"}__${trackId}__${playedAt.getTime()}`;
  return {
    id,
    userId,
    trackId,
    trackName: stream.trackName ?? "",
    artistName: stream.artistName ?? "",
    artistArt: stream.artistArt ?? null,
    albumName: stream.albumName ?? "",
    albumArt: stream.albumArt ?? null,
    durationMs: normalizeDurationMs(stream),
    playedAt,
    isDemo: stream.isDemo ?? false,
    createdAt: stream.createdAt ?? now,
    updatedAt: stream.updatedAt ?? now,
  };
}

function toFirestoreData(stream: StreamRecord) {
  const data: Record<string, unknown> = {
    trackId: stream.trackId,
    trackName: stream.trackName,
    artistName: stream.artistName,
    artistArt: stream.artistArt,
    albumName: stream.albumName,
    albumArt: stream.albumArt,
    durationMs: stream.durationMs,
    playedAt: toTimestamp(stream.playedAt),
    isDemo: stream.isDemo,
    createdAt: toTimestamp(stream.createdAt),
    updatedAt: toTimestamp(stream.updatedAt),
  };
  if (stream.userId) data.userId = stream.userId;
  return data;
}

function fromFirestoreDoc(id: string, data: FirebaseFirestore.DocumentData): Stream {
  return {
    id,
    userId: (data.userId as string | undefined) ?? undefined,
    trackId: String(data.trackId ?? ""),
    trackName: String(data.trackName ?? ""),
    artistName: String(data.artistName ?? ""),
    artistArt: (data.artistArt as string | null | undefined) ?? null,
    albumName: String(data.albumName ?? ""),
    albumArt: (data.albumArt as string | null | undefined) ?? null,
    durationMs: Number(data.durationMs ?? 0),
    playedAt: fromTimestamp(data.playedAt as Timestamp | undefined),
    isDemo: Boolean(data.isDemo),
    createdAt: fromTimestamp(data.createdAt as Timestamp | undefined),
    updatedAt: fromTimestamp(data.updatedAt as Timestamp | undefined),
  };
}

function pickFields(stream: Stream, select?: StreamSelect): Stream {
  if (!select) return stream;
  const picked = { ...stream };
  for (const key of Object.keys(stream) as Array<keyof Stream>) {
    if (select[key] === false) {
      delete (picked as Partial<Stream>)[key];
    }
  }
  return picked;
}

function compareValues(a: unknown, b: unknown) {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "string" && typeof b === "string") return a.localeCompare(b);
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

function matchesCondition(value: unknown, condition: unknown): boolean {
  if (condition === undefined) return true;
  if (condition === null) return value === null || value === undefined;
  if (condition instanceof Date) return value instanceof Date && value.getTime() === condition.getTime();
  if (typeof condition !== "object" || Array.isArray(condition)) {
    return value === condition;
  }

  const rules = condition as Record<string, unknown>;
  if ("in" in rules) {
    const options = rules.in as unknown[];
    return options.includes(value);
  }
  if ("contains" in rules && typeof value === "string") {
    return value.includes(String(rules.contains));
  }
  if ("not" in rules) {
    if (rules.not === null) return value != null;
    return value !== rules.not;
  }
  if ("gte" in rules && compareValues(value, rules.gte) < 0) return false;
  if ("gt" in rules && compareValues(value, rules.gt) <= 0) return false;
  if ("lte" in rules && compareValues(value, rules.lte) > 0) return false;
  if ("lt" in rules && compareValues(value, rules.lt) >= 0) return false;
  return true;
}

function matchesWhere(stream: Stream, where: StreamWhere = {}): boolean {
  if ("OR" in where && Array.isArray(where.OR)) {
    return where.OR.some((clause) => matchesWhere(stream, clause));
  }

  for (const [key, condition] of Object.entries(where)) {
    if (key === "OR") continue;
    const field = key as keyof Stream;
    if (field === "id") {
      if (!matchesCondition(stream.id, condition)) return false;
      continue;
    }
    if (field === "userId" && condition === undefined) {
      if (stream.userId != null) return false;
      continue;
    }
    if (!matchesCondition(stream[field], condition)) return false;
  }

  return true;
}

function sortStreams(rows: Stream[], orderBy?: StreamOrderBy) {
  if (!orderBy) return rows;
  const entries = Object.entries(orderBy);
  return [...rows].sort((a, b) => {
    for (const [field, direction] of entries) {
      const key = field as keyof Stream;
      const cmp = compareValues(a[key], b[key]);
      if (cmp !== 0) return direction === "desc" ? -cmp : cmp;
    }
    return 0;
  });
}

function distinctStreams(rows: Stream[], field: keyof Stream) {
  const seen = new Set<string>();
  const out: Stream[] = [];
  for (const row of rows) {
    const key = String(row[field]);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function queryStreams(where: StreamWhere = {}) {
  if ("OR" in where && Array.isArray(where.OR)) {
    const merged = new Map<string, Stream>();
    for (const clause of where.OR) {
      for (const row of await queryStreams(clause)) {
        merged.set(row.id, row);
      }
    }
    return [...merged.values()];
  }

  let query: Query = streamsCollection();

  if (where.id && typeof where.id === "string") {
    const doc = await streamsCollection().doc(where.id).get();
    return doc.exists ? [fromFirestoreDoc(doc.id, doc.data()!)] : [];
  }

  if (where.id && typeof where.id === "object" && where.id !== null && "in" in where.id) {
    const ids = (where.id as { in: string[] }).in;
    const chunks: Stream[] = [];
    for (let i = 0; i < ids.length; i += 30) {
      const slice = ids.slice(i, i + 30);
      const snap = await streamsCollection().where(FieldPath.documentId(), "in", slice).get();
      chunks.push(...snap.docs.map((doc) => fromFirestoreDoc(doc.id, doc.data())));
    }
    const rest = { ...where };
    delete rest.id;
    return chunks.filter((row) => matchesWhere(row, rest));
  }

  if (typeof where.isDemo === "boolean") {
    query = query.where("isDemo", "==", where.isDemo);
  }
  if (typeof where.userId === "string") {
    query = query.where("userId", "==", where.userId);
  }
  if (typeof where.trackId === "string") {
    query = query.where("trackId", "==", where.trackId);
  }
  if (typeof where.artistName === "string") {
    query = query.where("artistName", "==", where.artistName);
  }
  if (typeof where.albumName === "string") {
    query = query.where("albumName", "==", where.albumName);
  }
  if (where.albumArt === null) {
    query = query.where("albumArt", "==", null);
  }
  if (where.artistArt === null) {
    query = query.where("artistArt", "==", null);
  }

  const snap = await query.get();
  let rows = snap.docs.map((doc) => fromFirestoreDoc(doc.id, doc.data()));

  if (where.userId === undefined && !("userId" in where)) {
    // no-op
  } else if (!("userId" in where) && where.isDemo === false) {
    // legacy rows may omit userId; keep all unless caller filters later
  }

  rows = rows.filter((row) => matchesWhere(row, where));
  return rows;
}

class StreamRepository {
  async ensureIndexes() {
    // Firestore composite indexes are declared in firestore.indexes.json.
  }

  async createMany({ data, skipDuplicates = false }: { data: Partial<Stream>[]; skipDuplicates?: boolean }) {
    if (data.length === 0) return { count: 0 };

    const firestore = getAdminFirestore();
    let count = 0;

    for (let i = 0; i < data.length; i += BATCH_LIMIT) {
      const batch = firestore.batch();
      let batchCount = 0;
      for (const stream of data.slice(i, i + BATCH_LIMIT)) {
        const doc = prepareDocument(stream);
        const ref = streamsCollection().doc(doc.id);
        if (skipDuplicates) {
          const existing = await ref.get();
          if (existing.exists) continue;
        }
        batch.set(ref, toFirestoreData(doc), { merge: skipDuplicates });
        batchCount += 1;
      }
      if (batchCount > 0) {
        await batch.commit();
        count += batchCount;
      }
    }

    return { count };
  }

  async findMany({
    where = {},
    select,
    orderBy,
    take,
    distinct,
  }: {
    where?: StreamWhere;
    select?: StreamSelect;
    orderBy?: StreamOrderBy;
    take?: number;
    distinct?: Array<keyof Stream>;
  } = {}) {
    let rows = await queryStreams(where);
    rows = sortStreams(rows, orderBy);
    if (distinct?.length === 1) {
      rows = distinctStreams(rows, distinct[0]);
    }
    if (take != null) rows = rows.slice(0, take);
    return rows.map((row) => pickFields(row, select));
  }

  async findFirst(args: {
    where?: StreamWhere;
    select?: StreamSelect;
    orderBy?: StreamOrderBy;
    take?: number;
    distinct?: Array<keyof Stream>;
  } = {}) {
    const rows = await this.findMany({ ...args, take: 1 });
    return rows[0] ?? null;
  }

  async updateMany({ where = {}, data }: { where?: StreamWhere; data: Partial<Stream> }) {
    const rows = await queryStreams(where);
    if (rows.length === 0) return { count: 0 };

    const firestore = getAdminFirestore();
    let count = 0;
    const patch = { ...data, updatedAt: new Date() };

    if (data.durationMs != null && rows.length === 1) {
      patch.durationMs = normalizeDurationMs({
        trackId: rows[0].trackId,
        durationMs: data.durationMs,
      });
    }

    for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
      const batch = firestore.batch();
      let batchCount = 0;
      for (const row of rows.slice(i, i + BATCH_LIMIT)) {
        const ref = streamsCollection().doc(row.id);
        const update: Record<string, unknown> = { updatedAt: toTimestamp(patch.updatedAt as Date) };
        for (const [key, value] of Object.entries(patch)) {
          if (key === "updatedAt" || key === "id") continue;
          if (value === undefined) continue;
          if (key === "playedAt" || key === "createdAt") {
            update[key] = toTimestamp(value as Date);
          } else if (key === "userId" && value == null) {
            update.userId = FieldValue.delete();
          } else {
            update[key] = value;
          }
        }
        batch.update(ref, update);
        batchCount += 1;
      }
      if (batchCount > 0) {
        await batch.commit();
        count += batchCount;
      }
    }

    return { count };
  }

  async deleteMany({ where = {} }: { where?: StreamWhere } = {}) {
    const rows = await queryStreams(where);
    if (rows.length === 0) return { count: 0 };

    const firestore = getAdminFirestore();
    let count = 0;

    for (let i = 0; i < rows.length; i += BATCH_LIMIT) {
      const batch = firestore.batch();
      let batchCount = 0;
      for (const row of rows.slice(i, i + BATCH_LIMIT)) {
        batch.delete(streamsCollection().doc(row.id));
        batchCount += 1;
      }
      if (batchCount > 0) {
        await batch.commit();
        count += batchCount;
      }
    }

    return { count };
  }

  async groupBy<TBy extends Array<keyof Stream>>({
    by,
    where = {},
    _count,
    _sum,
    orderBy,
    take,
  }: {
    by: TBy;
    where?: StreamWhere;
    _count?: Record<string, boolean>;
    _sum?: Partial<Record<keyof Stream, boolean>>;
    orderBy?:
      | { _count?: Record<string, "asc" | "desc"> }
      | { _sum?: Partial<Record<keyof Stream, "asc" | "desc">> };
    take?: number;
  }) {
    const rows = await queryStreams(where);
    const groups = new Map<
      string,
      Pick<Stream, TBy[number]> & {
        _count: { id: number; _all: number };
        _sum: { durationMs: number | null };
      }
    >();

    for (const row of rows) {
      const key = by.map((field) => String(row[field])).join("\u0000");
      let group = groups.get(key);
      if (!group) {
        group = {
          ...(Object.fromEntries(by.map((field) => [field, row[field]])) as Pick<Stream, TBy[number]>),
          _count: { id: 0, _all: 0 },
          _sum: { durationMs: 0 },
        };
        groups.set(key, group);
      }
      if (_count) {
        group._count.id += 1;
        group._count._all += 1;
      }
      if (_sum?.durationMs) {
        group._sum.durationMs = (group._sum.durationMs ?? 0) + row.durationMs;
      }
    }

    let results = [...groups.values()];

    if (orderBy && "_count" in orderBy && orderBy._count) {
      const direction = Object.values(orderBy._count)[0] === "asc" ? 1 : -1;
      results.sort((a, b) => direction * (a._count.id - b._count.id));
    } else if (orderBy && "_sum" in orderBy && orderBy._sum?.durationMs) {
      const direction = orderBy._sum.durationMs === "asc" ? 1 : -1;
      results.sort(
        (a, b) => direction * ((a._sum.durationMs ?? 0) - (b._sum.durationMs ?? 0))
      );
    }

    if (take != null) results = results.slice(0, take);
    return results;
  }

  async aggregate({
    where = {},
    _sum,
    _count,
    _min,
    _max,
  }: {
    where?: StreamWhere;
    _sum?: Partial<Record<keyof Stream, boolean>>;
    _count?: Record<string, boolean>;
    _min?: Partial<Record<keyof Stream, boolean>>;
    _max?: Partial<Record<keyof Stream, boolean>>;
  }) {
    const rows = await queryStreams(where);
    let durationMsSum = 0;
    let count = 0;
    let minPlayedAt: Date | null = null;
    let maxPlayedAt: Date | null = null;

    for (const row of rows) {
      if (_count) count += 1;
      if (_sum?.durationMs) durationMsSum += row.durationMs;
      if (_min?.playedAt && (minPlayedAt == null || row.playedAt < minPlayedAt)) {
        minPlayedAt = row.playedAt;
      }
      if (_max?.playedAt && (maxPlayedAt == null || row.playedAt > maxPlayedAt)) {
        maxPlayedAt = row.playedAt;
      }
    }

    return {
      _sum: { durationMs: _sum?.durationMs ? durationMsSum : null },
      _count: { id: count, _all: count },
      _min: { playedAt: minPlayedAt },
      _max: { playedAt: maxPlayedAt },
    };
  }
}

class SoundfolioDb {
  readonly stream = new StreamRepository();

  async ensureIndexes() {
    await this.stream.ensureIndexes();
  }

  async $disconnect() {
    // Firestore admin client does not require explicit disconnect.
  }
}

export const db = globalForDb.soundfolioDb ?? new SoundfolioDb();

if (process.env.NODE_ENV !== "production") globalForDb.soundfolioDb = db;

/** @deprecated MongoDB removed — use `db.stream` (Firestore). */
export async function mongoDb(): Promise<never> {
  throw new Error("MongoDB has been removed. Soundfolio now uses Firestore for streams.");
}

/** @deprecated MongoDB removed — use Firestore via `db.stream`. */
export async function mongoClient(): Promise<never> {
  throw new Error("MongoDB has been removed. Soundfolio now uses Firestore for streams.");
}
