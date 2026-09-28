"use client";

export function ShowMoreButton({
  shown,
  total,
  onShowMore,
}: {
  shown: number;
  total: number;
  onShowMore: () => void;
}) {
  if (shown >= total) return null;
  return (
    <button
      type="button"
      onClick={onShowMore}
      className="mt-2 min-h-11 w-full border border-border bg-card text-sm text-muted-foreground hover:text-foreground"
    >
      Show more ({shown.toLocaleString()} of {total.toLocaleString()})
    </button>
  );
}
