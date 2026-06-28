# Soundfolio

Personal listening analytics across web and iOS. Import your Spotify Extended Streaming History ZIP, sync ongoing plays from Last.fm, and explore top tracks, artists, albums, listening patterns, and recent plays.

Default UI range is **This year** (`ytd`). Use the period control or `?range=all` for all time.

**Live:** [soundfolio-stats.vercel.app](https://soundfolio-stats.vercel.app) · **Repository:** [github.com/olivertransf/Soundfolio](https://github.com/olivertransf/Soundfolio)

Soundfolio is not affiliated with Spotify. Spotify is a trademark of Spotify AB.

## Features

### Web dashboard

- **Auth & onboarding** — Google sign-in via Firebase; Last.fm username setup
- **Dashboard** — Total streams and minutes, top tracks/artists/albums preview, listening activity chart, recent plays, insights (peak hour/day, diversity, listening span)
- **Library** — Recent plays, rankings (tops), and patterns (hour, weekday, week×hour heatmap)
- **Entity pages** — Per-track, per-artist, and per-album detail views with play history
- **Spotify import** — Upload Extended Streaming History ZIP with progress UI and deduplication
- **Last.fm sync** — Manual and background sync via paginated API; artwork backfill from Last.fm, iTunes, Cover Art Archive, Discogs, and Deezer
- **Filters** — Time ranges (30d, 3m, 6m, 1y, ytd, all, custom); sort by streams or minutes; viewer timezone
- **Settings** — Last.fm username, sync status, accent color, theme, density, chart metric
- **Demo mode** — Explore the UI with synthetic data without signing in

### iOS app

- Google Sign-In with Firestore-backed streams and stats
- Dashboard, Library, and Settings tabs (sidebar-adaptable on iPad)
- Rankings, patterns, and entity drill-downs matching the web app
- Pull-to-refresh and manual Last.fm sync
- Configurable server URL in Settings

Spotify ZIP import stays on the web at `/history/import`.

## Stack

- Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/ui, Recharts
- Firebase Auth + Firestore (client reads/writes; server syncs Last.fm)
- Native **iOS / iPadOS** app (`Soundfolio.xcodeproj`, SwiftUI)
- Vercel deployment

## iOS app

Open `Soundfolio.xcodeproj` in Xcode 16+.

- Sign in with Google, enter your Last.fm username on first launch
- Defaults to `https://soundfolio-stats.vercel.app` (change in Settings)
- Streams and stats read from Firestore; sync calls `POST /api/sync-lastfm`

## Setup (web)

You need Node 20.19+ and Firebase project credentials.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Fill in `NEXT_PUBLIC_FIREBASE_*` and `LASTFM_API_KEY` (see `.env.example`).

## Vercel

1. Import the repo in Vercel.
2. Set `NEXT_PUBLIC_FIREBASE_*`, `LASTFM_API_KEY`, and optional `LEGACY_USER_ID`.
3. Build command: `npm run build`.

## License

[MIT](LICENSE)
