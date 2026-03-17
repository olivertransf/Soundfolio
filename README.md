# Spotify Stats

A personal Spotify listening stats dashboard. Import your full Spotify history, then auto-sync new plays going forward.

## Setup

### 1. Create a Spotify App

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Click **Create app**
3. Add `http://127.0.0.1:3001/callback` as a Redirect URI
4. Copy your **Client ID** and **Client Secret**

### 2. Create a Neon Database

1. Sign up at [console.neon.tech](https://console.neon.tech) (free)
2. Create a new project
3. Copy the **Connection string** from the dashboard

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
DATABASE_URL="postgresql://..."   # from Neon
DIRECT_URL="postgresql://..."     # same URL (or pooler URL if Neon provides one)
SPOTIFY_CLIENT_ID="..."
SPOTIFY_CLIENT_SECRET="..."
SPOTIFY_REFRESH_TOKEN="..."       # generated in step 4
```

### 4. Generate your Spotify refresh token

```bash
npm run get-token
```

Open the URL it prints, approve access, then copy the token it prints into your `.env`.

### 5. Set up the database

```bash
npm run db:push
```

### 6. Import your Spotify history

1. Go to [spotify.com/account/privacy](https://www.spotify.com/account/privacy/)
2. Check **Extended streaming history** only
3. Click **Request data** — Spotify will email you in 1-5 days
4. Download the ZIP file
5. Start the app, go to the Import page, upload the ZIP

### 7. Run locally

```bash
npm run dev
```

## Last.fm sync (optional, no Premium needed)

If Spotify sync fails due to Premium requirement, use Last.fm instead:

1. Create account at [last.fm](https://www.last.fm)
2. In Spotify: Settings → Social → Connect to Last.fm
3. Get API key at [last.fm/api/account/create](https://www.last.fm/api/account/create)
4. Add to Netlify: `LASTFM_API_KEY`, `LASTFM_USER` (your username)
5. Click "Sync from Last.fm" on the Import page, or it runs hourly with the cron

## Deployment (Netlify)

1. Push to GitHub
2. Connect repo in Netlify
3. Add all `.env` values as **Environment variables** in Netlify settings
4. Add `CRON_SECRET` — any random string (secures the sync endpoint)
5. Optionally add `LASTFM_API_KEY` and `LASTFM_USER` for Last.fm sync (works without Premium)
6. Deploy — the scheduled function runs hourly (Spotify + Last.fm if configured)

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run get-token` | Generate Spotify refresh token |
| `npm run db:push` | Push schema to database |
| `npm run db:studio` | Open Prisma Studio (DB GUI) |
| `npm run build` | Build for production |
