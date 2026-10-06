"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  browserLocalPersistence,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { upsertUserProfile } from "@/lib/firestore/user-profile";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

const SESSION_RENEW_AFTER_MS = 24 * 60 * 60 * 1000;

function sessionRenewedKey(uid: string) {
  return `soundfolio:session-renewed:${uid}`;
}

function shouldRenewSession(uid: string) {
  try {
    const renewedAt = Number(localStorage.getItem(sessionRenewedKey(uid)) ?? "0");
    return !Number.isFinite(renewedAt) || Date.now() - renewedAt >= SESSION_RENEW_AFTER_MS;
  } catch {
    return true;
  }
}

async function saveSessionCookie(user: User) {
  if (!shouldRenewSession(user.uid)) return;

  const idToken = await user.getIdToken(true);
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not save the sign-in session.");
  }
  try {
    localStorage.setItem(sessionRenewedKey(user.uid), String(Date.now()));
  } catch {
    // The cookie is already set. A blocked storage write only means the next visit renews again.
  }
}

async function clearSessionCookie(uid: string | undefined) {
  await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" });
  if (uid) localStorage.removeItem(sessionRenewedKey(uid));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured());

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    let unsubscribe = () => {};
    let cancelled = false;

    void setPersistence(auth, browserLocalPersistence).finally(() => {
      if (cancelled) return;
      unsubscribe = onAuthStateChanged(auth, (nextUser) => {
        setUser(nextUser);
        setLoading(false);
        if (!nextUser) return;
        void saveSessionCookie(nextUser).catch((error) => {
          console.error("[auth] session cookie failed", error);
        });
        void upsertUserProfile(nextUser).catch((error) => {
          console.error("[auth] profile upsert failed", error);
        });
      });
    });

    const renewOnReturn = () => {
      if (document.visibilityState !== "visible") return;
      const current = auth.currentUser;
      if (!current) return;
      void saveSessionCookie(current).catch((error) => {
        console.error("[auth] session cookie failed", error);
      });
    };
    document.addEventListener("visibilitychange", renewOnReturn);

    return () => {
      cancelled = true;
      unsubscribe();
      document.removeEventListener("visibilitychange", renewOnReturn);
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    await setPersistence(auth, browserLocalPersistence);
    const result = await signInWithPopup(auth, googleProvider);
    try {
      await saveSessionCookie(result.user);
    } catch (error) {
      if (process.env.NODE_ENV === "production") throw error;
      console.error("[auth] session cookie failed", error);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    const auth = getFirebaseAuth();
    const uid = auth.currentUser?.uid;
    await clearSessionCookie(uid);
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      configured: isFirebaseConfigured(),
      signInWithGoogle,
      signOutUser,
    }),
    [user, loading, signInWithGoogle, signOutUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
