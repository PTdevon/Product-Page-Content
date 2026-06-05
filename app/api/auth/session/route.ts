import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { rateLimit } from "@/lib/rate-limit";

const SECRET = process.env.SHOPIFY_CLIENT_SECRET ?? "";
const DOMAIN = process.env.SHOPIFY_STORE_DOMAIN ?? "";
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID ?? "";
const SESSION_HOURS = 8;

// Exchange a Shopify id_token for a longer-lived server session token.
// This endpoint is intentionally unauthenticated — it IS the auth endpoint.
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { limited, retryAfter } = rateLimit(`auth:${ip}`, 20, 60 * 1000);
  if (limited) {
    return NextResponse.json({ error: "Too Many Requests" }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
  }

  const idToken = req.nextUrl.searchParams.get("id_token");
  if (!idToken) return NextResponse.json({ error: "Missing id_token" }, { status: 400 });
  if (!SECRET) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  try {
    const key = new TextEncoder().encode(SECRET);
    const { payload } = await jwtVerify(idToken, key, {
      algorithms: ["HS256"],
      clockTolerance: 30,
    });

    const issOk = payload.iss === `https://${DOMAIN}/admin`;
    const aud = payload.aud;
    const audOk = aud === CLIENT_ID || (Array.isArray(aud) && aud.includes(CLIENT_ID));

    if (!issOk || !audOk) {
      return NextResponse.json({ error: "Invalid token claims" }, { status: 401 });
    }

    // Issue our own server token valid for SESSION_HOURS
    const serverToken = await new SignJWT({ sub: String(payload.sub) })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer("pt-pdp-app")
      .setIssuedAt()
      .setExpirationTime(`${SESSION_HOURS}h`)
      .sign(key);

    const exp = Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600;
    return NextResponse.json({ token: serverToken, exp });
  } catch (err) {
    console.error("[auth/session] Token verification failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
