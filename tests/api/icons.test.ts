import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({ requireAuth: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/icons", () => ({ getBuiltinIcons: vi.fn() }));
vi.mock("@/lib/uploaded-icons-store", () => ({
  getUploadedIcons: vi.fn(),
  addUploadedIcon: vi.fn(),
}));

import { GET, POST } from "@/app/api/icons/route";
import { getBuiltinIcons } from "@/lib/icons";
import { getUploadedIcons, addUploadedIcon } from "@/lib/uploaded-icons-store";
import { requireAuth } from "@/lib/auth";

beforeEach(() => {
  vi.mocked(requireAuth).mockResolvedValue(null);
  vi.mocked(getBuiltinIcons).mockReturnValue(["heart", "home", "star"]);
  vi.mocked(getUploadedIcons).mockResolvedValue([]);
  vi.mocked(addUploadedIcon).mockResolvedValue(undefined);
});

function makeSvgFile(name: string, content = "<svg xmlns='http://www.w3.org/2000/svg'><circle/></svg>"): File {
  return new File([content], name, { type: "image/svg+xml" });
}

describe("GET /api/icons", () => {
  it("returns builtIn and uploaded icon lists", async () => {
    const req = new NextRequest("http://localhost/api/icons");
    const res = await GET(req);
    const body = await res.json();
    expect(body.builtIn).toEqual(["heart", "home", "star"]);
    expect(Array.isArray(body.uploaded)).toBe(true);
  });

  it("returns 401 when auth fails", async () => {
    const { NextResponse } = await import("next/server");
    vi.mocked(requireAuth).mockResolvedValueOnce(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    const req = new NextRequest("http://localhost/api/icons");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/icons (upload)", () => {
  it("accepts a valid SVG file and returns name and svg", async () => {
    const formData = new FormData();
    formData.append("file", makeSvgFile("my-icon.svg"));
    const req = new NextRequest("http://localhost/api/icons", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.name).toBe("my-icon");
    expect(addUploadedIcon).toHaveBeenCalled();
  });

  it("slugifies filename — spaces and special chars become hyphens", async () => {
    const formData = new FormData();
    formData.append("file", makeSvgFile("My Cool Icon!.svg"));
    const req = new NextRequest("http://localhost/api/icons", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.name).toMatch(/^my-cool-icon/);
  });

  it("rejects non-SVG file extension", async () => {
    const formData = new FormData();
    formData.append("file", new File(["<svg/>"], "icon.png", { type: "image/png" }));
    const req = new NextRequest("http://localhost/api/icons", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects file without <svg content", async () => {
    const formData = new FormData();
    formData.append("file", makeSvgFile("icon.svg", "not-svg-content"));
    const req = new NextRequest("http://localhost/api/icons", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects name that conflicts with a built-in icon", async () => {
    const formData = new FormData();
    formData.append("file", makeSvgFile("heart.svg")); // 'heart' is in builtIn mock
    const req = new NextRequest("http://localhost/api/icons", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects missing file", async () => {
    const formData = new FormData();
    const req = new NextRequest("http://localhost/api/icons", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
