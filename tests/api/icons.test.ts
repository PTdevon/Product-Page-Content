import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/icon-metaobjects-store", () => ({
  getAllIcons: vi.fn(),
  getIcon: vi.fn(),
  createIcon: vi.fn(),
  deleteIcon: vi.fn(),
  ensureDefinitionAndSeed: vi.fn(),
}));
vi.mock("@/lib/icon-usage", () => ({
  findIconUsage: vi.fn().mockResolvedValue({ products: [], phrases: [] }),
}));

import { GET, POST, DELETE } from "@/app/api/icons/route";
import { getAllIcons, getIcon, createIcon, deleteIcon, ensureDefinitionAndSeed } from "@/lib/icon-metaobjects-store";
import { requireAuth } from "@/lib/auth";

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/></svg>`;

beforeEach(() => {
  vi.mocked(requireAuth).mockResolvedValue(null);
  vi.mocked(getAllIcons).mockResolvedValue([
    { id: "gid://shopify/Metaobject/1", handle: "heart", svg: SAMPLE_SVG },
    { id: "gid://shopify/Metaobject/2", handle: "star", svg: SAMPLE_SVG },
  ]);
  vi.mocked(ensureDefinitionAndSeed).mockResolvedValue(undefined);
  vi.mocked(createIcon).mockResolvedValue({ id: "gid://shopify/Metaobject/3", handle: "my-icon", svg: SAMPLE_SVG });
  vi.mocked(deleteIcon).mockResolvedValue(undefined);
});

describe("GET /api/icons", () => {
  it("returns icons array", async () => {
    const req = new NextRequest("http://localhost/api/icons");
    const res = await GET(req);
    const body = await res.json();
    expect(Array.isArray(body.icons)).toBe(true);
    expect(body.icons).toHaveLength(2);
  });

  it("each icon has handle, id, and svg", async () => {
    const req = new NextRequest("http://localhost/api/icons");
    const res = await GET(req);
    const body = await res.json();
    expect(body.icons[0]).toMatchObject({ handle: "heart", id: expect.any(String), svg: expect.any(String) });
  });

  it("calls ensureDefinitionAndSeed when icons list is empty", async () => {
    vi.mocked(getAllIcons).mockResolvedValueOnce([]);
    const req = new NextRequest("http://localhost/api/icons");
    await GET(req);
    expect(ensureDefinitionAndSeed).toHaveBeenCalled();
  });

  it("returns 401 when auth fails", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(requireAuth).mockResolvedValueOnce(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const req = new NextRequest("http://localhost/api/icons");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/icons", () => {
  it("accepts JSON { name, svg } and returns the created icon", async () => {
    const req = new NextRequest("http://localhost/api/icons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "my-icon", svg: SAMPLE_SVG }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.handle).toBe("my-icon");
    expect(createIcon).toHaveBeenCalled();
  });

  it("rejects missing svg", async () => {
    const req = new NextRequest("http://localhost/api/icons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "my-icon" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects missing name", async () => {
    const req = new NextRequest("http://localhost/api/icons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ svg: SAMPLE_SVG }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects non-SVG content", async () => {
    const req = new NextRequest("http://localhost/api/icons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test", svg: "not-an-svg" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/icons", () => {
  it("deletes an icon when not in use", async () => {
    vi.mocked(getIcon).mockResolvedValue({ id: "gid://shopify/Metaobject/1", handle: "heart", svg: SAMPLE_SVG });
    const req = new NextRequest("http://localhost/api/icons?name=heart", { method: "DELETE" });
    const res = await DELETE(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(deleteIcon).toHaveBeenCalled();
  });

  it("returns 404 for unknown icon", async () => {
    vi.mocked(getIcon).mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/icons?name=nonexistent", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 when name param is missing", async () => {
    const req = new NextRequest("http://localhost/api/icons", { method: "DELETE" });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });
});
