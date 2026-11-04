"use client";
import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStreams } from "@/components/streams-provider";
import {
  buildArchive,
  monthLabel,
  monthlyInsights,
} from "@/lib/archive-analytics";
import { useArchiveNotes } from "./use-archive-notes";
import { resolveStatsTimeZone } from "@/lib/stats-timezone";
export function ArchiveEntry() {
  const { streams } = useStreams(),
    path = usePathname(),
    demo = path.startsWith("/demo");
  const { notes } = useArchiveNotes(demo);
  const tz = resolveStatsTimeZone();
  const a = useMemo(() => buildArchive(streams, tz), [streams, tz]);
  const latest = a.all.days.at(-1)?.slice(0, 7);
  const current = useMemo(
    () => (latest ? monthlyInsights(a, latest) : null),
    [a, latest],
  );
  if (!latest || !current) return null;
  const old =
    [...a.months.keys()].find(
      (m) => m.slice(5) === latest.slice(5) && m !== latest,
    ) || [...a.months.keys()][0];
  const discovery = a.all.tracks.find(
    (t) =>
      t.months.size >= 4 && t.first.slice(0, 7) !== a.all.days[0]?.slice(0, 7),
  );
  const former = a.all.tracks.find(
    (t) =>
      (Date.parse(a.all.days.at(-1)!) - Date.parse(t.last)) / 86400000 >= 90 &&
      t.plays >= 5,
  );
  const href = (view: string, month = latest, track?: string) =>
    `${demo ? "/demo" : ""}/time-machine?${new URLSearchParams({ view, month, tz, ...(track ? { track } : {}) })}`;
  return (
    <section className="archive archive-era">
      <p className="archive-kicker">Your music has a history</p>
      <h2>Open the Time Machine</h2>
      <p className="archive-muted">
        {current.p.rows.length.toLocaleString()} plays across{" "}
        {current.p.days.length} active days in {monthLabel(latest)}. Revisit the
        music and add the memories only you can tell.
      </p>
      <div className="flex flex-wrap gap-4 mt-3">
        <Link href={href("story")}>Explore {monthLabel(latest)} →</Link>
        <Link href={href("story", old)}>Revisit {monthLabel(old)} →</Link>
      </div>
      <details>
        <summary>Connections worth following</summary>
        {current.returning[0] ? (
          <p>
            A recorded return:{" "}
            <Link href={href("story", latest, current.returning[0].key)}>
              {current.returning[0].name}
            </Link>
            , after {current.returning[0].gap} days between plays.
          </p>
        ) : null}
        {discovery ? (
          <p>
            A lasting presence:{" "}
            <Link
              href={href("story", discovery.first.slice(0, 7), discovery.key)}
            >
              {discovery.name}
            </Link>
            , first observed {discovery.first} and heard in{" "}
            {discovery.months.size} months.
          </p>
        ) : null}
        {former ? (
          <p>
            Rediscover <Link href={href("rediscover")}>{former.name}</Link> ·{" "}
            {former.plays} observed plays, most recently {former.last}.
          </p>
        ) : null}
        {notes.memories[0] ? (
          <blockquote>
            <p className="archive-kicker">
              Your writing {demo ? "· fictional demo" : ""}
            </p>
            <h3>{notes.memories[0].title}</h3>
            <p>{notes.memories[0].text}</p>
            <Link href={href("memories")}>Visit your memories →</Link>
          </blockquote>
        ) : null}
      </details>
    </section>
  );
}
