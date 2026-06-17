import { createRemoteJWKSet, jwtVerify } from "jose";
import { firebasePublicConfig } from "@/lib/firebase/config";

export type VerifiedFirebaseUser = {
  uid: string;
  email: string | null;
};

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
    );
  }
  return jwks;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser> {
  const projectId = firebasePublicConfig.projectId;
  if (!projectId) {
    throw new Error("Firebase project ID is not configured.");
  }

  const { payload } = await jwtVerify(idToken, getJwks(), {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  const uid = payload.sub;
  if (!uid) {
    throw new Error("Invalid Firebase ID token.");
  }

  return {
    uid,
    email: typeof payload.email === "string" ? payload.email : null,
  };
}
