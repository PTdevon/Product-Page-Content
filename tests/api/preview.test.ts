import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/metafields", () => ({ getProductWithMetafields: vi.fn() }));
vi.mock("@/lib/settings-store", () => ({ getSettings: vi.fn() }));

import { POST } from "@/app/api/preview/route";
import { getProductWithMetafields } from "@/lib/metafields";
import { getSettings } from "@/lib/settings-store";
import { requireAuth } from "@/lib/auth";

const defaultSettings = {
  dateRanges: { mothersDay: null, fathersDay: null, valentinesDay: null },
  interestKeywords: {},
};

beforeEach(() => {
  vi.mocked(requireAuth).mockResolvedValue(null);
  vi.mocked(getSettings).mockResolvedValue(defaultSettings);
  vi.mocked(getProductWithMetafields).mockResolvedValue({
    product: { id: "gid://shopify/Product/1", title: "Vase", handle: "vase", descriptionHtml: "<p>Nice vase</p>", featuredImage: null },
    metafields: {
      productTypePt: "Home", productStylePt: "Minimal", productSummary: "",
      whyChooseThis: { bullet1: "", bullet2: "", bullet3: "", bullet4: "" },
      perfectFor: { bullet1: "", bullet2: "", bullet3: "", bullet4: "", icon1: "", icon2: "", icon3: "", icon4: "" },
      seasonalOverrides: { mothersDay: false, fathersDay: false, valentinesDay: false },
    },
  });
});

describe("POST /api/preview", () => {
  it("returns whyChooseThis, perfectFor, wctHasAlternatives, wctSlotCounts, pfSwapCount", async () => {
    const req = new NextRequest("http://localhost/api/preview", {
      method: "POST",
      body: JSON.stringify({ productType: "Home", productStyles: ["Minimal"] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body).toHaveProperty("whyChooseThis");
    expect(body).toHaveProperty("perfectFor");
    expect(body).toHaveProperty("wctHasAlternatives");
    expect(body).toHaveProperty("wctSlotCounts");
    expect(body).toHaveProperty("pfSwapCount");
  });

  it("accepts productStyles as a single string", async () => {
    const req = new NextRequest("http://localhost/api/preview", {
      method: "POST",
      body: JSON.stringify({ productType: "Home", productStyles: "Minimal" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("works without a productId (skips metafields fetch)", async () => {
    const req = new NextRequest("http://localhost/api/preview", {
      method: "POST",
      body: JSON.stringify({ productType: "Home", productStyles: ["Minimal"] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    // getProductWithMetafields should not be called without a productId
    expect(getProductWithMetafields).not.toHaveBeenCalled();
  });

  it("fetches product data when productId is provided", async () => {
    const req = new NextRequest("http://localhost/api/preview", {
      method: "POST",
      body: JSON.stringify({ productId: "123", productType: "Home", productStyles: ["Minimal"] }),
      headers: { "content-type": "application/json" },
    });
    await POST(req);
    expect(getProductWithMetafields).toHaveBeenCalled();
  });

  it("still returns preview even if metafields fetch throws", async () => {
    vi.mocked(getProductWithMetafields).mockRejectedValueOnce(new Error("Not found"));
    const req = new NextRequest("http://localhost/api/preview", {
      method: "POST",
      body: JSON.stringify({ productId: "999", productType: "Home", productStyles: ["Minimal"] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("returns 401 when auth fails", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(requireAuth).mockResolvedValueOnce(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const req = new NextRequest("http://localhost/api/preview", {
      method: "POST",
      body: JSON.stringify({ productType: "Home", productStyles: ["Minimal"] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
