import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/metafields", () => ({ setProductMetafields: vi.fn() }));

import { POST } from "@/app/api/bulk-content-save/route";
import { setProductMetafields } from "@/lib/metafields";
import { requireAuth } from "@/lib/auth";

const sampleRow = {
  productId: "gid://shopify/Product/1",
  summary: "A nice vase.",
  wctBullets: ["b1", "b2", "b3", "b4"] as [string, string, string, string],
  pfBullets: ["pf1", "pf2", "pf3", "pf4"] as [string, string, string, string],
  pfIcons: ["home", "heart", "star", "baby"] as [string, string, string, string],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(null);
  vi.mocked(setProductMetafields).mockResolvedValue(undefined);
});

describe("POST /api/bulk-content-save", () => {
  it("saves rows and returns saved/failed counts", async () => {
    const req = new NextRequest("http://localhost/api/bulk-content-save", {
      method: "POST",
      body: JSON.stringify({ rows: [sampleRow] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.saved).toBe(1);
    expect(body.failed).toBe(0);
    expect(setProductMetafields).toHaveBeenCalledWith(sampleRow.productId, expect.objectContaining({
      productSummary: sampleRow.summary,
    }));
  });

  it("only passes optional fields when defined in the row", async () => {
    const rowWithOptionals = {
      ...sampleRow,
      productTypePt: "Home",
      productStylePt: "Minimal",
      seasonalOverrides: { mothersDay: true, fathersDay: false, valentinesDay: false },
    };
    const req = new NextRequest("http://localhost/api/bulk-content-save", {
      method: "POST",
      body: JSON.stringify({ rows: [rowWithOptionals] }),
      headers: { "content-type": "application/json" },
    });
    await POST(req);
    const callArgs = vi.mocked(setProductMetafields).mock.calls[0][1];
    expect(callArgs).toHaveProperty("productTypePt", "Home");
    expect(callArgs).toHaveProperty("seasonalOverrides");
  });

  it("does not include optional fields when undefined", async () => {
    const req = new NextRequest("http://localhost/api/bulk-content-save", {
      method: "POST",
      body: JSON.stringify({ rows: [sampleRow] }),
      headers: { "content-type": "application/json" },
    });
    await POST(req);
    const callArgs = vi.mocked(setProductMetafields).mock.calls[0][1];
    expect(callArgs).not.toHaveProperty("productTypePt");
    expect(callArgs).not.toHaveProperty("seasonalOverrides");
  });

  it("counts failed when setProductMetafields throws", async () => {
    vi.mocked(setProductMetafields).mockRejectedValueOnce(new Error("Shopify error"));
    const req = new NextRequest("http://localhost/api/bulk-content-save", {
      method: "POST",
      body: JSON.stringify({ rows: [sampleRow] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.failed).toBe(1);
    expect(body.saved).toBe(0);
  });

  it("returns 401 when auth fails", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(requireAuth).mockResolvedValueOnce(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const req = new NextRequest("http://localhost/api/bulk-content-save", {
      method: "POST",
      body: JSON.stringify({ rows: [sampleRow] }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
