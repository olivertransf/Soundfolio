export function firestoreErrorCode(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

export function isFirestoreQuotaError(error: unknown): boolean {
  return firestoreErrorCode(error) === "resource-exhausted";
}

export function firestoreErrorMessage(error: unknown, fallback: string): string {
  if (isFirestoreQuotaError(error)) {
    return "Firestore read quota exceeded for today. Stats will use cached data until the quota resets, or upgrade your Firebase plan.";
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
