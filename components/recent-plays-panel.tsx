import { RecentPlaysList } from "@/components/recent-plays-list";
import { ContentPanel, SectionBlock } from "@/components/page-shell";
import type { Stream } from "@/lib/types/stream";
import type { ReactNode } from "react";

export function RecentPlaysPanel({
  title = "Recent plays",
  description,
  streams,
  compact = false,
  limit,
  action,
}: {
  title?: string;
  description?: string;
  streams: Stream[];
  compact?: boolean;
  limit?: number;
  action?: ReactNode;
}) {
  const visible = typeof limit === "number" ? streams.slice(0, limit) : streams;
  return (
    <SectionBlock title={title} description={description} action={action}>
      <ContentPanel>
        <RecentPlaysList
          compact={compact}
          linkable
          initialStreams={visible.map((stream) => ({
            id: stream.id,
            trackName: stream.trackName,
            artistName: stream.artistName,
            albumName: stream.albumName,
            albumArt: stream.albumArt,
            playedAt: stream.playedAt.toISOString(),
          }))}
        />
      </ContentPanel>
    </SectionBlock>
  );
}
