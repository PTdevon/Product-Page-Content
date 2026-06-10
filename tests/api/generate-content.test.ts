import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/metafields", () => ({ getProductWithMetafields: vi.fn() }));
vi.mock("@/lib/settings-store", () => ({ getSettings: vi.fn() }));
vi.mock("@/lib/generate-summary", () => ({ generateProductSummary: vi.fn() }));
vi.mock("@/lib/icons", () => ({ resolveIconForMetafield: vi.fn((x: string) => x) }));

import { POST } from "@/app/api/generate-content/route";
import { getProductWithMetafields } from "@/lib/metafields";
import { getSettings } from "@/lib/settings-store";
import { generateProductSummary } from "@/lib/generate-summary";
import { requireAuth } from "@/lib/auth";

const defaultSettings = {
  dateRanges: { mothersDay: null, fathersDay: null, valentinesDay: null },
  interestKeywords: {},
};

function mockProduct(type = "Home", style = "Minimal") {
  vi.mocked(getProductWithMetafields).mockResolvedValue({
    product: { id: "gid://shopify/Product/1", title: "Vase", handle: "vase", descriptionHtml: "<p>Nice</p>", featuredImage: null, price: 0 },
    metafields: {
      productTypePt: type,
      productStylePt: style,
      productSummary: "",
      whyChooseThis: { bullet1: "", bullet2: "", bullet3: "", bullet4: "" },
      perfectFor: { bullet1: "", bullet2: "", bullet3: "", bullet4: "", icon1: "", icon2: "", icon3: "", icon4: "" },
      seasonalOverrides: { mothersDay: false, fathersDay: false, valentinesDay: false },
    },
  });
}

beforeEach(() => {
  vi.mocked(requireAuth).mockResolvedValue(null);
  vi.mocked(getSettings).mockResolvedValue(defaultSettings);
  vi.mocked(generateProductSummary).mockResolvedValue({ options: ["A beautiful vase."] });
  mockProduct();
});

describe("POST /api/generate-content", () => {
  it("returns summary, wctBullets, pfBullets, pfIcons", async () => {
    const req = new NextRequest("http://localhost/api/generate-content", {
      method: "POST",
      body: JSON.stringify({ productId: "gid://shopify/Product/1" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body).toHaveProperty("summary");
    expect(body).toHaveProperty("wctBullets");
    expect(body).toHaveProperty("pfBullets");
    expect(body).toHaveProperty("pfIcons");
    expect(body.wctBullets).toHaveLength(4);
    expect(body.pfBullets).toHaveLength(4);
    expect(body.pfIcons).toHaveLength(4);
  });

  it("returns 400 when product has no type", async () => {
    mockProduct("", "Minimal");
    const req = new NextRequest("http://localhost/api/generate-content", {
      method: "POST",
      body: JSON.stringify({ productId: "gid://shopify/Product/1" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when product has no style", async () => {
    mockProduct("Home", "");
    const req = new NextRequest("http://localhost/api/generate-content", {
      method: "POST",
      body: JSON.stringify({ productId: "gid://shopify/Product/1" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 422 when summary generation fails", async () => {
    vi.mocked(generateProductSummary).mockResolvedValueOnce({
      error: { type: "rate_limited", message: "Too many requests" },
    });
    const req = new NextRequest("http://localhost/api/generate-content", {
      method: "POST",
      body: JSON.stringify({ productId: "gid://shopify/Product/1" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it("uses the first summary option as the summary", async () => {
    vi.mocked(generateProductSummary).mockResolvedValueOnce({ options: ["First option", "Second option"] });
    const req = new NextRequest("http://localhost/api/generate-content", {
      method: "POST",
      body: JSON.stringify({ productId: "gid://shopify/Product/1" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.summary).toBe("First option");
  });

  it("returns 401 when auth fails", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(requireAuth).mockResolvedValueOnce(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const req = new NextRequest("http://localhost/api/generate-content", {
      method: "POST",
      body: JSON.stringify({ productId: "gid://shopify/Product/1" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
