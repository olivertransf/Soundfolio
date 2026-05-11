/**
 * Run this once to get your Spotify refresh token.
 *
 * Usage:
 *   1. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to .env
 *   2. In your Spotify app dashboard, add http://127.0.0.1:3001/callback as a Redirect URI
 *   3. npx tsx scripts/get-refresh-token.ts
 *   4. Visit the URL printed, approve access, copy the token printed to .env
 */

import "dotenv/config";
import http from "http";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in your .env first.");
  process.exit(1);
}

const REDIRECT_URI = "http://127.0.0.1:3001/callback";
const SCOPES = [
  "user-read-recently-played",
  "user-top-read",
  "user-read-currently-playing",
].join(" ");

const authUrl =
  `https://accounts.spotify.com/authorize?` +
  new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
  });

console.log("\n--- Spotify Refresh Token Generator ---\n");
console.log("Open this URL in your browser and approve access:\n");
console.log(authUrl);
console.log("\nWaiting for callback...\n");

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url!, `http://localhost:3001`);
  const code = url.searchParams.get("code");

  if (!code) {
    res.end("No code received.");
    return;
  }

  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  const data = await tokenRes.json();

  res.end("Done! Check your terminal for the refresh token.");

  console.log("\n--- SUCCESS ---\n");
  console.log("Add this to your .env file:\n");
  console.log(`SPOTIFY_REFRESH_TOKEN="${data.refresh_token}"\n`);

  server.close();
  process.exit(0);
});

server.listen(3001);
