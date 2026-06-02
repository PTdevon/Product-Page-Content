import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProductWithMetafields } from "@/lib/metafields";
import { assignWhyChooseThis, assignPerfectFor } from "@/lib/assignment-engine";
import { generateProductSummary } from "@/lib/generate-summary";
import { getSettings } from "@/lib/settings-store";
import { resolveIconForMetafield } from "@/lib/icons";
import wctData from "@/data/why-choose-this.json";
import pfData from "@/data/perfect-for.json";
import type { WhyChooseThisEntry, PerfectForEntry } from "@/lib/types";

const wctLibrary = wctData as WhyChooseThisEntry[];
const pfLibrary = pfData as PerfectForEntry[];

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { productId } = await req.json() as { productId: string };

  const { product, metafields } = await getProductWithMetafields(productId);

  const type = metafields.productTypePt;
  const styles = metafields.productStylePt
    ? metafields.productStylePt.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  if (!type || styles.length === 0) {
    return NextResponse.json({ error: "No type/style set" }, { status: 400 });
  }

  const ctx = {
    title: product.title,
    descriptionText: product.descriptionHtml.replace(/<[^>]+>/g, " ").trim(),
    productType: type,
    productStyles: styles,
  };

  const settings = await getSettings();
  const today = new Date();

  const wct = assignWhyChooseThis(ctx, wctLibrary);
  const pf = assignPerfectFor(ctx, pfLibrary, settings.dateRanges, today, undefined, undefined, settings.interestKeywords);

  const summaryResult = await generateProductSummary({
    title: product.title,
    descriptionHtml: product.descriptionHtml,
    productType: type,
    productStyle: styles.join(", "),
  });

  if ("error" in summaryResult) {
    return NextResponse.json({ error: summaryResult.error }, { status: 422 });
  }

  const summary = summaryResult.options[0] ?? "";

  return NextResponse.json({
    summary,
    wctBullets: [wct.bullet1, wct.bullet2, wct.bullet3, wct.bullet4] as [string, string, string, string],
    pfBullets: [
      pf.bullets[0] ?? "",
      pf.bullets[1] ?? "",
      pf.bullets[2] ?? "",
      pf.bullets[3] ?? "",
    ] as [string, string, string, string],
    pfIcons: [
      resolveIconForMetafield(pf.icons[0] ?? ""),
      resolveIconForMetafield(pf.icons[1] ?? ""),
      resolveIconForMetafield(pf.icons[2] ?? ""),
      resolveIconForMetafield(pf.icons[3] ?? ""),
    ] as [string, string, string, string],
  });
}
