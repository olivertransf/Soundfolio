import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/spotify";

export async function GET() {
  try {
    const token = await getAccessToken();
    if (!token) throw new Error("No token returned");

    const res = await fetch("https://api.spotify.com/v1/tracks/4iV5W9uYEdYUVa79Axb7Rh", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      return NextResponse.json({ ok: false, error: data?.error?.message ?? "Token expired or invalid" }, { status: 500 });
    }
    if (res.status === 403) {
      const msg = data?.error?.message ?? data?.error ?? "Access forbidden";
      return NextResponse.json({
        ok: false,
        error: `403: ${msg}. If it worked before: you may have hit rate limits (wait 1hr) or your app user was removed from the allowlist. Re-add your email in Dashboard → App → Settings → User Management.`,
      }, { status: 500 });
    }
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: data?.error?.message ?? data?.error ?? `Spotify API ${res.status}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, message: "Spotify connection works" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
