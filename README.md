# Soundfolio

Self-hosted Spotify listening history and stats. Import your Spotify Extended Streaming History ZIP, sync new plays from Last.fm, and explore the library through a Next.js dashboard backed by MongoDB Atlas.

Default UI range is **This year** (`ytd`). Use the period control or `?range=all` for all time.

Soundfolio is not affiliated with Spotify. Spotify is a trademark of Spotify AB. The app reads the official account data export ZIP; the Spotify Web API is optional for recent-play sync.

## Stack

- Next.js 16 App Router, React 19, Tailwind CSS v4, shadcn/ui
- MongoDB Atlas via the native MongoDB Node driver
- Recharts visualizations
- Vercel deployment

## Setup

You need Node 20.19+ and a MongoDB Atlas connection string.

```bash
npm install
cp .env.example .env.local
npm run db:indexes
npm run dev
```

Fill in:

- `MONGODB_URI`: MongoDB Atlas URI. Rotate any URI that has been pasted into chat, logs, screenshots, or commits.
- `MONGODB_DB`: Database name, defaults to `soundfolio`.
- `LASTFM_API_KEY` and `LASTFM_USER`: Required for ongoing scrobble sync.
- `AUTH_KEY`: Optional protection for `/me`.
- `TIMEZONE`: Recommended IANA timezone for hour/day buckets.

## Migrating From Postgres

If you have an existing Neon/Postgres database from the old Prisma version:

```bash
POSTGRES_DATABASE_URL="postgresql://..." \
MONGODB_URI="mongodb+srv://..." \
MONGODB_DB="soundfolio" \
npm run db:migrate:postgres
```

The migration script bulk-upserts streams into MongoDB and preserves existing IDs, timestamps, artwork fields, and `isDemo`.

## Import And Sync

1. Request **Extended streaming history** from [Spotify account privacy](https://www.spotify.com/account/privacy/).
2. Upload the ZIP at `/history/import`.
3. Connect Spotify to Last.fm in the Spotify app so new plays scrobble.
4. Use **Sync from Last.fm** on the import page, or let the app run a lightweight background sync on load.

Backfill album artwork from Last.fm (then iTunes and Cover Art Archive). Backfill artist images from Last.fm (then Discogs and Deezer).

## Vercel

1. Import the repo in Vercel.
2. Set `MONGODB_URI`, `MONGODB_DB`, `LASTFM_API_KEY`, `LASTFM_USER`, and optional `AUTH_KEY`, `TIMEZONE`, Spotify vars, and `CRON_SECRET`.
3. Build command: `npm run build`.
4. Run `npm run db:indexes` locally or from a trusted one-off environment after changing index definitions.

For cron-driven Spotify sync, schedule `GET /api/sync` or call `POST /api/sync` with `Authorization: Bearer <CRON_SECRET>`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Next.js dev server. |
| `npm run build` | Production build. |
| `npm run db:indexes` | Create MongoDB indexes. |
| `npm run db:migrate:postgres` | One-time Postgres to MongoDB migration. |
| `npm run db:seed-demo` | Insert synthetic `isDemo: true` streams for local testing. |
| `npm run backfill-art` | CLI album artwork backfill. |
| `npm run backfill-artists` | CLI artist artwork backfill. |
| `npm run backfill-all` | Run both backfills. |
| `npm run clear-placeholder-art` | Clear known placeholder artwork URLs. |

## Obsidian

Use `npm run export-obsidian-stats` to write a JSON snapshot from MongoDB-backed stats. For a live dashboard inside Obsidian, embed your deployed `/me` URL with a webview/custom frame plugin.

## License

[MIT](LICENSE)
