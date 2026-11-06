"use client";

import { useMemo, useState } from "react";
import { Activity, Clock3, Flame, ListMusic } from "lucide-react";
import type {
  Archive,
  ArchiveEntity,
  ArchivePeriod,
} from "@/lib/archive-analytics";
import { monthLabel, shiftMonth } from "@/lib/archive-analytics";
import { artistGroupKey } from "@/lib/entity-normalize";
import {
  HOUR_WINDOWS,
  WEEKDAYS,
  listeningProfile,
  metricValue,
  type LabMetric,
} from "@/lib/archive-listening-lab";

const controls = "archive-control";
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const display = (value: number, metric: LabMetric) =>
  number.format(value) + (metric === "time" ? " min" : " plays");
type ChartMode = "Days" | "Hours" | "Week pattern";
type Pick = { mode: ChartMode; index: number };
type Ranking = "tracks" | "artists" | "albums";
type RankMetric = LabMetric | "days";

function Bars({
  points,
  label,
  metric,
  selected,
  onSelect,
}: {
  points: { label: string; value: number; tick: string }[];
  label: string;
  metric: LabMetric;
  selected?: number;
  onSelect: (index: number) => void;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className="lab-plot" role="group" aria-label={label}>
      <div className="lab-axis">
        <span>{display(max, metric)}</span>
        <span>0</span>
      </div>
      <div
        className="lab-bars"
        style={{
          gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`,
        }}
      >
        {points.map((p, i) => (
          <button
            type="button"
            key={p.label}
            aria-label={`${p.label}, ${display(p.value, metric)}`}
            title={`${p.label} · ${display(p.value, metric)}`}
            aria-pressed={selected === i}
            onClick={() => onSelect(i)}
          >
            <span className="lab-bar-track">
              <span
                className="lab-bar"
                style={{ height: `${(100 * p.value) / max}%` }}
              />
            </span>
            <span className="lab-tick" aria-hidden="true">
              {p.tick || "\u00a0"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ListeningLab({
  archive,
  period,
  month,
  metric,
  onMonth,
  onEntity,
  onBrowse,
}: {
  archive: Archive;
  period: ArchivePeriod;
  month: string;
  metric: LabMetric;
  onMonth: (month: string) => void;
  onEntity: (entity: ArchiveEntity, kind: Ranking) => void;
  onBrowse: () => void;
}) {
  const [mode, setMode] = useState<ChartMode>("Days");
  const [artist, setArtist] = useState("");
  const [pick, setPick] = useState<Pick | null>(null);
  const [ranking, setRanking] = useState<Ranking>("tracks");
  const [rankMetric, setRankMetric] = useState<RankMetric>("plays");
  const [limit, setLimit] = useState(10);
  const scoped = useMemo(
    () =>
      artist
        ? archive.select(
            period.rows.filter(
              (row) => artistGroupKey(row.artistName) === artist,
            ),
            period.key,
          )
        : period,
    [archive, artist, period],
  );
  const profile = useMemo(
    () => listeningProfile(archive, scoped),
    [archive, scoped],
  );
  const daysInMonth = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0),
  ).getUTCDate();
  const dayKeys = Array.from(
    { length: daysInMonth },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
  const dayPoints = dayKeys.map((day, i) => ({
    label: day,
    tick: i === 0 || (i + 1) % 5 === 0 ? String(i + 1) : "",
    value: metricValue(profile.days.get(day) ?? { plays: 0, ms: 0 }, metric),
  }));
  const hourPoints = profile.hours.map((hour, i) => ({
    label: `${String(i).padStart(2, "0")}:00 local`,
    tick: i % 4 === 0 ? String(i).padStart(2, "0") : "",
    value: metricValue(hour, metric),
  }));
  const selectedPeriod = useMemo(() => {
    if (!pick) return scoped;
    const rows = profile.entries
      .filter((entry) => {
        if (pick.mode === "Hours") return entry.hour === pick.index;
        if (pick.mode === "Week pattern") return entry.cell === pick.index;
        return Number(entry.day.slice(-2)) === pick.index + 1;
      })
      .map((entry) => entry.row);
    return archive.select(rows, scoped.key);
  }, [archive, pick, profile, scoped]);
  const rankValue = (entity: ArchiveEntity) =>
    rankMetric === "days" ? entity.days.size : metricValue(entity, rankMetric);
  const ranked = [...selectedPeriod[ranking]].sort(
    (a, b) =>
      rankValue(b) - rankValue(a) ||
      b.plays - a.plays ||
      a.name.localeCompare(b.name),
  );
  const rankMax = Math.max(1, ranked[0] ? rankValue(ranked[0]) : 0);
  const peak = [...profile.days].sort((a, b) => b[1].plays - a[1].plays)[0];
  const mostPlayed = scoped.tracks[0];
  const topFiveShare = scoped.rows.length
    ? Math.round(
        (scoped.tracks
          .slice(0, 5)
          .reduce((sum, track) => sum + track.plays, 0) /
          scoped.rows.length) *
          100,
      )
    : 0;
  const heatMax = Math.max(
    1,
    ...profile.heat.map((value) => metricValue(value, metric)),
  );
  const selectionLabel =
    pick?.mode === "Days"
      ? dayPoints[pick.index]?.label
      : pick?.mode === "Hours"
        ? hourPoints[pick.index]?.label
        : pick
          ? `${WEEKDAYS[Math.floor(pick.index / 6)]} · ${HOUR_WINDOWS[pick.index % 6]}`
          : "";
  const buckets =
    mode === "Week pattern"
      ? profile.heat.map((cell, index) => ({
          label: `${WEEKDAYS[Math.floor(index / 6)]} · ${HOUR_WINDOWS[index % 6]}`,
          value: metricValue(cell, metric),
        }))
      : mode === "Days"
        ? dayPoints
        : hourPoints;
  const yearPoints = Array.from({ length: 12 }, (_, i) => {
    const key = shiftMonth(`${month.slice(0, 4)}-01`, i);
    const data = archive.months.get(key);
    return {
      key,
      label: monthLabel(key),
      tick: monthLabel(key).slice(0, 3),
      value: metricValue(
        { plays: data?.rows.length ?? 0, ms: data?.ms ?? 0 },
        metric,
      ),
    };
  });

  function select(index: number) {
    setPick((current) =>
      current?.mode === mode && current.index === index
        ? null
        : { mode, index },
    );
  }

  return (
    <section className="listening-lab" aria-label="Listening analysis">
      <header className="lab-header">
        <div>
          <p className="archive-kicker">A closer listen</p>
          <h2>The rhythm of your month</h2>
          <p className="archive-muted">
            Touch a moment. See what was playing.
          </p>
        </div>
        <label>
          Artist filter
          <select
            className={controls}
            value={artist}
            onChange={(event) => {
              setArtist(event.target.value);
              setPick(null);
            }}
          >
            <option value="">All artists</option>
            {[...period.artists]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((item) => (
                <option key={item.key} value={item.key}>
                  {item.name}
                </option>
              ))}
          </select>
        </label>
      </header>
      {scoped.rows.length > 0 && (
        <div className="lab-facts">
          <div>
            <Activity size={16} aria-hidden="true" />
            <strong>{peak?.[1].plays ?? 0}</strong>
            <span>Plays on your busiest date</span>
            <small>{peak?.[0]}</small>
          </div>
          <div>
            <Flame size={16} aria-hidden="true" />
            <strong>{profile.longestStreak} days</strong>
            <span>Longest listening streak</span>
            <small>Consecutive dates with recorded plays</small>
          </div>
          <div>
            <ListMusic size={16} aria-hidden="true" />
            <strong>{topFiveShare}%</strong>
            <span>Share from your top five tracks</span>
            <small>Of plays in this artist selection</small>
          </div>
          <div>
            <Clock3 size={16} aria-hidden="true" />
            <strong>{mostPlayed?.plays ?? 0} plays</strong>
            <span>Most played track</span>
            <small>{mostPlayed?.name}</small>
          </div>
        </div>
      )}
      <div className="lab-panel">
        <div className="lab-header">
          <div>
            <h3>Listening rhythm</h3>
            <p className="archive-muted">
              {archive.tz} ·{" "}
              {metric === "time"
                ? "Stored duration in minutes"
                : "Recorded plays"}
            </p>
          </div>
          <div
            className="archive-segmented"
            role="group"
            aria-label="Chart view"
          >
            {(["Days", "Hours", "Week pattern"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={mode === option}
                onClick={() => {
                  setMode(option);
                  setPick(null);
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        {mode === "Week pattern" ? (
          <div
            className="lab-heat"
            role="group"
            aria-label="Weekday and time of day heatmap"
          >
            <span />
            {HOUR_WINDOWS.map((label, i) => (
              <span key={label} title={label}>
                {String(i * 4).padStart(2, "0")}:00
              </span>
            ))}
            {WEEKDAYS.map((label, weekday) => (
              <div key={label} className="lab-heat-row">
                <span>{label}</span>
                {HOUR_WINDOWS.map((window, i) => {
                  const index = weekday * 6 + i;
                  const value = metricValue(profile.heat[index], metric);
                  return (
                    <button
                      key={window}
                      type="button"
                      aria-pressed={pick?.index === index}
                      aria-label={`${label} ${window}, ${display(value, metric)}`}
                      title={`${label} ${window} · ${display(value, metric)}`}
                      onClick={() => select(index)}
                      style={{
                        backgroundColor: `color-mix(in srgb, var(--primary) ${value ? 12 + (70 * value) / heatMax : 0}%, var(--secondary))`,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <Bars
            points={mode === "Days" ? dayPoints : hourPoints}
            label={
              mode === "Days"
                ? "Daily listening chart"
                : "Hourly listening chart"
            }
            metric={metric}
            selected={pick?.index}
            onSelect={select}
          />
        )}
        <label className="lab-bucket-control">
          Inspect{" "}
          {mode === "Days"
            ? "a date"
            : mode === "Hours"
              ? "an hour"
              : "a time window"}
          <select
            className={controls}
            aria-label="Inspect chart bucket"
            value={pick?.index ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              setPick(value === "" ? null : { mode, index: Number(value) });
            }}
          >
            <option value="">All recorded listening</option>
            {buckets.map((bucket, index) => (
              <option key={bucket.label} value={index}>
                {bucket.label} · {display(bucket.value, metric)}
              </option>
            ))}
          </select>
        </label>
        <p className="archive-muted" aria-live="polite">
          {selectionLabel
            ? `${selectionLabel} · ${selectedPeriod.rows.length} plays across ${selectedPeriod.tracks.length} tracks · ${number.format(selectedPeriod.ms / 60_000)} stored min.`
            : `${scoped.rows.length} plays across ${scoped.days.length} active days.`}
        </p>
      </div>
      <div className="lab-panel">
        <div className="lab-header">
          <div>
            <h3>Rankings</h3>
            <p className="archive-muted">
              {selectionLabel || "Selected month"} ·{" "}
              {selectedPeriod[ranking].length} results
            </p>
          </div>
          {pick && (
            <button className={controls} onClick={() => setPick(null)}>
              Clear chart selection
            </button>
          )}
        </div>
        <div className="lab-rank-controls">
          <label>
            Group by
            <select
              className={controls}
              value={ranking}
              onChange={(e) => setRanking(e.target.value as Ranking)}
            >
              <option value="tracks">Tracks</option>
              <option value="artists">Artists</option>
              <option value="albums">Albums</option>
            </select>
          </label>
          <label>
            Rank by
            <select
              className={controls}
              value={rankMetric}
              onChange={(e) => setRankMetric(e.target.value as RankMetric)}
            >
              <option value="plays">Plays</option>
              <option value="time">Stored time</option>
              <option value="days">Active days</option>
            </select>
          </label>
          <label>
            Show
            <select
              className={controls}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value="5">Top 5</option>
              <option value="10">Top 10</option>
              <option value="25">Top 25</option>
            </select>
          </label>
        </div>
        <ol className="lab-rank-list">
          {ranked.slice(0, limit).map((item, i) => (
            <li key={item.key}>
              <button type="button" onClick={() => onEntity(item, ranking)}>
                <span
                  className="lab-rank-fill"
                  style={{ width: `${(100 * rankValue(item)) / rankMax}%` }}
                />
                <span className="lab-rank-index">{i + 1}</span>
                <span className="lab-rank-name">
                  {item.name}
                  {ranking !== "artists" && <small>{item.artist}</small>}
                </span>
                <strong>
                  {rankMetric === "days"
                    ? `${item.days.size} days`
                    : display(rankValue(item), rankMetric)}
                </strong>
              </button>
            </li>
          ))}
        </ol>
        {!ranked.length && (
          <p className="archive-muted">No recorded music in this selection.</p>
        )}
        <div>
          <button type="button" className={controls} onClick={onBrowse}>
            Browse all tracks this month
          </button>
        </div>
      </div>
      <div className="lab-panel">
        <h3>{month.slice(0, 4)} in context</h3>
        <p className="archive-muted">
          Entire library · choose a month to open its story.
        </p>
        <Bars
          points={yearPoints}
          label="Listening by month"
          metric={metric}
          selected={Number(month.slice(5)) - 1}
          onSelect={(index) => onMonth(yearPoints[index].key)}
        />
      </div>
    </section>
  );
}

export function ListeningComparison({
  a,
  b,
  onArtist,
}: {
  a: ArchivePeriod;
  b: ArchivePeriod;
  onArtist: (entity: ArchiveEntity) => void;
}) {
  const [order, setOrder] = useState<"shift" | "reach">("shift");
  const [metric, setMetric] = useState<LabMetric>("plays");
  const denominatorA = metricValue({ plays: a.rows.length, ms: a.ms }, metric);
  const denominatorB = metricValue({ plays: b.rows.length, ms: b.ms }, metric);
  const mapA = new Map(a.artists.map((artist) => [artist.key, artist]));
  const mapB = new Map(b.artists.map((artist) => [artist.key, artist]));
  const rows = [...new Set([...mapA.keys(), ...mapB.keys()])]
    .map((key) => {
      const left = mapA.get(key);
      const right = mapB.get(key);
      const shareA =
        left && denominatorA
          ? (100 * metricValue(left, metric)) / denominatorA
          : 0;
      const shareB =
        right && denominatorB
          ? (100 * metricValue(right, metric)) / denominatorB
          : 0;
      return {
        artist: (left ?? right)!,
        shareA,
        shareB,
        shift: shareA - shareB,
      };
    })
    .filter((row) => row.shareA || row.shareB);
  rows.sort((x, y) =>
    order === "shift"
      ? Math.abs(y.shift) - Math.abs(x.shift)
      : Math.max(y.shareA, y.shareB) - Math.max(x.shareA, x.shareB),
  );
  const visible = rows.slice(0, 10);
  const max = Math.max(
    1,
    ...visible.flatMap((row) => [row.shareA, row.shareB]),
  );
  return (
    <section
      className="lab-panel lab-comparison"
      aria-label="Compare artist listening share"
    >
      <div className="lab-header">
        <div>
          <h3>How your artist mix changed</h3>
          <p className="archive-muted">
            Each bar is a share of its period. A and B use the same scale.
          </p>
        </div>
      </div>
      <div className="lab-rank-controls">
        <label>
          Measure
          <select
            className={controls}
            value={metric}
            onChange={(event) => setMetric(event.target.value as LabMetric)}
          >
            <option value="plays">Share of plays</option>
            <option value="time">Share of stored time</option>
          </select>
        </label>
        <label>
          Sort by
          <select
            className={controls}
            value={order}
            onChange={(event) => setOrder(event.target.value as typeof order)}
          >
            <option value="shift">Biggest shift</option>
            <option value="reach">Largest share</option>
          </select>
        </label>
      </div>
      {(!denominatorA || !denominatorB) && (
        <p className="archive-muted">
          A period with zero recorded volume shows 0% for each artist.
        </p>
      )}
      <div className="lab-comparison-legend">
        <span>
          <i />A · {a.key}
        </span>
        <span>
          <i />B · {b.key}
        </span>
      </div>
      <ol className="lab-comparison-list">
        {visible.map(({ artist, shareA, shareB, shift }) => (
          <li key={artist.key}>
            <button
              type="button"
              className="archive-text-link"
              onClick={() => onArtist(artist)}
            >
              {artist.name}
            </button>
            <span className="archive-muted">
              {shift > 0 ? "+" : ""}
              {number.format(shift)} pp
            </span>
            {[shareA, shareB].map((share, i) => (
              <div
                key={i}
                className="lab-comparison-bar"
                aria-label={`Period ${i === 0 ? "A" : "B"}: ${number.format(share)} percent`}
              >
                <span>{i === 0 ? "A" : "B"}</span>
                <span className="lab-comparison-track">
                  <i style={{ width: `${(100 * share) / max}%` }} />
                </span>
                <strong>{number.format(share)}%</strong>
              </div>
            ))}
          </li>
        ))}
      </ol>
      {!visible.length && (
        <p className="archive-muted">No recorded listening for this measure.</p>
      )}
    </section>
  );
}
