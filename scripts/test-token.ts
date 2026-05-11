import "dotenv/config";

const REFRESH_TOKEN = process.argv[2] ?? process.env.SPOTIFY_REFRESH_TOKEN;
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!REFRESH_TOKEN) {
  console.log("Usage: npx tsx scripts/test-token.ts [REFRESH_TOKEN]");
  process.exit(1);
}
if (!CLIENT_ID || !CLIENT_SECRET) {
  console.log("Need SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env");
  process.exit(1);
}

async function main() {
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: REFRESH_TOKEN,
    }),
  });
  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    console.log("Token refresh failed:", tokenData.error, tokenData.error_description ?? "");
    process.exit(1);
  }
  console.log("Access token ok");

  const rpRes = await fetch(
    "https://api.spotify.com/v1/me/player/recently-played?limit=5",
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
  );
  console.log("Recently-played status:", rpRes.status);
  const text = await rpRes.text();
  let rpData: { error?: { message?: string }; items?: unknown[] };
  try {
    rpData = JSON.parse(text);
  } catch {
    console.log("Response (not JSON):", text.slice(0, 200));
    process.exit(1);
  }
  if (rpData?.error || rpRes.status !== 200) {
    console.log("Error:", rpData?.error?.message ?? text.slice(0, 200));
    process.exit(1);
  }
  console.log("Items returned:", rpData.items?.length ?? 0, "- Sync would work");
}

main();
