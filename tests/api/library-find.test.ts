import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/shopify", () => ({ shopifyGraphQL: vi.fn() }));
vi.mock("@/lib/library-edits-store", () => ({ getLibraryEdits: vi.fn() }));

import { POST } from "@/app/api/library/find/route";
import { shopifyGraphQL } from "@/lib/shopify";
import { getLibraryEdits } from "@/lib/library-edits-store";
import { requireAuth } from "@/lib/auth";

function shopifyPage(nodes: Array<{ id: string; title: string; typePt?: string | null; stylePt?: string | null; wct1?: string; pf1?: string }>, hasNextPage = false) {
  const mf = (v?: string | null) => (v ? { value: v } : null);
  return {
    products: {
      edges: nodes.map((n) => ({
        node: {
          id: n.id, title: n.title,
          typePt: mf(n.typePt ?? "Home"), stylePt: mf(n.stylePt ?? "Minimal"),
          wct1: mf(n.wct1), wct2: null, wct3: null, wct4: null,
          pf1: mf(n.pf1), pf2: null, pf3: null, pf4: null,
        },
        cursor: n.id,
      })),
      pageInfo: { hasNextPage },
    },
  };
}

beforeEach(() => {
  vi.mocked(requireAuth).mockResolvedValue(null);
});

describe("POST /api/library/find (WCT)", () => {
  it("returns products whose WCT bullet matches searchFormatted", async () => {
    const oldFormatted = "<strong>Old text</strong> old sub";
    const newFormatted = "<strong>New text</strong> new sub";
    vi.mocked(getLibraryEdits).mockResolvedValue({
      wct: { "wct-1": { id: "wct-1", productType: "Home", productStyle: "Minimal", category: "Stands Out", text: "New text", subtext: "new sub", searchFormatted: oldFormatted, isNew: false } },
      pf: {},
    });
    vi.mocked(shopifyGraphQL).mockResolvedValue(shopifyPage([
      { id: "gid://shopify/Product/1", title: "Match", wct1: oldFormatted },
      { id: "gid://shopify/Product/2", title: "No Match", wct1: newFormatted },
    ]));
    const req = new NextRequest("http://localhost/api/library/find", {
      method: "POST",
      body: JSON.stringify({ type: "wct", id: "wct-1" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.products).toHaveLength(1);
    expect(body.products[0].title).toBe("Match");
  });

  it("returns empty array when searchFormatted is empty (new entry)", async () => {
    vi.mocked(getLibraryEdits).mockResolvedValue({
      wct: { "wct-new": { id: "wct-new", productType: "Home", productStyle: "Minimal", category: "Stands Out", text: "t", subtext: "s", searchFormatted: "", isNew: true } },
      pf: {},
    });
    const req = new NextRequest("http://localhost/api/library/find", {
      method: "POST",
      body: JSON.stringify({ type: "wct", id: "wct-new" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.products).toEqual([]);
  });

  it("returns 404 when entry is not found", async () => {
    vi.mocked(getLibraryEdits).mockResolvedValue({ wct: {}, pf: {} });
    const req = new NextRequest("http://localhost/api/library/find", {
      method: "POST",
      body: JSON.stringify({ type: "wct", id: "nonexistent" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("filters WCT matches by product type and style", async () => {
    const oldFormatted = "<strong>Old</strong> text";
    vi.mocked(getLibraryEdits).mockResolvedValue({
      wct: { "wct-1": { id: "wct-1", productType: "Home", productStyle: "Minimal", category: "Stands Out", text: "New", subtext: "text", searchFormatted: oldFormatted, isNew: false } },
      pf: {},
    });
    vi.mocked(shopifyGraphQL).mockResolvedValue(shopifyPage([
      { id: "p1", title: "Right type/style", typePt: "Home", stylePt: "Minimal", wct1: oldFormatted },
      { id: "p2", title: "Wrong type", typePt: "Bags & Purses", stylePt: "Elegant", wct1: oldFormatted },
    ]));
    const req = new NextRequest("http://localhost/api/library/find", {
      method: "POST",
      body: JSON.stringify({ type: "wct", id: "wct-1" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.products).toHaveLength(1);
    expect(body.products[0].title).toBe("Right type/style");
  });
});

describe("POST /api/library/find (PF)", () => {
  it("returns products whose PF bullet matches searchPhrase", async () => {
    const oldPhrase = "Old phrase";
    vi.mocked(getLibraryEdits).mockResolvedValue({
      wct: {},
      pf: { "pf-1": { id: "pf-1", productType: "Home", productStyle: "Minimal", category: "Occasion", phrase: "New phrase", icon: "home", timeSensitive: null, filterByInterest: false, applicabilityCount: 0, searchPhrase: oldPhrase, isNew: false } },
    });
    vi.mocked(shopifyGraphQL).mockResolvedValue(shopifyPage([
      { id: "p1", title: "Match", pf1: oldPhrase },
      { id: "p2", title: "No match", pf1: "Different phrase" },
    ]));
    const req = new NextRequest("http://localhost/api/library/find", {
      method: "POST",
      body: JSON.stringify({ type: "pf", id: "pf-1" }),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.products).toHaveLength(1);
    expect(body.products[0].title).toBe("Match");
  });
});
