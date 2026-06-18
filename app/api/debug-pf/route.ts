import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPfLibrary } from "@/lib/pf-store";
import { getSettings } from "@/lib/settings-store";

// GET /api/debug-pf?type=Children&style=Playful+%2F+Fun
// Simulates assignPerfectFor step by step for a given type/style.
export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const productType = req.nextUrl.searchParams.get("type") ?? "Children";
  const productStyle = req.nextUrl.searchParams.get("style") ?? "";

  const [library, settings] = await Promise.all([getPfLibrary(), getSettings()]);
  const interestKeywords = settings.interestKeywords ?? {};

  // All library entries for this type (no style filter yet)
  const allForType = library.filter((e) => e.productType === productType || e.productType === "ALL");

  // Step 1: full filter (timeSensitive + type + style match; ignore price since we don't know it)
  const productStyles = productStyle ? [productStyle] : [];

  const step1 = allForType.filter((e) => {
    if (e.timeSensitive) return false;
    const styleMatch = !productStyle || e.productStyle === "ALL" || productStyles.includes(e.productStyle);
    return styleMatch;
  });

  // Step 1b: interest filter — flag which ones would be excluded if keywords are configured
  const interestExcluded: string[] = [];
  const step1WithoutInterest = step1.filter((e) => {
    if (!e.filterByInterest) return true;
    const kws = interestKeywords[e.phrase];
    if (!kws || kws.length === 0) return true;
    interestExcluded.push(`${e.phrase} (needs: ${kws.join(", ")})`);
    return false; // would be excluded for products without these keywords
  });

  // Step 2: dedup by phrase text
  const phraseMap = new Map<string, typeof step1[0]>();
  for (const e of step1WithoutInterest) {
    const existing = phraseMap.get(e.phrase);
    if (!existing || (e.productStyle !== "ALL" && existing.productStyle === "ALL")) {
      phraseMap.set(e.phrase, e);
    }
  }
  const candidates = [...phraseMap.values()];

  // Styles present in the raw library for this type
  const stylesInLibrary = [...new Set(allForType.map((e) => e.productStyle))].sort();

  return NextResponse.json({
    productType,
    productStyle: productStyle || "(any)",
    stylesInLibrary,
    step1_afterTypeStyleFilter: step1.map((e) => ({
      phrase: e.phrase,
      style: e.productStyle,
      filterByInterest: e.filterByInterest,
      timeSensitive: e.timeSensitive,
      minPrice: e.minPrice ?? null,
      maxPrice: e.maxPrice ?? null,
    })),
    step1b_interestExcludedIfKeywordsMatch: interestExcluded,
    step2_afterDedup: candidates.map((e) => ({
      phrase: e.phrase,
      style: e.productStyle,
      filterByInterest: e.filterByInterest,
      minPrice: e.minPrice ?? null,
      maxPrice: e.maxPrice ?? null,
    })),
    effectiveCount: candidates.length,
    wouldAssign: Math.min(candidates.length, 4),
  });
}
