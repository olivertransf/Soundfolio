import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/spotify";

export async function GET() {
  try {
    const token = await getAccessToken();
    if (!token) throw new Error("No token returned");

    const res = await fetch("https://api.spotify.com/v1/tracks/4iV5W9uYEdYUVa79Axb7Rh", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      return NextResponse.json({ ok: false, error: "Token expired or invalid" }, { status: 500 });
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { ok: false, error: data?.error?.message ?? `Spotify API ${res.status}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: "Spotify connection works" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
