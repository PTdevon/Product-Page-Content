import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProductWithMetafields } from "@/lib/metafields";
import { generateProductSummary } from "@/lib/generate-summary";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  let body: { productId: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const { productId } = body;

  const productGid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId}`;

  let product: Awaited<ReturnType<typeof getProductWithMetafields>>["product"];
  let metafields: Awaited<ReturnType<typeof getProductWithMetafields>>["metafields"];
  try {
    const result = await getProductWithMetafields(productGid);
    product = result.product;
    metafields = result.metafields;
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load product" }, { status: 502 });
  }

  const type = metafields.productTypePt ?? "";
  const styles = metafields.productStylePt
    ? metafields.productStylePt.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const result = await generateProductSummary({
    title: product.title,
    descriptionHtml: product.descriptionHtml,
    productType: type,
    productStyle: styles.join(", "),
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }

  return NextResponse.json({ options: result.options });
}
