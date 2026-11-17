export function formatListenAmount(minutes: number) {
  if (minutes < 90) return `${minutes.toLocaleString()} minutes`;
  const hours = Math.round(minutes / 60);
  return `${hours.toLocaleString()} ${hours === 1 ? "hour" : "hours"}`;
}

export function scopeResultLine({
  minutes,
  scope,
  when,
  leader,
}: {
  minutes: number;
  scope: string;
  when?: string | null;
  leader?: string | null;
}) {
  const timing = when ? `, ${when}` : "";
  const who = leader ? `, led by ${leader}` : "";
  return `${formatListenAmount(minutes)} ${scope}${timing}${who}.`;
}

export function ResultLine({ children }: { children: string }) {
  return (
    <p className="text-base font-medium tracking-tight text-pretty sm:text-lg">
      {children}
    </p>
  );
}
