import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto as Crypto;

import "dotenv/config";
import { getStreamsByWeek } from "../lib/stats";

async function main() {
  const tz = "America/Los_Angeles";
  const weeks = await getStreamsByWeek(8, undefined, "me", tz);
  for (const w of weeks) {
    if (w.week.startsWith("2026-05") || w.week.startsWith("2026-06")) {
      console.log(w.week, w.minutes, "min", w.streams, "streams");
    }
  }
  await import("../lib/db").then((m) => m.db.$disconnect());
}

main();
