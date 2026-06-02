import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SignJWT } from "jose";
import type { verifySessionToken as VerifyFn, requireAuth as RequireAuthFn } from "@/lib/auth";
import { NextRequest } from "next/server";

const SECRET = "test-secret-at-least-32-chars-long!!";
const STORE = "test.myshopify.com";
const CLIENT_ID = "test-client-id";

async function makeToken(overrides: {
  iss?: string;
  aud?: string;
  dest?: string;
  exp?: number;
} = {}) {
  const iss = overrides.iss ?? `https://${STORE}/admin`;
  const aud = overrides.aud ?? CLIENT_ID;

  const jwt = new SignJWT({ dest: overrides.dest ?? `https://${STORE}` })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(iss)
    .setAudience(aud)
    .setIssuedAt();

  if (overrides.exp !== undefined) {
    jwt.setExpirationTime(overrides.exp);
  } else {
    jwt.setExpirationTime("1h");
  }

  return jwt.sign(new TextEncoder().encode(SECRET));
}

// The auth module reads env vars at module-load time, so we must
// vi.resetModules() + dynamically import for each test.
let verifySessionToken: typeof VerifyFn;
let requireAuth: typeof RequireAuthFn;

beforeEach(async () => {
  process.env.SHOPIFY_CLIENT_SECRET = SECRET;
  process.env.SHOPIFY_STORE_DOMAIN = STORE;
  process.env.SHOPIFY_CLIENT_ID = CLIENT_ID;
  process.env.NODE_ENV = "test";
  vi.resetModules();
  const mod = await import("@/lib/auth");
  verifySessionToken = mod.verifySessionToken;
  requireAuth = mod.requireAuth;
});

afterEach(() => {
  delete process.env.SHOPIFY_CLIENT_SECRET;
  delete process.env.SHOPIFY_STORE_DOMAIN;
  delete process.env.SHOPIFY_CLIENT_ID;
});

describe("verifySessionToken", () => {
  it("resolves with payload for a valid token", async () => {
    const token = await makeToken();
    const payload = await verifySessionToken(token);
    expect(payload.iss).toBe(`https://${STORE}/admin`);
  });

  it("throws for wrong issuer", async () => {
    const token = await makeToken({ iss: "https://evil.myshopify.com/admin" });
    await expect(verifySessionToken(token)).rejects.toThrow();
  });

  it("throws for wrong audience", async () => {
    const token = await makeToken({ aud: "wrong-client" });
    await expect(verifySessionToken(token)).rejects.toThrow();
  });

  it("throws for invalid destination", async () => {
    const token = await makeToken({ dest: "https://evil.myshopify.com" });
    await expect(verifySessionToken(token)).rejects.toThrow("Invalid destination");
  });

  it("throws for expired token", async () => {
    const token = await makeToken({ exp: Math.floor(Date.now() / 1000) - 60 });
    await expect(verifySessionToken(token)).rejects.toThrow();
  });

  it("throws when SHOPIFY_CLIENT_SECRET is not set", async () => {
    delete process.env.SHOPIFY_CLIENT_SECRET;
    vi.resetModules();
    const { verifySessionToken: freshFn } = await import("@/lib/auth");
    const token = await makeToken();
    await expect(freshFn(token)).rejects.toThrow();
  });
});

describe("requireAuth", () => {
  it("returns null (authorised) in development mode", async () => {
    process.env.NODE_ENV = "development";
    vi.resetModules();
    const { requireAuth: devRequireAuth } = await import("@/lib/auth");
    const req = new NextRequest("http://localhost/api/test");
    const result = await devRequireAuth(req);
    expect(result).toBeNull();
  });

  it("returns 401 when no authorization header", async () => {
    const req = new NextRequest("http://localhost/api/test");
    const result = await requireAuth(req);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 401 when token is invalid", async () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { authorization: "Bearer not-a-valid-jwt" },
    });
    const result = await requireAuth(req);
    expect(result!.status).toBe(401);
  });

  it("returns null (authorised) for a valid token", async () => {
    const token = await makeToken();
    const req = new NextRequest("http://localhost/api/test", {
      headers: { authorization: `Bearer ${token}` },
    });
    const result = await requireAuth(req);
    expect(result).toBeNull();
  });
});
