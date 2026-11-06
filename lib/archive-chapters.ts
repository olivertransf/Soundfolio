import { suggestedBoundaries, shiftMonth, type Archive } from './archive-analytics';

/** Listening chapters follow sustained artist changes; missing months break continuity. */
export function listeningChapters(archive: Archive) {
  const months = [...archive.months.keys()].sort();
  const changes = new Set(suggestedBoundaries(archive).map(item => item.month));
  const groups: string[][] = [];
  months.forEach((month, index) => {
    if (!index || changes.has(month) || shiftMonth(months[index - 1], 1) !== month) groups.push([]);
    groups.at(-1)!.push(month);
  });
  return groups.map(group => {
    const from = group[0];
    const to = group.at(-1)!;
    const period = archive.range(`${from}-01`, `${to}-31`);
    return { from, to, period, name: period.artists[0]?.name ?? 'Listening chapter' };
  });
}
