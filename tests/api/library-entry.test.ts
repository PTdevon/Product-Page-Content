import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/library-edits-store", () => ({
  upsertWCTEdit: vi.fn(),
  upsertPFEdit: vi.fn(),
  deleteWCTEdit: vi.fn(),
  deletePFEdit: vi.fn(),
}));

import { POST, DELETE } from "@/app/api/library/entry/route";
import { upsertWCTEdit, upsertPFEdit, deleteWCTEdit, deletePFEdit } from "@/lib/library-edits-store";
import { requireAuth } from "@/lib/auth";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAuth).mockResolvedValue(null);
  vi.mocked(upsertWCTEdit).mockResolvedValue(undefined);
  vi.mocked(upsertPFEdit).mockResolvedValue(undefined);
  vi.mocked(deleteWCTEdit).mockResolvedValue(undefined);
  vi.mocked(deletePFEdit).mockResolvedValue(undefined);
});

describe("POST /api/library/entry (WCT)", () => {
  it("creates new WCT entry with generated id starting wct-custom-", async () => {
    const req = new NextRequest("http://localhost/api/library/entry", {
      method: "POST",
      body: JSON.stringify({
        type: "wct",
        entry: { productType: "Home", productStyle: "Minimal", category: "Stands Out", text: "New text", subtext: "new sub" },
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.id).toMatch(/^wct-custom-/);
    expect(upsertWCTEdit).toHaveBeenCalled();
  });

  it("updates existing base WCT entry preserving searchFormatted from base library", async () => {
    // Get a real base entry id by checking the base library data
    const baseWCT = await import("@/data/why-choose-this.json");
    const firstId = (baseWCT.default as Array<{ id: string; text: string; subtext: string }>)[0]?.id;
    if (!firstId) return;

    const req = new NextRequest("http://localhost/api/library/entry", {
      method: "POST",
      body: JSON.stringify({
        type: "wct",
        entry: { id: firstId, productType: "Home", productStyle: "Minimal", category: "Stands Out", text: "Updated", subtext: "updated" },
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.id).toBe(firstId);
    const call = vi.mocked(upsertWCTEdit).mock.calls[0][0];
    expect(call.searchFormatted).toBeTruthy(); // should have the original formatted string
  });
});

describe("POST /api/library/entry (PF)", () => {
  it("creates new PF entry with generated id starting pf-custom-", async () => {
    const req = new NextRequest("http://localhost/api/library/entry", {
      method: "POST",
      body: JSON.stringify({
        type: "pf",
        entry: {
          productType: "Home", productStyle: "Minimal", category: "Occasion",
          phrase: "New phrase", icon: "home", timeSensitive: null,
          filterByInterest: false, applicabilityCount: 5,
        },
      }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.id).toMatch(/^pf-custom-/);
    expect(upsertPFEdit).toHaveBeenCalled();
  });
});

describe("POST /api/library/entry (invalid type)", () => {
  it("returns 400 for unrecognised type", async () => {
    const req = new NextRequest("http://localhost/api/library/entry", {
      method: "POST",
      body: JSON.stringify({ type: "unknown", entry: {} }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/library/entry", () => {
  it("calls deleteWCTEdit for type=wct", async () => {
    const req = new NextRequest("http://localhost/api/library/entry", {
      method: "DELETE",
      body: JSON.stringify({ type: "wct", id: "wct-custom-123" }),
      headers: { "content-type": "application/json" },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect(deleteWCTEdit).toHaveBeenCalledWith("wct-custom-123");
  });

  it("calls deletePFEdit for type=pf", async () => {
    const req = new NextRequest("http://localhost/api/library/entry", {
      method: "DELETE",
      body: JSON.stringify({ type: "pf", id: "pf-custom-456" }),
      headers: { "content-type": "application/json" },
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    expect(deletePFEdit).toHaveBeenCalledWith("pf-custom-456");
  });
});
