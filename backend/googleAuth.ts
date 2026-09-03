import { OAuth2Client } from "google-auth-library";
import type { User } from "@shared/schema";
import type { IStorage } from "./storage";

export function isGoogleAuthConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID?.trim();
}

export function getGoogleClientId(): string | null {
  return process.env.GOOGLE_CLIENT_ID?.trim() || null;
}

export type GoogleProfile = {
  googleId: string;
  email: string;
  emailVerified: boolean;
  fullName: string | null;
};

export async function verifyGoogleCredential(
  credential: string,
): Promise<GoogleProfile> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error("GOOGLE_NOT_CONFIGURED");
  }

  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: clientId,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error("INVALID_GOOGLE_TOKEN");
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    emailVerified: payload.email_verified === true,
    fullName: payload.name?.trim() || null,
  };
}

export async function resolveGoogleUsername(
  email: string,
  storage: IStorage,
): Promise<string> {
  let base = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24);

  if (base.length < 8) {
    base = `${base || "user"}_google`.slice(0, 24);
    while (base.length < 8) base += "0";
  }

  let candidate = base;
  let suffix = 0;
  while (await storage.checkUsernameExists(candidate)) {
    suffix += 1;
    candidate = `${base.slice(0, 20)}_${suffix}`;
  }
  return candidate;
}

export async function findOrCreateGoogleUser(
  storage: IStorage,
  profile: GoogleProfile,
): Promise<{ user: User; isNew: boolean }> {
  const byGoogle = await storage.getUserByGoogleId(profile.googleId);
  if (byGoogle) {
    return { user: byGoogle, isNew: false };
  }

  const byEmail = profile.email
    ? await storage.getUserByEmail(profile.email)
    : undefined;

  if (byEmail) {
    if (byEmail.googleId && byEmail.googleId !== profile.googleId) {
      throw new Error("EMAIL_LINKED_OTHER_GOOGLE");
    }
    if (!profile.emailVerified) {
      throw new Error("EMAIL_NOT_VERIFIED");
    }

    const updated = await storage.updateUser(byEmail.id, {
      googleId: profile.googleId,
      fullName: byEmail.fullName || profile.fullName,
    });
    if (!updated) {
      throw new Error("USER_UPDATE_FAILED");
    }
    return { user: updated, isNew: false };
  }

  if (!profile.emailVerified) {
    throw new Error("EMAIL_NOT_VERIFIED");
  }

  const username = await resolveGoogleUsername(profile.email, storage);
  const newUser = await storage.createUser({
    username,
    email: profile.email,
    fullName: profile.fullName,
    phone: null,
    password: null,
    googleId: profile.googleId,
    role: "user",
    avatarUrl: null,
  });

  return { user: newUser, isNew: true };
}
