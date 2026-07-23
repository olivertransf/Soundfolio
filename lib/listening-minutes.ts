/** Whole minutes from accumulated listen duration (matches JS Math.round). */
export function minutesFromMs(ms: number): number {
  return Math.round(ms / 60_000);
}

/** Whole hours from accumulated listen duration (matches JS Math.round). */
export function hoursFromMs(ms: number): number {
  return Math.round(ms / 3_600_000);
}
