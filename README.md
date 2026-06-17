# Soundfolio

Self-hosted listening history and stats. Import your Spotify Extended Streaming History ZIP, sync new plays from Last.fm, and explore your library through a Next.js dashboard and native iOS app backed by Firebase Firestore.

Default UI range is **This year** (`ytd`). Use the period control or `?range=all` for all time.

Soundfolio is not affiliated with Spotify. Spotify is a trademark of Spotify AB.

## Stack

- Next.js App Router, React, Tailwind CSS, shadcn/ui
- Firebase Auth + Firestore (client reads/writes streams; server syncs Last.fm)
- Recharts visualizations
- Vercel deployment
- Native **iOS / iPadOS** app (`Soundfolio.xcodeproj`, SwiftUI)

## iOS app

Open `Soundfolio.xcodeproj` in Xcode 26.5+.

- Firebase project `odev-b10e2` with Google sign-in
- `GoogleService-Info.plist` is included for `com.olivertran.Soundfolio`
- Sign in with Google, enter your Last.fm username on first launch
- Defaults to `https://soundfolio-stats.vercel.app` (change in Settings)
- Streams and stats are read from Firestore locally; sync calls `POST /api/sync-lastfm`

Import Spotify history stays on the web at `/history/import`.

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
