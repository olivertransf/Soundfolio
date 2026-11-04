"use client";
import {
  useMemo,
  useEffect,
  useState,
  useDeferredValue,
  useRef,
  type ReactNode,
} from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ArchivePeriodPicker } from "./archive-period-picker";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useStreams } from "@/components/streams-provider";
import { AlbumArt } from "@/components/album-art";
import {
  buildArchive,
  monthlyInsights,
  monthNarrative,
  trackLife,
  repeatedSequences,
  comparePeriods,
  listeningSessions,
  suggestedBoundaries,
  shiftMonth,
  monthLabel,
  trackKey,
  ARCHIVE_RULES,
  type Archive,
  type ArchiveEntity,
  type ArchivePeriod,
} from "@/lib/archive-analytics";
import {
  mergeEras,
  downloadArchive,
  type Memory,
  type Era,
} from "@/lib/archive-notes";
import { useArchiveNotes } from "./use-archive-notes";
import { resolveStatsTimeZone } from "@/lib/stats-timezone";
import { trackPath, artistPath, albumPath } from "@/lib/entity-paths";

const tabs = [
  "Story",
  "Compare",
  "Rediscover",
  "Eras",
  "Memories",
  "Explore",
  "Sessions",
  "Coverage",
] as const;
const control = "archive-control";
function chooseInterestingPeriod(periods: ArchivePeriod[]) {
  const choices = periods.filter((p) => p.rows.length >= 20);
  const value = crypto.getRandomValues(new Uint32Array(1))[0];
  return choices[value % choices.length];
}

function Chapter({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="archive-chapter">
      <div>
        <h2>{title}</h2>
        {description ? <p className="archive-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
function Evidence({ children }: { children: ReactNode }) {
  return (
    <details className="archive-evidence">
      <summary>How this is calculated</summary>
      <div>{children}</div>
    </details>
  );
}
function safeLink(value: string) {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
}
function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}
export function ArchiveExperience() {
  const {
    streams,
    loading,
    fullyLoaded,
    hasMore,
    loadMore,
    loadingMore,
    error: streamError,
  } = useStreams();
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const demo = pathname.startsWith("/demo");
  const { notes, update, error, ready } = useArchiveNotes(demo);
  const tz = resolveStatsTimeZone(params.get("tz"));
  const archive = useMemo(() => buildArchive(streams, tz), [streams, tz]);
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.get("month") || "")
    ? params.get("month")!
    : archive.all.days.at(-1)?.slice(0, 7) || "2026-11";
  const tab =
    tabs.find((t) => t.toLowerCase() === params.get("view")) || "Story";
  const sort = params.get("sort") === "time" ? "time" : "plays";
  const entity = String(params.get("track") || "");
  const insight = useMemo(
    () => monthlyInsights(archive, month),
    [archive, month],
  );
  const p = insight.p;
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState(params.get("q") || "");
  const deferred = useDeferredValue(query);
  const [minPlays, setMinPlays] = useState(
    Math.max(1, Number(params.get("min")) || 1),
  );
  const [dateFrom, setDateFrom] = useState(params.get("from") || "");
  const [dateTo, setDateTo] = useState(params.get("to") || "");
  const [source, setSource] = useState(params.get("source") || "all");
  const [firstMonth, setFirstMonth] = useState(params.get("first") || "");
  const [lastMonth, setLastMonth] = useState(params.get("last") || "");
  const [notedOnly, setNotedOnly] = useState(params.get("noted") === "1");
  const [memory, setMemory] = useState<Memory | null>(null);
  const [era, setEra] = useState<Era | null>(null);
  const [day, setDay] = useState("");
  const [searchLimit, setSearchLimit] = useState(40);
  const [sessionLimit, setSessionLimit] = useState(20);
  const compare = String(params.get("compare") || shiftMonth(month, -1));
  const aFrom = params.get("aFrom") || "",
    aTo = params.get("aTo") || "",
    bFrom = params.get("bFrom") || "",
    bTo = params.get("bTo") || "";
  const setAFrom = (v: string) => nav({ aFrom: v });
  const setATo = (v: string) => nav({ aTo: v });
  const setBFrom = (v: string) => nav({ bFrom: v });
  const setBTo = (v: string) => nav({ bTo: v });
  const periodQuery = () => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries({
      month,
      tz,
      q: query,
      min: String(minPlays),
      from: dateFrom,
      to: dateTo,
      source,
      noted: notedOnly ? "1" : "",
      first: firstMonth,
      last: lastMonth,
    })) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    return q;
  };
  const nav = (changes: Record<string, string | null>) => {
    const q = periodQuery();
    q.set("month", month);
    q.set("tz", tz);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    router.push(`${pathname}?${q}`, { scroll: false });
  };
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.defaultPrevented ||
        !(e.target instanceof HTMLElement) ||
        e.target.closest(
          'input,textarea,select,button,a,summary,[contenteditable="true"]',
        )
      )
        return;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const q = new URLSearchParams(window.location.search);
        q.set("month", shiftMonth(month, e.key === "ArrowLeft" ? -1 : 1));
        q.set("tz", tz);
        router.push(`${pathname}?${q}`, { scroll: false });
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [month, pathname, router, tz]);
  const ranked = (list: ArchiveEntity[]) =>
    sort === "time" ? [...list].sort((a, b) => b.ms - a.ms) : list;
  const openMemory = (target: string) =>
    setMemory({
      id: crypto.randomUUID(),
      target,
      title: "",
      text: "",
      tags: "",
      link: "",
    });
  const rankList = (
    items: ArchiveEntity[],
    limit = 8,
    kind: "track" | "artist" | "album" = "track",
  ) => (
    <div className="archive-list">
      {ranked(items)
        .slice(0, limit)
        .map((e, i) => (
          <div className="archive-row" key={e.key}>
            <span className="archive-rank">
              {String(i + 1).padStart(2, "0")}
            </span>
            <AlbumArt src={e.art} alt="" width={44} height={44} />
            <div className="min-w-0 flex-1">
              {kind === "track" ? (
                <button
                  className="archive-text-link"
                  onClick={() => nav({ track: trackKey(e.row) })}
                >
                  {e.name}
                </button>
              ) : (
                <Link
                  className="archive-text-link"
                  href={`${demo ? "/demo" : ""}${kind === "artist" ? artistPath(e.name) : albumPath(e.artist, e.name)}?range=all&archiveMonth=${month}&tz=${encodeURIComponent(tz)}`}
                >
                  {e.name}
                </Link>
              )}
              <p className="archive-muted truncate">
                {e.artist} · {e.days.size} active days
              </p>
            </div>
            <span className="shrink-0 text-right text-sm">
              {e.plays} plays
              <br />
              <small className="archive-muted">
                {(e.ms / 3600000).toFixed(1)}h stored
              </small>
            </span>
          </div>
        ))}
      {!items.length ? (
        <p className="archive-muted py-4">
          No qualifying records in this period.
        </p>
      ) : null}
    </div>
  );
  const entityTrack = entity ? archive.trackIndex.get(entity) : undefined;
  const comparisonA =
    /^\d{4}-\d{2}-\d{2}$/.test(aFrom) &&
    /^\d{4}-\d{2}-\d{2}$/.test(aTo) &&
    aFrom <= aTo
      ? archive.range(aFrom, aTo)
      : p;
  const comparisonB =
    /^\d{4}-\d{2}-\d{2}$/.test(bFrom) &&
    /^\d{4}-\d{2}-\d{2}$/.test(bTo) &&
    bFrom <= bTo
      ? archive.range(bFrom, bTo)
      : archive.months.get(compare) || archive.empty(compare);
  const comparison = useMemo(
    () => comparePeriods(comparisonA, comparisonB),
    [comparisonA, comparisonB],
  );
  const sessions = useMemo(() => listeningSessions(archive), [archive]);
  const suggestions = useMemo(() => suggestedBoundaries(archive), [archive]);
  const companionTracks = useMemo(() => {
    if (!entity) return [];
    const rows = sessions
      .filter((session) => session.some((r) => trackKey(r) === entity))
      .flat()
      .filter((r) => trackKey(r) !== entity);
    return archive.select(rows, "companions").tracks;
  }, [sessions, entity, archive]);
  const filteredTracks = useMemo(() => {
    const selected = archive.rows.filter(
      (r) =>
        (!dateFrom || archive.dates.get(r)! >= dateFrom) &&
        (!dateTo || archive.dates.get(r)! <= dateTo) &&
        (source === "all" ||
          (source === "lastfm") === r.trackId.startsWith("lfm-")),
    );
    const scope =
      dateFrom || dateTo || source !== "all"
        ? archive.select(selected, "search").tracks
        : archive.all.tracks;
    return scope.filter(
      (t) =>
        t.plays >= minPlays &&
        `${t.name} ${t.artist} ${t.album} ${notes.works
          .filter((w) => w.track === t.key)
          .map((w) => `${w.composer} ${w.work} ${w.performer}`)
          .join(" ")}`
          .toLowerCase()
          .includes(deferred.toLowerCase()) &&
        (!firstMonth ||
          archive.trackIndex.get(t.key)?.first.startsWith(firstMonth)) &&
        (!lastMonth ||
          archive.trackIndex.get(t.key)?.last.startsWith(lastMonth)) &&
        (!notedOnly ||
          notes.memories.some((m) => m.target === `track:${t.key}`)),
    );
  }, [
    archive,
    dateFrom,
    dateTo,
    minPlays,
    deferred,
    source,
    notedOnly,
    notes.memories,
    notes.works,
    firstMonth,
    lastMonth,
  ]);
  const rediscovery = archive.all.tracks
    .filter(
      (t) =>
        t.plays >= ARCHIVE_RULES.minimumPlays &&
        daysBetween(t.last, archive.all.days.at(-1) || t.last) >= 90 &&
        !notes.dismissed.includes(t.key) &&
        !notes.elsewhere.includes(t.key),
    )
    .sort((a, b) => b.plays - a.plays);
  function exportPeriod() {
    downloadArchive(`soundfolio-${month}.json`, {
      format: "soundfolio-period-v1",
      period: month,
      timeZone: tz,
      coverage: "Observed records only; gaps are not evidence of absence.",
      duration:
        "Stored durations; Last.fm and legacy values are estimates, not measured listening.",
      summary: {
        plays: p.rows.length,
        activeDays: p.days.length,
        storedMs: p.ms,
      },
      tracks: p.tracks.map(({ days, months, row, ...t }) => ({
        ...t,
        days: [...days],
        months: Object.fromEntries(months),
        trackId: row.trackId,
      })),
      records: p.rows,
      memoriesIncluded: false,
    });
    setNotice("Period exported. Personal memories were excluded.");
  }
  function imageExport() {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const theme = getComputedStyle(document.documentElement);
    const themeColor = (name: string, fallback: string) =>
      theme.getPropertyValue(name).trim() || fallback;
    ctx.fillStyle = themeColor("--background", "#09090b");
    ctx.fillRect(0, 0, 1200, 800);
    ctx.fillStyle = themeColor("--primary", "#1ed760");
    ctx.font = "24px sans-serif";
    ctx.fillText("SOUNDFOLIO / LISTENING TIME MACHINE", 80, 100);
    ctx.fillStyle = themeColor("--foreground", "#fafafa");
    ctx.font = "600 60px sans-serif";
    ctx.fillText(monthLabel(month), 80, 210);
    ctx.font = "26px sans-serif";
    ctx.fillText(
      `${p.rows.length} plays · ${p.tracks.length} tracks · ${p.days.length} active days`,
      80,
      285,
    );
    p.tracks.slice(0, 5).forEach((t, i) => {
      ctx.fillText(
        `${i + 1}. ${t.name.slice(0, 48)} — ${t.artist.slice(0, 20)}`,
        80,
        370 + i * 60,
      );
    });
    ctx.fillStyle = themeColor("--primary", "#1ed760");
    ctx.font = "18px sans-serif";
    ctx.fillText(
      `${demo ? "Fictional demo · " : ""}${tz} · Personal memories excluded · Observed records only`,
      80,
      740,
    );
    canvas.toBlob((blob) => {
      if (!blob) {
        setNotice(
          "Image export is unavailable in this browser. Use Print story instead.",
        );
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = `soundfolio-${month}.png`;
      a.href = url;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Summary image exported. Personal memories were excluded.");
    }, "image/png");
  }
  if (loading)
    return <div className="archive-loading">Opening the record cabinet…</div>;
  return (
    <div className="archive" data-archive>
      <header className="archive-heading">
        <div>
          <p className="archive-kicker">Your listening archive</p>
          <h1>Listening Time Machine</h1>
          <p className="archive-muted">Follow the music. Find the memories.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={control}
            disabled={
              ![...archive.months.values()].some((m) => m.rows.length >= 20)
            }
            onClick={() => {
              const chosen = chooseInterestingPeriod([
                ...archive.months.values(),
              ]);
              if (chosen) {
                nav({ month: chosen.key, track: null });
                setNotice(
                  `Selected ${monthLabel(chosen.key)}: ${chosen.artists.length} artists across ${chosen.days.length} active days.`,
                );
              }
            }}
          >
            ✦ Surprise me
          </button>
          <button
            className={control}
            onClick={() => {
              navigator.clipboard
                .writeText(
                  `${window.location.origin}${pathname}?${periodQuery()}`,
                )
                .then(() =>
                  setNotice(
                    "Private navigation URL copied. This grants no access to your data.",
                  ),
                )
                .catch(() => setNotice("Copy the URL from your address bar."));
            }}
          >
            Copy period URL
          </button>
        </div>
      </header>
      {demo ? (
        <p className="archive-banner">
          FICTIONAL DEMO · All listening, memories, and eras in this demo are
          synthetic.
        </p>
      ) : null}
      {!fullyLoaded ? (
        <div className="archive-banner">
          Only {streams.length.toLocaleString()} loaded records are included.
          Insights remain provisional.{" "}
          {hasMore ? (
            <button
              className={control}
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? "Loading…" : "Load more history"}
            </button>
          ) : null}
        </div>
      ) : null}
      {streamError || error ? <p role="alert">{streamError || error}</p> : null}
      {notice ? (
        <p role="status" className="archive-banner">
          {notice}
        </p>
      ) : null}
      <div className="archive-navigation">
        <div className="archive-period-group">
          <p className="archive-field-label">Listening period</p>
          <div className="archive-period-controls">
            <button
              aria-label="Previous month"
              className="archive-arrow"
              onClick={() => nav({ month: shiftMonth(month, -1), track: null })}
            >
              <ChevronLeft size={16} />
            </button>
            <ArchivePeriodPicker
              month={month}
              availableMonths={archive.months}
              onChange={(value) => nav({ month: value, track: null })}
            />
            <button
              aria-label="Next month"
              className="archive-arrow"
              onClick={() => nav({ month: shiftMonth(month, 1), track: null })}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div className="archive-sort-group">
          <p className="archive-field-label">Rank by</p>
          <div className="archive-segmented" role="group" aria-label="Rank by">
            <button
              aria-pressed={sort === "plays"}
              onClick={() => nav({ sort: "plays" })}
            >
              Plays
            </button>
            <button
              aria-pressed={sort === "time"}
              onClick={() => nav({ sort: "time" })}
            >
              Stored time
            </button>
          </div>
        </div>
        <p className="archive-timezone" title={tz}>
          Calendar · {tz.split("/").at(-1)?.replaceAll("_", " ")}
        </p>
      </div>
      <div
        className="archive-year"
        aria-label={`${month.slice(0, 4)} year overview`}
      >
        {Array.from({ length: 12 }, (_, i) => {
          const m = `${month.slice(0, 4)}-${String(i + 1).padStart(2, "0")}`,
            period = archive.months.get(m);
          return (
            <button
              key={m}
              aria-pressed={m === month}
              className={m === month ? "selected" : ""}
              title={
                period
                  ? `${period.rows.length} plays; led by ${period.artists[0]?.name}`
                  : "No observed records"
              }
              onClick={() => nav({ month: m, track: null })}
            >
              <span>{monthLabel(m).split(" ")[0].slice(0, 3)}</span>
              <span className="archive-month-mark">{period ? "●" : "·"}</span>
              <small>{period?.artists[0]?.name || "No records"}</small>
            </button>
          );
        })}
      </div>
      <nav className="archive-tabs" aria-label="Archive sections">
        {tabs.map((t) => (
          <button
            key={t}
            aria-current={tab === t ? "page" : undefined}
            onClick={() => nav({ view: t.toLowerCase(), track: null })}
          >
            {t}
          </button>
        ))}
      </nav>
      {entityTrack ? (
        <>
          <button className={control} onClick={() => nav({ track: null })}>
            ← Back to {monthLabel(month)}
          </button>
          <Chapter title={entityTrack.name} description={entityTrack.artist}>
            <div className="archive-split">
              <div>
                <AlbumArt
                  src={entityTrack.art}
                  alt={entityTrack.album}
                  width={160}
                  height={160}
                />
                <p>
                  First observed {entityTrack.first} · Latest {entityTrack.last}
                </p>
                <p>
                  {entityTrack.plays} plays across {entityTrack.months.size}{" "}
                  months and {entityTrack.days.size} days.
                </p>
                <p>
                  Peak month:{" "}
                  <button
                    className="archive-text-link"
                    onClick={() =>
                      nav({
                        month: [...entityTrack.months].sort(
                          (a, b) => b[1] - a[1],
                        )[0][0],
                        track: null,
                      })
                    }
                  >
                    {monthLabel(
                      [...entityTrack.months].sort((a, b) => b[1] - a[1])[0][0],
                    )}
                  </button>
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`${demo ? "/demo" : ""}${trackPath(entityTrack.artist, entityTrack.name)}?range=all&archiveMonth=${month}&tz=${encodeURIComponent(tz)}`}
                  >
                    Track details ↗
                  </Link>
                  <Link
                    href={`${demo ? "/demo" : ""}${artistPath(entityTrack.artist)}?range=all&archiveMonth=${month}&tz=${encodeURIComponent(tz)}`}
                  >
                    Artist details ↗
                  </Link>
                  <Link
                    href={`${demo ? "/demo" : ""}${albumPath(entityTrack.artist, entityTrack.album)}?range=all&archiveMonth=${month}&tz=${encodeURIComponent(tz)}`}
                  >
                    Album details ↗
                  </Link>
                  <button
                    className={control}
                    onClick={() => openMemory(`track:${entityTrack.key}`)}
                  >
                    Add memory
                  </button>
                </div>
              </div>
              <div className="archive-history">
                {[...entityTrack.months].map(([m, n]) => (
                  <button
                    key={m}
                    onClick={() => nav({ month: m, track: null })}
                  >
                    <span>{monthLabel(m)}</span>
                    <span>{n} plays</span>
                  </button>
                ))}
              </div>
            </div>
            <Evidence>
              Track identity uses normalized artist and title, matching existing
              cross-source deduplication. Different recordings with the same
              artist and title may remain merged. First observed is bounded by
              imported coverage.
            </Evidence>
            <TrackLifeSummary
              archive={archive}
              track={entityTrack}
              onMonth={(m) => nav({ month: m, track: null })}
            />
            <h3>Heard in the same sessions</h3>
            {rankList(companionTracks, 5)}
            <h3>Associated memories and eras</h3>
            {notes.memories
              .filter((m) => m.target === `track:${entityTrack.key}`)
              .map((m) => (
                <p key={m.id}>
                  <strong>{m.title}</strong> — {m.text}
                </p>
              ))}
            {notes.eras
              .filter((e) =>
                [...entityTrack.days].some((d) => d >= e.from && d <= e.to),
              )
              .map((e) => (
                <button
                  className={control}
                  key={e.id}
                  onClick={() => {
                    nav({
                      view: "compare",
                      track: null,
                      aFrom: e.from,
                      aTo: e.to,
                    });
                  }}
                >
                  {e.name} · explore period
                </button>
              ))}
            <WorkEditor track={entityTrack} notes={notes} update={update} />
          </Chapter>
        </>
      ) : null}
      {!entityTrack && tab === "Story" ? (
        <>
          <section className="archive-cover">
            <div className="archive-cover-copy">
              <p className="archive-kicker">A chapter in your listening</p>
              <h2>{monthLabel(month)}</h2>
              <p>{monthNarrative(p)}</p>
              <div className="archive-cover-stats">
                <span>
                  <b>{p.rows.length.toLocaleString()}</b> plays
                </span>
                <span>
                  <b>{(p.ms / 3600000).toFixed(1)}h</b> stored time*
                </span>
                <span>
                  <b>{p.days.length}</b> active days
                </span>
              </div>
              <p className="archive-muted">
                {p.tracks.length} tracks · {p.artists.length} artists ·{" "}
                {p.albums.length} observed albums
                <br />
                {insight.first.length} first-observed tracks ·{" "}
                {
                  p.artists.filter(
                    (a) =>
                      archive.all.artists
                        .find((v) => v.key === a.key)
                        ?.first.slice(0, 7) === month,
                  ).length
                }{" "}
                first-observed artists
              </p>
              <p className="archive-muted">
                * Stored duration totals may include estimates. See coverage.
              </p>
            </div>
            <div className="archive-collage">
              {p.albums.slice(0, 4).map((t) => (
                <AlbumArt
                  key={t.key}
                  src={t.art}
                  alt={`${t.artist}: ${t.name}`}
                  width={180}
                  height={180}
                  className="archive-cover-art"
                />
              ))}
            </div>
          </section>
          {insight.edge ? (
            <p className="archive-banner">
              Coverage boundary: this month may be partial. First observed means
              first in this archive, never first heard. Totals are not adjusted
              for missing days.
            </p>
          ) : null}
          <div className="archive-inline-actions">
            <button
              className={control}
              onClick={() => openMemory(`month:${month}`)}
            >
              ＋ Add a memory
            </button>
            <button
              className={control}
              onClick={() => nav({ view: "compare" })}
            >
              Compare this month
            </button>
            <button className={control} onClick={exportPeriod}>
              Export period JSON
            </button>
            <button className={control} onClick={imageExport}>
              Download summary image
            </button>
            <button className={control} onClick={() => window.print()}>
              Print story
            </button>
          </div>
          <Chapter
            title="The soundtrack"
            description="The music that occupied this month. Switch between plays and stored duration above."
          >
            {rankList(p.tracks)}
            <button
              className={control}
              onClick={() => {
                const from = `${month}-01`,
                  to = `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()}`;
                setDateFrom(from);
                setDateTo(to);
                nav({ view: "explore", from, to });
              }}
            >
              Explore all tracks from this month →
            </button>
            <details>
              <summary>Explore artists and albums</summary>
              <div className="archive-split">
                <div>
                  <h3>Artists</h3>
                  {rankList(p.artists, 8, "artist")}
                </div>
                <div>
                  <h3>Albums observed</h3>
                  {rankList(p.albums, 8, "album")}
                </div>
              </div>
            </details>
          </Chapter>
          <Chapter
            title="On repeat"
            description="Favorites heard at least five times, with their spread across days."
          >
            {rankList(
              p.tracks.filter((t) => t.plays >= ARCHIVE_RULES.minimumPlays),
              5,
            )}
            <Evidence>
              Minimum {ARCHIVE_RULES.minimumPlays} plays. Repeat concentration:{" "}
              {p.rows.length
                ? Math.round(
                    (p.tracks.slice(0, 5).reduce((s, t) => s + t.plays, 0) /
                      p.rows.length) *
                      100,
                  )
                : 0}
              % of plays belong to the five most played tracks. Counts are
              deduplicated; distinct active dates use {tz}.
            </Evidence>
          </Chapter>
          <Chapter
            title="First appearances"
            description={
              insight.boundary
                ? "The beginning of the archive is a coverage boundary, not a discovery event."
                : "First observed in available history, not necessarily newly discovered."
            }
          >
            {rankList(insight.first, 5)}
            <Evidence>
              Compare each track’s earliest observed local date across all
              loaded history with this month. Missing older records can change
              these results.
            </Evidence>
          </Chapter>
          <Chapter
            title="What came next"
            description="Retrospective: these observations use listening after the selected month."
          >
            {insight.followup ? (
              <>
                <h3>Discoveries that lasted</h3>
                {rankList(insight.retained, 5)}
                <details>
                  <summary>Brief bursts without observed retention</summary>
                  {rankList(insight.brief, 5)}
                </details>
              </>
            ) : (
              <p>
                Not enough follow-up coverage to judge retention. Revisit when
                at least three subsequent months are available.
              </p>
            )}
            <Evidence>
              Retention requires at least {ARCHIVE_RULES.retentionPlays} plays
              in the next {ARCHIVE_RULES.retentionMonths} calendar months, with
              records extending beyond that window. Brief bursts require at
              least five plays in the first month and fewer than three later
              plays within that window. A lack of records does not prove a lack
              of listening.{" "}
              {insight.boundary
                ? "First-month candidates are especially uncertain because earlier history is unavailable."
                : ""}
            </Evidence>
          </Chapter>
          <Chapter title="Old favorites returning">
            {insight.returning.map((t) => (
              <div key={t.key}>
                <button
                  className="archive-text-link"
                  onClick={() => nav({ track: t.key })}
                >
                  {t.name}
                </button>
                <p className="archive-muted">
                  {t.gap} days between observed plays · {t.plays} plays this
                  month
                </p>
              </div>
            ))}
            {!insight.returning.length ? (
              <p className="archive-muted">
                No recorded returns across a 90-day gap.
              </p>
            ) : null}
            <Evidence>
              At least {ARCHIVE_RULES.comebackDays} calendar days between the
              final earlier play and first play in this month. Gaps may reflect
              incomplete imports.
            </Evidence>
          </Chapter>
          <Chapter
            title="What changed"
            description="Listening share compared with the previous calendar month; percentage points, not percent growth."
          >
            {insight.previous ? (
              insight.changes.slice(0, 6).map((a) => (
                <div className="archive-comparison-row" key={a.key}>
                  <Link href={`${demo ? "/demo" : ""}${artistPath(a.name)}`}>
                    {a.name}
                  </Link>
                  <span>
                    {a.before} → {a.plays} plays
                  </span>
                  <strong>
                    {a.delta >= 0 ? "+" : ""}
                    {(a.delta * 100).toFixed(1)} pp
                  </strong>
                </div>
              ))
            ) : (
              <p>No previous-month records available.</p>
            )}
            <Evidence>
              Artist plays divided by all plays in each month. Minimum five
              plays in either period. Boundary months may be partial; this
              comparison describes observed shares only, not a change in total
              listening habits.
            </Evidence>
          </Chapter>
          <Chapter
            title="How the month unfolded"
            description="Select a date to inspect its listening and add your own context."
          >
            <div className="archive-calendar">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <span className="archive-muted text-center" key={d}>
                  {d}
                </span>
              ))}
              {Array.from(
                { length: new Date(`${month}-01T12:00:00Z`).getUTCDay() },
                (_, i) => (
                  <span aria-hidden="true" key={`blank-${i}`} />
                ),
              )}
              {Array.from(
                {
                  length: new Date(
                    Number(month.slice(0, 4)),
                    Number(month.slice(5)),
                    0,
                  ).getDate(),
                },
                (_, i) => {
                  const d = `${month}-${String(i + 1).padStart(2, "0")}`,
                    n = p.rows.filter((r) => archive.dates.get(r) === d).length;
                  return (
                    <button
                      key={d}
                      aria-pressed={day === d}
                      className={n ? "active" : ""}
                      onClick={() => setDay(d)}
                    >
                      <b>{i + 1}</b>
                      <small>{n} plays</small>
                    </button>
                  );
                },
              )}
            </div>
            {day && day.startsWith(month) ? (
              <div>
                <h3>{day}</h3>
                {rankList(archive.range(day, day).tracks, 6)}
                <button
                  className={control}
                  onClick={() => openMemory(`date:${day}`)}
                >
                  Add a memory for this day
                </button>
                {notes.memories
                  .filter((m) => m.target === `date:${day}`)
                  .map((m) => (
                    <p key={m.id}>
                      {m.title} — {m.text}
                    </p>
                  ))}
              </div>
            ) : null}
          </Chapter>
          <Chapter
            title="Your words"
            description="Personal writing stays separate from calculated observations."
          >
            {notes.memories
              .filter((m) => m.target === `month:${month}`)
              .map((m) => (
                <blockquote key={m.id}>
                  <h3>{m.title}</h3>
                  <p>{m.text}</p>
                  <button className={control} onClick={() => setMemory(m)}>
                    Edit memory
                  </button>
                </blockquote>
              ))}
            <p className="archive-muted">
              Optional prompt: What does this month’s music remind you of?
            </p>
          </Chapter>
          <Chapter title="On this month in…">
            <div className="flex flex-wrap gap-2">
              {[...archive.months.keys()]
                .filter((m) => m.slice(5) === month.slice(5) && m !== month)
                .map((m) => (
                  <button
                    className={control}
                    key={m}
                    onClick={() => nav({ month: m })}
                  >
                    {monthLabel(m)} · {archive.months.get(m)!.rows.length} plays
                  </button>
                ))}
            </div>
          </Chapter>
        </>
      ) : null}
      {!entityTrack && tab === "Compare" ? (
        <Chapter
          title="Two chapters, side by side"
          description="Choose months or enter inclusive custom ranges. A year or summer is simply a date range."
        >
          <div className="archive-split">
            <div>
              <h3>Period A · {comparisonA.key}</h3>
              <RangeFields
                from={aFrom}
                to={aTo}
                setFrom={setAFrom}
                setTo={setATo}
              />
              <select
                aria-label="Period A era"
                className={control}
                value=""
                onChange={(e) => {
                  const v = notes.eras.find((v) => v.id === e.target.value);
                  if (v) {
                    nav({ aFrom: v.from, aTo: v.to });
                  }
                }}
              >
                <option value="">Use a named era</option>
                {notes.eras.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <PeriodMetrics period={comparisonA} perDay={comparison.perDayA} />
            </div>
            <div>
              <h3>Period B · {comparisonB.key}</h3>
              <select
                aria-label="Comparison month"
                className={control}
                value={compare}
                onChange={(e) =>
                  nav({ compare: e.target.value, bFrom: null, bTo: null })
                }
              >
                {[...new Set([compare, ...archive.months.keys()])]
                  .sort()
                  .reverse()
                  .map((m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                    </option>
                  ))}
              </select>
              <RangeFields
                from={bFrom}
                to={bTo}
                setFrom={setBFrom}
                setTo={setBTo}
              />
              <select
                aria-label="Period B era"
                className={control}
                value=""
                onChange={(e) => {
                  const v = notes.eras.find((v) => v.id === e.target.value);
                  if (v) {
                    nav({ bFrom: v.from, bTo: v.to });
                  }
                }}
              >
                <option value="">Use a named era</option>
                {notes.eras.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              <PeriodMetrics period={comparisonB} perDay={comparison.perDayB} />
            </div>
          </div>
          {(aFrom > aTo && aTo) || (bFrom > bTo && bTo) ? (
            <p role="alert">
              Range start must precede its end. Showing the selected month until
              corrected.
            </p>
          ) : null}
          <p className="archive-big-number">
            {Math.round(comparison.overlap * 100)}% <span>artist overlap</span>
          </p>
          <Evidence>
            Jaccard overlap = distinct artists heard in both periods ÷ distinct
            artists heard in either. Each artist counts equally. Plays per
            calendar day use the inclusive selected duration, including dates
            without records. This is descriptive and sensitive to missing
            history. Stored time includes legacy duration estimates.
          </Evidence>
          <details>
            <summary>First observed in each period</summary>
            <div className="archive-split">
              <div>
                <h3>Period A</h3>
                {rankList(
                  comparisonA.tracks.filter(
                    (t) => archive.trackIndex.get(t.key)?.first === t.first,
                  ),
                  5,
                )}
              </div>
              <div>
                <h3>Period B</h3>
                {rankList(
                  comparisonB.tracks.filter(
                    (t) => archive.trackIndex.get(t.key)?.first === t.first,
                  ),
                  5,
                )}
              </div>
            </div>
            <p className="archive-muted">
              First in available history, not necessarily newly discovered.
              Coverage-boundary dates are especially uncertain.
            </p>
          </details>
          <h3>Shared favorites</h3>
          {rankList(comparison.shared)}
          <div className="archive-split">
            <div>
              <h3>Observed only in A</h3>
              {rankList(comparison.onlyA)}
            </div>
            <div>
              <h3>Observed only in B</h3>
              {rankList(comparison.onlyB)}
            </div>
          </div>
          <h3>Artists gaining or losing share (B → A)</h3>
          {[
            ...new Set([
              ...comparisonA.artists.map((t) => t.key),
              ...comparisonB.artists.map((t) => t.key),
            ]),
          ]
            .map((k) => {
              const a = comparisonA.artists.find((t) => t.key === k),
                b = comparisonB.artists.find((t) => t.key === k);
              return {
                name: a?.name || b!.name,
                delta:
                  (a?.plays || 0) / Math.max(1, comparisonA.rows.length) -
                  (b?.plays || 0) / Math.max(1, comparisonB.rows.length),
                a: a?.plays || 0,
                b: b?.plays || 0,
              };
            })
            .filter((t) => Math.max(t.a, t.b) >= 5)
            .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
            .slice(0, 8)
            .map((t) => (
              <p key={t.name}>
                {t.name}: {t.b} → {t.a} plays · {(t.delta * 100).toFixed(1)}{" "}
                percentage points
              </p>
            ))}
          <div className="archive-split">
            <PatternSummary period={comparisonA} tz={tz} />
            <PatternSummary period={comparisonB} tz={tz} />
          </div>
        </Chapter>
      ) : null}
      {!entityTrack && tab === "Rediscover" ? (
        <>
          <Chapter
            title="Worth hearing again"
            description="Former favorites with no observed plays for at least 90 days before the latest record in this archive."
          >
            {rediscovery.slice(0, 16).map((t) => (
              <div className="archive-rediscovery" key={t.key}>
                <AlbumArt src={t.art} alt="" width={64} height={64} />
                <div className="min-w-0 flex-1">
                  <button
                    className="archive-text-link"
                    onClick={() => nav({ track: t.key })}
                  >
                    {t.name}
                  </button>
                  <p>{t.artist}</p>
                  <p className="archive-muted">
                    {t.plays} observed plays · last {t.last} ·{" "}
                    {daysBetween(t.last, archive.all.days.at(-1)!)} days before
                    archive end
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className={control}
                      onClick={() =>
                        update((n) => ({
                          ...n,
                          queue: n.queue.includes(t.key)
                            ? n.queue.filter((k) => k !== t.key)
                            : [...n.queue, t.key],
                        }))
                      }
                    >
                      {notes.queue.includes(t.key)
                        ? "Remove from queue"
                        : "Save to queue"}
                    </button>
                    <button
                      className={control}
                      onClick={() =>
                        update((n) => ({
                          ...n,
                          dismissed: [...n.dismissed, t.key],
                        }))
                      }
                    >
                      Dismiss
                    </button>
                    <button
                      className={control}
                      onClick={() =>
                        update((n) => ({
                          ...n,
                          elsewhere: [...n.elsewhere, t.key],
                        }))
                      }
                    >
                      I listen elsewhere
                    </button>
                    <button
                      className={control}
                      onClick={() => openMemory(`track:${t.key}`)}
                    >
                      Add memory
                    </button>
                    {/^(spotify:track:)?[A-Za-z0-9]{22}$/.test(
                      t.row.trackId,
                    ) ? (
                      <a
                        className={control}
                        target="_blank"
                        rel="noreferrer"
                        href={`https://open.spotify.com/track/${t.row.trackId.replace("spotify:track:", "")}`}
                      >
                        Open Spotify ↗
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {!rediscovery.length ? (
              <p>No qualifying former favorites in the loaded history.</p>
            ) : null}
            <Evidence>
              At least {ARCHIVE_RULES.minimumPlays} lifetime plays and a{" "}
              {ARCHIVE_RULES.comebackDays}-day observed gap. This does not imply
              you stopped listening elsewhere. Links appear only for
              recognizable Spotify track URIs.
            </Evidence>
          </Chapter>
          <Chapter title={`Your private queue · ${notes.queue.length}`}>
            <div className="flex flex-wrap gap-2">
              <button
                className={control}
                onClick={() =>
                  downloadArchive(
                    "soundfolio-rediscovery.json",
                    notes.queue
                      .map((k) => archive.trackIndex.get(k))
                      .filter(Boolean)
                      .map((t) => ({
                        artist: t!.artist,
                        track: t!.name,
                        lastObserved: t!.last,
                      })),
                  )
                }
              >
                Export queue
              </button>
              <button
                className={control}
                onClick={() =>
                  update((n) => ({ ...n, dismissed: [], elsewhere: [] }))
                }
              >
                Reset dismissed suggestions
              </button>
            </div>
            {notes.queue.map((k) => {
              const t = archive.trackIndex.get(k);
              return (
                <div className="archive-comparison-row" key={k}>
                  <button
                    className="archive-text-link"
                    onClick={() => nav({ track: k })}
                  >
                    {t?.name || k}
                  </button>
                  <button
                    className={control}
                    onClick={() =>
                      update((n) => ({
                        ...n,
                        queue: n.queue.filter((v) => v !== k),
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </Chapter>
        </>
      ) : null}
      {!entityTrack && tab === "Eras" ? (
        <>
          <Chapter
            title="Your musical eras"
            description="Give a period a name in your own words. These are your labels, not conclusions about your life."
          >
            <button
              className={control}
              onClick={() =>
                setEra({
                  id: crypto.randomUUID(),
                  name: "",
                  from: `${month}-01`,
                  to: `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()}`,
                  description: "",
                  color: "#bd935b",
                  cover: "",
                })
              }
            >
              ＋ Create era
            </button>
            {notes.eras.map((e) => {
              const period = archive.range(e.from, e.to);
              return (
                <article
                  key={e.id}
                  className="archive-era"
                  style={{ borderLeftColor: e.color }}
                >
                  {e.cover ? (
                    <AlbumArt
                      src={e.cover}
                      alt="Era cover"
                      width={100}
                      height={100}
                    />
                  ) : null}
                  <h3>{e.name}</h3>
                  <p className="archive-muted">
                    {e.from} — {e.to} · {period.rows.length} plays
                  </p>
                  <p>{e.description}</p>
                  <div className="flex flex-wrap gap-2">
                    <button className={control} onClick={() => setEra(e)}>
                      Edit
                    </button>
                    <button
                      className={control}
                      onClick={() =>
                        update((n) => ({
                          ...n,
                          eras: n.eras.filter((v) => v.id !== e.id),
                        }))
                      }
                    >
                      Delete era
                    </button>
                    <button
                      className={control}
                      onClick={() => openMemory(`era:${e.id}`)}
                    >
                      Add memory
                    </button>
                    <button
                      className={control}
                      onClick={() => {
                        nav({ view: "compare", aFrom: e.from, aTo: e.to });
                      }}
                    >
                      Compare era
                    </button>
                    <button
                      className={control}
                      onClick={() =>
                        downloadArchive(`soundfolio-era-${e.id}.json`, {
                          era: e,
                          tracks: period.tracks.map((t) => ({
                            name: t.name,
                            artist: t.artist,
                            plays: t.plays,
                          })),
                          memoriesIncluded: false,
                        })
                      }
                    >
                      Export era
                    </button>
                    {notes.eras.length > 1 ? (
                      <label>
                        Merge into{" "}
                        <select
                          className={control}
                          aria-label={`Merge ${e.name} into another era`}
                          value=""
                          onChange={(event) => {
                            if (event.target.value)
                              update((n) =>
                                mergeEras(n, e.id, event.target.value),
                              );
                          }}
                        >
                          <option value="">Choose era…</option>
                          {notes.eras
                            .filter((v) => v.id !== e.id)
                            .map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.name}
                              </option>
                            ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                  <details>
                    <summary>Defining music and memories</summary>
                    {rankList(period.tracks, 6)}
                    {notes.memories
                      .filter((m) => m.target === `era:${e.id}`)
                      .map((m) => (
                        <p key={m.id}>
                          <b>{m.title}</b> — {m.text}
                        </p>
                      ))}
                  </details>
                </article>
              );
            })}
          </Chapter>
          <Chapter
            title="Suggested boundaries"
            description="Optional starting points based on sustained changes in observed artists."
          >
            {suggestions
              .filter((s) => !notes.dismissedBoundaries.includes(s.month))
              .map((s) => (
                <div className="archive-era" key={s.month}>
                  <h3>{monthLabel(s.month)}</h3>
                  <p>
                    {Math.round(s.overlap * 100)}% artist listening-share
                    overlap with the preceding month; the next month shares at
                    least 50%.
                  </p>
                  <button
                    className={control}
                    onClick={() =>
                      setEra({
                        id: crypto.randomUUID(),
                        name: "",
                        from: `${s.month}-01`,
                        to: archive.all.days.at(-1)!,
                        description: "",
                        color: "#bd935b",
                        cover: "",
                      })
                    }
                  >
                    Name and adjust
                  </button>
                  <button
                    className={control}
                    onClick={() =>
                      update((n) => ({
                        ...n,
                        dismissedBoundaries: [
                          ...n.dismissedBoundaries,
                          s.month,
                        ],
                      }))
                    }
                  >
                    Dismiss
                  </button>
                </div>
              ))}
            <Evidence>
              Three consecutive months, each with at least 20 plays. A boundary
              is suggested when artist listening-share overlap falls below 35%
              from the previous month and is at least 50% with the following
              month. Overlap sums the smaller artist play share for every artist
              across both periods. These thresholds are exploratory, not
              objective eras. Edit dates to combine periods.
            </Evidence>
          </Chapter>
        </>
      ) : null}
      {!entityTrack && tab === "Memories" ? (
        <Chapter
          title="A timeline in your own words"
          description="Private, device-local annotations. Browser storage is separated by account and demo; it does not sync to other devices. Export a backup before clearing browser data."
        >
          <label className="archive-label">
            Search memories and tags
            <input
              className={control}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your words…"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              className={control}
              onClick={() => openMemory(`month:${month}`)}
            >
              ＋ Add memory
            </button>
            <button
              className={control}
              onClick={() =>
                downloadArchive("soundfolio-annotations-v1.json", notes)
              }
            >
              Export all annotations
            </button>
          </div>
          {notes.memories
            .filter((m) =>
              `${m.title} ${m.text} ${m.tags} ${m.target}`
                .toLowerCase()
                .includes(deferred.toLowerCase()),
            )
            .sort((a, b) => b.target.localeCompare(a.target))
            .map((m) => (
              <article className="archive-memory" key={m.id}>
                <p className="archive-kicker">
                  Your writing · {m.target.replace(/\0/g, " / ")}
                </p>
                <h3>{m.title}</h3>
                <p className="whitespace-pre-wrap">{m.text}</p>
                <p className="archive-muted">{m.tags}</p>
                {safeLink(m.link) ? (
                  <a href={safeLink(m.link)} target="_blank" rel="noreferrer">
                    Attached link ↗
                  </a>
                ) : null}
                <div className="flex gap-2">
                  <button className={control} onClick={() => setMemory(m)}>
                    Edit
                  </button>
                  <button
                    className={control}
                    onClick={() =>
                      update((n) => ({
                        ...n,
                        memories: n.memories.filter((v) => v.id !== m.id),
                      }))
                    }
                  >
                    Delete memory
                  </button>
                  {m.target.startsWith("month:") ? (
                    <button
                      className={control}
                      onClick={() =>
                        nav({ month: m.target.slice(6), view: "story" })
                      }
                    >
                      Visit month
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
        </Chapter>
      ) : null}
      {!entityTrack && tab === "Explore" ? (
        <Chapter
          title="Search the archive"
          description="Search tracks, artists, albums, named eras, memories, and tags. Results show observed music, never album completion."
        >
          <input
            aria-label="Search archive"
            className={control}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Artist, track, album, memory, tag…"
          />
          <div className="archive-inline-actions">
            <label>
              First observed month
              <input
                aria-label="First observed month"
                type="month"
                className={control}
                value={firstMonth}
                onChange={(e) => setFirstMonth(e.target.value)}
              />
            </label>
            <label>
              Latest observed month
              <input
                aria-label="Latest observed month"
                type="month"
                className={control}
                value={lastMonth}
                onChange={(e) => setLastMonth(e.target.value)}
              />
            </label>
            <label>
              Minimum plays{" "}
              <input
                type="number"
                min={1}
                className={control}
                value={minPlays}
                onChange={(e) =>
                  setMinPlays(Math.max(1, Number(e.target.value)))
                }
              />
            </label>
            <RangeFields
              from={dateFrom}
              to={dateTo}
              setFrom={setDateFrom}
              setTo={setDateTo}
            />
            <select
              aria-label="Source filter"
              className={control}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="all">All sources</option>
              <option value="lastfm">Last.fm ID</option>
              <option value="other">Other / legacy ID</option>
            </select>
            <label>
              <input
                type="checkbox"
                checked={notedOnly}
                onChange={(e) => setNotedOnly(e.target.checked)}
              />{" "}
              Has track notes
            </label>
          </div>
          <p>
            {filteredTracks.length} matching tracks · showing up to{" "}
            {searchLimit}
          </p>
          {rankList(filteredTracks, searchLimit)}
          {filteredTracks.length > searchLimit ? (
            <button
              className={control}
              onClick={() => setSearchLimit((n) => n + 40)}
            >
              Show 40 more tracks
            </button>
          ) : null}
          {notes.memories
            .filter((m) =>
              `${m.title} ${m.text} ${m.tags}`
                .toLowerCase()
                .includes(deferred.toLowerCase()),
            )
            .map((m) => (
              <p key={m.id}>
                Memory:{" "}
                <button
                  className="archive-text-link"
                  onClick={() => setMemory(m)}
                >
                  {m.title}
                </button>
              </p>
            ))}
          {notes.eras
            .filter((e) =>
              `${e.name} ${e.description}`
                .toLowerCase()
                .includes(deferred.toLowerCase()),
            )
            .map((e) => (
              <p key={e.id}>
                Era:{" "}
                <button
                  className="archive-text-link"
                  onClick={() => nav({ view: "eras" })}
                >
                  {e.name}
                </button>
              </p>
            ))}
          <h3>Classical work groupings · your corrections</h3>
          <p className="archive-muted">
            Open any track to add composer, work, and performer. Imported
            metadata is retained. No title-based work inference is applied.
          </p>
          {[
            ...new Set(notes.works.map((w) => `${w.composer} / ${w.work}`)),
          ].map((k) => {
            const works = notes.works.filter(
              (w) => `${w.composer} / ${w.work}` === k,
            );
            return (
              <details key={k}>
                <summary>{k}</summary>
                {works.map((w) => {
                  const t = archive.trackIndex.get(w.track);
                  return (
                    <p key={w.id}>
                      <button
                        className="archive-text-link"
                        onClick={() => nav({ track: w.track })}
                      >
                        {t?.name || "Track unavailable"}
                      </button>{" "}
                      · {w.performer || "Performer unspecified"} ·{" "}
                      {t?.plays || 0} plays ·{" "}
                      {((t?.ms || 0) / 3600000).toFixed(1)}h stored
                    </p>
                  );
                })}
              </details>
            );
          })}
        </Chapter>
      ) : null}
      {!entityTrack && tab === "Sessions" ? (
        <Chapter
          title="Listening sessions"
          description="A provisional grouping using gaps of at most 30 minutes between timestamps. Legacy sources cannot reliably distinguish start and end timestamps, so boundaries do not assume full track duration."
        >
          <p>
            {sessions.length} provisional sessions in loaded history. Showing up
            to {sessionLimit} largest sessions within {monthLabel(month)}.
          </p>
          {sessions
            .filter((s) =>
              s.some((r) => archive.dates.get(r)!.startsWith(month)),
            )
            .sort((a, b) => b.length - a.length)
            .slice(0, sessionLimit)
            .map((s) => {
              const first = s[0],
                last = s.at(-1)!,
                artists = new Set(s.map((r) => r.artistName));
              return (
                <details key={first.id}>
                  <summary>
                    {archive.dates.get(first)} · {s.length} plays ·{" "}
                    {artists.size} artists ·{" "}
                    {Math.round(
                      (last.playedAt.getTime() - first.playedAt.getTime()) /
                        60000,
                    )}{" "}
                    min timestamp span
                  </summary>
                  <p className="archive-muted">
                    {first.playedAt.toLocaleString("en-US", { timeZone: tz })} —{" "}
                    {last.playedAt.toLocaleString("en-US", { timeZone: tz })} (
                    {tz})
                  </p>
                  <ol>
                    {s.slice(0, 100).map((r) => (
                      <li key={r.id}>
                        <button
                          className="archive-text-link"
                          onClick={() => nav({ track: trackKey(r) })}
                        >
                          {r.trackName}
                        </button>{" "}
                        — {r.artistName}
                      </li>
                    ))}
                  </ol>
                  <button
                    className={control}
                    onClick={() =>
                      openMemory(`session:${first.playedAt.toISOString()}`)
                    }
                  >
                    Attach a memory
                  </button>
                </details>
              );
            })}
          <button
            className={control}
            onClick={() => setSessionLimit((n) => n + 20)}
          >
            Show more sessions
          </button>
          <details>
            <summary>Repeated track sequences in this month</summary>
            {repeatedSequences(
              sessions.filter((s) =>
                s.some((r) => archive.dates.get(r)!.startsWith(month)),
              ),
            )
              .slice(0, 10)
              .map((pair) => (
                <p
                  key={JSON.stringify([
                    pair.first.trackId,
                    pair.second.trackId,
                  ])}
                >
                  <button
                    className="archive-text-link"
                    onClick={() => nav({ track: trackKey(pair.first) })}
                  >
                    {pair.first.trackName}
                  </button>{" "}
                  →{" "}
                  <button
                    className="archive-text-link"
                    onClick={() => nav({ track: trackKey(pair.second) })}
                  >
                    {pair.second.trackName}
                  </button>{" "}
                  · {pair.count} occurrences
                </p>
              ))}
            <p className="archive-muted">
              Adjacent distinct tracks in a provisional session, observed at
              least three times. Sequence reflects timestamp order and may be
              affected by overlapping sources.
            </p>
          </details>
          <Evidence>
            Threshold: {ARCHIVE_RULES.sessionGapMinutes} minutes. Timestamp span
            is not measured listening time. Long movements may cause false
            splits; concurrent or incomplete sources can join unrelated plays.
            No activity, genre, or mood labels are inferred.
          </Evidence>
        </Chapter>
      ) : null}
      {!entityTrack && tab === "Coverage" ? (
        <Chapter
          title="What the archive can tell you"
          description="Evidence comes first. Records describe what was captured, not all the music you have ever heard."
        >
          <dl className="archive-facts">
            <dt>Observed range</dt>
            <dd>
              {archive.all.days[0] || "No records"} —{" "}
              {archive.all.days.at(-1) || "No records"}
            </dd>
            <dt>Calendar timezone</dt>
            <dd>{tz}</dd>
            <dt>Deduplication</dt>
            <dd>
              {archive.duplicates} duplicate or invalid records excluded from
              this view; original storage is unchanged.
            </dd>
            <dt>Loaded history</dt>
            <dd>
              {archive.rows.length.toLocaleString()} deduplicated records ·{" "}
              {fullyLoaded
                ? "All currently available records loaded"
                : "Incomplete: load additional pages before interpreting first appearances"}
            </dd>
            <dt>Missing durations</dt>
            <dd>
              {archive.all.unknownTime} records contribute plays but no
              listening time.
            </dd>
            <dt>Last.fm durations</dt>
            <dd>
              {archive.all.estimatedTime} nonzero durations with scrobble IDs
              are estimated. Scrobbles do not measure actual time listened.
            </dd>
            <dt>Other duration values</dt>
            <dd>
              Legacy stream rows do not carry explicit import provenance. Stored
              duration can be ms_played or catalog-based; the archive labels
              totals as stored time rather than claiming measured listening.
            </dd>
            <dt>Coverage gaps</dt>
            <dd>
              A month with no records is unknown, not proof of silence. First
              and last observed months can be partial. Internal months can also
              have unrecorded gaps.
            </dd>
            <dt>Track identity</dt>
            <dd>
              Normalized artist and title; the existing 90-second cross-source
              collision rule prefers Spotify over Last.fm. Recording variants
              may need manual work metadata.
            </dd>
            <dt>Annotations</dt>
            <dd>
              Device-local, account-scoped browser storage. No public links or
              server writes. Notes are separate from imports and derived
              insights.
            </dd>
          </dl>
          <button
            className={control}
            onClick={() =>
              downloadArchive("soundfolio-history-v1.json", {
                format: "soundfolio-history-v1",
                timeZone: tz,
                records: streams,
                notes:
                  "Raw loaded stream rows, including stored durationMs; provenance is limited by the legacy schema. Personal annotations exported separately.",
              })
            }
          >
            Export loaded listening records
          </button>
          <Evidence>
            Thresholds: repeat {ARCHIVE_RULES.minimumPlays} plays; retention{" "}
            {ARCHIVE_RULES.retentionPlays} plays within{" "}
            {ARCHIVE_RULES.retentionMonths} months; comeback{" "}
            {ARCHIVE_RULES.comebackDays} days; session gap{" "}
            {ARCHIVE_RULES.sessionGapMinutes} minutes. Definitions live together
            in lib/archive-analytics.ts. Reimports, syncs, deletions, and
            timezone changes recalculate from the shared provider automatically.
          </Evidence>
        </Chapter>
      ) : null}
      {memory ? (
        <ArchiveDialog label="Memory editor" onClose={() => setMemory(null)}>
          <h2>
            {notes.memories.some((m) => m.id === memory.id)
              ? "Edit memory"
              : "A note from you"}
          </h2>
          <p className="archive-muted">
            Private on this browser · What does this music remind you of?
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              update((n) => ({
                ...n,
                memories: [
                  ...n.memories.filter((m) => m.id !== memory.id),
                  memory,
                ],
              }));
              setMemory(null);
              setNotice("Memory saved on this browser.");
            }}
          >
            <label>
              Attach to
              <select
                className={control}
                value={memory.target.split(":")[0]}
                onChange={(e) =>
                  setMemory({
                    ...memory,
                    target: `${e.target.value}:${e.target.value === "month" ? month : ""}`,
                  })
                }
              >
                {[
                  "month",
                  "era",
                  "track",
                  "album",
                  "artist",
                  "date",
                  "session",
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <MemoryTarget
              memory={memory}
              onChange={(target) => setMemory({ ...memory, target })}
              archive={archive}
              notes={notes}
            />
            <label>
              Title
              <input
                autoFocus
                required
                maxLength={180}
                className={control}
                value={memory.title}
                onChange={(e) =>
                  setMemory({ ...memory, title: e.target.value })
                }
              />
            </label>
            <label>
              Your memory
              <textarea
                required
                rows={5}
                maxLength={20000}
                className={control}
                value={memory.text}
                onChange={(e) => setMemory({ ...memory, text: e.target.value })}
              />
            </label>
            <label>
              Tags
              <input
                className={control}
                value={memory.tags}
                onChange={(e) => setMemory({ ...memory, tags: e.target.value })}
              />
            </label>
            <label>
              Optional link
              <input
                type="url"
                className={control}
                value={memory.link}
                onChange={(e) => setMemory({ ...memory, link: e.target.value })}
              />
            </label>
            <div className="flex gap-2">
              <button disabled={!ready} className={control} type="submit">
                Save memory
              </button>
              <button
                className={control}
                type="button"
                onClick={() => setMemory(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </ArchiveDialog>
      ) : null}
      {era ? (
        <ArchiveDialog label="Era editor" onClose={() => setEra(null)}>
          <h2>Name a chapter</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (era.from > era.to) {
                setNotice("Era start must be before its end.");
                return;
              }
              update((n) => ({
                ...n,
                eras: [...n.eras.filter((v) => v.id !== era.id), era],
              }));
              setEra(null);
            }}
          >
            <label>
              Name
              <input
                autoFocus
                required
                className={control}
                value={era.name}
                onChange={(e) => setEra({ ...era, name: e.target.value })}
              />
            </label>
            <RangeFields
              from={era.from}
              to={era.to}
              setFrom={(from) => setEra({ ...era, from })}
              setTo={(to) => setEra({ ...era, to })}
              required
            />
            <label>
              Description
              <textarea
                className={control}
                value={era.description}
                onChange={(e) =>
                  setEra({ ...era, description: e.target.value })
                }
              />
            </label>
            <label>
              Accent
              <input
                type="color"
                value={era.color}
                onChange={(e) => setEra({ ...era, color: e.target.value })}
              />
            </label>
            <label>
              Cover from observed artwork
              <select
                className={control}
                value={era.cover}
                onChange={(e) => setEra({ ...era, cover: e.target.value })}
              >
                <option value="">No cover</option>
                {archive.all.albums
                  .filter((t) => t.art)
                  .slice(0, 100)
                  .map((t) => (
                    <option key={t.key} value={t.art!}>
                      {t.name} — {t.artist}
                    </option>
                  ))}
              </select>
            </label>
            <div className="flex gap-2">
              <button disabled={!ready} className={control}>
                Save era
              </button>
              <button
                type="button"
                className={control}
                onClick={() => setEra(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </ArchiveDialog>
      ) : null}
    </div>
  );
}
function RangeFields({
  from,
  to,
  setFrom,
  setTo,
  required = false,
}: {
  from: string;
  to: string;
  setFrom: (v: string) => void;
  setTo: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="archive-range">
      <label>
        From
        <input
          required={required}
          aria-label="Range start"
          className={control}
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </label>
      <label>
        Through
        <input
          required={required}
          aria-label="Range end"
          className={control}
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </label>
    </div>
  );
}
function PeriodMetrics({
  period: p,
  perDay,
}: {
  period: ArchivePeriod;
  perDay: number;
}) {
  return (
    <p>
      {p.rows.length} plays · {perDay.toFixed(1)} plays/calendar day
      <br />
      {p.days.length} active days · {p.artists.length} artists ·{" "}
      {p.tracks.length} tracks
      <br />
      {(p.ms / 3600000).toFixed(1)}h stored duration
    </p>
  );
}
function PatternSummary({
  period: p,
  tz,
}: {
  period: ArchivePeriod;
  tz: string;
}) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hourCycle: "h23",
    weekday: "short",
  });
  const buckets = [0, 0, 0, 0];
  let weekends = 0;
  for (const r of p.rows) {
    const parts = f.formatToParts(r.playedAt);
    const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
    buckets[hour < 6 ? 0 : hour < 12 ? 1 : hour < 18 ? 2 : 3]++;
    if (
      ["Sat", "Sun"].includes(
        parts.find((p) => p.type === "weekday")?.value || "",
      )
    )
      weekends++;
  }
  return (
    <div>
      <h3>Timing · {p.key}</h3>
      {[
        "Late night (00–06)",
        "Morning (06–12)",
        "Afternoon (12–18)",
        "Evening (18–24)",
      ].map((s, i) => (
        <p key={s}>
          {s}: {buckets[i]} plays
        </p>
      ))}
      <p>
        Weekdays: {p.rows.length - weekends} · Weekend: {weekends}
      </p>
      <p className="archive-muted">
        Local time in {tz}; counts describe records, not activities.
      </p>
    </div>
  );
}
function WorkEditor({
  track,
  notes,
  update,
}: {
  track: ArchiveEntity;
  notes: ReturnType<typeof useArchiveNotes>["notes"];
  update: ReturnType<typeof useArchiveNotes>["update"];
}) {
  const existing = notes.works.find((w) => w.track === track.key);
  return (
    <details>
      <summary>Composer, work, and recording · manual correction</summary>
      <p className="archive-muted">
        Separate annotation; original track metadata remains unchanged. No
        automatic grouping is assumed.
      </p>
      <form
        key={existing?.id || track.key}
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          update((n) => ({
            ...n,
            works: [
              ...n.works.filter((w) => w.track !== track.key),
              {
                id: existing?.id || crypto.randomUUID(),
                track: track.key,
                composer: String(data.get("composer")),
                work: String(data.get("work")),
                performer: String(data.get("performer")),
              },
            ],
          }));
        }}
      >
        <label>
          Composer
          <input
            name="composer"
            className={control}
            defaultValue={existing?.composer}
          />
        </label>
        <label>
          Work
          <input
            required
            name="work"
            className={control}
            defaultValue={existing?.work}
          />
        </label>
        <label>
          Performer / ensemble / recording
          <input
            name="performer"
            className={control}
            defaultValue={existing?.performer}
          />
        </label>
        <button className={control}>Save grouping</button>
        {existing ? (
          <button
            type="button"
            className={control}
            onClick={() =>
              update((n) => ({
                ...n,
                works: n.works.filter((w) => w.id !== existing.id),
              }))
            }
          >
            Remove grouping
          </button>
        ) : null}
      </form>
    </details>
  );
}

function ArchiveDialog({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="archive archive-editor"
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {children}
    </dialog>
  );
}

function MemoryTarget({
  memory,
  onChange,
  archive,
  notes,
}: {
  memory: Memory;
  onChange: (target: string) => void;
  archive: Archive;
  notes: ReturnType<typeof useArchiveNotes>["notes"];
}) {
  const kind = memory.target.split(":")[0],
    value = memory.target.slice(kind.length + 1);
  if (kind === "month" || kind === "date")
    return (
      <label>
        {kind === "month" ? "Month" : "Listening date"}
        <input
          required
          className={control}
          type={kind === "month" ? "month" : "date"}
          value={value}
          onChange={(e) => onChange(`${kind}:${e.target.value}`)}
        />
      </label>
    );
  const options =
    kind === "era"
      ? notes.eras.map((e) => ({ value: e.id, label: e.name }))
      : kind === "track"
        ? archive.all.tracks.map((t) => ({
            value: t.key,
            label: `${t.name} — ${t.artist}`,
          }))
        : kind === "artist"
          ? archive.all.artists.map((t) => ({ value: t.name, label: t.name }))
          : kind === "album"
            ? archive.all.albums.map((t) => ({
                value: `${t.artist}:${t.name}`,
                label: `${t.name} — ${t.artist}`,
              }))
            : listeningSessions(archive).map((s) => ({
                value: s[0].playedAt.toISOString(),
                label: `${s[0].playedAt.toLocaleString()} · ${s.length} plays`,
              }));
  return (
    <label>
      {kind === "session"
        ? "Session (displayed in your device time)"
        : `Choose ${kind}`}
      <select
        required
        className={control}
        value={value}
        onChange={(e) => onChange(`${kind}:${e.target.value}`)}
      >
        <option value="">Choose…</option>
        {value && !options.some((o) => o.value === value) ? (
          <option value={value}>Previously attached item</option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function TrackLifeSummary({
  archive,
  track,
  onMonth,
}: {
  archive: Archive;
  track: ArchiveEntity;
  onMonth: (m: string) => void;
}) {
  const life = trackLife(archive, track.key);
  if (!life) return null;
  return (
    <details>
      <summary>Repeat bursts, absences, and listening spread</summary>
      <p>
        {life.years} calendar years with observed plays.{" "}
        {Math.round(life.peakShare * 100)}% of plays occurred in{" "}
        <button
          className="archive-text-link"
          onClick={() => onMonth(life.peak[0])}
        >
          {monthLabel(life.peak[0])}
        </button>
        . Longest run: {life.longestStreak} consecutive listening days.
      </p>
      <h3>Repeat bursts</h3>
      {life.bursts.slice(0, 8).map(([d, n]) => (
        <p key={d}>
          {d}: {n} plays
        </p>
      ))}
      {!life.bursts.length ? (
        <p>No days with at least five observed plays.</p>
      ) : null}
      <h3>Long absences and returns</h3>
      {life.gaps.map((g) => (
        <p key={g.to}>
          {g.from} →{" "}
          <button
            className="archive-text-link"
            onClick={() => onMonth(g.to.slice(0, 7))}
          >
            {g.to}
          </button>
          : {g.days} days between observed listens
        </p>
      ))}
      {!life.gaps.length ? <p>No recorded gaps of at least 90 days.</p> : null}
      <p className="archive-muted">
        All dates use {archive.tz}. Gaps can reflect missing records; a repeat
        burst means five plays on one local date.
      </p>
    </details>
  );
}
