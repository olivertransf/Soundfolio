import { NextRequest, NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { db } from "@/lib/db";
import { isRequestAuthorized } from "@/lib/auth";
import {
  resolveStatsTimeZone,
  spotifyExportTsToUtc,
} from "@/lib/stats-timezone";

interface SpotifyStreamEntry {
  ts: string;
  ms_played: number;
  master_metadata_track_name: string | null;
  master_metadata_album_artist_name: string | null;
  master_metadata_album_album_name: string | null;
  spotify_track_uri: string | null;
  reason_end?: string;
  skipped?: boolean;
}

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  if (!isRequestAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const timeZone = resolveStatsTimeZone(
      (formData.get("tz") as string | null) ?? undefined
    );

    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    const historyEntries: SpotifyStreamEntry[] = [];

    for (const entry of entries) {
      const name = entry.entryName;
      if (!name.includes("Streaming_History_Audio") || !name.endsWith(".json")) continue;

      const content = entry.getData().toString("utf-8");
      const parsed: SpotifyStreamEntry[] = JSON.parse(content);
      historyEntries.push(...parsed);
    }

    if (historyEntries.length === 0) {
      return NextResponse.json(
        { error: "No streaming history files found in ZIP. Make sure you uploaded the correct Spotify data export." },
        { status: 400 }
      );
    }

    const validStreams = historyEntries.filter((e) => {
      if (
        !e.master_metadata_track_name ||
        !e.master_metadata_album_artist_name ||
        !e.spotify_track_uri ||
        e.ms_played <= 30000
      ) {
        return false;
      }
      const playedAt = spotifyExportTsToUtc(e.ts, timeZone);
      return !Number.isNaN(playedAt.getTime());
    });

    let inserted = 0;
    let skipped = 0;

    const BATCH_SIZE = 500;
    for (let i = 0; i < validStreams.length; i += BATCH_SIZE) {
      const batch = validStreams.slice(i, i + BATCH_SIZE);

      const result = await db.stream.createMany({
        data: batch.map((e) => ({
          trackId: e.spotify_track_uri!.replace("spotify:track:", ""),
          trackName: e.master_metadata_track_name!,
          artistName: e.master_metadata_album_artist_name!,
          artistArt: null,
          albumName: e.master_metadata_album_album_name ?? "",
          albumArt: null,
          durationMs: e.ms_played,
          playedAt: spotifyExportTsToUtc(e.ts, timeZone),
          isDemo: false,
        })),
        skipDuplicates: true,
      });

      inserted += result.count;
      skipped += batch.length - result.count;
    }

    return NextResponse.json({
      success: true,
      total: historyEntries.length,
      valid: validStreams.length,
      inserted,
      skipped,
      timeZone,
    });
  } catch (err) {
    console.error("Import error:", err);
    return NextResponse.json(
      { error: "Failed to process file. Make sure it's a valid Spotify data export ZIP." },
      { status: 400 }
    );
  }
}
