import { getAdminFirestore } from "@/lib/firebase/admin";

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  lastfmUsername: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const USERS_COLLECTION = "users";

function usersCollection() {
  return getAdminFirestore().collection(USERS_COLLECTION);
}

function fromDoc(uid: string, data: FirebaseFirestore.DocumentData): UserProfile {
  return {
    uid,
    email: (data.email as string | null | undefined) ?? null,
    displayName: (data.displayName as string | null | undefined) ?? null,
    photoURL: (data.photoURL as string | null | undefined) ?? null,
    lastfmUsername: (data.lastfmUsername as string | null | undefined) ?? null,
    createdAt: data.createdAt?.toDate?.() ?? new Date(),
    updatedAt: data.updatedAt?.toDate?.() ?? new Date(),
  };
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await usersCollection().doc(uid).get();
  if (!snap.exists) return null;
  return fromDoc(uid, snap.data()!);
}

export async function ensureUserProfile(input: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}): Promise<UserProfile> {
  const ref = usersCollection().doc(input.uid);
  const existing = await ref.get();
  const now = new Date();

  if (existing.exists) {
    const patch: Record<string, unknown> = { updatedAt: now };
    if (input.email) patch.email = input.email;
    if (input.displayName) patch.displayName = input.displayName;
    if (input.photoURL) patch.photoURL = input.photoURL;
    await ref.set(patch, { merge: true });
    return (await getUserProfile(input.uid))!;
  }

  const profile = {
    email: input.email ?? null,
    displayName: input.displayName ?? null,
    photoURL: input.photoURL ?? null,
    lastfmUsername: null,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(profile);
  return fromDoc(input.uid, profile);
}

export async function updateUserLastfmUsername(uid: string, lastfmUsername: string) {
  const normalized = lastfmUsername.trim();
  if (!normalized) {
    throw new Error("Last.fm username is required.");
  }

  const now = new Date();
  await usersCollection().doc(uid).set(
    {
      lastfmUsername: normalized,
      updatedAt: now,
    },
    { merge: true }
  );

  return getUserProfile(uid);
}

export function userNeedsOnboarding(profile: UserProfile | null) {
  return !profile?.lastfmUsername?.trim();
}
