/**
 * Assign all non-demo streams without a userId to a Firebase user.
 *
 * Usage:
 *   LEGACY_USER_ID="firebase_uid" npx tsx scripts/migrate-legacy-streams.ts
 *   npx tsx scripts/migrate-legacy-streams.ts --uid="firebase_uid"
 *   npx tsx scripts/migrate-legacy-streams.ts --dry-run
 */
import { config } from "dotenv";
import { assignLegacyStreamsToUser, countLegacyStreams } from "@/lib/legacy-migration";
import { ensureUserProfile, updateUserLastfmUsername } from "@/lib/users";

config({ path: ".env.local" });
config();

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const uidArg = process.argv.find((arg) => arg.startsWith("--uid="))?.split("=")[1]?.trim();
  const uid = uidArg || process.env.LEGACY_USER_ID?.trim();

  if (!uid) {
    console.error("Provide LEGACY_USER_ID or --uid=<firebase_uid>");
    process.exit(1);
  }

  const pending = await countLegacyStreams();
  console.log(`Legacy streams waiting for assignment: ${pending}`);

  if (dryRun) {
    console.log(`Dry run — would assign ${pending} streams to ${uid}`);
    return;
  }

  const result = await assignLegacyStreamsToUser(uid);
  console.log(
    `Assigned legacy streams to ${uid}: matched ${result.matched}, modified ${result.modified}`
  );

  const lastfm = process.env.LASTFM_USER?.trim();
  if (lastfm) {
    try {
      await ensureUserProfile({ uid, email: null, displayName: null, photoURL: null });
      await updateUserLastfmUsername(uid, lastfm);
      console.log(`Set Firestore lastfmUsername to ${lastfm}`);
    } catch (error) {
      console.warn("Could not update Firestore profile (Firebase Admin may be missing locally):", error);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
