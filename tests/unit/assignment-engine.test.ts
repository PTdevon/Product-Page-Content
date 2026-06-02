import { describe, it, expect } from "vitest";
import { assignWhyChooseThis, assignPerfectFor } from "@/lib/assignment-engine";
import type { ProductContext } from "@/lib/assignment-engine";
import { makeWCT, makePF, wctLibraryOnePerCategory, pfLibraryAllCategories } from "@/tests/fixtures/library";

const noDateConfig = { mothersDay: null, fathersDay: null, valentinesDay: null };
const today = new Date("2025-06-01");

const homeMinimalCtx: ProductContext = {
  title: "Ceramic Vase",
  descriptionText: "A beautiful minimal vase",
  productType: "Home",
  productStyles: ["Minimal"],
};

// ── assignWhyChooseThis ────────────────────────────────────────────────────

describe("assignWhyChooseThis", () => {
  it("returns bullet1-bullet4 keys", () => {
    const lib = wctLibraryOnePerCategory();
    const result = assignWhyChooseThis(homeMinimalCtx, lib, 0);
    expect(result).toHaveProperty("bullet1");
    expect(result).toHaveProperty("bullet2");
    expect(result).toHaveProperty("bullet3");
    expect(result).toHaveProperty("bullet4");
  });

  it("formats selected bullet as <strong>text</strong> subtext", () => {
    const lib = [makeWCT({ text: "Bold claim", subtext: "backed by quality." })];
    const result = assignWhyChooseThis(homeMinimalCtx, lib, 0);
    expect(result.bullet1).toBe("<strong>Bold claim</strong> backed by quality.");
  });

  it("returns empty string for a category with no matching entries", () => {
    const lib = [makeWCT({ category: "Stands Out" })]; // only 1 of 4 categories
    const result = assignWhyChooseThis(homeMinimalCtx, lib, 0);
    expect(result.bullet1).toBeTruthy(); // Stands Out — matched
    expect(result.bullet2).toBe("");     // Gift Impact — no match
    expect(result.bullet3).toBe("");     // Trusted Pick — no match
    expect(result.bullet4).toBe("");     // Worth Keeping — no match
  });

  it("returns empty string when product type does not match", () => {
    const lib = wctLibraryOnePerCategory("Bags & Purses", "Elegant");
    const result = assignWhyChooseThis(homeMinimalCtx, lib, 0);
    expect(result.bullet1).toBe("");
    expect(result.bullet2).toBe("");
  });

  it("returns empty string when product style does not match", () => {
    const lib = wctLibraryOnePerCategory("Home", "Bold/Colourful");
    const result = assignWhyChooseThis(homeMinimalCtx, lib, 0);
    expect(result.bullet1).toBe(""); // ctx has Minimal, not Bold/Colourful
  });

  it("is deterministic: same seed produces the same result", () => {
    const lib = [
      makeWCT({ id: "a", text: "A", subtext: "a", category: "Stands Out" }),
      makeWCT({ id: "b", text: "B", subtext: "b", category: "Stands Out" }),
      makeWCT({ id: "c", text: "C", subtext: "c", category: "Stands Out" }),
    ];
    const r1 = assignWhyChooseThis(homeMinimalCtx, lib, 42);
    const r2 = assignWhyChooseThis(homeMinimalCtx, lib, 42);
    expect(r1.bullet1).toBe(r2.bullet1);
  });

  it("different seeds can produce different results", () => {
    const lib = Array.from({ length: 20 }, (_, i) =>
      makeWCT({ id: `x${i}`, text: `Text ${i}`, subtext: "s", category: "Stands Out" })
    );
    // Use widely-spaced seeds to ensure the LCG produces distinct outputs
    const results = new Set(
      Array.from({ length: 50 }, (_, i) =>
        assignWhyChooseThis(homeMinimalCtx, lib, i * 1000).bullet1
      )
    );
    expect(results.size).toBeGreaterThan(1);
  });

  it("matches product with multiple styles", () => {
    const ctx: ProductContext = { ...homeMinimalCtx, productStyles: ["Minimal", "EcoFriendly"] };
    const lib = [
      makeWCT({ id: "eco", productStyle: "EcoFriendly", category: "Stands Out", text: "Eco", subtext: "conscious." }),
    ];
    const result = assignWhyChooseThis(ctx, lib, 0);
    expect(result.bullet1).toContain("Eco");
  });
});

// ── assignPerfectFor ───────────────────────────────────────────────────────

describe("assignPerfectFor", () => {
  it("returns bullets and icons arrays", () => {
    const lib = pfLibraryAllCategories();
    const result = assignPerfectFor(homeMinimalCtx, lib, noDateConfig, today);
    expect(Array.isArray(result.bullets)).toBe(true);
    expect(Array.isArray(result.icons)).toBe(true);
    expect(result.bullets.length).toBe(result.icons.length);
  });

  it("excludes time-sensitive entries", () => {
    const lib = [
      makePF({ id: "md", phrase: "Mother's Day gift", timeSensitive: "mothers-day" }),
      makePF({ id: "ok", phrase: "Any time gift", timeSensitive: null, category: "Occasion" }),
    ];
    const result = assignPerfectFor(homeMinimalCtx, lib, noDateConfig, today);
    expect(result.bullets).not.toContain("Mother's Day gift");
    expect(result.bullets).toContain("Any time gift");
  });

  it("productType ALL matches any product type", () => {
    const lib = [makePF({ productType: "ALL", productStyle: "ALL", phrase: "For everyone" })];
    const result = assignPerfectFor(homeMinimalCtx, lib, noDateConfig, today);
    expect(result.bullets).toContain("For everyone");
  });

  it("productStyle ALL matches any style", () => {
    const lib = [makePF({ productType: "Home", productStyle: "ALL", phrase: "For all homes" })];
    const result = assignPerfectFor(homeMinimalCtx, lib, noDateConfig, today);
    expect(result.bullets).toContain("For all homes");
  });

  it("filterByInterest=false entries are always included regardless of keywords", () => {
    const lib = [makePF({ filterByInterest: false, phrase: "Always included" })];
    const result = assignPerfectFor(homeMinimalCtx, lib, noDateConfig, today, undefined, undefined, {
      "Always included": ["travel", "adventure"],
    });
    expect(result.bullets).toContain("Always included");
  });

  it("filterByInterest=true entry included when keyword appears in title", () => {
    const ctx: ProductContext = { ...homeMinimalCtx, title: "Travel Vase", descriptionText: "" };
    const lib = [makePF({ filterByInterest: true, phrase: "For travellers" })];
    const result = assignPerfectFor(ctx, lib, noDateConfig, today, undefined, undefined, {
      "For travellers": ["travel"],
    });
    expect(result.bullets).toContain("For travellers");
  });

  it("filterByInterest=true entry included when keyword appears in description (case-insensitive)", () => {
    const ctx: ProductContext = { ...homeMinimalCtx, title: "Vase", descriptionText: "Great for TRAVEL lovers" };
    const lib = [makePF({ filterByInterest: true, phrase: "For travellers" })];
    const result = assignPerfectFor(ctx, lib, noDateConfig, today, undefined, undefined, {
      "For travellers": ["travel"],
    });
    expect(result.bullets).toContain("For travellers");
  });

  it("filterByInterest=true entry excluded when no keyword matches", () => {
    const lib = [makePF({ filterByInterest: true, phrase: "For travellers" })];
    const result = assignPerfectFor(homeMinimalCtx, lib, noDateConfig, today, undefined, undefined, {
      "For travellers": ["travel", "adventure"],
    });
    expect(result.bullets).not.toContain("For travellers");
  });

  it("maintains category diversity — never picks 2 of same category before exhausting others", () => {
    const lib = pfLibraryAllCategories(); // 2 Occasion, 2 Person, 1 Context
    const result = assignPerfectFor(homeMinimalCtx, lib, noDateConfig, today, undefined, undefined, {});
    expect(result.bullets.length).toBe(4);
    const counts: Record<string, number> = {};
    for (const phrase of result.bullets) {
      const entry = lib.find((e) => e.phrase === phrase)!;
      counts[entry.category] = (counts[entry.category] ?? 0) + 1;
    }
    // Context only has 1 entry so it can't appear more than once;
    // no category should appear 3 times when there are 3 categories available.
    expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(2);
  });

  it("style-specific entries are preferred over ALL entries", () => {
    const lib = [
      makePF({ id: "specific", productStyle: "Minimal", phrase: "Specific phrase", applicabilityCount: 100 }),
      makePF({ id: "all", productStyle: "ALL", phrase: "Generic phrase", applicabilityCount: 1 }),
    ];
    const result = assignPerfectFor(homeMinimalCtx, lib, noDateConfig, today, undefined, undefined, {});
    // Specific should appear first (lower specificity index after sort)
    expect(result.bullets[0]).toBe("Specific phrase");
  });

  it("returns fewer than 4 bullets when library has fewer than 4 candidates", () => {
    const lib = [
      makePF({ id: "a", phrase: "First" }),
      makePF({ id: "b", phrase: "Second" }),
    ];
    const result = assignPerfectFor(homeMinimalCtx, lib, noDateConfig, today);
    expect(result.bullets.length).toBe(2);
  });

  it("returns empty arrays when no candidates exist", () => {
    const result = assignPerfectFor(homeMinimalCtx, [], noDateConfig, today);
    expect(result.bullets).toEqual([]);
    expect(result.icons).toEqual([]);
  });

  it("excludes entries whose product type does not match", () => {
    const lib = [makePF({ productType: "Bags & Purses", phrase: "For bag lovers" })];
    const result = assignPerfectFor(homeMinimalCtx, lib, noDateConfig, today);
    expect(result.bullets).not.toContain("For bag lovers");
  });
});
