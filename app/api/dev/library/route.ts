import { NextRequest, NextResponse } from "next/server";
import { readDevLibrarySlice } from "@/lib/dev-firestore";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const offset = Number(request.nextUrl.searchParams.get("offset") ?? "0");
    const start = Number.isFinite(offset) && offset > 0 ? offset : 0;
    const library = await readDevLibrarySlice(start);
    const body = JSON.stringify({
      uid: library.user.uid,
      displayName: library.user.displayName,
      lastfmUsername: library.user.lastfmUsername,
      streams: library.streams,
      nextOffset: library.nextOffset,
      loaded: library.loaded,
      total: library.total,
      partial: library.partial,
    });
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(body)),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the dev library.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
