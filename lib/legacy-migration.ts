import { mongoDb } from "@/lib/db";
import { getUserProfile, updateUserLastfmUsername } from "@/lib/users";

export async function countLegacyStreams() {
  const db = await mongoDb();
  return db.collection("streams").countDocuments({
    isDemo: false,
    userId: { $exists: false },
  });
}

export async function assignLegacyStreamsToUser(uid: string) {
  const db = await mongoDb();
  const now = new Date();
  const result = await db.collection("streams").updateMany(
    { isDemo: false, userId: { $exists: false } },
    { $set: { userId: uid, updatedAt: now } }
  );

  return {
    matched: result.matchedCount,
    modified: result.modifiedCount,
  };
}

export async function claimLegacyStreamsIfEligible(uid: string, email: string | null | undefined) {
  const legacyEmail = process.env.LEGACY_OWNER_EMAIL?.trim();
  const legacyUid = process.env.LEGACY_USER_ID?.trim();

  if (legacyUid && legacyUid === uid) {
    return assignLegacyStreamsToUser(uid);
  }

  if (!legacyEmail || !email) {
    return { matched: 0, modified: 0, skipped: true as const };
  }

  if (email.toLowerCase() !== legacyEmail.toLowerCase()) {
    return { matched: 0, modified: 0, skipped: true as const };
  }

  const migration = await assignLegacyStreamsToUser(uid);
  const legacyLastfm = process.env.LASTFM_USER?.trim();
  if (legacyLastfm) {
    const profile = await getUserProfile(uid);
    if (!profile?.lastfmUsername?.trim()) {
      await updateUserLastfmUsername(uid, legacyLastfm);
    }
  }

  return migration;
}
