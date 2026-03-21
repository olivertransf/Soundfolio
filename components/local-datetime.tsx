"use client";

import { format } from "date-fns";
import { useEffect, useState } from "react";

type LocalDateTimeProps = {
  /** Prisma `Date` serializes to ISO when passed from a Server Component */
  date: string | Date;
  pattern: string;
  className?: string;
};

/**
 * Formats an instant in the viewer’s local timezone.
 * Server-rendered `format()` uses the host TZ (often UTC on Vercel), so we format after mount.
 */
export function LocalDateTime({ date, pattern, className }: LocalDateTimeProps) {
  const iso = typeof date === "string" ? date : date.toISOString();
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return;
    setText(format(d, pattern));
  }, [iso, pattern]);

  if (Number.isNaN(new Date(iso).getTime())) return null;

  return (
    <time dateTime={iso} className={className}>
      {text ?? ""}
    </time>
  );
}
