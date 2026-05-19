import type { WhyChooseThisEntry, PerfectForEntry } from "./types";

export interface ProductContext {
  title: string;
  descriptionText: string;
  productType: string;
  productStyles: string[];
}

export interface DateRangeConfig {
  mothersDay:    { start: string; end: string } | null;
  fathersDay:    { start: string; end: string } | null;
  valentinesDay: { start: string; end: string } | null;
}

export interface SeasonalOverrides {
  mothersDay:    boolean;
  fathersDay:    boolean;
  valentinesDay: boolean;
}

export interface AssignedWhyChooseThis {
  bullet1: string;
  bullet2: string;
  bullet3: string;
  bullet4: string;
}

export interface AssignedPerfectFor {
  bullets: string[];
  icons: string[];
}

const WCT_CATEGORIES = ["Stands Out", "Gift Impact", "Trusted Pick", "Worth Keeping"] as const;

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export function assignWhyChooseThis(
  product: ProductContext,
  library: WhyChooseThisEntry[],
  seed?: number
): AssignedWhyChooseThis {
  const rand = seed !== undefined ? seededRandom(seed) : Math.random.bind(Math);
  const result: string[] = [];

  for (const category of WCT_CATEGORIES) {
    const candidates = library.filter(
      (e) =>
        e.productType === product.productType &&
        product.productStyles.includes(e.productStyle) &&
        e.category === category
    );

    if (candidates.length === 0) {
      result.push("");
    } else {
      const chosen = candidates[Math.floor(rand() * candidates.length)];
      result.push(`<strong>${chosen.text}</strong> ${chosen.subtext}`);
    }
  }

  return { bullet1: result[0], bullet2: result[1], bullet3: result[2], bullet4: result[3] };
}

function isWithinDateRange(today: Date, range: { start: string; end: string } | null): boolean {
  if (!range) return false;
  const t = today.toISOString().slice(0, 10);
  return t >= range.start && t <= range.end;
}

function timeSensitiveKey(ts: string | null): keyof DateRangeConfig | null {
  if (ts === "mothers-day") return "mothersDay";
  if (ts === "fathers-day") return "fathersDay";
  if (ts === "valentines-day") return "valentinesDay";
  return null;
}

export function assignPerfectFor(
  product: ProductContext,
  library: PerfectForEntry[],
  dateConfig: DateRangeConfig,
  today: Date,
  seed?: number,
  seasonalOverrides?: SeasonalOverrides
): AssignedPerfectFor {
  const rand = seed !== undefined ? seededRandom(seed) : Math.random.bind(Math);

  // Step 1: filter
  const candidates = library.filter((entry) => {
    const typeMatch = entry.productType === "ALL" || entry.productType === product.productType;
    const styleMatch = entry.productStyle === "ALL" || product.productStyles.includes(entry.productStyle);
    if (!typeMatch || !styleMatch) return false;

    if (entry.timeSensitive) {
      const key = timeSensitiveKey(entry.timeSensitive);
      if (!key) return false;
      const overrideActive = seasonalOverrides?.[key] === true;
      if (!overrideActive && !isWithinDateRange(today, dateConfig[key])) return false;
    }

    // Phase 1: interest-filtered entries included unconditionally
    return true;
  });

  // Step 2: sort by specificity
  const sorted = [...candidates].sort((a, b) => {
    const aNiche = a.productStyle !== "ALL" ? 0 : 1;
    const bNiche = b.productStyle !== "ALL" ? 0 : 1;
    if (aNiche !== bNiche) return aNiche - bNiche;
    return a.applicabilityCount - b.applicabilityCount;
  });

  // Step 3: pick 4 with category diversity
  const selected: PerfectForEntry[] = [];
  const categoryCounts: Record<string, number> = { Occasion: 0, Person: 0, Context: 0 };
  const remaining = [...sorted];

  while (selected.length < 4 && remaining.length > 0) {
    const minCount = Math.min(...Object.values(categoryCounts));
    const idx = remaining.findIndex((e) => (categoryCounts[e.category] ?? 0) === minCount);
    const pick = idx >= 0 ? remaining.splice(idx, 1)[0] : remaining.shift()!;
    selected.push(pick);
    categoryCounts[pick.category] = (categoryCounts[pick.category] ?? 0) + 1;
    void rand; // keep reference to suppress unused warning
  }

  return {
    bullets: selected.map((e) => e.phrase),
    icons: selected.map((e) => e.icon),
  };
}
