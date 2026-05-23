# Soundfolio (iOS / iPadOS)

Native SwiftUI client for your self-hosted [SpotifyStats](https://github.com) dashboard.

## Requirements

- Xcode 26.5+
- A deployed Soundfolio instance with MongoDB and Last.fm configured
- No `AUTH_KEY` required (same as a website deploy without it)

## Setup

1. Open `Soundfolio.xcodeproj` in Xcode.
2. Run on an iPhone or iPad simulator/device.
3. The app defaults to `https://mongodb-vercel-redesign.vercel.app`. Change it in **Settings** if needed.

The app calls your public `/api/stats/*` routes directly. Pull to refresh runs Last.fm sync on the server.

## API routes

- `GET /api/stats/overview`, `top-tracks`, `top-artists`, `top-albums`
- `GET /api/stats/history`, `patterns`, `recent`, `freshness`
- `POST /api/sync-lastfm`

Import Spotify history stays on the web at `/history/import`.
