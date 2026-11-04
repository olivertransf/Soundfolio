"use client";
import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useStreams } from "@/components/streams-provider";
import { buildArchive, monthLabel } from "@/lib/archive-analytics";
import { matchesEntity } from "@/lib/entity-normalize";
import { resolveStatsTimeZone } from "@/lib/stats-timezone";
import { useArchiveNotes } from "./use-archive-notes";
export function EntityArchiveHistory({
  artist,
  track,
  album,
}: {
  artist: string;
  track?: string;
  album?: string;
}) {
  const { streams, fullyLoaded } = useStreams();
  const path = usePathname(),
    params = useSearchParams(),
    demo = path.startsWith("/demo");
  const tz = resolveStatsTimeZone(params.get("tz"));
  const { notes } = useArchiveNotes(demo);
  const history = useMemo(
    () =>
      buildArchive(
        streams.filter(
          (r) =>
            matchesEntity(r.artistName, artist) &&
            (!track || matchesEntity(r.trackName, track)) &&
            (!album || matchesEntity(r.albumName, album)),
        ),
        tz,
      ),
    [streams, artist, track, album, tz],
  );
  const full = useMemo(() => buildArchive(streams, tz), [streams, tz]);
  if (!history.rows.length) return null;
  const peak = [...history.months.values()].sort(
    (a, b) => b.rows.length - a.rows.length,
  )[0];
  const target = track
    ? `track:${history.all.tracks[0].key}`
    : album
      ? `album:${artist}:${album}`
      : `artist:${artist}`;
  const returnTo = params.get("archiveMonth");
  return (
    <section className="archive archive-chapter">
      <p className="archive-kicker">Across your recorded history</p>
      <h2>
        {track
          ? "The life of this track"
          : album
            ? "Album exploration over time"
            : "The artist’s story"}
      </h2>
      {returnTo && /^\d{4}-\d{2}$/.test(returnTo) ? (
        <Link
          href={`${demo ? "/demo" : ""}/time-machine?month=${returnTo}&tz=${encodeURIComponent(tz)}`}
        >
          ← Return to {monthLabel(returnTo)}
        </Link>
      ) : null}
      <p>
        First observed {history.all.days[0]} · Latest {history.all.days.at(-1)}{" "}
        · {history.all.days.length} active days
      </p>
      <p className="archive-muted">
        {fullyLoaded
          ? "Available history"
          : "Loaded history only; earlier records may be missing"}
        . First observed does not mean first heard.
      </p>
      <p>
        Strongest month:{" "}
        <Link
          href={`${demo ? "/demo" : ""}/time-machine?month=${peak.key}&tz=${encodeURIComponent(tz)}`}
        >
          {monthLabel(peak.key)} · {peak.rows.length} plays
        </Link>
      </p>
      <details>
        <summary>Browse {history.months.size} months of listening</summary>
        {[...history.months].map(([m, p]) => (
          <div className="archive-comparison-row" key={m}>
            <Link
              href={`${demo ? "/demo" : ""}/time-machine?month=${m}&tz=${encodeURIComponent(tz)}`}
            >
              {monthLabel(m)}
            </Link>
            <span>
              {p.rows.length} plays · {p.tracks[0]?.name} · {p.albums.length}{" "}
              albums observed
            </span>
          </div>
        ))}
      </details>
      {!track && !album ? (
        <details>
          <summary>Early tracks and listening across your eras</summary>
          <h3>First tracks in the available record</h3>
          {[...history.all.tracks]
            .sort((a, b) => a.first.localeCompare(b.first))
            .slice(0, 5)
            .map((t) => (
              <p key={t.key}>
                {t.first} · {t.name}
              </p>
            ))}
          <h3>Artist’s share in your named eras</h3>
          {notes.eras.map((e) => {
            const own = history.range(e.from, e.to),
              total = full.range(e.from, e.to);
            return (
              <p key={e.id}>
                {e.name}: {own.rows.length} of {total.rows.length} observed
                plays ·{" "}
                {total.rows.length
                  ? Math.round((own.rows.length / total.rows.length) * 100)
                  : 0}
                %
              </p>
            );
          })}
          <p className="archive-muted">
            Play share uses all observed records within each era as its
            denominator.
          </p>
        </details>
      ) : null}
      {notes.memories
        .filter((m) => m.target === target)
        .map((m) => (
          <blockquote key={m.id}>
            <h3>{m.title}</h3>
            <p>{m.text}</p>
          </blockquote>
        ))}
      <Link
        href={`${demo ? "/demo" : ""}/time-machine?month=${peak.key}&view=memories`}
      >
        Explore memories and add context →
      </Link>
    </section>
  );
}
