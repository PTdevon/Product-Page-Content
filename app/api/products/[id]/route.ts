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
      productStyle: metafields.productStylePt,
    };
    const settings = await getSettings();
    const wct = assignWhyChooseThis(ctx, wctLibrary);
    const pf = assignPerfectFor(ctx, pfLibrary, settings.dateRanges, new Date());
    preview = { whyChooseThis: wct, perfectFor: pf };
  }

  return NextResponse.json({ product, metafields, preview });
}
