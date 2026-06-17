# Soundfolio (iOS / iPadOS)

Native SwiftUI client for Soundfolio with Firebase Authentication.

## Requirements

- Xcode 26.5+
- Firebase project `odev-b10e2` with Google + Email/Password auth enabled
- Deployed Soundfolio web backend with Firebase Admin configured

## Setup

1. Open `Soundfolio.xcodeproj` in Xcode.
2. `GoogleService-Info.plist` is included for `com.olivertran.Soundfolio`.
3. Run on an iPhone or iPad simulator/device.
4. Sign in with Google or email, then enter your Last.fm username on first launch.

The app defaults to `https://soundfolio-stats.vercel.app`. Change it in **Settings** if needed.

Authenticated API calls send a Firebase ID token as `Authorization: Bearer …`.

## API routes

- `GET /api/stats/overview`, `top-tracks`, `top-artists`, `top-albums`
- `GET /api/stats/history`, `patterns`, `recent`, `freshness`
- `POST /api/sync-lastfm`
- `GET /api/auth/me`, `POST /api/auth/onboarding`

Import Spotify history stays on the web at `/history/import`.
