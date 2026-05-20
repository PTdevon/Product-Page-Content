import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProductWithMetafields } from "@/lib/metafields";
import { assignWhyChooseThis, assignPerfectFor } from "@/lib/assignment-engine";
import { getSettings } from "@/lib/settings-store";
import wctData from "@/data/why-choose-this.json";
import pfData from "@/data/perfect-for.json";
import type { WhyChooseThisEntry, PerfectForEntry } from "@/lib/types";

const wctLibrary = wctData as WhyChooseThisEntry[];
const pfLibrary = pfData as PerfectForEntry[];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { id } = await params;
  const productGid = `gid://shopify/Product/${id}`;

  const { product, metafields } = await getProductWithMetafields(productGid);

  // Generate auto-preview if type+style are set
  let preview = null;
  if (metafields.productTypePt && metafields.productStylePt) {
    const ctx = {
      title: product.title,
      descriptionText: product.descriptionHtml.replace(/<[^>]+>/g, " ").trim(),
      productType: metafields.productTypePt,
      productStyles: metafields.productStylePt
        ? metafields.productStylePt.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
    };
    const settings = await getSettings();
    const wct = assignWhyChooseThis(ctx, wctLibrary);
    const pf = assignPerfectFor(ctx, pfLibrary, settings.dateRanges, new Date());
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
    preview = { whyChooseThis: wct, perfectFor: pf, wctHasAlternatives, wctSlotCounts, pfSwapCount };
  }

  return NextResponse.json({ product, metafields, preview });
}
