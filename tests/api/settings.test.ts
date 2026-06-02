import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/settings-store", () => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

import { GET, POST } from "@/app/api/settings/route";
import { getSettings, saveSettings } from "@/lib/settings-store";
import { requireAuth } from "@/lib/auth";

const defaultSettings = {
  dateRanges: { mothersDay: null, fathersDay: null, valentinesDay: null },
  interestKeywords: {},
};

beforeEach(() => {
  vi.mocked(getSettings).mockResolvedValue(defaultSettings);
  vi.mocked(saveSettings).mockResolvedValue(undefined);
  vi.mocked(requireAuth).mockResolvedValue(null);
});

describe("GET /api/settings", () => {
  it("returns current settings", async () => {
    const req = new NextRequest("http://localhost/api/settings");
    const res = await GET(req);
    const body = await res.json();
    expect(body).toEqual(defaultSettings);
  });

  it("returns 401 when auth fails", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(requireAuth).mockResolvedValueOnce(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const req = new NextRequest("http://localhost/api/settings");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/settings", () => {
  it("saves settings and returns 200", async () => {
    const newSettings = {
      ...defaultSettings,
      dateRanges: { mothersDay: { start: "2025-05-01", end: "2025-05-31" }, fathersDay: null, valentinesDay: null },
    };
    const req = new NextRequest("http://localhost/api/settings", {
      method: "POST",
      body: JSON.stringify(newSettings),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(saveSettings).toHaveBeenCalledWith(newSettings);
  });

  it("returns 401 when auth fails", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(requireAuth).mockResolvedValueOnce(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const req = new NextRequest("http://localhost/api/settings", {
      method: "POST",
      body: JSON.stringify(defaultSettings),
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
