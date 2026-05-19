import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

function verifyHmac(searchParams: URLSearchParams): boolean {
  const hmac = searchParams.get("hmac");
  if (!hmac) return false;
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret) return false;

  const params = new URLSearchParams();
  searchParams.forEach((value, key) => { if (key !== "hmac") params.set(key, value); });
  const sortedParams = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const computed = crypto.createHmac("sha256", secret).update(sortedParams).digest("hex");
  if (computed.length !== hmac.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hmac));
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const shop = searchParams.get("shop");
  const state = searchParams.get("state");
  const storedState = req.cookies.get("shopify_oauth_state")?.value;

  if (!code || !shop) return new NextResponse("Missing code or shop", { status: 400 });
  if (!verifyHmac(searchParams)) return new NextResponse("Invalid HMAC", { status: 403 });
  if (state !== storedState) return new NextResponse("Invalid state", { status: 403 });

  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_CLIENT_ID,
      client_secret: process.env.SHOPIFY_CLIENT_SECRET,
      code,
    }),
  });

  if (!tokenRes.ok) {
    return new NextResponse("Token exchange failed", { status: 500 });
  }

  const { access_token } = await tokenRes.json();

  const html = `<!DOCTYPE html><html><head><title>Setup Complete</title>
  <style>body{font-family:system-ui,sans-serif;max-width:600px;margin:60px auto;padding:0 20px}
  h1{font-size:1.4rem}.box{background:#f3f4f6;border:1px solid #d1d5db;border-radius:8px;padding:16px;margin:16px 0}
  code{font-family:monospace;font-size:.9rem;word-break:break-all}
  .step{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin-top:20px}
  .step p{margin:4px 0;font-size:.9rem}</style></head>
  <body><h1>Shopify connected</h1>
  <p>Add these to <code>.env.local</code>:</p>
  <div class="box">
    <p><strong>SHOPIFY_STORE_DOMAIN=</strong><code>${shop}</code></p>
    <p style="margin-top:8px"><strong>SHOPIFY_ACCESS_TOKEN=</strong><code>${access_token}</code></p>
  </div>
  <div class="step"><p><strong>Next steps:</strong></p>
    <p>1. Update <code>.env.local</code> with the values above</p>
    <p>2. Restart <code>npm run dev</code></p>
  </div></body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}
