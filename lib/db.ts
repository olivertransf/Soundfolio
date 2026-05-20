import { randomUUID } from "crypto";
import {
  lastFmDefaultDurationMs,
  LASTFM_MAX_CATALOG_MS,
  LASTFM_MIN_CATALOG_MS,
} from "@/lib/lastfm";
import {
  MongoClient,
  type Collection,
  type Db,
  type Document,
  type Filter,
  type Sort,
} from "mongodb";

export interface Stream {
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
  createdAt: Date;
  updatedAt: Date;
}

type StreamDocument = Omit<Stream, "id"> & { _id: string };
type StreamWhere = Partial<Record<keyof Stream, unknown>> & {
  OR?: StreamWhere[];
};
type StreamSelect = Partial<Record<keyof Stream, boolean>>;
type StreamOrderBy = Partial<Record<keyof Stream, "asc" | "desc">>;

const DEFAULT_DB_NAME = "soundfolio";

const globalForMongo = globalThis as unknown as {
  mongoClientPromise?: Promise<MongoClient>;
  soundfolioDb?: SoundfolioDb;
};

function getMongoUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI. Add it to .env.local and Vercel environment variables.");
  }
  return uri;
}

function clientPromise() {
  if (!globalForMongo.mongoClientPromise) {
    globalForMongo.mongoClientPromise = new MongoClient(getMongoUri(), {
      appName: "Soundfolio",
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 30_000,
      serverSelectionTimeoutMS: 5_000,
    })
      .connect()
      .catch((error) => {
        globalForMongo.mongoClientPromise = undefined;
        throw error;
      });
  }
  return globalForMongo.mongoClientPromise;
}

export async function mongoClient() {
  return clientPromise();
}

export async function mongoDb(): Promise<Db> {
  const client = await clientPromise();
  return client.db(process.env.MONGODB_DB || DEFAULT_DB_NAME);
}

function toMongoFilter(where: StreamWhere = {}): Filter<StreamDocument> {
  if ("OR" in where && Array.isArray(where.OR)) {
    return { $or: where.OR.map((clause) => toMongoFilter(clause)) };
  }

  const filter: Filter<StreamDocument> = {};

  for (const [key, value] of Object.entries(where)) {
    if (key === "OR") continue;
    if (value === undefined) continue;
    if (key === "id") {
      filter._id = value as string;
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      const condition = value as Record<string, unknown>;
      const mongoCondition: Document = {};
      if ("gte" in condition) mongoCondition.$gte = condition.gte;
      if ("lte" in condition) mongoCondition.$lte = condition.lte;
      if ("gt" in condition) mongoCondition.$gt = condition.gt;
      if ("lt" in condition) mongoCondition.$lt = condition.lt;
      if ("in" in condition) mongoCondition.$in = condition.in;
      if ("not" in condition) mongoCondition.$ne = condition.not;
      if ("contains" in condition) mongoCondition.$regex = condition.contains;
      filter[key as keyof StreamDocument] = mongoCondition as never;
      continue;
    }
    filter[key as keyof StreamDocument] = value as never;
  }

  return filter;
}

function toMongoSort(orderBy?: StreamOrderBy): Sort {
  if (!orderBy) return {};
  return Object.fromEntries(
    Object.entries(orderBy).map(([key, direction]) => [
      key === "id" ? "_id" : key,
      direction === "desc" ? -1 : 1,
    ])
  );
}

function toProjection(select?: StreamSelect): Document | undefined {
  if (!select) return undefined;
  const projection = Object.fromEntries(
    Object.entries(select).map(([key, enabled]) => [key === "id" ? "_id" : key, enabled ? 1 : 0])
  );
  if (select.id) projection._id = 1;
  return projection;
}

function fromDocument(doc: StreamDocument): Stream {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

const ABSOLUTE_MAX_DURATION_MS = 60 * 60 * 1000;

function normalizeDurationMs(stream: Partial<Stream>): number {
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

function prepareDocument(stream: Partial<Stream>): StreamDocument {
  const now = new Date();
  return {
    _id: stream.id ?? randomUUID(),
    trackId: stream.trackId ?? "",
    trackName: stream.trackName ?? "",
    artistName: stream.artistName ?? "",
    artistArt: stream.artistArt ?? null,
    albumName: stream.albumName ?? "",
    albumArt: stream.albumArt ?? null,
    durationMs: normalizeDurationMs(stream),
    playedAt: stream.playedAt ?? now,
    isDemo: stream.isDemo ?? false,
    createdAt: stream.createdAt ?? now,
    updatedAt: stream.updatedAt ?? now,
  };
}

class StreamRepository {
  private collectionPromise?: Promise<Collection<StreamDocument>>;

  private collection() {
    this.collectionPromise ??= mongoDb().then((database) =>
      database.collection<StreamDocument>("streams")
    );
    return this.collectionPromise;
  }

  async ensureIndexes() {
    const collection = await this.collection();
    await collection.createIndexes([
      { key: { trackId: 1, playedAt: 1 }, name: "stream_track_playedAt_unique", unique: true },
      { key: { playedAt: -1 }, name: "stream_playedAt_desc" },
      { key: { isDemo: 1, playedAt: -1 }, name: "stream_scope_playedAt_desc" },
      { key: { isDemo: 1, artistName: 1 }, name: "stream_scope_artist" },
      { key: { isDemo: 1, albumName: 1 }, name: "stream_scope_album" },
      { key: { isDemo: 1, trackId: 1 }, name: "stream_scope_track" },
    ]);
  }

  async createMany({ data, skipDuplicates = false }: { data: Partial<Stream>[]; skipDuplicates?: boolean }) {
    if (data.length === 0) return { count: 0 };
    const collection = await this.collection();
    if (skipDuplicates) {
      const result = await collection.bulkWrite(
        data.map((stream) => {
          const doc = prepareDocument(stream);
          return {
            updateOne: {
              filter: { trackId: doc.trackId, playedAt: doc.playedAt },
              update: { $setOnInsert: doc },
              upsert: true,
            },
          };
        }),
        { ordered: false }
      );
      return { count: result.upsertedCount };
    }
    const result = await collection.insertMany(data.map(prepareDocument), { ordered: false });
    return { count: result.insertedCount };
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
    const collection = await this.collection();
    if (distinct?.length === 1) {
      const [field] = distinct;
      const pipeline: Document[] = [
        { $match: toMongoFilter(where) },
        { $group: { _id: `$${field}`, doc: { $first: "$$ROOT" } } },
        { $replaceRoot: { newRoot: "$doc" } },
      ];
      const sort = toMongoSort(orderBy);
      if (Object.keys(sort).length > 0) pipeline.splice(1, 0, { $sort: sort });
      if (take) pipeline.push({ $limit: take });
      if (select) pipeline.push({ $project: toProjection(select) });
      const docs = await collection.aggregate<StreamDocument>(pipeline).toArray();
      return docs.map(fromDocument);
    }

    let cursor = collection.find(toMongoFilter(where), { projection: toProjection(select) });
    if (orderBy) cursor = cursor.sort(toMongoSort(orderBy));
    if (take) cursor = cursor.limit(take);
    const docs = await cursor.toArray();
    return docs.map(fromDocument);
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
    const collection = await this.collection();
    const patch = { ...data, updatedAt: new Date() };
    if (data.durationMs != null) {
      const rows = await collection
        .find(toMongoFilter(where), { projection: { trackId: 1 } })
        .toArray();
      if (rows.length === 1) {
        patch.durationMs = normalizeDurationMs({
          trackId: rows[0].trackId,
          durationMs: data.durationMs,
        });
      }
    }
    const result = await collection.updateMany(toMongoFilter(where), { $set: patch });
    return { count: result.modifiedCount };
  }

  async deleteMany({ where = {} }: { where?: StreamWhere } = {}) {
    const collection = await this.collection();
    const result = await collection.deleteMany(toMongoFilter(where));
    return { count: result.deletedCount };
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
    const collection = await this.collection();
    const id = Object.fromEntries(by.map((field) => [field, `$${field}`]));
    const project: Document = Object.fromEntries(by.map((field) => [field, `$_id.${field}`]));
    const group: Document = { _id: id };
    if (_count) group.count = { $sum: 1 };
    if (_sum?.durationMs) group.durationMsSum = { $sum: "$durationMs" };

    const pipeline: Document[] = [
      { $match: toMongoFilter(where) },
      { $group: group },
      {
        $project: {
          _id: 0,
          ...project,
          _count: { id: "$count", _all: "$count" },
          _sum: { durationMs: "$durationMsSum" },
        },
      },
    ];

    if (orderBy && "_count" in orderBy && orderBy._count) {
      const direction = Object.values(orderBy._count)[0] === "asc" ? 1 : -1;
      pipeline.push({ $sort: { "_count.id": direction } });
    } else if (orderBy && "_sum" in orderBy && orderBy._sum?.durationMs) {
      pipeline.push({
        $sort: { "_sum.durationMs": orderBy._sum.durationMs === "asc" ? 1 : -1 },
      });
    }
    if (take) pipeline.push({ $limit: take });

    return collection.aggregate<
      Pick<Stream, TBy[number]> & {
        _count: { id: number; _all: number };
        _sum: { durationMs: number | null };
      }
    >(pipeline).toArray();
  }

  async aggregate({ where = {}, _sum, _count, _min, _max }: {
    where?: StreamWhere;
    _sum?: Partial<Record<keyof Stream, boolean>>;
    _count?: Record<string, boolean>;
    _min?: Partial<Record<keyof Stream, boolean>>;
    _max?: Partial<Record<keyof Stream, boolean>>;
  }) {
    const collection = await this.collection();
    const group: Document = { _id: null };
    if (_sum?.durationMs) group.durationMsSum = { $sum: "$durationMs" };
    if (_count) group.count = { $sum: 1 };
    if (_min?.playedAt) group.minPlayedAt = { $min: "$playedAt" };
    if (_max?.playedAt) group.maxPlayedAt = { $max: "$playedAt" };
    const [result] = await collection.aggregate<Document>([
      { $match: toMongoFilter(where) },
      { $group: group },
    ]).toArray();

    return {
      _sum: { durationMs: result?.durationMsSum ?? null },
      _count: { id: result?.count ?? 0, _all: result?.count ?? 0 },
      _min: { playedAt: result?.minPlayedAt ?? null },
      _max: { playedAt: result?.maxPlayedAt ?? null },
    };
  }
}

class SoundfolioDb {
  readonly stream = new StreamRepository();

  async ensureIndexes() {
    await this.stream.ensureIndexes();
  }

  async $disconnect() {
    const client = await clientPromise();
    await client.close();
    globalForMongo.mongoClientPromise = undefined;
  }
}

export const db = globalForMongo.soundfolioDb ?? new SoundfolioDb();

if (process.env.NODE_ENV !== "production") globalForMongo.soundfolioDb = db;
