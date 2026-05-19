import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { shopifyGraphQL } from "@/lib/shopify";
import type { ProductSummary } from "@/lib/types";

const LIST_PRODUCTS = `
  query ListProducts($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, query: $query) {
      edges {
        node {
          id
          title
          handle
          featuredImage { url }
          productTypePt: metafield(namespace: "product", key: "product_type_pt") { value }
          productStylePt: metafield(namespace: "product", key: "product_style_pt") { value }
          productSummary: metafield(namespace: "product", key: "product_summary") { value }
          wctBullet1: metafield(namespace: "why-choose-this", key: "bullet_1") { value }
          pfBullet1: metafield(namespace: "perfect-for", key: "perfect_bullet_1") { value }
        }
        cursor
      }
      pageInfo { hasNextPage }
    }
  }
`;

function contentStatus(node: { productSummary: { value: string } | null; wctBullet1: { value: string } | null; pfBullet1: { value: string } | null }): ProductSummary["contentStatus"] {
  const summary = node.productSummary?.value ?? "";
  const wct = node.wctBullet1?.value ?? "";
  const pf = node.pfBullet1?.value ?? "";
  if (summary && wct && pf) return "complete";
  if (summary || wct || pf) return "partial";
  return "missing";
}

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { searchParams } = req.nextUrl;
  const cursor = searchParams.get("cursor") ?? undefined;
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";

  const query = search ? `title:*${search}*` : "";

  type MF = { value: string } | null;
  const data = await shopifyGraphQL<{
    products: {
      edges: {
        node: {
          id: string;
          title: string;
          handle: string;
          featuredImage: { url: string } | null;
          productTypePt: MF;
          productStylePt: MF;
          productSummary: MF;
          wctBullet1: MF;
          pfBullet1: MF;
        };
        cursor: string;
      }[];
      pageInfo: { hasNextPage: boolean };
    };
  }>(LIST_PRODUCTS, { first: 50, after: cursor || null, query });

  let products: ProductSummary[] = data.products.edges.map(({ node }) => {
    const cs = contentStatus(node);
    return {
      id: node.id,
      title: node.title,
      handle: node.handle,
      featuredImage: node.featuredImage?.url ?? null,
      productTypePt: node.productTypePt?.value ?? "",
      productStylePt: node.productStylePt?.value ?? "",
      contentStatus: cs,
    };
  });

  if (status === "missing") products = products.filter((p) => p.contentStatus === "missing");
  if (status === "partial") products = products.filter((p) => p.contentStatus === "partial");
  if (status === "complete") products = products.filter((p) => p.contentStatus === "complete");

  const lastEdge = data.products.edges[data.products.edges.length - 1];
  const nextCursor = data.products.pageInfo.hasNextPage ? lastEdge?.cursor ?? null : null;

  return NextResponse.json({ products, nextCursor });
}
