import { NextRequest, NextResponse } from "next/server";
import { getDevLibrary } from "@/lib/dev-firestore";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const library = await getDevLibrary();
    const offset = Number(request.nextUrl.searchParams.get("offset") ?? "0");
    const start = Number.isFinite(offset) && offset > 0 ? offset : 0;
    const streams = library.streams.slice(start, start + 2000);
    const nextOffset = start + streams.length < library.streams.length ? start + streams.length : null;
    return NextResponse.json({
      uid: library.user.uid,
      displayName: library.user.displayName,
      lastfmUsername: library.user.lastfmUsername,
      streams,
      nextOffset,
      total: library.streams.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the dev library.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
