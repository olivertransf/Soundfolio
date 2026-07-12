"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface ArtistArtProps {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}

const PLACEHOLDER_HASH = "2a96cbd8b46e442fc41c2b86b821562f";

export function ArtistArt({ src, alt, width = 44, height = 44, className }: ArtistArtProps) {
  const [error, setError] = useState(false);
  const isPlaceholder = src?.includes(PLACEHOLDER_HASH);
  const size = Math.min(width, height);

  if (!src || error || isPlaceholder) {
    const letter = (alt?.trim()[0] ?? "?").toUpperCase();
    const fontSize = Math.max(12, Math.floor(size * 0.45));
    return (
      <div
        data-art
        role="img"
        aria-label={alt || "Artist"}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-secondary",
          className
        )}
        style={{ width, height, minWidth: size, minHeight: size }}
      >
        <span className="font-semibold text-muted-foreground" style={{ fontSize }}>
          {letter}
        </span>
      </div>
    );
  }

  return (
    <Image
      data-art
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={cn("shrink-0 rounded-full object-cover", className)}
      style={{ width, height, minWidth: size, minHeight: size }}
      unoptimized
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
    />
  );
}
