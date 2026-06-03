import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { shopifyGraphQL } from "@/lib/shopify";

const QUERY = `
  query($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        node {
          productTypePt:  metafield(namespace: "product", key: "product_type")  { value }
          productStylePt: metafield(namespace: "product", key: "product_style") { value }
        }
        cursor
      }
      pageInfo { hasNextPage }
    }
  }
`;

type MF = { value: string } | null;
type Row = { productTypePt: MF; productStylePt: MF };
type Result = { products: { edges: { node: Row; cursor: string }[]; pageInfo: { hasNextPage: boolean } } };

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { searchParams } = req.nextUrl;
  const type  = searchParams.get("type")  ?? "";
  const style = searchParams.get("style") ?? "";

  let count = 0;
  let cursor: string | null = null;
  let hasMore = true;

  try {
    while (hasMore) {
      const data = await shopifyGraphQL<Result>(QUERY, { first: 250, after: cursor });
      for (const { node } of data.products.edges) {
        const nodeType  = node.productTypePt?.value  ?? "";
        const nodeStyle = node.productStylePt?.value ?? "";
        if (type && nodeType !== type) continue;
        if (style) {
          const styles = nodeStyle.split(",").map((s) => s.trim());
          if (!styles.includes(style)) continue;
        }
        count++;
      }
      hasMore = data.products.pageInfo.hasNextPage;
      if (hasMore && data.products.edges.length > 0) {
        cursor = data.products.edges[data.products.edges.length - 1].cursor;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ count });
}
