// Uses Web Crypto API — works in both Edge runtime (proxy) and Node.js 18+

export const SESSION_COOKIE = "app_session";
export const SESSION_MAX_AGE = 8 * 60 * 60; // 8 hours

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyShopifyHmac(params: URLSearchParams): Promise<boolean> {
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  const hmac = params.get("hmac");
  if (!hmac || !secret) return false;
  const msg = [...params.entries()]
    .filter(([k]) => k !== "hmac")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  try {
    const key = await hmacKey(secret);
    const sig = await globalThis.crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
    return constantTimeEqual(toHex(sig), hmac);
  } catch {
    return false;
  }
}

export async function generateSessionCookie(): Promise<string> {
  const secret = process.env.SHOPIFY_CLIENT_SECRET ?? "";
  const raw = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const token = toHex(raw.buffer);
  const key = await hmacKey(secret);
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token));
  return `${token}.${toHex(sig)}`;
}

export async function verifySessionCookie(cookie: string): Promise<boolean> {
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret) return false;
  const dot = cookie.lastIndexOf(".");
  if (dot < 0) return false;
  const token = cookie.slice(0, dot);
  const sig = cookie.slice(dot + 1);
  try {
    const key = await hmacKey(secret);
    const expected = await globalThis.crypto.subtle.sign("HMAC", key, new TextEncoder().encode(token));
    return constantTimeEqual(toHex(expected), sig);
  } catch {
    return false;
  }
}
