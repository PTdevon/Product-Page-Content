import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fs before importing icons
vi.mock("fs", () => ({
  readdirSync: vi.fn(),
  readFileSync: vi.fn(),
}));

import * as fs from "fs";
import { resolveIconForMetafield, getBuiltinIcons, getBuiltinSvg } from "@/lib/icons";

const SAMPLE_SVG = `<svg id="heart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path d="M20.84 4.61a5.5 5.5 x"/>
</svg>`;

const MINIFIED = SAMPLE_SVG.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();

beforeEach(() => {
  vi.mocked(fs.readFileSync).mockReset();
  vi.mocked(fs.readdirSync).mockReset();
});

describe("resolveIconForMetafield", () => {
  it("returns empty string unchanged", () => {
    expect(resolveIconForMetafield("")).toBe("");
  });

  it("returns HTTPS URLs unchanged", () => {
    const url = "https://cdn.shopify.com/icons/heart.svg";
    expect(resolveIconForMetafield(url)).toBe(url);
  });

  it("resolves plain icon name to minified SVG", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(SAMPLE_SVG);
    const result = resolveIconForMetafield("heart");
    expect(result).toBe(MINIFIED);
  });

  it("returns plain name unchanged when file not found", () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error("ENOENT"); });
    expect(resolveIconForMetafield("unknown-icon")).toBe("unknown-icon");
  });

  it("re-resolves SVG string with id attribute to current file", () => {
    const svgWithId = `<svg id="heart"><path/></svg>`;
    vi.mocked(fs.readFileSync).mockReturnValue(SAMPLE_SVG);
    const result = resolveIconForMetafield(svgWithId);
    expect(result).toBe(MINIFIED);
  });

  it("falls back to legacy fingerprint when no id attribute — heart", () => {
    const legacySvg = `<svg><path d="M20.84 4.61a5.5 5.5 old"/></svg>`;
    vi.mocked(fs.readFileSync).mockReturnValue(SAMPLE_SVG);
    const result = resolveIconForMetafield(legacySvg);
    expect(result).toBe(MINIFIED);
  });

  it("falls back to legacy fingerprint — baby (cy='6' r='3')", () => {
    const legacySvg = `<svg><circle cx="12" cy="6" r="3"/></svg>`;
    const babySvg = `<svg id="baby"><circle/></svg>`;
    vi.mocked(fs.readFileSync).mockReturnValue(babySvg);
    const result = resolveIconForMetafield(legacySvg);
    expect(result).toContain("<svg");
  });

  it("falls back to legacy fingerprint — star", () => {
    const legacySvg = `<svg><path d="M12 2l3.09 6.26"/></svg>`;
    const starSvg = `<svg id="star"><path/></svg>`;
    vi.mocked(fs.readFileSync).mockReturnValue(starSvg);
    const result = resolveIconForMetafield(legacySvg);
    expect(result).toContain("<svg");
  });

  it("returns unrecognised SVG string as-is", () => {
    const unknownSvg = `<svg><rect width="10" height="10"/></svg>`;
    // readFileSync would throw if called (no id, no fingerprint match)
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error("ENOENT"); });
    expect(resolveIconForMetafield(unknownSvg)).toBe(unknownSvg);
  });
});

describe("getBuiltinIcons", () => {
  it("returns sorted SVG names without extension", () => {
    vi.mocked(fs.readdirSync).mockReturnValue(["heart.svg", "baby.svg", "star.svg"] as unknown as ReturnType<typeof fs.readdirSync>);
    expect(getBuiltinIcons()).toEqual(["baby", "heart", "star"]);
  });

  it("filters out non-SVG files", () => {
    vi.mocked(fs.readdirSync).mockReturnValue(["heart.svg", "readme.txt"] as unknown as ReturnType<typeof fs.readdirSync>);
    expect(getBuiltinIcons()).toEqual(["heart"]);
  });

  it("returns empty array when directory read fails", () => {
    vi.mocked(fs.readdirSync).mockImplementation(() => { throw new Error("ENOENT"); });
    expect(getBuiltinIcons()).toEqual([]);
  });
});

describe("getBuiltinSvg", () => {
  it("returns SVG file contents", () => {
    vi.mocked(fs.readFileSync).mockReturnValue(SAMPLE_SVG);
    expect(getBuiltinSvg("heart")).toBe(SAMPLE_SVG);
  });

  it("returns null when file not found", () => {
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error("ENOENT"); });
    expect(getBuiltinSvg("nope")).toBeNull();
  });
});
