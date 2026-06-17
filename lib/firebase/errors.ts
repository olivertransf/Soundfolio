export function formatFirebaseAdminError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("PERMISSION_DENIED") || message.includes("permission-denied")) {
    return [
      "Firestore permission denied for the Firebase Admin service account.",
      "In Google Cloud IAM, grant the service account from FIREBASE_SERVICE_ACCOUNT_JSON:",
      "Cloud Datastore User and Service Account Token Creator.",
      "Also create the Firestore database in Firebase Console if it does not exist yet.",
    ].join(" ");
  }

  if (message.includes("Firebase Admin is not configured")) {
    return "Server Firebase Admin is not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON on Vercel.";
  }

  return message;
}
