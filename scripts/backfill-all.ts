/**
 * Runs backfill-art until all album art is done.
 * Usage: npx tsx scripts/backfill-all.ts
 */

import { spawnSync } from "child_process";
import path from "path";

const scriptsDir = path.join(__dirname);
const tsx = "npx";
const tsxArgs = ["tsx"];

function run(script: string): { output: string; ok: boolean } {
  const result = spawnSync(tsx, [...tsxArgs, path.join(scriptsDir, script)], {
    encoding: "utf-8",
    stdio: "pipe",
    cwd: path.join(__dirname, ".."),
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  return { output, ok: result.status === 0 };
}

function runUntilDone(
  script: string,
  donePattern: RegExp,
  label: string
): void {
  let round = 0;
  const maxRounds = Number(process.env.BACKFILL_MAX_ROUNDS ?? 10);
  while (round < maxRounds) {
    round++;
    console.log(`\n--- ${label} round ${round} ---`);
    const { output, ok } = run(script);
    console.log(output);
    if (donePattern.test(output)) {
      console.log(`\n${label} complete.`);
      break;
    }
    if (!ok) {
      console.error(`\n${label} failed. Stopping.`);
      process.exit(1);
    }
  }
  console.log(`\n${label} stopped after ${maxRounds} rounds. Some artwork may not be resolvable.`);
}

async function main() {
  console.log("Starting album art backfill...\n");

  runUntilDone(
    "backfill-art.ts",
    /No tracks missing album artwork/,
    "Album art"
  );

  console.log("\nBackfill complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
