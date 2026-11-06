"use client";
import { useMemo } from 'react';
import { AlbumArt } from '@/components/album-art';
import { monthlyInsights, monthLabel, type Archive } from '@/lib/archive-analytics';
import { listeningChapters } from '@/lib/archive-chapters';
import type { ArchiveNotes } from '@/lib/archive-notes';

const moods = ['Reflective', 'Bright', 'Restless', 'Quiet', 'Focused', 'Nostalgic'];
export function ListeningJournal({ archive, month, notes, ready, update, onMonth, onTrack }: {
  archive: Archive; month: string; notes: ArchiveNotes; ready: boolean;
  update: (fn: (notes: ArchiveNotes) => ArchiveNotes) => void;
  onMonth: (month: string) => void; onTrack: (track: string) => void;
}) {
  const chapters = useMemo(() => listeningChapters(archive), [archive]);
  const insight = useMemo(() => monthlyInsights(archive, month), [archive, month]);
  const p = insight.p;
  const mood = notes.memories.find(m => m.target === `mood:${month}`)?.tags;
  const firstShare = p.tracks.length ? Math.round(insight.first.length / p.tracks.length * 100) : 0;
  return <div className="listening-journal">
    <section className="journal-hero">
      <div>
        <p className="archive-kicker">The soundtrack to</p>
        <h2>{monthLabel(month)}</h2>
        <p className="journal-lead">{p.artists[0] ? <>A month with <strong>{p.artists[0].name}</strong>.</> : 'An unwritten chapter.'}</p>
        <div className="journal-numbers"><span><b>{p.rows.length.toLocaleString()}</b>plays</span><span><b>{p.artists.length}</b>artists</span><span><b>{p.days.length}</b>days of music</span></div>
        <div className="journal-moods" role="group" aria-label="Your mood for this month">{moods.map(value => <button key={value} disabled={!ready || !p.rows.length} aria-pressed={mood === value} onClick={() => update(current => ({ ...current, memories: [...current.memories.filter(m => m.target !== `mood:${month}`), ...(mood === value ? [] : [{id: crypto.randomUUID(), target: `mood:${month}`, title: `${value} · ${monthLabel(month)}`, text: '', tags: value, link: ''}])] }))}>{value}</button>)}</div>
        <small className="archive-muted">Your mood, your choice · saved on this device</small>
      </div>
      <div className="journal-sleeves">{p.albums.slice(0, 4).map((album, i) => <button key={album.key} onClick={() => onTrack(p.tracks.find(t => t.album === album.name && t.artist === album.artist)?.key ?? p.tracks[0].key)} aria-label={`Explore ${album.name} by ${album.artist}`} style={{ rotate: `${[-7, 5, -3, 7][i]}deg` }}><AlbumArt src={album.art} alt={`${album.name} · ${album.artist}`} width={220} height={220}/><span className="journal-sleeve-label">{album.name}<small>{album.artist}</small></span></button>)}</div>
    </section>
    {!p.rows.length ? <p className="archive-banner">No records for this month. Choose another month to explore.</p> : <section className="journal-insights" aria-label="Monthly highlights">
      <div className="journal-discovery"><div className="journal-ring" style={{background: `conic-gradient(var(--primary) ${firstShare}%, var(--secondary) 0)`}}><b>{firstShare}%</b></div><div><h3>New to your archive</h3><p>{insight.first.length} of {p.tracks.length} tracks</p></div></div>
      <div><p className="archive-kicker">On repeat</p><button className="journal-track" onClick={() => onTrack(p.tracks[0].key)}><AlbumArt src={p.tracks[0].art} alt="" width={56} height={56}/><span><strong>{p.tracks[0].name}</strong><small>{p.tracks[0].plays} plays · {p.tracks[0].days.size} days</small></span><span>↗</span></button></div>
      <div><p className="archive-kicker">Back in rotation</p>{insight.returning[0] ? <button className="journal-track" onClick={() => onTrack(insight.returning[0].key)}><span><strong>{insight.returning[0].name}</strong><small>After {insight.returning[0].gap} days away</small></span><span>↗</span></button> : <><h3>{p.albums[0]?.name ?? 'Still unfolding'}</h3><p className="archive-muted">{p.albums[0] ? 'Your most-played album' : 'More listening, more connections'}</p></>}</div>
    </section>}
    <section className="journal-chapters"><header><div><p className="archive-kicker">Automatically grouped</p><h2>Your listening chapters</h2></div><details><summary>How chapters work</summary><p>Chapters begin when a change in artist listening persists into the next month. Gaps in recorded months also start a chapter. Names come from the leading artist; these are listening patterns, not inferred moods.</p></details></header>
      <div className="journal-chapter-strip">{chapters.map((chapter, i) => <button key={chapter.from} aria-pressed={month >= chapter.from && month <= chapter.to} onClick={() => onMonth(chapter.from)}><div className="journal-chapter-art"><AlbumArt src={chapter.period.albums[0]?.art} alt="" width={160} height={160}/><span>{String(i + 1).padStart(2,'0')}</span></div><small>{monthLabel(chapter.from)}{chapter.to !== chapter.from ? ` – ${monthLabel(chapter.to)}` : ''}</small><strong>{chapter.name}</strong><span>{chapter.period.rows.length.toLocaleString()} plays</span></button>)}</div>
    </section>
  </div>;
}
