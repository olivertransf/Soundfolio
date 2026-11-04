import { artistGroupKey, albumGroupKey } from "./entity-normalize";
import type { Stream } from "./types/stream";
import {
  dedupeListens,
  songIdentityKey,
  isLastFmScrobbleId,
} from "./listen-dedupe";
import {
  formatCalendarDateInZone,
  resolveStatsTimeZone,
} from "./stats-timezone";

export const ARCHIVE_RULES = {
  minimumPlays: 5,
  retentionMonths: 3,
  retentionPlays: 3,
  comebackDays: 90,
  sessionGapMinutes: 30,
  eraOverlap: 0.35,
};
export type ArchiveEntity = {
  key: string;
  name: string;
  artist: string;
  album: string;
  art: string | null;
  plays: number;
  ms: number;
  days: Set<string>;
  first: string;
  last: string;
  months: Map<string, number>;
  row: Stream;
};
export type ArchivePeriod = {
  key: string;
  rows: Stream[];
  tracks: ArchiveEntity[];
  artists: ArchiveEntity[];
  albums: ArchiveEntity[];
  days: string[];
  ms: number;
  unknownTime: number;
  estimatedTime: number;
};
export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}
export function monthLabel(month: string) {
  return new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
export function trackKey(row: Stream) {
  return songIdentityKey(row.artistName, row.trackName);
}
const archiveCache = new WeakMap<Stream[], Map<string, Archive>>();

export function buildArchive(input: Stream[], zone = "UTC"): Archive {
  const tz = resolveStatsTimeZone(zone);
  const cached = archiveCache.get(input)?.get(tz);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const date = (row: Stream) => {
    const parts = formatter.formatToParts(row.playedAt);
    return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-${parts.find((p) => p.type === "day")!.value}`;
  };
  const rows = dedupeListens(
    input.filter((r) => !r.isDemo && Number.isFinite(r.playedAt.getTime())),
  ).sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const dates = new Map(rows.map((r) => [r, date(r)]));
  function aggregate(selected: Stream[], key: string): ArchivePeriod {
    const tracks = new Map<string, ArchiveEntity>(),
      artists = new Map<string, ArchiveEntity>(),
      albums = new Map<string, ArchiveEntity>();
    let ms = 0,
      unknownTime = 0,
      estimatedTime = 0;
    for (const r of selected) {
      const day = dates.get(r)!;
      const duration = Number.isFinite(r.durationMs)
        ? Math.max(0, r.durationMs)
        : 0;
      if (!duration) unknownTime++;
      else {
        ms += duration;
        if (isLastFmScrobbleId(r.trackId)) estimatedTime++;
      }
      for (const [map, k, name] of [
        [tracks, trackKey(r), r.trackName],
        [artists, artistGroupKey(r.artistName), r.artistName],
        [
          albums,
          albumGroupKey(r.albumName, r.artistName),
          r.albumName || "Unknown album",
        ],
      ] as const) {
        if (map === albums && !r.albumName.trim()) continue;
        let e = map.get(k);
        if (!e) {
          e = {
            key: k,
            name,
            artist: r.artistName,
            album: r.albumName,
            art: r.albumArt,
            plays: 0,
            ms: 0,
            days: new Set(),
            first: day,
            last: day,
            months: new Map(),
            row: r,
          };
          map.set(k, e);
        }
        if (!e.art && r.albumArt) e.art = r.albumArt;
        e.plays++;
        e.ms += duration;
        e.days.add(day);
        e.last = day;
        e.months.set(day.slice(0, 7), (e.months.get(day.slice(0, 7)) || 0) + 1);
      }
    }
    const ranked = (m: Map<string, ArchiveEntity>) =>
      [...m.values()].sort(
        (a, b) => b.plays - a.plays || a.key.localeCompare(b.key),
      );
    return {
      key,
      rows: selected,
      tracks: ranked(tracks),
      artists: ranked(artists),
      albums: ranked(albums),
      days: [...new Set(selected.map((r) => dates.get(r)!))].sort(),
      ms,
      unknownTime,
      estimatedTime,
    };
  }
  const buckets = new Map<string, Stream[]>();
  for (const r of rows) {
    const m = dates.get(r)!.slice(0, 7);
    const b = buckets.get(m) || [];
    b.push(r);
    buckets.set(m, b);
  }
  const months = new Map([...buckets].map(([m, r]) => [m, aggregate(r, m)]));
  const listensByTrack = new Map<string, Stream[]>();
  for (const r of rows) {
    const key = trackKey(r);
    const list = listensByTrack.get(key) || [];
    list.push(r);
    listensByTrack.set(key, list);
  }
  const all = aggregate(rows, "all");
  const trackIndex = new Map(all.tracks.map((t) => [t.key, t]));
  const rangeCache = new Map<string, ArchivePeriod>();
  const range = (from: string, to: string) => {
    const key = `${from}/${to}`;
    const cached = rangeCache.get(key);
    if (cached) return cached;
    const p = aggregate(
      rows.filter((r) => dates.get(r)! >= from && dates.get(r)! <= to),
      key,
    );
    if (rangeCache.size >= 12)
      rangeCache.delete(rangeCache.keys().next().value!);
    rangeCache.set(key, p);
    return p;
  };
  const result = {
    rows,
    months,
    all,
    trackIndex,
    listensByTrack,
    dates,
    tz,
    range,
    select: aggregate,
    empty: (key: string) => aggregate([], key),
    duplicates: input.length - rows.length,
  };
  let cachedZones = archiveCache.get(input);
  if (!cachedZones) {
    cachedZones = new Map();
    archiveCache.set(input, cachedZones);
  }
  cachedZones.set(tz, result);
  return result;
}
export type Archive = {
  rows: Stream[];
  months: Map<string, ArchivePeriod>;
  all: ArchivePeriod;
  trackIndex: Map<string, ArchiveEntity>;
  listensByTrack: Map<string, Stream[]>;
  dates: Map<Stream, string>;
  tz: string;
  range: (from: string, to: string) => ArchivePeriod;
  empty: (key: string) => ArchivePeriod;
  select: (rows: Stream[], key: string) => ArchivePeriod;
  duplicates: number;
};
export function monthlyInsights(archive: Archive, month: string) {
  const p = archive.months.get(month) || archive.empty(month),
    earliest = archive.all.days[0]?.slice(0, 7),
    latest = archive.all.days.at(-1)?.slice(0, 7);
  const first = p.tracks.filter(
    (t) => archive.trackIndex.get(t.key)?.first.slice(0, 7) === month,
  );
  const followup =
    !!latest && latest >= shiftMonth(month, ARCHIVE_RULES.retentionMonths + 1);
  const retained = first.filter((t) => {
    const e = archive.trackIndex.get(t.key)!;
    return (
      [...e.months]
        .filter(
          ([m]) =>
            m > month && m <= shiftMonth(month, ARCHIVE_RULES.retentionMonths),
        )
        .reduce((s, [, n]) => s + n, 0) >= ARCHIVE_RULES.retentionPlays
    );
  });
  const brief = first.filter(
    (t) =>
      t.plays >= ARCHIVE_RULES.minimumPlays &&
      !retained.some((e) => e.key === t.key),
  );
  const returning = p.tracks
    .filter((t) => t.plays >= ARCHIVE_RULES.minimumPlays)
    .flatMap((t) => {
      const before = (archive.listensByTrack.get(t.key) || [])
        .filter(
          (r) => trackKey(r) === t.key && archive.dates.get(r)! < `${month}-01`,
        )
        .at(-1);
      if (!before) return [];
      const gap = Math.floor(
        (Date.parse(t.first) - Date.parse(archive.dates.get(before)!)) /
          86400000,
      );
      return gap >= ARCHIVE_RULES.comebackDays ? [{ ...t, gap }] : [];
    });
  const previous = archive.months.get(shiftMonth(month, -1));
  const changes = [
    ...new Set([
      ...p.artists.map((t) => t.key),
      ...(previous?.artists.map((t) => t.key) || []),
    ]),
  ]
    .map((key) => {
      const current = p.artists.find((t) => t.key === key),
        old = previous?.artists.find((t) => t.key === key);
      const t = current || old!;
      return {
        ...t,
        plays: current?.plays || 0,
        before: old?.plays || 0,
        delta:
          (current?.plays || 0) / Math.max(1, p.rows.length) -
          (old?.plays || 0) / Math.max(1, previous?.rows.length || 0),
      };
    })
    .filter((t) => Math.max(t.plays, t.before) >= ARCHIVE_RULES.minimumPlays)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return {
    p,
    first,
    retained,
    brief,
    returning,
    changes,
    followup,
    boundary: month === earliest,
    edge: month === earliest || month === latest,
    previous,
  };
}
export function comparePeriods(a: ArchivePeriod, b: ArchivePeriod) {
  const ak = new Set(a.artists.map((e) => e.key)),
    bk = new Set(b.artists.map((e) => e.key));
  const at = new Set(a.tracks.map((t) => t.key)),
    bt = new Set(b.tracks.map((t) => t.key));
  const union = new Set([...ak, ...bk]);
  const intersection = [...ak].filter((k) => bk.has(k));
  const calendarDays = (p: ArchivePeriod) => {
    const parts = p.key.split("/");
    return parts.length === 2
      ? 1 + Math.round((Date.parse(parts[1]) - Date.parse(parts[0])) / 86400000)
      : new Date(
          Number(p.key.slice(0, 4)),
          Number(p.key.slice(5, 7)),
          0,
        ).getDate();
  };
  return {
    overlap: union.size ? intersection.length / union.size : 0,
    shared: a.tracks.filter((t) => bt.has(t.key)),
    onlyA: a.tracks.filter((t) => !bt.has(t.key)),
    onlyB: b.tracks.filter((t) => !at.has(t.key)),
    perDayA: a.rows.length / Math.max(1, calendarDays(a)),
    perDayB: b.rows.length / Math.max(1, calendarDays(b)),
  };
}
export function listeningSessions(archive: Archive) {
  const sessions: Stream[][] = [];
  for (const row of archive.rows) {
    const last = sessions.at(-1)?.at(-1); // Conservative timestamp gaps: duration evidence is ambiguous in legacy rows.
    if (
      !last ||
      row.playedAt.getTime() - last.playedAt.getTime() >
        ARCHIVE_RULES.sessionGapMinutes * 60000
    )
      sessions.push([row]);
    else sessions.at(-1)!.push(row);
  }
  return sessions;
}
export function suggestedBoundaries(archive: Archive) {
  const entries = [...archive.months];
  return entries.flatMap(([m, p], i) => {
    if (i < 1 || i + 1 >= entries.length) return [];
    const [pm, prev] = entries[i - 1],
      [nm, next] = entries[i + 1];
    if (
      shiftMonth(pm, 1) !== m ||
      shiftMonth(m, 1) !== nm ||
      Math.min(p.rows.length, prev.rows.length, next.rows.length) < 20
    )
      return [];
    const overlap = artistShareOverlap(prev, p);
    return overlap < ARCHIVE_RULES.eraOverlap &&
      artistShareOverlap(p, next) >= 0.5
      ? [{ month: m, overlap }]
      : [];
  });
}
export function archiveDay(instant: Date, zone: string) {
  return formatCalendarDateInZone(instant, zone);
}

/** Facts only: duration-based statements deliberately refer to stored duration. */
export function monthNarrative(p: ArchivePeriod) {
  if (!p.rows.length)
    return "No listening records are available for this month. Missing records do not imply silence.";
  const leader = p.artists[0];
  const long = p.rows.filter((r) => r.durationMs >= 600000);
  const longMs = long.reduce((s, r) => s + r.durationMs, 0);
  const lead = `${leader.name} led with ${leader.plays} plays (${Math.round((leader.plays / p.rows.length) * 100)}% of the month).`;
  if (p.ms && longMs / p.ms >= 0.25)
    return `${lead} ${long.length} plays with stored durations of at least ten minutes accounted for ${Math.round((longMs / p.ms) * 100)}% of stored duration. Duration totals may include estimates.`;
  const top = p.tracks[0];
  if (
    top.plays / p.rows.length >= 0.2 &&
    top.plays >= ARCHIVE_RULES.minimumPlays
  )
    return `${lead} “${top.name}” appeared ${top.plays} times across ${top.days.size} days.`;
  return `${lead} ${p.tracks.filter((t) => t.plays >= ARCHIVE_RULES.minimumPlays).length} tracks appeared at least five times, across ${p.days.length} active listening days.`;
}
export function trackLife(archive: Archive, key: string) {
  const track = archive.trackIndex.get(key);
  if (!track) return null;
  const days = [...track.days].sort();
  let longestStreak = days.length ? 1 : 0,
    streak = longestStreak;
  const gaps: { from: string; to: string; days: number }[] = [];
  for (let i = 1; i < days.length; i++) {
    const gap = Math.round(
      (Date.parse(days[i]) - Date.parse(days[i - 1])) / 86400000,
    );
    streak = gap === 1 ? streak + 1 : 1;
    longestStreak = Math.max(longestStreak, streak);
    if (gap >= ARCHIVE_RULES.comebackDays)
      gaps.push({ from: days[i - 1], to: days[i], days: gap });
  }
  const peak = [...track.months].sort((a, b) => b[1] - a[1])[0];
  const counts = new Map<string, number>();
  for (const r of archive.listensByTrack.get(key) || []) {
    const d = archive.dates.get(r)!;
    counts.set(d, (counts.get(d) || 0) + 1);
  }
  const bursts = [...counts]
    .filter(([, n]) => n >= ARCHIVE_RULES.minimumPlays)
    .sort((a, b) => b[1] - a[1]);
  return {
    longestStreak,
    gaps,
    peak,
    peakShare: peak[1] / track.plays,
    bursts,
    years: new Set(days.map((d) => d.slice(0, 4))).size,
  };
}

export function artistShareOverlap(a: ArchivePeriod, b: ArchivePeriod) {
  if (!a.rows.length || !b.rows.length) return 0;
  const shares = new Map(
    b.artists.map((t) => [t.key, t.plays / b.rows.length]),
  );
  return a.artists.reduce(
    (sum, t) => sum + Math.min(t.plays / a.rows.length, shares.get(t.key) || 0),
    0,
  );
}
export function repeatedSequences(sessions: Stream[][]) {
  const pairs = new Map<
    string,
    { first: Stream; second: Stream; count: number }
  >();
  for (const s of sessions)
    for (let i = 1; i < s.length; i++) {
      const first = s[i - 1],
        second = s[i];
      if (trackKey(first) === trackKey(second)) continue;
      const key = JSON.stringify([trackKey(first), trackKey(second)]);
      const p = pairs.get(key) || { first, second, count: 0 };
      p.count++;
      pairs.set(key, p);
    }
  return [...pairs.values()]
    .filter((p) => p.count >= 3)
    .sort((a, b) => b.count - a.count);
}
