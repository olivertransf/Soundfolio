export interface Stream {
  id: string;
  userId?: string;
  trackId: string;
  trackName: string;
  artistName: string;
  artistArt: string | null;
  albumName: string;
  albumArt: string | null;
  durationMs: number;
  playedAt: Date;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type StreamInput = Omit<Stream, "id" | "createdAt" | "updatedAt" | "isDemo"> & {
  id?: string;
  isDemo?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export function streamDocumentId(input: {
  id?: string;
  userId?: string;
  trackId: string;
  playedAt: Date;
}) {
  if (input.id) return input.id;
  const owner = input.userId ?? "legacy";
  return `${owner}__${input.trackId}__${input.playedAt.getTime()}`;
}
