"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface AlbumArtProps {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}

const PLACEHOLDER_HASH = "2a96cbd8b46e442fc41c2b86b821562f";

function fillsParent(className?: string) {
  return /(?:^|\s)(?:size-full|h-full|w-full)(?:\s|$)/.test(className ?? "");
}

export function AlbumArt({ src, alt, width = 40, height = 40, className }: AlbumArtProps) {
  const [error, setError] = useState(false);
  const isPlaceholder = src?.includes(PLACEHOLDER_HASH);
  const fill = fillsParent(className);

  if (!src || error || isPlaceholder) {
    return (
      <div
        data-art
        className={cn("flex shrink-0 items-center justify-center bg-secondary", className)}
        style={fill ? undefined : { width, height }}
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
      className={cn(fill && "h-full w-full object-cover", className)}
      unoptimized
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
    />
  );
}
