import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = process.env.SHOPIFY_CLIENT_SECRET ?? "";
const DOMAIN = process.env.SHOPIFY_STORE_DOMAIN ?? "";
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID ?? "";

async function verifyShopifyToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(SECRET), {
      algorithms: ["HS256"], clockTolerance: 30,
    });
    const aud = payload.aud;
    return (
      payload.iss === `https://${DOMAIN}/admin` &&
      (aud === CLIENT_ID || (Array.isArray(aud) && aud.includes(CLIENT_ID)))
    );
  } catch { return false; }
}

async function verifyServerToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(SECRET), {
      algorithms: ["HS256"], issuer: "pt-pdp-app",
    });
    return !!payload.sub;
  } catch { return false; }
}

export async function requireAuth(req: NextRequest): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === "development") return null;

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token) {
    if (await verifyServerToken(token)) return null;
    if (await verifyShopifyToken(token)) return null;
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
