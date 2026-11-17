import type { ReactNode } from "react";
import { format } from "date-fns";

export type StatItem = {
  label: string;
  value: string;
  hint?: string;
};

export function StatGrid({ items }: { items: StatItem[] }) {
  const visible = items.filter((item) => item.value.length > 0);
  if (visible.length === 0) return null;

  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {visible.map((item) => (
        <div key={item.label} className="min-w-0 rounded-xl border border-border bg-card px-3 py-2.5">
          <dt className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {item.label}
          </dt>
          <dd className="mt-0.5 truncate text-lg font-semibold tabular-nums tracking-tight">{item.value}</dd>
          {item.hint ? (
            <p className="truncate text-[11px] tabular-nums text-muted-foreground">{item.hint}</p>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

export function NumberChart({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="shrink-0 text-sm font-semibold tracking-tight">{title}</h2>
        {detail ? <p className="min-w-0 truncate text-xs tabular-nums text-muted-foreground">{detail}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function countDetail(minutes: number, plays: number) {
  return `${minutes.toLocaleString()} min · ${plays.toLocaleString()} plays`;
}

export function listeningStatItems({
  minutes,
  plays,
  days,
  tracks,
  artists,
  albums,
  activeDays,
  peakHour,
  peakHourDetail,
  peakDay,
  peakDayDetail,
  replayShare,
  topShare,
  topMinutes,
  rank,
  share,
  first,
  last,
}: {
  minutes: number;
  plays: number;
  days: number;
  tracks?: number;
  artists?: number;
  albums?: number;
  activeDays?: number;
  peakHour?: string | null;
  peakHourDetail?: string | null;
  peakDay?: string | null;
  peakDayDetail?: string | null;
  replayShare?: number;
  topShare?: number;
  topMinutes?: number;
  rank?: number | null;
  share?: number | null;
  first?: Date | null;
  last?: Date | null;
}): StatItem[] {
  const span = Math.max(1, days);
  const items: StatItem[] = [
    {
      label: "Minutes",
      value: minutes.toLocaleString(),
      hint: `${Math.round(minutes / 60).toLocaleString()} hrs`,
    },
    { label: "Plays", value: plays.toLocaleString() },
    {
      label: "Min / day",
      value: Math.round(minutes / span).toLocaleString(),
      hint: `${span.toLocaleString()} days`,
    },
    { label: "Plays / day", value: Math.round(plays / span).toLocaleString() },
    {
      label: "Avg / play",
      value: plays > 0 ? `${Math.round(minutes / plays).toLocaleString()} min` : "",
    },
  ];
  if (tracks != null) items.push({ label: "Tracks", value: tracks.toLocaleString() });
  if (artists != null) items.push({ label: "Artists", value: artists.toLocaleString() });
  if (albums != null) items.push({ label: "Albums", value: albums.toLocaleString() });
  if (activeDays != null) items.push({ label: "Active days", value: activeDays.toLocaleString() });
  if (peakHour) items.push({ label: "Peak hour", value: peakHour, hint: peakHourDetail ?? undefined });
  if (peakDay) items.push({ label: "Peak day", value: peakDay, hint: peakDayDetail ?? undefined });
  if (replayShare != null) items.push({ label: "Replayed", value: `${replayShare}%`, hint: "of minutes" });
  if (topShare != null) {
    items.push({
      label: "Top 10",
      value: `${topShare}%`,
      hint: topMinutes != null ? `${topMinutes.toLocaleString()} min` : "of minutes",
    });
  }
  if (rank != null) items.push({ label: "Rank", value: `#${rank}` });
  if (share != null) items.push({ label: "Share", value: `${share}%`, hint: "of minutes" });
  if (first) items.push({ label: "First play", value: format(first, "MMM d, yyyy"), hint: format(first, "h:mm a") });
  if (last) items.push({ label: "Last play", value: format(last, "MMM d, yyyy"), hint: format(last, "h:mm a") });
  return items;
}

function percent(part: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

function calendarLabel(label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(label)) return label;
  const [year, month, day] = label.split("-").map(Number);
  return format(new Date(year, (month ?? 1) - 1, day ?? 1), "EEE, MMM d");
}

export function extraStatItems({
  minutes,
  plays,
  tracks,
  artists,
  albums,
  activeDays,
  dayparts,
  weekParts,
  topArtist,
  restMinutes,
  onceTracks,
  replayTracks,
  replayMinutes,
  replayPlays,
  longestPlayMinutes,
  busiestDay,
  busiestMinutes,
  busiestPlays,
  quietDay,
  quietMinutes,
  quietPlays,
  quietHour,
  quietHourDetail,
}: {
  minutes: number;
  plays: number;
  tracks?: number;
  artists?: number;
  albums?: number;
  activeDays?: number;
  dayparts?: { label: string; minutes: number; streams: number }[];
  weekParts?: { label: string; minutes: number; streams: number }[];
  topArtist?: { label: string; minutes: number; streams: number } | null;
  restMinutes?: number;
  onceTracks?: number;
  replayTracks?: number;
  replayMinutes?: number;
  replayPlays?: number;
  longestPlayMinutes?: number;
  busiestDay?: string | null;
  busiestMinutes?: number;
  busiestPlays?: number;
  quietDay?: string | null;
  quietMinutes?: number;
  quietPlays?: number;
  quietHour?: string | null;
  quietHourDetail?: string | null;
}): StatItem[] {
  const items: StatItem[] = [];
  if (activeDays && activeDays > 0) {
    items.push({
      label: "Min / active day",
      value: Math.round(minutes / activeDays).toLocaleString(),
      hint: `${activeDays.toLocaleString()} days with plays`,
    });
    items.push({
      label: "Plays / active day",
      value: Math.round(plays / activeDays).toLocaleString(),
    });
  }
  if (tracks && tracks > 0) {
    items.push({ label: "Plays / track", value: Math.round(plays / tracks).toLocaleString() });
    items.push({ label: "Min / track", value: Math.round(minutes / tracks).toLocaleString() });
  }
  if (tracks && artists) {
    items.push({ label: "Tracks / artist", value: (tracks / artists).toFixed(1) });
  }
  if (albums && artists) {
    items.push({ label: "Albums / artist", value: (albums / artists).toFixed(1) });
  }
  for (const part of weekParts ?? []) {
    items.push({
      label: part.label,
      value: `${part.minutes.toLocaleString()} min`,
      hint: `${part.streams.toLocaleString()} plays · ${percent(part.minutes, minutes)}`,
    });
  }
  for (const part of dayparts ?? []) {
    items.push({
      label: part.label,
      value: `${part.minutes.toLocaleString()} min`,
      hint: `${part.streams.toLocaleString()} plays · ${percent(part.minutes, minutes)}`,
    });
  }
  if (topArtist && topArtist.label !== "Rest" && topArtist.minutes <= minutes * 1.01) {
    items.push({
      label: "Top artist",
      value: topArtist.label,
      hint: `${countDetail(topArtist.minutes, topArtist.streams)} · ${percent(topArtist.minutes, minutes)}`,
    });
  }
  if (restMinutes != null && restMinutes > 0) {
    items.push({
      label: "Outside top 10",
      value: `${restMinutes.toLocaleString()} min`,
      hint: percent(restMinutes, minutes),
    });
  }
  if (onceTracks != null) {
    items.push({ label: "Heard once", value: onceTracks.toLocaleString(), hint: "tracks" });
  }
  if (replayTracks != null) {
    items.push({
      label: "Heard again",
      value: replayTracks.toLocaleString(),
      hint:
        replayMinutes != null && replayPlays != null
          ? countDetail(replayMinutes, replayPlays)
          : "tracks",
    });
  }
  if (longestPlayMinutes != null && longestPlayMinutes > 0) {
    items.push({ label: "Longest play", value: `${longestPlayMinutes.toLocaleString()} min` });
  }
  if (busiestDay) {
    items.push({
      label: "Busiest day",
      value: calendarLabel(busiestDay),
      hint:
        busiestMinutes != null && busiestPlays != null
          ? countDetail(busiestMinutes, busiestPlays)
          : undefined,
    });
  }
  if (quietDay && quietDay !== busiestDay) {
    items.push({
      label: "Quietest day",
      value: calendarLabel(quietDay),
      hint:
        quietMinutes != null && quietPlays != null ? countDetail(quietMinutes, quietPlays) : undefined,
    });
  }
  if (quietHour) {
    items.push({ label: "Quietest hour", value: quietHour, hint: quietHourDetail ?? undefined });
  }
  return items;
}
