"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { firestoreErrorMessage, isFirestoreQuotaError } from "@/lib/firestore/errors";
import {
  fetchStreamDocSnapshot,
  fetchUserStreamsPage,
} from "@/lib/firestore/streams";
import {
  clearStreamCache,
  readStreamCache,
  upsertStreamCache,
  writeStreamCache,
  type StreamCacheMeta,
  type StreamCachePagination,
} from "@/lib/stream-idb-cache";
import {
  isStreamCacheFresh,
  mergeStreamLists,
} from "@/lib/stream-cache";
import type { Stream } from "@/lib/types/stream";
import type { QueryDocumentSnapshot } from "firebase/firestore";

function paginationFromPage(page: { hasMore: boolean; lastDoc?: QueryDocumentSnapshot }): StreamCachePagination {
  return {
    hasMore: page.hasMore,
    lastDocId: page.lastDoc?.id,
  };
}

export function useUserStreams() {
  const { user, loading: authLoading } = useAuth();
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fullyLoaded, setFullyLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cacheMeta, setCacheMeta] = useState<StreamCacheMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadTokenRef = useRef(0);
  const cursorRef = useRef<QueryDocumentSnapshot | undefined>(undefined);

  const restoreCursor = useCallback(async (uid: string, lastDocId?: string) => {
    if (!lastDocId) {
      cursorRef.current = undefined;
      return;
    }
    cursorRef.current = await fetchStreamDocSnapshot(uid, lastDocId);
  }, []);

  const applyCache = useCallback(async (uid: string, token: number) => {
    const cached = await readStreamCache(uid);
    if (token !== loadTokenRef.current) return null;
    if (!cached?.streams.length) return null;

    setStreams(cached.streams);
    setCacheMeta(cached.meta);
    setHasMore(cached.meta ? !cached.meta.fullyLoaded : true);
    setFullyLoaded(Boolean(cached.meta?.fullyLoaded));
    setLoading(false);
    return cached;
  }, []);

  const loadAllRemaining = useCallback(async (uid: string, token: number) => {
    if (token !== loadTokenRef.current) return;

    setLoadingMore(true);
    setError(null);

    try {
      let keepGoing = true;
      while (keepGoing && token === loadTokenRef.current) {
        const page = await fetchUserStreamsPage(uid, undefined, cursorRef.current);
        if (token !== loadTokenRef.current) return;

        cursorRef.current = page.lastDoc;
        keepGoing = page.hasMore;
        setHasMore(page.hasMore);
        setFullyLoaded(!page.hasMore);
        setStreams((current) => mergeStreamLists(current, page.streams));

        const meta = await upsertStreamCache(uid, page.streams, paginationFromPage(page));
        if (token !== loadTokenRef.current) return;
        setCacheMeta(meta);
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
  }, []);

  const refreshFromNetwork = useCallback(
    async (
      uid: string,
      token: number,
      options: { fullRefresh: boolean; cachedMeta?: StreamCacheMeta | null }
    ) => {
      setRefreshing(true);
      setError(null);

      try {
        const firstPage = await fetchUserStreamsPage(uid);
        if (token !== loadTokenRef.current) return;

        cursorRef.current = firstPage.lastDoc;
        const shouldLoadTail =
          firstPage.hasMore && (options.fullRefresh || !options.cachedMeta?.fullyLoaded);

        setStreams((current) => mergeStreamLists(current, firstPage.streams));
        const meta = await upsertStreamCache(uid, firstPage.streams, {
          hasMore: shouldLoadTail,
          lastDocId: firstPage.lastDoc?.id,
        });
        if (token !== loadTokenRef.current) return;

        setCacheMeta(meta);
        setHasMore(shouldLoadTail);
        setFullyLoaded(!shouldLoadTail);
        setLoading(false);

        if (shouldLoadTail) {
          await loadAllRemaining(uid, token);
        }
      } catch (err) {
        if (token !== loadTokenRef.current) return;
        setError(firestoreErrorMessage(err, "Could not load listening history."));
        if (isFirestoreQuotaError(err)) {
          setFullyLoaded(true);
          setHasMore(false);
        }
        setLoading(false);
      } finally {
        if (token === loadTokenRef.current) {
          setRefreshing(false);
        }
      }
    },
    [loadAllRemaining]
  );

  const reload = useCallback(
    async (options?: { forceNetwork?: boolean; fullRefresh?: boolean }) => {
      if (!user) {
        setStreams([]);
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
        setFullyLoaded(true);
        setHasMore(false);
        setCacheMeta(null);
        cursorRef.current = undefined;
        return;
      }

      const token = ++loadTokenRef.current;
      setError(null);
      setFullyLoaded(false);
      setHasMore(false);
      setLoadingMore(false);
      cursorRef.current = undefined;

      const cached = await applyCache(user.uid, token);
      const cachedMeta = cached?.meta ?? null;

      if (cached && isStreamCacheFresh(cachedMeta?.savedAt ?? null) && !options?.forceNetwork) {
        if (cachedMeta?.fullyLoaded) {
          setHasMore(false);
          setFullyLoaded(true);
          return;
        }

        await restoreCursor(user.uid, cachedMeta?.lastDocId ?? cached.streams[cached.streams.length - 1]?.id);
        if (token !== loadTokenRef.current) return;
        setHasMore(true);
        setFullyLoaded(false);
        void loadAllRemaining(user.uid, token);
        return;
      }

      if (!cached?.streams.length) {
        setLoading(true);
      }

      await refreshFromNetwork(user.uid, token, {
        fullRefresh: options?.fullRefresh ?? !cachedMeta?.fullyLoaded,
        cachedMeta,
      });
    },
    [user, applyCache, restoreCursor, loadAllRemaining, refreshFromNetwork]
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setStreams([]);
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      setFullyLoaded(true);
      setHasMore(false);
      setCacheMeta(null);
      return;
    }
    void reload();
  }, [authLoading, user, reload]);

  useEffect(() => {
    if (!user) {
      loadTokenRef.current += 1;
    }
  }, [user]);

  const loadMore = useCallback(async () => {
    if (!user || loadingMore || fullyLoaded || !hasMore) return;
    await loadAllRemaining(user.uid, loadTokenRef.current);
  }, [user, loadingMore, fullyLoaded, hasMore, loadAllRemaining]);

  const setStreamsWithCache = useCallback(
    (next: Stream[]) => {
      if (user) {
        void writeStreamCache(user.uid, next, { hasMore, lastDocId: cursorRef.current?.id }).then(setCacheMeta);
      }
      setStreams(next);
    },
    [user, hasMore]
  );

  const clearCache = useCallback(async () => {
    if (!user) return;
    await clearStreamCache(user.uid);
    setStreams([]);
    setCacheMeta(null);
    setHasMore(false);
    setFullyLoaded(false);
  }, [user]);

  return useMemo(
    () => ({
      streams,
      loading: authLoading || loading,
      loadingMore,
      refreshing,
      fullyLoaded,
      hasMore,
      cacheMeta,
      error,
      reload: () => reload({ forceNetwork: true, fullRefresh: true }),
      refreshHead: () => reload({ forceNetwork: true, fullRefresh: false }),
      loadMore,
      setStreams: setStreamsWithCache,
      clearCache,
    }),
    [
      streams,
      authLoading,
      loading,
      loadingMore,
      refreshing,
      fullyLoaded,
      hasMore,
      cacheMeta,
      error,
      reload,
      loadMore,
      setStreamsWithCache,
      clearCache,
    ]
  );
}
