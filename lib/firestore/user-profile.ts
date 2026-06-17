import type { User } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type DocumentData,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";

export type UserProfile = {
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  lastfmUsername: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
  lastSignInAt?: unknown;
};

function fromDoc(data: DocumentData): UserProfile {
  return {
    email: (data.email as string | null | undefined) ?? null,
    displayName: (data.displayName as string | null | undefined) ?? null,
    photoURL: (data.photoURL as string | null | undefined) ?? null,
    lastfmUsername: (data.lastfmUsername as string | null | undefined) ?? null,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    lastSignInAt: data.lastSignInAt,
  };
}

export function userNeedsOnboarding(profile: UserProfile | null) {
  return !profile?.lastfmUsername?.trim();
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const db = getFirebaseFirestore();
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return fromDoc(snap.data());
}

export async function upsertUserProfile(user: User): Promise<void> {
  const db = getFirebaseFirestore();
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const now = serverTimestamp();
  const fields = {
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    updatedAt: now,
    lastSignInAt: now,
  };

  if (!snap.exists()) {
    await setDoc(ref, {
      ...fields,
      lastfmUsername: null,
      createdAt: now,
    });
  } else {
    await setDoc(ref, fields, { merge: true });
  }
}

export async function setLastfmUsername(uid: string, lastfmUsername: string) {
  const db = getFirebaseFirestore();
  const ref = doc(db, "users", uid);
  await setDoc(
    ref,
    {
      lastfmUsername: lastfmUsername.trim(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
