"use client";
import { useMemo } from 'react';
import { AlbumArt } from '@/components/album-art';
import { monthLabel, type Archive } from '@/lib/archive-analytics';
import { listeningChapters } from '@/lib/archive-chapters';
import type { ArchiveNotes } from '@/lib/archive-notes';

const moods = ['Reflective', 'Bright', 'Restless', 'Quiet', 'Focused', 'Nostalgic'];
export function ListeningJournal({ archive, month, notes, ready, update, onMonth, onTrack }: {
  archive: Archive; month: string; notes: ArchiveNotes; ready: boolean;
  update: (fn: (notes: ArchiveNotes) => ArchiveNotes) => void;
  onMonth: (month: string) => void; onTrack: (track: string) => void;
}) {
  const chapters = useMemo(() => listeningChapters(archive), [archive]);
  const p = archive.months.get(month) ?? archive.empty(month);
  const mood = notes.memories.find(m => m.target === `mood:${month}`)?.tags;
  return <div className="listening-journal">
    <section className="journal-hero">
      <div>
        <h2>{monthLabel(month)}</h2>

        <div className="journal-numbers"><span><b>{p.rows.length.toLocaleString()}</b>plays</span><span><b>{p.artists.length}</b>artists</span><span><b>{p.days.length}</b>days of music</span></div>
        <div className="journal-moods" role="group" aria-label="Your mood for this month">{moods.map(value => <button key={value} disabled={!ready || !p.rows.length} aria-pressed={mood === value} onClick={() => update(current => ({ ...current, memories: [...current.memories.filter(m => m.target !== `mood:${month}`), ...(mood === value ? [] : [{id: crypto.randomUUID(), target: `mood:${month}`, title: `${value} · ${monthLabel(month)}`, text: '', tags: value, link: ''}])] }))}>{value}</button>)}</div>
        <small className="archive-muted">Mood · saved on this device</small>
      </div>
      <div className="journal-sleeves">{p.albums.slice(0, 3).map((album) => <button key={album.key} onClick={() => onTrack(p.tracks.find(t => t.album === album.name && t.artist === album.artist)?.key ?? p.tracks[0].key)} aria-label={`Explore ${album.name} by ${album.artist}`}><AlbumArt src={album.art} alt={`${album.name} · ${album.artist}`} width={220} height={220}/><span className="journal-sleeve-label">{album.name}<small>{album.artist}</small></span></button>)}</div>
    </section>
    {!p.rows.length ? <p className="archive-banner">No records for this month. Choose another month to explore.</p> : null}
    <details className="journal-chapters"><summary>Listening chapters</summary><header><details><summary>How chapters work</summary><p>Chapters begin when a change in artist listening persists into the next month. Gaps in recorded months also start a chapter. Names come from the leading artist; these are listening patterns, not inferred moods.</p></details></header>
      <div className="journal-chapter-strip">{chapters.map((chapter) => <button key={chapter.from} aria-pressed={month >= chapter.from && month <= chapter.to} onClick={() => onMonth(chapter.from)}><div className="journal-chapter-art"><AlbumArt src={chapter.period.albums[0]?.art} alt="" width={160} height={160}/></div><small>{monthLabel(chapter.from)}{chapter.to !== chapter.from ? ` – ${monthLabel(chapter.to)}` : ''}</small><strong>{chapter.name}</strong><span>{chapter.period.rows.length.toLocaleString()} plays</span></button>)}</div>
    </details>
  </div>;
}
