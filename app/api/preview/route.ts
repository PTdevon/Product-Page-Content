import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { assignWhyChooseThis, assignPerfectFor } from "@/lib/assignment-engine";
import { getSettings } from "@/lib/settings-store";
import { getProductWithMetafields } from "@/lib/metafields";
import wctData from "@/data/why-choose-this.json";
import pfData from "@/data/perfect-for.json";
import type { WhyChooseThisEntry, PerfectForEntry } from "@/lib/types";

const wctLibrary = wctData as WhyChooseThisEntry[];
const pfLibrary = pfData as PerfectForEntry[];

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { productId, productType, productStyles, seasonalOverrides } = await req.json();
  const styles: string[] = Array.isArray(productStyles) ? productStyles : [productStyles].filter(Boolean);

  let title = "";
  let descriptionText = "";
  if (productId) {
    try {
      const { product } = await getProductWithMetafields(`gid://shopify/Product/${productId}`);
      title = product.title;
      descriptionText = product.descriptionHtml.replace(/<[^>]+>/g, " ").trim();
    } catch {
      // non-fatal — preview still works without product data
    }
  }

  const ctx = { title, descriptionText, productType, productStyles: styles };
  const settings = await getSettings();

  const wct = assignWhyChooseThis(ctx, wctLibrary);
  const pf = assignPerfectFor(ctx, pfLibrary, settings.dateRanges, new Date(), undefined, seasonalOverrides);

  const wctCategories = ["Stands Out", "Gift Impact", "Trusted Pick", "Worth Keeping"];
  const wctSlotCounts = wctCategories.map(
    (category) => wctLibrary.filter(
      (e) => e.productType === ctx.productType && ctx.productStyles.includes(e.productStyle) && e.category === category
    ).length
  );
  const wctHasAlternatives = wctSlotCounts.some((c) => c > 1);
  const pfSwapCount = pfLibrary.filter((e) => {
    const typeMatch = e.productType === "ALL" || e.productType === ctx.productType;
    const styleMatch = e.productStyle === "ALL" || ctx.productStyles.includes(e.productStyle);
    return typeMatch && styleMatch;
  }).length;

  return NextResponse.json({ whyChooseThis: wct, perfectFor: pf, wctHasAlternatives, wctSlotCounts, pfSwapCount });
}
