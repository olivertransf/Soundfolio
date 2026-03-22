import { subMonths, addMilliseconds, startOfDay, setHours, setMinutes } from "date-fns";
import {
  DEMO_ALBUM_ART_BY_TRACK_ID,
  DEMO_ARTIST_ART_BY_NAME,
} from "@/lib/demo-artwork";

export type DemoStreamRow = {
  id: string;
  trackId: string;
  trackName: string;
  artistName: string;
  artistArt: string | null;
  albumName: string;
  albumArt: string | null;
  durationMs: number;
  playedAt: Date;
};

type CatalogTrack = {
  trackId: string;
  trackName: string;
  artistName: string;
  albumName: string;
  albumArt: string | null;
  artistArt: string | null;
  durationMs: number;
  weight: number;
};

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATALOG_RAW: Omit<CatalogTrack, "albumArt" | "artistArt">[] = [
  { trackId: "t1", trackName: "Anti-Hero", artistName: "Taylor Swift", albumName: "Midnights", durationMs: 201000, weight: 1.4 },
  { trackId: "t2", trackName: "Blinding Lights", artistName: "The Weeknd", albumName: "After Hours", durationMs: 200000, weight: 1.35 },
  { trackId: "t3", trackName: "As It Was", artistName: "Harry Styles", albumName: "Harry's House", durationMs: 167000, weight: 1.2 },
  { trackId: "t4", trackName: "good 4 u", artistName: "Olivia Rodrigo", albumName: "SOUR", durationMs: 178000, weight: 1.15 },
  { trackId: "t5", trackName: "Heat Waves", artistName: "Glass Animals", albumName: "Dreamland", durationMs: 238000, weight: 1.1 },
  { trackId: "t6", trackName: "Levitating", artistName: "Dua Lipa", albumName: "Future Nostalgia", durationMs: 203000, weight: 1.25 },
  { trackId: "t7", trackName: "Circles", artistName: "Post Malone", albumName: "Hollywood's Bleeding", durationMs: 215000, weight: 1.05 },
  { trackId: "t8", trackName: "drivers license", artistName: "Olivia Rodrigo", albumName: "SOUR", durationMs: 242000, weight: 1.1 },
  { trackId: "t9", trackName: "Save Your Tears", artistName: "The Weeknd", albumName: "After Hours", durationMs: 215000, weight: 1.12 },
  { trackId: "t10", trackName: "Flowers", artistName: "Miley Cyrus", albumName: "Endless Summer Vacation", durationMs: 200000, weight: 1.18 },
  { trackId: "t11", trackName: "Starboy", artistName: "The Weeknd", albumName: "Starboy", durationMs: 230000, weight: 1.0 },
  { trackId: "t12", trackName: "One More Time", artistName: "Daft Punk", albumName: "Discovery", durationMs: 320000, weight: 0.65 },
  { trackId: "t13", trackName: "Bohemian Rhapsody", artistName: "Queen", albumName: "A Night at the Opera", durationMs: 355000, weight: 0.55 },
  { trackId: "t14", trackName: "Mr. Brightside", artistName: "The Killers", albumName: "Hot Fuss", durationMs: 222000, weight: 0.85 },
  { trackId: "t15", trackName: "Take Me Out", artistName: "Franz Ferdinand", albumName: "Franz Ferdinand", durationMs: 237000, weight: 0.7 },
  { trackId: "t16", trackName: "Do I Wanna Know?", artistName: "Arctic Monkeys", albumName: "AM", durationMs: 272000, weight: 0.95 },
  { trackId: "t17", trackName: "Electric Feel", artistName: "MGMT", albumName: "Oracular Spectacular", durationMs: 229000, weight: 0.75 },
  { trackId: "t18", trackName: "Redbone", artistName: "Childish Gambino", albumName: "Awaken, My Love!", durationMs: 327000, weight: 0.8 },
  { trackId: "t19", trackName: "Get Lucky", artistName: "Daft Punk", albumName: "Random Access Memories", durationMs: 248000, weight: 0.72 },
  { trackId: "t20", trackName: "Somebody That I Used To Know", artistName: "Gotye", albumName: "Making Mirrors", durationMs: 244000, weight: 0.68 },
  { trackId: "t21", trackName: "Losing My Religion", artistName: "R.E.M.", albumName: "Out of Time", durationMs: 269000, weight: 0.6 },
  { trackId: "t22", trackName: "Creep", artistName: "Radiohead", albumName: "Pablo Honey", durationMs: 239000, weight: 0.78 },
  { trackId: "t23", trackName: "Smells Like Teen Spirit", artistName: "Nirvana", albumName: "Nevermind", durationMs: 301000, weight: 0.62 },
  { trackId: "t24", trackName: "Everlong", artistName: "Foo Fighters", albumName: "The Colour and the Shape", durationMs: 250000, weight: 0.7 },
  { trackId: "t25", trackName: "Dreams", artistName: "Fleetwood Mac", albumName: "Rumours", durationMs: 257000, weight: 0.65 },
  { trackId: "t26", trackName: "The Less I Know The Better", artistName: "Tame Impala", albumName: "Currents", durationMs: 216000, weight: 0.88 },
  { trackId: "t27", trackName: "Stolen Dance", artistName: "Milky Chance", albumName: "Sadnecessary", durationMs: 313000, weight: 0.58 },
  { trackId: "t28", trackName: "Sweater Weather", artistName: "The Neighbourhood", albumName: "I Love You.", durationMs: 240000, weight: 0.82 },
  { trackId: "t29", trackName: "Riptide", artistName: "Vance Joy", albumName: "Dream Your Life Away", durationMs: 204000, weight: 0.9 },
  { trackId: "t30", trackName: "Shut Up and Dance", artistName: "WALK THE MOON", albumName: "Talking Is Hard", durationMs: 199000, weight: 0.76 },
];

const CATALOG: CatalogTrack[] = CATALOG_RAW.map((row) => ({
  ...row,
  albumArt: DEMO_ALBUM_ART_BY_TRACK_ID[row.trackId] ?? null,
  artistArt: DEMO_ARTIST_ART_BY_NAME[row.artistName] ?? null,
}));

function pickWeightedTrack(rand: () => number, catalog: CatalogTrack[]): CatalogTrack {
  const total = catalog.reduce((s, t) => s + t.weight, 0);
  let r = rand() * total;
  for (const t of catalog) {
    r -= t.weight;
    if (r <= 0) return t;
  }
  return catalog[catalog.length - 1]!;
}

function randomPlayTime(rand: () => number, dayStart: Date): Date {
  const dow = dayStart.getDay();
  const isWeekend = dow === 0 || dow === 6;
  let hour: number;
  if (isWeekend) {
    const roll = rand();
    if (roll < 0.35) hour = 10 + Math.floor(rand() * 6);
    else if (roll < 0.7) hour = 16 + Math.floor(rand() * 8);
    else hour = 20 + Math.floor(rand() * 4);
  } else {
    const roll = rand();
    if (roll < 0.22) hour = 7 + Math.floor(rand() * 3);
    else if (roll < 0.55) hour = 12 + Math.floor(rand() * 5);
    else if (roll < 0.78) hour = 17 + Math.floor(rand() * 3);
    else hour = 20 + Math.floor(rand() * 4);
  }
  hour = Math.min(23, Math.max(0, hour));
  const minute = Math.floor(rand() * 60);
  const second = Math.floor(rand() * 60);
  return addMilliseconds(
    setMinutes(setHours(startOfDay(dayStart), hour), minute),
    second * 1000
  );
}

let cachedStreams: DemoStreamRow[] | null = null;

export function getDemoStreams(): DemoStreamRow[] {
  if (cachedStreams) return cachedStreams;

  const rand = mulberry32(0xdec0de);
  const now = new Date();
  const since = subMonths(now, 12);
  const streams: DemoStreamRow[] = [];

  const dayMs = 24 * 60 * 60 * 1000;
  const catalog = CATALOG;

  let id = 0;
  for (let dayOffset = 0; ; dayOffset++) {
    const dayStart = new Date(since.getTime() + dayOffset * dayMs);
    if (dayStart > now) break;

    const seasonal = 0.85 + 0.3 * Math.sin((dayOffset / 365) * Math.PI * 2);
    const dow = dayStart.getDay();
    const weekendBoost = dow === 5 || dow === 6 ? 1.18 : dow === 0 ? 1.08 : 0.92;
    const basePlays = 18 + Math.floor(rand() * 34);
    const n = Math.max(8, Math.floor(basePlays * seasonal * weekendBoost));

    for (let p = 0; p < n; p++) {
      const track = pickWeightedTrack(rand, catalog);
      const playedAt = randomPlayTime(rand, dayStart);
      if (playedAt > now) continue;

      id += 1;
      streams.push({
        id: `demo-${id}`,
        trackId: track.trackId,
        trackName: track.trackName,
        artistName: track.artistName,
        artistArt: track.artistArt,
        albumName: track.albumName,
        albumArt: track.albumArt,
        durationMs: track.durationMs + Math.floor((rand() - 0.5) * 12000),
        playedAt,
      });
    }
  }

  streams.sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  cachedStreams = streams;
  return streams;
}
