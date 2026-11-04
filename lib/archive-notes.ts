export type Memory = {
  id: string;
  target: string;
  title: string;
  text: string;
  tags: string;
  link: string;
};
export type Era = {
  id: string;
  name: string;
  from: string;
  to: string;
  description: string;
  color: string;
  cover: string;
};
export type Work = {
  id: string;
  track: string;
  composer: string;
  work: string;
  performer: string;
};
export type ArchiveNotes = {
  version: 1;
  memories: Memory[];
  eras: Era[];
  queue: string[];
  dismissed: string[];
  elsewhere: string[];
  works: Work[];
  dismissedBoundaries: string[];
};
export function emptyArchiveNotes(): ArchiveNotes {
  return {
    version: 1,
    memories: [],
    eras: [],
    queue: [],
    dismissed: [],
    elsewhere: [],
    works: [],
    dismissedBoundaries: [],
  };
}
export function annotationStorageKey(demo: boolean, uid?: string) {
  return `soundfolio:archive:v1:${demo ? "fictional-demo" : uid ? `account:${uid}` : "local-device"}`;
}
export function downloadArchive(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Reject malformed storage rather than silently replacing someone's writing. */
export function parseArchiveNotes(raw: string): ArchiveNotes {
  const value: unknown = JSON.parse(raw);
  if (
    !value ||
    typeof value !== "object" ||
    !("version" in value) ||
    value.version !== 1
  )
    throw Error("Unsupported archive annotations");
  const n = { ...emptyArchiveNotes(), ...value } as ArchiveNotes;
  const objects: [unknown, string[]][] = [
    [n.memories, ["id", "target", "title", "text", "tags", "link"]],
    [n.eras, ["id", "name", "from", "to", "description", "color", "cover"]],
    [n.works, ["id", "track", "composer", "work", "performer"]],
  ];
  for (const [list, keys] of objects) {
    if (
      !Array.isArray(list) ||
      list.some(
        (item) =>
          !item ||
          typeof item !== "object" ||
          keys.some((key) => typeof item[key] !== "string"),
      )
    )
      throw Error("Malformed archive annotations");
  }
  for (const list of [n.queue, n.dismissed, n.elsewhere, n.dismissedBoundaries])
    if (!Array.isArray(list) || list.some((v) => typeof v !== "string"))
      throw Error("Malformed archive list");
  return n;
}
export function mergeEras(
  notes: ArchiveNotes,
  fromId: string,
  intoId: string,
): ArchiveNotes {
  const a = notes.eras.find((e) => e.id === fromId),
    b = notes.eras.find((e) => e.id === intoId);
  if (!a || !b || a.id === b.id) return notes;
  return {
    ...notes,
    eras: notes.eras
      .filter((e) => e.id !== fromId)
      .map((e) =>
        e.id === intoId
          ? {
              ...e,
              from: [a.from, b.from].sort()[0],
              to: [a.to, b.to].sort().at(-1)!,
              description: [b.description, a.description]
                .filter(Boolean)
                .join("\n\n"),
            }
          : e,
      ),
    memories: notes.memories.map((m) =>
      m.target === `era:${fromId}` ? { ...m, target: `era:${intoId}` } : m,
    ),
  };
}
