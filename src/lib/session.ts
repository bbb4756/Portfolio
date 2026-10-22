import crypto from "node:crypto";
import { cookies } from "next/headers";

export type AdminSession = { login: string; githubUserId?: number; token: string; preview?: boolean; expiresAt?: number };

const SESSION_COOKIE = "portfolio_admin_session";
const OAUTH_COOKIE = "portfolio_oauth_state";

export function isLocalPreview() {
  return process.env.NODE_ENV !== "production" && process.env.CMS_LOCAL_PREVIEW === "true";
}

function key() {
  const secret = process.env.CMS_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("CMS_SESSION_SECRET must contain at least 32 characters");
  return crypto.createHash("sha256").update(secret).digest();
}

function seal(value: unknown) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function unseal<T>(value?: string): T | null {
  if (!value) return null;
  try {
    const input = Buffer.from(value, "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), input.subarray(0, 12));
    decipher.setAuthTag(input.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(input.subarray(28)), decipher.final()]).toString("utf8")) as T;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  if (isLocalPreview()) return { login: "local-preview", token: "", preview: true };
  const store = await cookies();
  const session = unseal<AdminSession>(store.get(SESSION_COOKIE)?.value);
  if (!session?.expiresAt || session.expiresAt <= Date.now()) return null;
  return session;
}

export async function setAdminSession(session: AdminSession) {
  const store = await cookies();
  store.set(SESSION_COOKIE, seal({ ...session, expiresAt: Date.now() + 60 * 60 * 8 * 1000 }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function setOauthState(value: { state: string; verifier: string }) {
  const store = await cookies();
  store.set(OAUTH_COOKIE, seal({ ...value, expiresAt: Date.now() + 10 * 60 * 1000 }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}

export async function consumeOauthState() {
  const store = await cookies();
  const value = unseal<{ state: string; verifier: string; expiresAt: number }>(store.get(OAUTH_COOKIE)?.value);
  store.delete(OAUTH_COOKIE);
  return value?.expiresAt && value.expiresAt > Date.now() ? value : null;
}
