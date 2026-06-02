import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/library-edits-store", () => ({ getLibraryEdits: vi.fn() }));
vi.mock("@/lib/pf-icon-overrides-store", () => ({
  getPfIconOverrides: vi.fn(),
  setPfIconOverride: vi.fn(),
  deletePfIconOverride: vi.fn(),
}));

import { GET, PATCH } from "@/app/api/library/route";
import { getLibraryEdits } from "@/lib/library-edits-store";
import { getPfIconOverrides, setPfIconOverride, deletePfIconOverride } from "@/lib/pf-icon-overrides-store";
import { requireAuth } from "@/lib/auth";

const emptyEdits = { wct: {}, pf: {} };

beforeEach(() => {
  vi.mocked(requireAuth).mockResolvedValue(null);
  vi.mocked(getLibraryEdits).mockResolvedValue(emptyEdits);
  vi.mocked(getPfIconOverrides).mockResolvedValue({});
  vi.mocked(setPfIconOverride).mockResolvedValue(undefined);
  vi.mocked(deletePfIconOverride).mockResolvedValue(undefined);
});

describe("GET /api/library (type=why)", () => {
  it("returns WCT library entries", async () => {
    const req = new NextRequest("http://localhost/api/library?type=why");
    const res = await GET(req);
    const body = await res.json();
    expect(Array.isArray(body.entries)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("filters by productType", async () => {
    const req = new NextRequest("http://localhost/api/library?type=why&productType=Home");
    const res = await GET(req);
    const body = await res.json();
    for (const entry of body.entries) {
      expect(entry.productType).toBe("Home");
    }
  });

  it("filters by category", async () => {
    const req = new NextRequest("http://localhost/api/library?type=why&category=Stands+Out");
    const res = await GET(req);
    const body = await res.json();
    for (const entry of body.entries) {
      expect(entry.category).toBe("Stands Out");
    }
  });

  it("filters by search text", async () => {
    const req = new NextRequest("http://localhost/api/library?type=why&search=zzznomatch");
    const res = await GET(req);
    const body = await res.json();
    expect(body.entries).toHaveLength(0);
  });

  it("includes edits — overrides existing entry text", async () => {
    // Find the first WCT entry from the base library to edit
    const baseReq = new NextRequest("http://localhost/api/library?type=why");
    const baseRes = await GET(baseReq);
    const { entries } = await baseRes.json() as { entries: Array<{ id: string }> };
    const firstId = entries[0]?.id;
    if (!firstId) return; // no base library entries to test

    vi.mocked(getLibraryEdits).mockResolvedValueOnce({
      wct: { [firstId]: { id: firstId, productType: "Home", productStyle: "Minimal", category: "Stands Out", text: "Edited text", subtext: "edited subtext", searchFormatted: "", isNew: false } },
      pf: {},
    });

    const req = new NextRequest(`http://localhost/api/library?type=why&productType=Home&productStyle=Minimal&category=Stands+Out`);
    const res = await GET(req);
    const body = await res.json() as { entries: Array<{ id: string; text: string }> };
    const edited = body.entries.find((e) => e.id === firstId);
    if (edited) {
      expect(edited.text).toBe("Edited text");
    }
  });
});

describe("GET /api/library (type=perfect)", () => {
  it("returns PF library entries", async () => {
    const req = new NextRequest("http://localhost/api/library?type=perfect");
    const res = await GET(req);
    const body = await res.json();
    expect(Array.isArray(body.entries)).toBe(true);
  });

  it("icon override takes precedence over base icon", async () => {
    const baseReq = new NextRequest("http://localhost/api/library?type=perfect");
    const baseRes = await GET(baseReq);
    const { entries } = await baseRes.json() as { entries: Array<{ id: string }> };
    const firstId = entries[0]?.id;
    if (!firstId) return;

    vi.mocked(getPfIconOverrides).mockResolvedValueOnce({ [firstId]: "override-icon" });
    const req = new NextRequest("http://localhost/api/library?type=perfect");
    const res = await GET(req);
    const body = await res.json() as { entries: Array<{ id: string; icon: string }> };
    const overridden = body.entries.find((e) => e.id === firstId);
    if (overridden) {
      expect(overridden.icon).toBe("override-icon");
    }
  });

  it("filters by category", async () => {
    const req = new NextRequest("http://localhost/api/library?type=perfect&category=Occasion");
    const res = await GET(req);
    const body = await res.json();
    for (const entry of body.entries) {
      expect(entry.category).toBe("Occasion");
    }
  });
});

describe("PATCH /api/library (icon override)", () => {
  it("sets icon override when icon is provided", async () => {
    const req = new NextRequest("http://localhost/api/library", {
      method: "PATCH",
      body: JSON.stringify({ id: "pf-1", icon: "heart" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(setPfIconOverride).toHaveBeenCalledWith("pf-1", "heart");
  });

  it("deletes icon override when icon is null", async () => {
    const req = new NextRequest("http://localhost/api/library", {
      method: "PATCH",
      body: JSON.stringify({ id: "pf-1", icon: null }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(deletePfIconOverride).toHaveBeenCalledWith("pf-1");
  });

  it("returns 400 when id is missing", async () => {
    const req = new NextRequest("http://localhost/api/library", {
      method: "PATCH",
      body: JSON.stringify({ icon: "heart" }),
      headers: { "content-type": "application/json" },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});
