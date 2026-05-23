# Soundfolio iOS / iPadOS

Native SwiftUI client for this repo’s stats API.

## Requirements

- Xcode 26.5+
- Deployed Soundfolio backend (MongoDB + Last.fm)
- No `AUTH_KEY` required when the server has auth disabled

## Setup

1. Open `ios/Soundfolio.xcodeproj` in Xcode.
2. Run on an iPhone or iPad simulator or device.
3. Default server URL is `https://mongodb-vercel-redesign.vercel.app`. Change it in **Settings** if needed.

The app calls `/api/stats/*` on your deployment. Pull to refresh triggers Last.fm sync on the server.

## API routes

- `GET /api/stats/overview`, `top-tracks`, `top-artists`, `top-albums`
- `GET /api/stats/history`, `patterns`, `recent`, `freshness`
- `POST /api/sync-lastfm`

Spotify history import stays on the web at `/history/import`.
