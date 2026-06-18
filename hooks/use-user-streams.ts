"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { fetchUserStreamsPage, STREAMS_PAGE_SIZE } from "@/lib/firestore/streams";
import { firestoreErrorMessage, isFirestoreQuotaError } from "@/lib/firestore/errors";
import {
  clearStreamCache,
  isStreamCacheFresh,
  mergeStreamLists,
  readStreamCache,
  writeStreamCache,
} from "@/lib/stream-cache";
import type { Stream } from "@/lib/types/stream";
import type { QueryDocumentSnapshot } from "firebase/firestore";

export function useUserStreams() {
  const { user, loading: authLoading } = useAuth();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fullyLoaded, setFullyLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadTokenRef = useRef(0);
  const cursorRef = useRef<QueryDocumentSnapshot | undefined>(undefined);

  const applyCache = useCallback((uid: string) => {
    const cached = readStreamCache(uid);
    if (!cached?.streams.length) return null;
    setStreams(cached.streams);
    setLoading(false);
    return cached;
  }, []);

  const loadMore = useCallback(async () => {
    if (!user || loadingMore || fullyLoaded || !hasMore) return;

    const token = loadTokenRef.current;
    setLoadingMore(true);
    setError(null);

    try {
      const page = await fetchUserStreamsPage(user.uid, STREAMS_PAGE_SIZE, cursorRef.current);
      if (token !== loadTokenRef.current) return;

      cursorRef.current = page.lastDoc;
      setHasMore(page.hasMore);
      setFullyLoaded(!page.hasMore);

      setStreams((current) => {
        const merged = mergeStreamLists(current, page.streams);
        writeStreamCache(user.uid, merged);
        return merged;
      });
    } catch (err) {
      if (token !== loadTokenRef.current) return;
      setError(firestoreErrorMessage(err, "Could not load more listening history."));
      if (isFirestoreQuotaError(err)) {
        setFullyLoaded(true);
        setHasMore(false);
      }
    } finally {
      if (token === loadTokenRef.current) {
        setLoadingMore(false);
      }
    }
  }, [user, loadingMore, fullyLoaded, hasMore]);

  const reload = useCallback(
    async (options?: { forceNetwork?: boolean }) => {
      if (!user) {
        setStreams([]);
        setLoading(false);
        setLoadingMore(false);
        setFullyLoaded(true);
        setHasMore(false);
        cursorRef.current = undefined;
        return;
      }

      const token = ++loadTokenRef.current;
      setError(null);
      setFullyLoaded(false);
      setHasMore(false);
      setLoadingMore(false);
      cursorRef.current = undefined;

      const cached = applyCache(user.uid);

      if (cached && isStreamCacheFresh(cached.savedAt) && !options?.forceNetwork) {
        setFullyLoaded(true);
        return;
      }

      if (!cached?.streams.length) {
        setLoading(true);
      }

      try {
        const firstPage = await fetchUserStreamsPage(user.uid);
        if (token !== loadTokenRef.current) return;

        cursorRef.current = firstPage.lastDoc;
        setHasMore(firstPage.hasMore);
        setFullyLoaded(!firstPage.hasMore);

        setStreams((current) => {
          const merged = mergeStreamLists(cached?.streams ?? current, firstPage.streams);
          writeStreamCache(user.uid, merged);
          return merged;
        });
        setLoading(false);
      } catch (err) {
        if (token !== loadTokenRef.current) return;
        const message = firestoreErrorMessage(err, "Could not load listening history.");
        setError(message);
        if (cached?.streams.length) {
          setLoading(false);
          setFullyLoaded(true);
        } else {
          setStreams([]);
          setLoading(false);
          setFullyLoaded(true);
        }
      }
    },
    [user, applyCache]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setStreams([]);
      setLoading(false);
      setLoadingMore(false);
      setFullyLoaded(true);
      setHasMore(false);
      return;
    }
    void reload();
  }, [authLoading, user, reload]);

  useEffect(() => {
    if (!user) {
      loadTokenRef.current += 1;
    }
  }, [user]);

  const setStreamsWithCache = useCallback(
    (next: Stream[]) => {
      if (user) {
        writeStreamCache(user.uid, next);
      }
      setStreams(next);
    },
    [user]
  );

  const clearCache = useCallback(() => {
    if (user) {
      clearStreamCache(user.uid);
    }
  }, [user]);

  return useMemo(
    () => ({
      streams,
      loading: authLoading || loading,
      loadingMore,
      fullyLoaded,
      hasMore,
      error,
      reload: () => reload({ forceNetwork: true }),
      loadMore,
      setStreams: setStreamsWithCache,
      clearCache,
    }),
    [
      streams,
      authLoading,
      loading,
      loadingMore,
      fullyLoaded,
      hasMore,
      error,
      reload,
      loadMore,
      setStreamsWithCache,
      clearCache,
    ]
  );
}
