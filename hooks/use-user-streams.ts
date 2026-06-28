"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  fetchStreamDocSnapshot,
  fetchUserStreamsPage,
  STREAMS_PAGE_SIZE,
} from "@/lib/firestore/streams";
import { firestoreErrorMessage, isFirestoreQuotaError } from "@/lib/firestore/errors";
import {
  clearStreamCache,
  isStreamCacheFresh,
  mergeStreamLists,
  readStreamCache,
  writeStreamCache,
  type StreamCachePagination,
} from "@/lib/stream-cache";
import type { Stream } from "@/lib/types/stream";
import type { QueryDocumentSnapshot } from "firebase/firestore";

function paginationFromPage(
  page: { hasMore: boolean; lastDoc?: QueryDocumentSnapshot },
  streams: Stream[]
): StreamCachePagination {
  return {
    hasMore: page.hasMore,
    lastDocId: page.lastDoc?.id ?? streams[streams.length - 1]?.id,
  };
}

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

  const persistCache = useCallback(
    (uid: string, nextStreams: Stream[], pagination: StreamCachePagination) => {
      writeStreamCache(uid, nextStreams, pagination);
    },
    []
  );

  const restoreCursor = useCallback(async (uid: string, lastDocId?: string) => {
    if (!lastDocId) {
      cursorRef.current = undefined;
      return;
    }
    cursorRef.current = await fetchStreamDocSnapshot(uid, lastDocId);
  }, []);

  const applyCache = useCallback((uid: string) => {
    const cached = readStreamCache(uid);
    if (!cached?.streams.length) return null;
    setStreams(cached.streams);
    setLoading(false);
    return cached;
  }, []);

  const loadAllRemaining = useCallback(
    async (uid: string, token: number) => {
      if (token !== loadTokenRef.current) return;

      setLoadingMore(true);
      setError(null);

      try {
        let keepGoing = true;
        while (keepGoing && token === loadTokenRef.current) {
          const page = await fetchUserStreamsPage(uid, STREAMS_PAGE_SIZE, cursorRef.current);
          if (token !== loadTokenRef.current) return;

          cursorRef.current = page.lastDoc;
          keepGoing = page.hasMore;
          setHasMore(page.hasMore);
          setFullyLoaded(!page.hasMore);

          setStreams((current) => {
            const merged = mergeStreamLists(current, page.streams);
            persistCache(uid, merged, paginationFromPage(page, merged));
            return merged;
          });
        }
      } catch (err) {
        if (token !== loadTokenRef.current) return;
        setError(firestoreErrorMessage(err, "Could not load listening history."));
        if (isFirestoreQuotaError(err)) {
          setFullyLoaded(true);
          setHasMore(false);
        }
      } finally {
        if (token === loadTokenRef.current) {
          setLoadingMore(false);
        }
      }
    },
    [persistCache]
  );

  const loadMore = useCallback(async () => {
    if (!user || loadingMore || fullyLoaded || !hasMore) return;
    await loadAllRemaining(user.uid, loadTokenRef.current);
  }, [user, loadingMore, fullyLoaded, hasMore, loadAllRemaining]);

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
        const cachedHasMore = cached.hasMore;
        const lastDocId = cached.lastDocId ?? cached.streams[cached.streams.length - 1]?.id;

        await restoreCursor(user.uid, lastDocId);
        if (token !== loadTokenRef.current) return;

        if (cachedHasMore === false) {
          setHasMore(false);
          setFullyLoaded(true);
          return;
        }

        setHasMore(true);
        setFullyLoaded(false);
        void loadAllRemaining(user.uid, token);
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
          persistCache(user.uid, merged, paginationFromPage(firstPage, merged));
          return merged;
        });
        setLoading(false);

        if (firstPage.hasMore) {
          void loadAllRemaining(user.uid, token);
        }
      } catch (err) {
        if (token !== loadTokenRef.current) return;
        const message = firestoreErrorMessage(err, "Could not load listening history.");
        setError(message);
        if (cached?.streams.length) {
          setLoading(false);
          setFullyLoaded(true);
          setHasMore(false);
        } else {
          setStreams([]);
          setLoading(false);
          setFullyLoaded(true);
          setHasMore(false);
        }
      }
    },
    [user, applyCache, restoreCursor, loadAllRemaining, persistCache]
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
        persistCache(user.uid, next, { hasMore, lastDocId: cursorRef.current?.id });
      }
      setStreams(next);
    },
    [user, hasMore, persistCache]
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
