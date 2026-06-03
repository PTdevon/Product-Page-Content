import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { shopifyGraphQL } from "@/lib/shopify";
import { classifyStatus, contentStatus, matchesFilter } from "@/lib/product-filters";
import type { ProductSummary } from "@/lib/types";

const LIST_PRODUCTS = `
  query ListProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      edges {
        node {
          id
          title
          handle
          tags
          featuredImage { url }
          productTypePt: metafield(namespace: "product", key: "product_type") { value }
          productStylePt: metafield(namespace: "product", key: "product_style") { value }
          productSummary: metafield(namespace: "product", key: "product_summary") { value }
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

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { searchParams } = req.nextUrl;
  const cursor = searchParams.get("cursor") ?? undefined;
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";
  const limitParam = parseInt(searchParams.get("limit") ?? "10", 10);
  const PAGE_SIZE = Math.min(Math.max(limitParam, 1), 100);

  const bestseller = searchParams.get("bestseller") === "true";
  const statusFilter = status;

  const queryParts: string[] = [];
  queryParts.push(`-tag:hidden`);
  queryParts.push(`-tag:christmas`);
  if (search) queryParts.push(`title:*${search}*`);
  if (bestseller) queryParts.push(`tag:*bestseller*`);
  const query = queryParts.join(" AND ");

  type RawEdge = {
    node: {
      id: string; title: string; handle: string; tags: string[];
      featuredImage: { url: string } | null;
      productTypePt: MF; productStylePt: MF;
      productSummary: MF; wctBullet1: MF; pfBullet1: MF;
      seasonalMdPhrase: MF; seasonalFdPhrase: MF; seasonalVdPhrase: MF;
    };
    cursor: string;
  };

  // When filtering by status, Shopify can't filter by metafield value so we loop
  // through pages until we accumulate PAGE_SIZE matching products.
  // Each matched item tracks its cursor so the next request resumes from exactly
  // after the last returned product.
  const matched: Array<{ product: ProductSummary; cursor: string }> = [];
  let scanCursor: string | null = cursor || null;
  let hasMore = true;
  // When filtering, fetch 250 (Shopify's max) per call so we usually only need one round-trip.
  // Cap at 3 iterations to avoid serverless timeout (covers up to 750 products).
  const SHOPIFY_BATCH = statusFilter ? 250 : PAGE_SIZE;
  const MAX_ITERATIONS = statusFilter ? 10 : 1;
  let iterations = 0;

  let shopifyTotal = 0;
  let filteredByTag = 0;

  try {
  while (matched.length < PAGE_SIZE && hasMore && iterations < MAX_ITERATIONS) {
    iterations++;
    const data = await shopifyGraphQL<{
      products: { edges: RawEdge[]; pageInfo: { hasNextPage: boolean } };
    }>(LIST_PRODUCTS, { first: SHOPIFY_BATCH, after: scanCursor, query });

    shopifyTotal += data.products.edges.length;

    for (const edge of data.products.edges) {
      if (matched.length >= PAGE_SIZE) break;
      if (edge.node.tags.includes("hidden")) { filteredByTag++; continue; }
      if (edge.node.tags.some(t => t.toLowerCase() === "christmas")) { filteredByTag++; continue; }
      const cs        = classifyStatus(edge.node);
      const contentSt = contentStatus(edge.node);
      if (!statusFilter || matchesFilter(statusFilter, cs, contentSt)) {
        matched.push({
          product: {
            id: edge.node.id,
            title: edge.node.title,
            handle: edge.node.handle,
            featuredImage: edge.node.featuredImage?.url ?? null,
            productTypePt: edge.node.productTypePt?.value ?? "",
            productStylePt: edge.node.productStylePt?.value ?? "",
            classifyStatus: cs,
            contentStatus: contentSt,
          },
          cursor: edge.cursor,
        });
      }
    }

    hasMore = data.products.pageInfo.hasNextPage;
    if (hasMore && data.products.edges.length > 0) {
      scanCursor = data.products.edges[data.products.edges.length - 1].cursor;
    }
  }

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Failed to fetch products: ${message}` }, { status: 502 });
  }

  const products = matched.map((e) => e.product);
  const nextCursor = matched.length >= PAGE_SIZE ? matched[matched.length - 1].cursor : null;

  const debug = process.env.NODE_ENV === "development"
    ? { shopifyQuery: query, shopifyReturned: shopifyTotal, filteredByTag, matched: products.length }
    : undefined;

  return NextResponse.json({ products, nextCursor, ...(debug ? { _debug: debug } : {}) });
}
