import { describe, it, expect } from "vitest";
import { getBuiltinIcons, getBuiltinSvg } from "@/lib/icons";

describe("getBuiltinIcons", () => {
  it("returns an array of 35 icon names", () => {
    expect(getBuiltinIcons()).toHaveLength(35);
  });

  it("contains no duplicates", () => {
    const names = getBuiltinIcons();
    expect(new Set(names).size).toBe(names.length);
  });

  it("includes expected icon names", () => {
    const names = getBuiltinIcons();
    expect(names).toContain("heart");
    expect(names).toContain("star");
    expect(names).toContain("gift");
  });
});

describe("getBuiltinSvg", () => {
  it("returns an SVG string for a known icon", () => {
    const svg = getBuiltinSvg("heart");
    expect(svg).not.toBeNull();
    expect(svg).toContain("<svg");
  });

  it("includes the correct id attribute", () => {
    const svg = getBuiltinSvg("heart");
    expect(svg).toContain('id="heart"');
  });

  it("returns null for an unknown icon", () => {
    expect(getBuiltinSvg("definitely-not-an-icon")).toBeNull();
  });

  it("each icon in the list has a corresponding SVG", () => {
    for (const name of getBuiltinIcons()) {
      const svg = getBuiltinSvg(name);
      expect(svg, `${name} should have an SVG`).not.toBeNull();
      expect(svg, `${name} SVG should be non-empty`).toBeTruthy();
    }
  });
});
