import { db } from "@/lib/db";
import { getUserProfile, updateUserLastfmUsername } from "@/lib/users";

export async function countLegacyStreams() {
  const rows = await db.stream.findMany({ where: { isDemo: false } });
  return rows.filter((row) => !row.userId).length;
}

export async function assignLegacyStreamsToUser(uid: string) {
  const rows = await db.stream.findMany({ where: { isDemo: false } });
  const legacyIds = rows.filter((row) => !row.userId).map((row) => row.id);
  if (legacyIds.length === 0) {
    return { matched: 0, modified: 0 };
  }

  let modified = 0;
  for (let i = 0; i < legacyIds.length; i += 450) {
    const slice = legacyIds.slice(i, i + 450);
    const result = await db.stream.updateMany({
      where: { id: { in: slice } },
      data: { userId: uid },
    });
    modified += result.count;
  }

  return { matched: legacyIds.length, modified };
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
