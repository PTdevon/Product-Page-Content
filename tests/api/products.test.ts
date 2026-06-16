import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/shopify", () => ({ shopifyGraphQL: vi.fn() }));
vi.mock("@/lib/hidden-products", () => ({ getHiddenProductIds: vi.fn().mockResolvedValue(new Set()) }));

import { GET } from "@/app/api/products/route";
import { shopifyGraphQL } from "@/lib/shopify";
import { requireAuth } from "@/lib/auth";

type EdgeOverrides = {
  id?: string; title?: string; handle?: string; tags?: string[];
  productTypePt?: string | null; productStylePt?: string | null;
  productSummary?: string | null; wctBullet1?: string | null; pfBullet1?: string | null;
  seasonalMD?: string | null; seasonalFD?: string | null; seasonalVD?: string | null;
  cursor?: string;
};

function makeEdge(overrides: EdgeOverrides = {}) {
  const mf = (v: string | null | undefined) => (v != null ? { value: v } : null);
  // Use 'in' to respect explicit null (null ?? default would coerce null to default)
  return {
    node: {
      id: overrides.id ?? "gid://shopify/Product/1",
      title: overrides.title ?? "Test Product",
      handle: overrides.handle ?? "test-product",
      tags: overrides.tags ?? [],
      featuredImage: null,
      productTypePt: mf("productTypePt" in overrides ? overrides.productTypePt : "Home"),
      productStylePt: mf("productStylePt" in overrides ? overrides.productStylePt : "Minimal"),
      productSummary: mf("productSummary" in overrides ? overrides.productSummary : "A nice product"),
      wctBullet1: mf("wctBullet1" in overrides ? overrides.wctBullet1 : "<strong>Bold</strong> claim"),
      pfBullet1: mf("pfBullet1" in overrides ? overrides.pfBullet1 : "Perfect for gifting"),
      seasonalMD: mf("seasonalMD" in overrides ? overrides.seasonalMD : null),
      seasonalFD: mf("seasonalFD" in overrides ? overrides.seasonalFD : null),
      seasonalVD: mf("seasonalVD" in overrides ? overrides.seasonalVD : null),
    },
    cursor: overrides.cursor ?? "cursor1",
  };
}

function shopifyPage(edges: ReturnType<typeof makeEdge>[], hasNextPage = false) {
  return { products: { edges, pageInfo: { hasNextPage } } };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(null);
});

describe("GET /api/products", () => {
  it("returns products with computed statuses and nextCursor", async () => {
    vi.mocked(shopifyGraphQL).mockResolvedValue(shopifyPage([makeEdge()]));
    const req = new NextRequest("http://localhost/api/products?limit=10");
    const res = await GET(req);
    const body = await res.json();
    expect(body.products).toHaveLength(1);
    expect(body.products[0].classifyStatus).toBe("complete");
    expect(body.products[0].contentStatus).toBe("complete");
  });

  it("nextCursor is the last product cursor when page is full", async () => {
    const edges = Array.from({ length: 2 }, (_, i) => makeEdge({ cursor: `cur${i}` }));
    vi.mocked(shopifyGraphQL).mockResolvedValue(shopifyPage(edges));
    const req = new NextRequest("http://localhost/api/products?limit=2");
    const res = await GET(req);
    const body = await res.json();
    expect(body.nextCursor).toBe("cur1");
  });

  it("nextCursor is null when fewer than PAGE_SIZE results", async () => {
    vi.mocked(shopifyGraphQL).mockResolvedValue(shopifyPage([makeEdge()]));
    const req = new NextRequest("http://localhost/api/products?limit=10");
    const res = await GET(req);
    const body = await res.json();
    expect(body.nextCursor).toBeNull();
  });

  it("filters out products tagged hidden", async () => {
    vi.mocked(shopifyGraphQL).mockResolvedValue(shopifyPage([makeEdge({ tags: ["hidden"] })]));
    const req = new NextRequest("http://localhost/api/products?limit=10");
    const res = await GET(req);
    const body = await res.json();
    expect(body.products).toHaveLength(0);
  });

  it("filters out products tagged christmas", async () => {
    vi.mocked(shopifyGraphQL).mockResolvedValue(shopifyPage([makeEdge({ tags: ["christmas"] })]));
    const req = new NextRequest("http://localhost/api/products?limit=10");
    const res = await GET(req);
    const body = await res.json();
    expect(body.products).toHaveLength(0);
  });

  it("status=needs-classify excludes fully classified products", async () => {
    vi.mocked(shopifyGraphQL).mockResolvedValue(shopifyPage([
      // classified complete — should be EXCLUDED from needs-classify
      makeEdge({ id: "gid://shopify/Product/1", cursor: "c1" }),
      // classification missing — should be INCLUDED
      makeEdge({ id: "gid://shopify/Product/2", productTypePt: null, productStylePt: null, productSummary: null, wctBullet1: null, pfBullet1: null, cursor: "c2" }),
    ]));
    const req = new NextRequest("http://localhost/api/products?status=needs-classify&limit=10");
    const res = await GET(req);
    const body = await res.json();
    expect(body.products).toHaveLength(1);
    expect(body.products[0].classifyStatus).not.toBe("complete");
  });

  it("status=ready-to-populate returns classified but content-incomplete products", async () => {
    vi.mocked(shopifyGraphQL).mockResolvedValue(shopifyPage([
      // type+style set (classified), but no content
      makeEdge({ id: "gid://shopify/Product/1", productSummary: null, wctBullet1: null, pfBullet1: null, cursor: "c1" }),
    ]));
    const req = new NextRequest("http://localhost/api/products?status=ready-to-populate&limit=10");
    const res = await GET(req);
    const body = await res.json();
    expect(body.products).toHaveLength(1);
    expect(body.products[0].classifyStatus).toBe("complete");
    expect(body.products[0].contentStatus).not.toBe("complete");
  });

  it("status=complete returns only fully complete products", async () => {
    vi.mocked(shopifyGraphQL).mockResolvedValue(shopifyPage([
      makeEdge({ id: "gid://shopify/Product/1", productSummary: "s", wctBullet1: "w", pfBullet1: "p", cursor: "c1" }),
    ]));
    const req = new NextRequest("http://localhost/api/products?status=complete&limit=10");
    const res = await GET(req);
    const body = await res.json();
    expect(body.products).toHaveLength(1);
    expect(body.products[0].contentStatus).toBe("complete");
  });

  it("bestseller=true passes tag filter to Shopify query", async () => {
    vi.mocked(shopifyGraphQL).mockResolvedValue(shopifyPage([]));
    const req = new NextRequest("http://localhost/api/products?bestseller=true&limit=10");
    await GET(req);
    const calls = vi.mocked(shopifyGraphQL).mock.calls;
    const [, vars] = calls[calls.length - 1];
    expect((vars as Record<string, unknown>).query).toContain("bestseller");
  });

  it("search param passes title filter to Shopify query", async () => {
    vi.mocked(shopifyGraphQL).mockResolvedValue(shopifyPage([]));
    const req = new NextRequest("http://localhost/api/products?search=vase&limit=10");
    await GET(req);
    const calls = vi.mocked(shopifyGraphQL).mock.calls;
    const [, vars] = calls[calls.length - 1];
    expect((vars as Record<string, unknown>).query).toContain("vase");
  });

  it("returns 502 when Shopify throws", async () => {
    vi.mocked(shopifyGraphQL).mockRejectedValue(new Error("Shopify down"));
    const req = new NextRequest("http://localhost/api/products?limit=10");
    const res = await GET(req);
    expect(res.status).toBe(502);
  });

  it("returns 401 when auth fails", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(requireAuth).mockResolvedValueOnce(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const req = new NextRequest("http://localhost/api/products");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
