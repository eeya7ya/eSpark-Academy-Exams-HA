import { cookies } from "next/headers";
import { createHash } from "crypto";

const ADMIN_COOKIE = "admin_session";
const STUDENT_COOKIE = "student_session";
const SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours in seconds

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    // Fallback: derive from the admin credential so it works without
    // extra config (set ADMIN_SESSION_SECRET for a dedicated secret)
    const pass =
      process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD_HASH || "";
    return `espark_academy_session_${pass}_secret`;
  }
  return secret;
}

async function sign(payload: string): Promise<string> {
  const secret = getSecret();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload)
  );
  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${payload}.${sigHex}`;
}

async function verify(token: string): Promise<string | null> {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;

  const payload = token.substring(0, lastDot);
  const expected = await sign(payload);

  if (expected.length !== token.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return diff === 0 ? payload : null;
}

async function setSessionCookie(
  name: string,
  data: Record<string, unknown>
): Promise<void> {
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = JSON.stringify({ ...data, exp: expiresAt });
  const token = await sign(payload);

  const cookieStore = await cookies();
  cookieStore.set(name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

async function readSessionCookie(
  name: string
): Promise<Record<string, unknown> | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(name)?.value;
  if (!token) return null;

  const payload = await verify(token);
  if (!payload) return null;

  try {
    const data = JSON.parse(payload);
    if (!data.exp || Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

// ── Admin sessions ──────────────────────────────────────────────────

export async function createAdminSession(): Promise<void> {
  await setSessionCookie(ADMIN_COOKIE, { admin: true });
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}

export async function validateAdminSession(): Promise<boolean> {
  const data = await readSessionCookie(ADMIN_COOKIE);
  return !!data?.admin;
}

export function validateAdminCredentials(
  username: string,
  password: string
): boolean {
  const adminUser = process.env.ADMIN_USERNAME;
  // Preferred: ADMIN_PASSWORD_HASH — SHA-256 hex digest (64 chars) of the
  // password, so the plaintext never appears in environment variables.
  // Fallback: plaintext ADMIN_PASSWORD.
  const adminHash = process.env.ADMIN_PASSWORD_HASH?.trim().toLowerCase();
  const adminPass = process.env.ADMIN_PASSWORD;

  if (!adminUser || (!adminHash && !adminPass)) {
    console.error(
      "ADMIN_USERNAME and ADMIN_PASSWORD_HASH (or ADMIN_PASSWORD) environment variables must be set."
    );
    return false;
  }

  const userMatch =
    username.length === adminUser.length &&
    timingSafeEqual(username, adminUser);

  let passMatch: boolean;
  if (adminHash) {
    const candidate = createHash("sha256").update(password).digest("hex");
    passMatch =
      candidate.length === adminHash.length &&
      timingSafeEqual(candidate, adminHash);
  } else {
    passMatch =
      password.length === adminPass!.length &&
      timingSafeEqual(password, adminPass!);
  }

  return userMatch && passMatch;
}

// ── Student sessions ────────────────────────────────────────────────

export async function createStudentSession(studentId: string): Promise<void> {
  await setSessionCookie(STUDENT_COOKIE, { sid: studentId });
}

export async function destroyStudentSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(STUDENT_COOKIE);
}

export async function getStudentSessionId(): Promise<string | null> {
  const data = await readSessionCookie(STUDENT_COOKIE);
  return typeof data?.sid === "string" ? data.sid : null;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
