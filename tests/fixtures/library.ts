import type { WhyChooseThisEntry, PerfectForEntry } from "@/lib/types";

export function makeWCT(overrides: Partial<WhyChooseThisEntry> = {}): WhyChooseThisEntry {
  return {
    id: "wct-1",
    productType: "Home",
    productStyle: "Minimal",
    category: "Stands Out",
    text: "Unique design",
    subtext: "that stands out on any shelf.",
    ...overrides,
  };
}

export function makePF(overrides: Partial<PerfectForEntry> = {}): PerfectForEntry {
  return {
    id: "pf-1",
    phraseId: "phrase-1",
    productType: "Home",
    productStyle: "Minimal",
    category: "Occasion",
    phrase: "A thoughtful housewarming gift",
    filterByInterest: false,
    timeSensitive: null,
    applicabilityCount: 10,
    icon: "home",
    ...overrides,
  };
}

export const ALL_WCT_CATEGORIES = ["Stands Out", "Gift Impact", "Trusted Pick", "Worth Keeping"] as const;

export function wctLibraryOnePerCategory(productType = "Home", productStyle = "Minimal"): WhyChooseThisEntry[] {
  return ALL_WCT_CATEGORIES.map((category, i) =>
    makeWCT({ id: `wct-${i}`, productType, productStyle, category })
  );
}

export function pfLibraryAllCategories(productType = "Home", productStyle = "Minimal"): PerfectForEntry[] {
  return [
    makePF({ id: "pf-occ-1", productType, productStyle, category: "Occasion", phrase: "As a housewarming gift", applicabilityCount: 5 }),
    makePF({ id: "pf-per-1", productType, productStyle, category: "Person", phrase: "For the homebody", applicabilityCount: 5 }),
    makePF({ id: "pf-ctx-1", productType, productStyle, category: "Context", phrase: "To make any room feel cosy", applicabilityCount: 5 }),
    makePF({ id: "pf-occ-2", productType, productStyle, category: "Occasion", phrase: "As a birthday gift", applicabilityCount: 8 }),
    makePF({ id: "pf-per-2", productType, productStyle, category: "Person", phrase: "For the design lover", applicabilityCount: 8 }),
  ];
}
