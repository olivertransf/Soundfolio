#!/usr/bin/env python3
"""
Soundfolio → Obsidian bridge
Queries the Neon DB and writes a stats note into the Obsidian vault.
Usage: python3 scripts/obsidian_stats.py [--range 30d|3m|6m|1y|all]
"""

import os
import sys
import argparse
from datetime import datetime, timezone, timedelta
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# ── Config ────────────────────────────────────────────────────────────────────

VAULT_PATH = Path(
    "/Users/olivertran/Library/Mobile Documents/iCloud~md~obsidian/Documents/Yokihijo"
)
NOTE_PATH = VAULT_PATH / "02 - Areas" / "Soundfolio Stats.md"

ENV_PATH = Path(__file__).parent.parent / ".env"

RANGE_LABELS = {
    "30d": "Last 30 days",
    "3m":  "Last 3 months",
    "6m":  "Last 6 months",
    "1y":  "Last year",
    "all": "All time",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def range_to_since(r: str) -> datetime | None:
    now = datetime.now(timezone.utc)
    if r == "30d": return now - timedelta(days=30)
    if r == "3m":  return now - timedelta(days=91)
    if r == "6m":  return now - timedelta(days=182)
    if r == "1y":  return now - timedelta(days=365)
    return None  # all time


def fmt_minutes(mins: int) -> str:
    if mins < 60:
        return f"{mins}m"
    h, m = divmod(mins, 60)
    return f"{h}h {m}m" if m else f"{h}h"


# ── Queries ───────────────────────────────────────────────────────────────────

def get_totals(cur, since):
    where = 'WHERE "isDemo" = false'
    params = []
    if since:
        where += ' AND "playedAt" >= %s'
        params.append(since)
    cur.execute(
        f'SELECT COUNT(*) AS streams, SUM("durationMs") AS total_ms FROM "Stream" {where}',
        params,
    )
    row = cur.fetchone()
    streams = row["streams"] or 0
    total_ms = row["total_ms"] or 0
    return {"streams": streams, "minutes": total_ms // 60000, "hours": total_ms // 3600000}


def get_top_artists(cur, since, limit=10):
    where = '"isDemo" = false'
    params = []
    if since:
        where += ' AND "playedAt" >= %s'
        params.append(since)
    params.append(limit)
    cur.execute(
        f"""
        SELECT "artistName",
               COUNT(*) AS streams,
               SUM("durationMs") / 60000 AS minutes
        FROM "Stream"
        WHERE {where}
        GROUP BY "artistName"
        ORDER BY streams DESC
        LIMIT %s
        """,
        params,
    )
    return cur.fetchall()


def get_top_tracks(cur, since, limit=10):
    where = '"isDemo" = false'
    params = []
    if since:
        where += ' AND "playedAt" >= %s'
        params.append(since)
    params.append(limit)
    cur.execute(
        f"""
        SELECT "trackName", "artistName",
               COUNT(*) AS streams,
               SUM("durationMs") / 60000 AS minutes
        FROM "Stream"
        WHERE {where}
        GROUP BY "trackId", "trackName", "artistName"
        ORDER BY streams DESC
        LIMIT %s
        """,
        params,
    )
    return cur.fetchall()


def get_top_albums(cur, since, limit=5):
    where = '"isDemo" = false'
    params = []
    if since:
        where += ' AND "playedAt" >= %s'
        params.append(since)
    params.append(limit)
    cur.execute(
        f"""
        SELECT "albumName", "artistName",
               COUNT(*) AS streams,
               SUM("durationMs") / 60000 AS minutes
        FROM "Stream"
        WHERE {where}
        GROUP BY "albumName", "artistName"
        ORDER BY streams DESC
        LIMIT %s
        """,
        params,
    )
    return cur.fetchall()


def get_recent(cur, limit=10):
    cur.execute(
        """
        SELECT "trackName", "artistName", "playedAt"
        FROM "Stream"
        WHERE "isDemo" = false
        ORDER BY "playedAt" DESC
        LIMIT %s
        """,
        [limit],
    )
    return cur.fetchall()


def get_listening_span(cur):
    cur.execute(
        'SELECT MIN("playedAt") AS first, MAX("playedAt") AS last FROM "Stream" WHERE "isDemo" = false'
    )
    return cur.fetchone()


# ── Note rendering ─────────────────────────────────────────────────────────────

def render_note(range_key: str, totals, artists, tracks, albums, recent, span) -> str:
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    label = RANGE_LABELS[range_key]

    first_str = span["first"].strftime("%b %d, %Y") if span and span["first"] else "—"
    last_str  = span["last"].strftime("%b %d, %Y")  if span and span["last"]  else "—"

    lines = [
        "---",
        "tags: [soundfolio, music-stats]",
        f"updated: {now}",
        "---",
        "",
        f"# Soundfolio Stats — {label}",
        "",
        f"> Pulled from Neon DB on {now}.  Data spans {first_str} → {last_str}.",
        "",
        "## Overview",
        "",
        f"| Metric | Value |",
        f"|--------|-------|",
        f"| Total streams | {totals['streams']:,} |",
        f"| Listening time | {fmt_minutes(totals['minutes'])} |",
        f"| Data from | {first_str} |",
        f"| Last scrobble | {last_str} |",
        "",
        "## Top Artists",
        "",
        "| # | Artist | Streams | Time |",
        "|---|--------|---------|------|",
    ]
    for i, a in enumerate(artists, 1):
        lines.append(f"| {i} | {a['artistName']} | {a['streams']:,} | {fmt_minutes(a['minutes'])} |")

    lines += [
        "",
        "## Top Tracks",
        "",
        "| # | Track | Artist | Streams | Time |",
        "|---|-------|--------|---------|------|",
    ]
    for i, t in enumerate(tracks, 1):
        lines.append(f"| {i} | {t['trackName']} | {t['artistName']} | {t['streams']:,} | {fmt_minutes(t['minutes'])} |")

    lines += [
        "",
        "## Top Albums",
        "",
        "| # | Album | Artist | Streams | Time |",
        "|---|-------|--------|---------|------|",
    ]
    for i, a in enumerate(albums, 1):
        lines.append(f"| {i} | {a['albumName']} | {a['artistName']} | {a['streams']:,} | {fmt_minutes(a['minutes'])} |")

    lines += [
        "",
        "## Recently Played",
        "",
        "| Track | Artist | Played At |",
        "|-------|--------|-----------|",
    ]
    for r in recent:
        played = r["playedAt"].strftime("%b %d, %H:%M")
        lines.append(f"| {r['trackName']} | {r['artistName']} | {played} |")

    lines.append("")
    return "\n".join(lines)


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Soundfolio → Obsidian stats bridge")
    parser.add_argument("--range", default="30d", choices=RANGE_LABELS.keys(),
                        help="Time range (default: 30d)")
    args = parser.parse_args()

    load_dotenv(ENV_PATH)
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not found in .env", file=sys.stderr)
        sys.exit(1)

    since = range_to_since(args.range)

    print(f"Connecting to Neon DB...")
    conn = psycopg2.connect(db_url, cursor_factory=psycopg2.extras.RealDictCursor)
    conn.autocommit = True
    cur = conn.cursor()

    print("Querying stats...")
    totals  = get_totals(cur, since)
    artists = get_top_artists(cur, since)
    tracks  = get_top_tracks(cur, since)
    albums  = get_top_albums(cur, since)
    recent  = get_recent(cur)
    span    = get_listening_span(cur)

    cur.close()
    conn.close()

    note = render_note(args.range, totals, artists, tracks, albums, recent, span)

    NOTE_PATH.parent.mkdir(parents=True, exist_ok=True)
    NOTE_PATH.write_text(note, encoding="utf-8")
    print(f"Note written to: {NOTE_PATH}")
    print(f"  {totals['streams']:,} streams  |  {fmt_minutes(totals['minutes'])} listened")


if __name__ == "__main__":
    main()
