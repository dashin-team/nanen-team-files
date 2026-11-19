import { createHash, timingSafeEqual } from "node:crypto";

export const COOKIE_NAME = "team_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

type SessionPayload = { exp: number; v: 1 };

export function getTeamPassword(): string | null {
  const value = process.env.TEAM_PASSWORD;
  if (!value || !value.trim()) return null;
  return value;
}

export function getSessionSecret(): string {
  const dedicated = process.env.SESSION_SECRET?.trim();
  if (dedicated) {
    if (dedicated.length < 16) {
      throw new Error("SESSION_SECRET 至少需要 16 個字元。");
    }
    return dedicated;
  }
  const password = getTeamPassword();
  if (!password) throw new Error("TEAM_PASSWORD 尚未設定。");
  return `team-session-v1:${password}`;
}

export function passwordsMatch(input: string, expected: string): boolean {
  const left = createHash("sha256").update(input, "utf8").digest();
  const right = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(left, right);
}

function bytesToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function timingSafeEqualHex(left: string, right: string): boolean {
  const leftBytes = hexToBytes(left);
  const rightBytes = hexToBytes(right);
  if (!leftBytes || !rightBytes || leftBytes.length !== rightBytes.length) return false;
  let diff = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    diff |= leftBytes[index]! ^ rightBytes[index]!;
  }
  return diff === 0;
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return bytesToHex(signature);
}

function encodePayload(payload: SessionPayload): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decodePayload(value: string): SessionPayload | null {
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as SessionPayload;
    if (parsed?.v !== 1 || typeof parsed.exp !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function signSession(secret: string, expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000): Promise<string> {
  const payload = encodePayload({ exp: expiresAt, v: 1 });
  const signature = await hmac(secret, payload);
  return `${payload}.${signature}`;
}

export async function verifySession(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = await hmac(secret, payload);
  if (!timingSafeEqualHex(signature, expected)) return false;
  const parsed = decodePayload(payload);
  if (!parsed) return false;
  return parsed.exp > Date.now();
}

const failures = new Map<string, { count: number; reset: number }>();

export function loginBlocked(ip: string, now = Date.now()): boolean {
  const entry = failures.get(ip);
  if (!entry || entry.reset < now) return false;
  return entry.count >= 10;
}

export function recordLoginFailure(ip: string, now = Date.now()): void {
  const entry = failures.get(ip);
  if (!entry || entry.reset < now) {
    failures.set(ip, { count: 1, reset: now + 15 * 60 * 1000 });
    return;
  }
  entry.count += 1;
}

export function clearLoginFailures(ip: string): void {
  failures.delete(ip);
}

export function resetLoginFailuresForTests(): void {
  failures.clear();
}
