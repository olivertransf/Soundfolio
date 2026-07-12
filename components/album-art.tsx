"use client";

import { useState } from "react";
import Image from "next/image";

interface AlbumArtProps {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}

const PLACEHOLDER_HASH = "2a96cbd8b46e442fc41c2b86b821562f";

export function AlbumArt({ src, alt, width = 40, height = 40, className }: AlbumArtProps) {
  const [error, setError] = useState(false);
  const isPlaceholder = src?.includes(PLACEHOLDER_HASH);

  if (!src || error || isPlaceholder) {
    return (
      <div
        data-art
        className={`bg-secondary shrink-0 flex items-center justify-center ${className ?? ""}`}
        style={{ width, height }}
      />
    );
  }

  return (
    <Image
      data-art
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      unoptimized
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
    />
  );
}
