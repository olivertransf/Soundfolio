"use client";
import { useEffect, useState, useCallback } from "react";
import {
  annotationStorageKey,
  parseArchiveNotes,
  emptyArchiveNotes,
  type ArchiveNotes,
} from "@/lib/archive-notes";
import { songIdentityKey } from "@/lib/listen-dedupe";
import { useAuth } from "@/components/auth-provider";
export function useArchiveNotes(demo: boolean) {
  const { user } = useAuth();
  const key = annotationStorageKey(demo, user?.uid);
  const [stored, setStored] = useState<{
    key: string;
    data: ArchiveNotes;
    dirty?: boolean;
    unreadable?: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      const data = raw ? parseArchiveNotes(raw) : emptyArchiveNotes();
      if (data.version !== 1) throw Error("Unsupported archive version");
      if (!raw && demo) {
        data.works = [
          {
            id: "demo-bach-1",
            track: songIdentityKey(
              "Glenn Gould",
              "Goldberg Variations, BWV 988: Aria",
            ),
            composer: "Johann Sebastian Bach",
            work: "Goldberg Variations, BWV 988",
            performer: "Glenn Gould · 1981",
          },
          {
            id: "demo-bach-2",
            track: songIdentityKey(
              "Murray Perahia",
              "Goldberg Variations, BWV 988: Aria",
            ),
            composer: "Johann Sebastian Bach",
            work: "Goldberg Variations, BWV 988",
            performer: "Murray Perahia",
          },
        ];
        data.memories = [
          {
            id: "fictional-note",
            target: "month:2024-06",
            title: "A fictional summer note",
            text: "I kept returning to the piano recordings in this imaginary listening diary.",
            tags: "piano, summer",
            link: "",
          },
        ];
        data.eras = [
          {
            id: "fictional-era",
            name: "Summer piano",
            from: "2024-06-01",
            to: "2024-08-31",
            description:
              "Fictional demo era. A place to collect piano recordings.",
            color: "#bd935b",
            cover: "",
          },
        ];
      }
      setStored({ key, data: { ...emptyArchiveNotes(), ...data } });
      setError("");
    } catch {
      setError(
        "Browser storage is unavailable or unreadable. Export before leaving; changes cannot be saved.",
      );
      setStored({ key, data: emptyArchiveNotes(), unreadable: true });
    }
  }, [key, demo]);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return;
      try {
        setStored({
          key,
          data: event.newValue
            ? parseArchiveNotes(event.newValue)
            : emptyArchiveNotes(),
        });
      } catch {
        setError(
          "Annotations changed in another tab but could not be read. Reload before editing.",
        );
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);
  const update = useCallback(
    (fn: (data: ArchiveNotes) => ArchiveNotes) => {
      setStored((current) => {
        if (!current || current.key !== key || current.unreadable)
          return current;
        const data = fn(current.data);
        return { key, data, dirty: true };
      });
    },
    [key],
  );
  useEffect(() => {
    if (stored?.key !== key || !stored.dirty) return;
    try {
      localStorage.setItem(key, JSON.stringify(stored.data));
    } catch {
      setError(
        "Could not save to browser storage. Export your annotations before leaving.",
      );
    }
  }, [stored, key]);
  return {
    notes: stored?.key === key ? stored.data : emptyArchiveNotes(),
    update,
    error,
    ready: stored?.key === key && !stored.unreadable,
  };
}
