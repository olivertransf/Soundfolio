"use client";

import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";

type LocalDateTimeProps = {
  /** Dates serialize to ISO strings when passed from a Server Component. */
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
  const parsed = useMemo(() => new Date(iso), [iso]);

  useEffect(() => {
    if (Number.isNaN(parsed.getTime())) return;
    setText(format(parsed, pattern));
  }, [parsed, pattern]);

  if (Number.isNaN(parsed.getTime())) return null;

  const fallback = format(parsed, pattern);

  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {text ?? fallback}
    </time>
  );
}
