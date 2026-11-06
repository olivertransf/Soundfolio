import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildArchive } from './archive-analytics';
import { listeningChapters } from './archive-chapters';
import type { Stream } from './types/stream';
function monthRows(month: string, artist: string): Stream[] {
  return Array.from({ length: 24 }, (_, i) => ({ id: `${month}-${i}`, trackId: artist, trackName: artist, artistName: artist, albumName: artist, albumArt: null, artistArt: null, playedAt: new Date(`${month}-${String(i+1).padStart(2,'0')}T12:00:00Z`), durationMs: 180000, isDemo: false, createdAt: new Date(0), updatedAt: new Date(0) }));
}
test('chapters distinguish sustained shifts from missing coverage and preserve every play', () => {
 const archive = buildArchive([...monthRows('2024-01','A'), ...monthRows('2024-02','B'), ...monthRows('2024-03','B'), ...monthRows('2024-05','B')], 'UTC');
 const chapters = listeningChapters(archive);
 assert.deepEqual(chapters.map(c => [c.from,c.to]), [['2024-01','2024-01'],['2024-02','2024-03'],['2024-05','2024-05']]);
 assert.equal(chapters.reduce((sum,c)=>sum+c.period.rows.length,0), archive.rows.length);
 assert.deepEqual(listeningChapters(buildArchive([], 'UTC')), []);
});
