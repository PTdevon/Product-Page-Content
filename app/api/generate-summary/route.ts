import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateProductSummary } from "@/lib/generate-summary";
import { getProductWithMetafields } from "@/lib/metafields";

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { productId } = await req.json();
  if (!productId) return NextResponse.json({ error: "productId required" }, { status: 400 });

  const { product, metafields } = await getProductWithMetafields(`gid://shopify/Product/${productId}`);

  const result = await generateProductSummary({
    title: product.title,
    descriptionHtml: product.descriptionHtml,
    productType: metafields.productTypePt,
    productStyle: metafields.productStylePt,
  });

  return NextResponse.json(result);
}
