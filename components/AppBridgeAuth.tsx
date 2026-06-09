"use client";

import { useEffect } from "react";

const STORAGE_KEY = "app_session_token";

// Holds a promise while the token exchange is in flight, so parallel requests
// wait for the same exchange rather than each firing their own.
let _tokenPromise: Promise<string | null> | null = null;
let _originalFetch: typeof fetch | null = null;

function getStoredToken(): string | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { token, exp } = JSON.parse(raw) as { token: string; exp: number };
    // Treat as expired 5 minutes early to avoid edge cases
    if (Date.now() / 1000 < exp - 300) return token;
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
  return null;
}

async function fetchSessionToken(): Promise<string | null> {
  // Prefer App Bridge 4 CDN global — always returns a fresh, valid token
  let idToken: string | null = null;
  const shopify = (window as { shopify?: { idToken?: () => Promise<string> } }).shopify;
  if (shopify?.idToken) {
    try { idToken = await shopify.idToken(); } catch { /* fall through */ }
  }
  // Fall back to URL parameter (only present on initial load)
  if (!idToken) idToken = new URLSearchParams(window.location.search).get("id_token");
  if (!idToken) return null;

  try {
    // Use the original (unpatched) fetch to avoid recursion
    const res = await (_originalFetch ?? fetch)(
      `/api/auth/session?id_token=${encodeURIComponent(idToken)}`
    );
    if (!res.ok) return null;
    const { token, exp } = await res.json() as { token: string; exp: number };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, exp }));
    return token;
  } catch {
    return null;
  }
}

async function getToken(): Promise<string | null> {
  const stored = getStoredToken();
  if (stored) return stored;

  if (!_tokenPromise) {
    _tokenPromise = fetchSessionToken().finally(() => { _tokenPromise = null; });
  }
  return _tokenPromise;
}

if (typeof window !== "undefined") {
  _originalFetch = window.fetch.bind(window);
  const original = _originalFetch;
  window.fetch = async (input, init) => {
    const url =
      typeof input === "string" ? input
      : input instanceof URL ? input.toString()
      : (input as Request).url;

    if (url.startsWith("/api/")) {
      const token = await getToken();
      if (token) {
        const headers = new Headers(init?.headers);
        headers.set("Authorization", `Bearer ${token}`);
        init = { ...(init ?? {}), headers };
      }
    }
    return original(input, init);
  };
}

export default function AppBridgeAuth() {
  useEffect(() => {
    // Kick off token exchange eagerly on mount so it's ready before first API call
    getToken();
    return () => {
      if (_originalFetch) window.fetch = _originalFetch;
    };
  }, []);
  return null;
}
