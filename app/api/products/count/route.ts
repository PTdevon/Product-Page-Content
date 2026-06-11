import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { shopifyGraphQL } from "@/lib/shopify";
import { classifyStatus, contentStatus, matchesFilter } from "@/lib/product-filters";

const COUNT_PRODUCTS = `
  query CountProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      edges {
        node {
          tags
          productTypePt: metafield(namespace: "product", key: "product_type") { value }
          productStylePt: metafield(namespace: "product", key: "product_style") { value }
          productSummary: metafield(namespace: "product", key: "product_summary") { value }
          humanReviewed: metafield(namespace: "product", key: "approved") { value }
          wctBullet1: metafield(namespace: "why-choose-this", key: "bullet_1") { value }
          pfBullet1: metafield(namespace: "perfect-for", key: "perfect_bullet_1") { value }
          seasonalMdPhrase: metafield(namespace: "seasonal", key: "mothers_day_phrase")    { value }
          seasonalFdPhrase: metafield(namespace: "seasonal", key: "fathers_day_phrase")    { value }
          seasonalVdPhrase: metafield(namespace: "seasonal", key: "valentines_day_phrase") { value }
        }
        cursor
      }
      pageInfo { hasNextPage }
    }
  }
`;

type MF = { value: string } | null;
type RawNode = { tags: string[]; productTypePt: MF; productStylePt: MF; humanReviewed: MF; productSummary: MF; wctBullet1: MF; pfBullet1: MF; seasonalMdPhrase: MF; seasonalFdPhrase: MF; seasonalVdPhrase: MF };
type CountResult = { products: { edges: { node: RawNode; cursor: string }[]; pageInfo: { hasNextPage: boolean } } };

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { searchParams } = req.nextUrl;
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";
  const typeFilter  = searchParams.get("type")  ?? "";
  const styleFilter = searchParams.get("style") ?? "";

  const bestseller     = searchParams.get("bestseller") === "true";
  const christmas      = searchParams.get("christmas") === "true";
  const reviewedFilter = searchParams.get("reviewed") ?? "";
  const statusFilter   = status;

  const queryParts = ["-status:archived", "-tag:hidden", christmas ? "tag:christmas" : "-tag:christmas"];
  if (search) queryParts.push(`title:*${search}*`);
  if (bestseller) queryParts.push(`tag:*bestseller*`);
  const query = queryParts.join(" AND ");

  let count = 0;
  let cursor: string | null = null;
  let hasMore = true;
  const MAX_ITERATIONS = 10;
  let iterations = 0;

  try {
    while (hasMore && iterations < MAX_ITERATIONS) {
      iterations++;
      const data: CountResult = await shopifyGraphQL<CountResult>(COUNT_PRODUCTS, { first: 250, after: cursor, query });

      for (const edge of data.products.edges) {
        if (edge.node.tags.includes("hidden")) continue;
        const isChristmas = edge.node.tags.some((t: string) => t.toLowerCase() === "christmas");
        if (christmas !== isChristmas) continue;
        const cs        = classifyStatus(edge.node);
        const contentSt = contentStatus(edge.node);
        if (typeFilter && (edge.node.productTypePt?.value ?? "").trim() !== typeFilter.trim()) continue;
        if (styleFilter) {
          const styles = (edge.node.productStylePt?.value ?? "").split(",").map((s: string) => s.trim());
          if (!styles.includes(styleFilter.trim())) continue;
        }
        const isHumanReviewed = (edge.node.humanReviewed?.value ?? "") === "true";
        if (reviewedFilter === "true"  && !isHumanReviewed) continue;
        if (reviewedFilter === "false" && isHumanReviewed) continue;
        if (!statusFilter || matchesFilter(statusFilter, cs, contentSt, !!(typeFilter || styleFilter))) {
          count++;
        }
      }

      hasMore = data.products.pageInfo.hasNextPage;
      if (hasMore && data.products.edges.length > 0) {
        cursor = data.products.edges[data.products.edges.length - 1].cursor;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to count products: ${message}` }, { status: 502 });
  }

  return NextResponse.json({ count });
}
