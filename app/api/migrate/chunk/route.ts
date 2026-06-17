import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";
import { verifyFirebaseIdToken } from "@/lib/auth/verify-id-token";

export const maxDuration = 60;

const PAGE_SIZE = 200;
const LEGACY_UID = process.env.LEGACY_USER_ID?.trim() ?? "lLqJcmE1iYbrHx9OUmLaXriCGAi1";

function bearerToken(request: NextRequest) {
  const bearer = request.headers.get("authorization");
  if (!bearer?.startsWith("Bearer ")) return null;
  return bearer.slice("Bearer ".length).trim();
}

function getMongoUri() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) throw new Error("MONGODB_URI is not configured on the server.");
  return uri;
}

export async function GET(req: NextRequest) {
  const token = bearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let uid: string;
  try {
    ({ uid } = await verifyFirebaseIdToken(token));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid token";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  if (uid !== LEGACY_UID) {
    return NextResponse.json({ error: "This import is limited to the legacy account owner." }, { status: 403 });
  }

  const offset = Math.max(0, Number(req.nextUrl.searchParams.get("offset") ?? "0") || 0);

  const mongo = new MongoClient(getMongoUri(), { appName: "SoundfolioClientMigration" });
  await mongo.connect();

  try {
    const dbName = process.env.MONGODB_DB?.trim() || "soundfolio";
    const collection = mongo.db(dbName).collection("streams");
    const total = await collection.countDocuments({ isDemo: false });
    const docs = await collection
      .find({ isDemo: false })
      .sort({ playedAt: 1 })
      .skip(offset)
      .limit(PAGE_SIZE)
      .toArray();

    const streams = docs.map((doc) => ({
      trackId: String(doc.trackId ?? ""),
      trackName: String(doc.trackName ?? ""),
      artistName: String(doc.artistName ?? ""),
      artistArt: (doc.artistArt as string | null | undefined) ?? null,
      albumName: String(doc.albumName ?? ""),
      albumArt: (doc.albumArt as string | null | undefined) ?? null,
      durationMs: Number(doc.durationMs ?? 0),
      playedAt: (doc.playedAt as Date).toISOString(),
      isDemo: false,
    }));

    return NextResponse.json({
      total,
      offset,
      count: streams.length,
      hasMore: offset + streams.length < total,
      streams,
    });
  } finally {
    await mongo.close();
  }
}
