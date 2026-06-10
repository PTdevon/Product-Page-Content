import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { collectSSE } from "./helpers";

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/metafields", () => ({
  getProductWithMetafields: vi.fn(),
  setProductMetafields: vi.fn(),
}));
vi.mock("@/lib/settings-store", () => ({ getSettings: vi.fn() }));
vi.mock("@/lib/generate-summary", () => ({ generateProductSummary: vi.fn() }));
vi.mock("@/lib/icons", () => ({ resolveIconForMetafield: vi.fn((x: string) => x) }));

import { POST } from "@/app/api/bulk-assign/route";
import { getProductWithMetafields, setProductMetafields } from "@/lib/metafields";
import { getSettings } from "@/lib/settings-store";
import { generateProductSummary } from "@/lib/generate-summary";
import { requireAuth } from "@/lib/auth";

const defaultSettings = {
  dateRanges: { mothersDay: null, fathersDay: null, valentinesDay: null },
  interestKeywords: {},
};

function mockProduct(gid: string, type = "Home", style = "Minimal", complete = false) {
  vi.mocked(getProductWithMetafields).mockResolvedValueOnce({
    product: { id: gid, title: `Product ${gid}`, handle: "p", descriptionHtml: "<p>desc</p>", featuredImage: null, price: 0 },
    metafields: {
      productTypePt: type,
      productStylePt: style,
      productSummary: complete ? "summary" : "",
      whyChooseThis: { bullet1: complete ? "b" : "", bullet2: "", bullet3: "", bullet4: "" },
      perfectFor: { bullet1: complete ? "pf" : "", bullet2: "", bullet3: "", bullet4: "", icon1: "", icon2: "", icon3: "", icon4: "" },
      seasonalOverrides: { mothersDay: false, fathersDay: false, valentinesDay: false },
    },
  });
}

beforeEach(() => {
  // Reset Once-queues to prevent bleed-over between tests
  vi.mocked(getProductWithMetafields).mockReset();
  vi.mocked(generateProductSummary).mockReset();
  vi.mocked(requireAuth).mockResolvedValue(null);
  vi.mocked(getSettings).mockResolvedValue(defaultSettings);
  vi.mocked(setProductMetafields).mockResolvedValue(undefined);
  vi.mocked(generateProductSummary).mockResolvedValue({ options: ["A nice product."] });
});

describe("POST /api/bulk-assign", () => {
  it("returns 400 for empty productIds", async () => {
    const req = new NextRequest("http://localhost/api/bulk-assign", {
      method: "POST",
      body: JSON.stringify({ productIds: [] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("streams progress events for each product", async () => {
    mockProduct("gid://shopify/Product/1");
    const req = new NextRequest("http://localhost/api/bulk-assign", {
      method: "POST",
      body: JSON.stringify({ productIds: ["gid://shopify/Product/1"] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const events = await collectSSE(res) as Array<{ type: string; status: string }>;
    const progress = events.filter((e) => e.type === "progress");
    expect(progress).toHaveLength(1);
    expect(progress[0].status).toBe("ok");
  });

  it("skips products with no type/style set", async () => {
    mockProduct("gid://shopify/Product/1", "", "");
    const req = new NextRequest("http://localhost/api/bulk-assign", {
      method: "POST",
      body: JSON.stringify({ productIds: ["gid://shopify/Product/1"] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const events = await collectSSE(res) as Array<{ type: string; status: string }>;
    const progress = events.filter((e) => e.type === "progress");
    expect(progress[0].status).toBe("skipped");
  });

  it("skipComplete=true skips already-complete products", async () => {
    mockProduct("gid://shopify/Product/1", "Home", "Minimal", true);
    const req = new NextRequest("http://localhost/api/bulk-assign", {
      method: "POST",
      body: JSON.stringify({ productIds: ["gid://shopify/Product/1"], skipComplete: true }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const events = await collectSSE(res) as Array<{ type: string; status: string }>;
    const progress = events.filter((e) => e.type === "progress");
    expect(progress[0].status).toBe("skipped");
  });

  it("credits_exhausted error sets fatalError and skips subsequent products", async () => {
    mockProduct("gid://shopify/Product/1");
    mockProduct("gid://shopify/Product/2");
    vi.mocked(generateProductSummary)
      .mockResolvedValueOnce({ error: { type: "credits_exhausted", message: "No credits" } })
      .mockResolvedValueOnce({ options: ["Summary"] });
    const req = new NextRequest("http://localhost/api/bulk-assign", {
      method: "POST",
      body: JSON.stringify({ productIds: ["gid://shopify/Product/1", "gid://shopify/Product/2"] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const events = await collectSSE(res) as Array<{ type: string; status: string }>;
    const progress = events.filter((e) => e.type === "progress");
    // Second product should be skipped due to fatal error
    expect(progress[1].status).toBe("skipped");
  });

  it("done event includes correct totals", async () => {
    mockProduct("gid://shopify/Product/1");
    mockProduct("gid://shopify/Product/2", "", "");
    const req = new NextRequest("http://localhost/api/bulk-assign", {
      method: "POST",
      body: JSON.stringify({ productIds: ["gid://shopify/Product/1", "gid://shopify/Product/2"] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const events = await collectSSE(res) as Array<{ type: string; succeeded?: number; skipped?: number; failed?: number }>;
    const done = events.find((e) => e.type === "done")!;
    expect(done.succeeded).toBe(1);
    expect(done.skipped).toBe(1);
    expect(done.failed).toBe(0);
  });

  it("returns 401 when auth fails", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(requireAuth).mockResolvedValueOnce(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const req = new NextRequest("http://localhost/api/bulk-assign", {
      method: "POST",
      body: JSON.stringify({ productIds: ["gid://shopify/Product/1"] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
