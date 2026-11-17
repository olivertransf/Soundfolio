"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AlbumArt } from "@/components/album-art";
import { ArtistArt } from "@/components/artist-art";
import { ArchivePeriodPicker } from "@/components/archive/archive-period-picker";
import { BarSeriesChart, chartAxisLabel } from "@/components/bar-series-chart";
import { PageShell } from "@/components/page-shell";
import { useStreams } from "@/components/streams-provider";
import { CoverRail, type CoverItem } from "@/components/visual/cover-rail";
import { ResultLine, scopeResultLine } from "@/components/visual/result-line";
import {
  ARCHIVE_RULES,
  buildArchive,
  comparePeriods,
  monthLabel,
  monthlyInsights,
  shiftMonth,
  type ArchiveEntity,
} from "@/lib/archive-analytics";
import { listeningChapters } from "@/lib/archive-chapters";
import { albumPath, artistPath, trackPath } from "@/lib/entity-paths";
import { minutesFromMs } from "@/lib/listening-minutes";
import { resolveStatsTimeZone } from "@/lib/stats-timezone";

function byTime<T extends { ms: number; plays: number }>(items: T[]) {
  return [...items].sort((a, b) => b.ms - a.ms || b.plays - a.plays);
}

function archiveCovers(items: ArchiveEntity[], kind: "track" | "artist" | "album", base: string): CoverItem[] {
  return items.slice(0, 12).map((item) => ({
    key: `${kind}-${item.key}`,
    href:
      kind === "artist"
        ? `${base}${artistPath(item.name)}`
        : kind === "album"
          ? `${base}${albumPath(item.artist, item.name)}`
          : `${base}${trackPath(item.artist, item.name)}`,
    title: item.name,
    subtitle: kind === "artist" ? undefined : item.artist,
    minutes: minutesFromMs(item.ms),
    art:
      kind === "artist" ? (
        <ArtistArt
          src={item.row.artistArt || item.art}
          alt={item.name}
          width={176}
          height={176}
          className="size-full"
        />
      ) : (
        <AlbumArt
          src={item.art}
          alt={item.name}
          width={176}
          height={176}
          className="size-full object-cover"
        />
      ),
  }));
}

function signedMinutes(delta: number) {
  const mark = delta > 0 ? "+" : "−";
  return `${mark}${Math.abs(delta).toLocaleString()}m`;
}

export function ArchiveExperience() {
  const { streams, loading, error, reload } = useStreams();
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const base = pathname.startsWith("/demo") ? "/demo" : "";
  const timeZone = resolveStatsTimeZone(params.get("tz"));
  const archive = useMemo(() => buildArchive(streams, timeZone), [streams, timeZone]);
  const months = useMemo(() => [...archive.months.keys()].sort(), [archive]);
  const requested = params.get("month") ?? "";
  const latest = archive.all.days.at(-1)?.slice(0, 7) ?? months.at(-1) ?? "";
  const month = /^\d{4}-\d{2}$/.test(requested) ? requested : latest;
  const insight = useMemo(() => monthlyInsights(archive, month || "1970-01"), [archive, month]);
  const chapters = useMemo(() => listeningChapters(archive), [archive]);
  const [day, setDay] = useState<string | null>(null);

  useEffect(() => {
    setDay(null);
  }, [month]);

  const dayPoints = useMemo(() => {
    if (!month) return [];
    const [year, monthNumber] = month.split("-").map(Number);
    const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const totals = new Map<string, { ms: number; streams: number }>();
    for (const row of insight.p.rows) {
      const key = archive.dates.get(row);
      if (!key) continue;
      const bucket = totals.get(key) ?? { ms: 0, streams: 0 };
      bucket.ms += Number.isFinite(row.durationMs) ? row.durationMs : 0;
      bucket.streams += 1;
      totals.set(key, bucket);
    }
    return Array.from({ length: count }, (_, index) => {
      const label = `${month}-${String(index + 1).padStart(2, "0")}`;
      const bucket = totals.get(label);
      return {
        label,
        minutes: minutesFromMs(bucket?.ms ?? 0),
        streams: bucket?.streams ?? 0,
      };
    });
  }, [archive, insight.p.rows, month]);

  const dayTracks = useMemo(() => {
    if (!day) return [];
    const rows = insight.p.rows.filter((row) => archive.dates.get(row) === day);
    return byTime(archive.select(rows, day).tracks).slice(0, 12);
  }, [archive, day, insight.p.rows]);

  const go = (nextMonth: string) => {
    const query = new URLSearchParams(params.toString());
    query.set("month", nextMonth);
    for (const key of [
      "view",
      "track",
      "sort",
      "q",
      "min",
      "from",
      "to",
      "source",
      "noted",
      "first",
      "last",
      "compare",
      "aFrom",
      "aTo",
      "bFrom",
      "bTo",
    ]) {
      query.delete(key);
    }
    router.replace(`${pathname}?${query.toString()}`, { scroll: false });
  };

  if (loading && streams.length === 0) {
    return <p className="py-20 text-center text-sm text-muted-foreground">Opening your archive…</p>;
  }

  if (error && streams.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <button type="button" className="text-sm font-medium text-primary" onClick={() => void reload()}>
          Try again
        </button>
      </div>
    );
  }

  if (!month) {
    return <p className="py-20 text-center text-sm text-muted-foreground">No plays yet.</p>;
  }

  const index = months.indexOf(month);
  const earlierMonth = index > 0 ? months[index - 1] : null;
  const laterMonth = index >= 0 && index < months.length - 1 ? months[index + 1] : null;
  const period = insight.p;
  const previous = insight.previous;
  const leader = byTime(period.artists)[0];
  const line =
    period.rows.length > 0
      ? scopeResultLine({
          minutes: minutesFromMs(period.ms),
          scope: `in ${monthLabel(month)}`,
          when: `${period.rows.length.toLocaleString()} plays across ${period.days.length} days`,
          leader: leader?.name,
        })
      : `No plays in ${monthLabel(month)}.`;
  const onRepeat = byTime(period.tracks.filter((track) => track.plays >= ARCHIVE_RULES.minimumPlays)).slice(0, 12);
  const firstHeard = byTime(insight.first).slice(0, 12);
  const cameBack = byTime(insight.returning).slice(0, 12);
  const shifts = previous
    ? insight.changes.flatMap((change) => {
        const now = period.artists.find((artist) => artist.key === change.key);
        const then = previous.artists.find((artist) => artist.key === change.key);
        const delta = minutesFromMs(now?.ms ?? 0) - minutesFromMs(then?.ms ?? 0);
        if (delta === 0) return [];
        const entity = now ?? then ?? change;
        return [{ entity, delta }];
      })
    : [];
  const rose = shifts.filter((item) => item.delta > 0).slice(0, 8);
  const fell = shifts.filter((item) => item.delta < 0).slice(0, 8);
  const comparison =
    previous && previous.rows.length > 0 ? comparePeriods(period, previous) : null;

  return (
    <PageShell className="space-y-6">
      <div className="archive-navigation">
        <div className="archive-period-group">
          <div className="archive-period-controls">
            <button
              type="button"
              className="archive-arrow"
              aria-label="Previous month"
              disabled={!earlierMonth}
              onClick={() => earlierMonth && go(earlierMonth)}
            >
              <ChevronLeft size={16} />
            </button>
            <ArchivePeriodPicker
              month={month}
              availableMonths={archive.months}
              onChange={go}
            />
            <button
              type="button"
              className="archive-arrow"
              aria-label="Next month"
              disabled={!laterMonth}
              onClick={() => laterMonth && go(laterMonth)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <CoverRail items={archiveCovers(byTime(period.albums).slice(0, 5), "album", base)} size="hero" />
      <ResultLine>{line}</ResultLine>

      {period.rows.length > 0 ? (
        <div className="rounded-xl border border-border bg-card p-3">
          <BarSeriesChart
            points={dayPoints}
            metric="minutes"
            label={`Minutes in ${monthLabel(month)}`}
            selectedLabel={day ?? undefined}
            onSelect={(point) => setDay((current) => (current === point.label ? null : point.label))}
          />
        </div>
      ) : null}

      {day ? (
        <CoverRail title={chartAxisLabel(day)} items={archiveCovers(dayTracks, "track", base)} />
      ) : null}

      <CoverRail title="On repeat" items={archiveCovers(onRepeat, "track", base)} />
      <CoverRail title="First heard" items={archiveCovers(firstHeard, "track", base)} />
      <CoverRail
        title="Came back"
        items={archiveCovers(cameBack, "track", base).map((item, index) => ({
          ...item,
          subtitle: cameBack[index]
            ? `${cameBack[index].gap.toLocaleString()} days away`
            : item.subtitle,
        }))}
      />

      <CoverRail
        title="Eras"
        items={chapters.map((chapter) => ({
          key: chapter.from,
          title: chapter.name,
          subtitle:
            chapter.to === chapter.from
              ? monthLabel(chapter.from)
              : `${monthLabel(chapter.from)} – ${monthLabel(chapter.to)}`,
          minutes: minutesFromMs(chapter.period.ms),
          active: month >= chapter.from && month <= chapter.to,
          onSelect: () => go(chapter.from),
          art: (
            <AlbumArt
              src={chapter.period.albums[0]?.art ?? chapter.period.tracks[0]?.art}
              alt={chapter.name}
              width={176}
              height={176}
              className="size-full object-cover"
            />
          ),
        }))}
      />

      {comparison && previous ? (
        <section className="space-y-3">
          <ResultLine>
            {`${Math.round(comparison.overlap * 100)}% of artists showed up in both ${monthLabel(previous.key)} and ${monthLabel(month)}.`}
          </ResultLine>
          <div className="rounded-xl border border-border bg-card p-3">
            <BarSeriesChart
              points={[
                {
                  label: shiftMonth(month, -1),
                  minutes: minutesFromMs(previous.ms),
                  streams: previous.rows.length,
                },
                {
                  label: month,
                  minutes: minutesFromMs(period.ms),
                  streams: period.rows.length,
                },
              ]}
              metric="minutes"
              label="This month and the previous month"
            />
          </div>
          <CoverRail
            title="Up"
            shape="round"
            items={rose.map(({ entity, delta }) => ({
              key: entity.key,
              href: `${base}${artistPath(entity.name)}`,
              title: entity.name,
              detail: signedMinutes(delta),
              art: (
                <ArtistArt
                  src={entity.row.artistArt || entity.art}
                  alt={entity.name}
                  width={160}
                  height={160}
                  className="size-full"
                />
              ),
            }))}
          />
          <CoverRail
            title="Down"
            shape="round"
            items={fell.map(({ entity, delta }) => ({
              key: entity.key,
              href: `${base}${artistPath(entity.name)}`,
              title: entity.name,
              detail: signedMinutes(delta),
              art: (
                <ArtistArt
                  src={entity.row.artistArt || entity.art}
                  alt={entity.name}
                  width={160}
                  height={160}
                  className="size-full"
                />
              ),
            }))}
          />
        </section>
      ) : null}
    </PageShell>
  );
}
