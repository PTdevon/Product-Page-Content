import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getProductsBatchWithMetafields } from "@/lib/metafields";
import { assignWhyChooseThis, assignPerfectFor } from "@/lib/assignment-engine";
import { generateProductSummary } from "@/lib/generate-summary";
import { getSettings } from "@/lib/settings-store";
import { getLibraryEdits } from "@/lib/library-edits-store";
import wctData from "@/data/why-choose-this.json";
import { getPfLibrary } from "@/lib/pf-store";
import type { WhyChooseThisEntry } from "@/lib/types";

const wctBase = wctData as WhyChooseThisEntry[];

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { productIds } = await req.json() as { productIds: string[] };

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return NextResponse.json({ error: "No products" }, { status: 400 });
  }

  const [settings, libraryEdits, pfLibrary, products] = await Promise.all([
    getSettings(),
    getLibraryEdits(),
    getPfLibrary(),
    getProductsBatchWithMetafields(productIds),
  ]);

  const wctEditsMap = libraryEdits.wct;
  const wctLibrary: WhyChooseThisEntry[] = [
    ...wctBase.map((e) => wctEditsMap[e.id] ? { ...e, text: wctEditsMap[e.id].text, subtext: wctEditsMap[e.id].subtext } : e),
    ...Object.values(wctEditsMap).filter((e) => e.isNew).map((e) => ({
      id: e.id, productType: e.productType, productStyle: e.productStyle,
      category: e.category as WhyChooseThisEntry["category"], text: e.text, subtext: e.subtext,
    })),
  ];

  const today = new Date();

  const rows = await Promise.all(
    products.map(async ({ product, metafields }) => {
      const productId = product.id;

      const hasContent = !!(
        metafields.productSummary &&
        metafields.whyChooseThis.bullet1 &&
        metafields.perfectFor.bullet1
      );

      if (hasContent) {
        return {
          productId,
          title: product.title,
          imageUrl: product.featuredImage?.url ?? null,
          productTypePt: metafields.productTypePt,
          productStylePt: metafields.productStylePt,
          summary: metafields.productSummary,
          wctBullets: [
            metafields.whyChooseThis.bullet1,
            metafields.whyChooseThis.bullet2,
            metafields.whyChooseThis.bullet3,
            metafields.whyChooseThis.bullet4,
          ] as [string, string, string, string],
          pfBullets: [
            metafields.perfectFor.bullet1,
            metafields.perfectFor.bullet2,
            metafields.perfectFor.bullet3,
            metafields.perfectFor.bullet4,
          ] as [string, string, string, string],
          pfIcons: [
            metafields.perfectFor.icon1,
            metafields.perfectFor.icon2,
            metafields.perfectFor.icon3,
            metafields.perfectFor.icon4,
          ] as [string, string, string, string],
          source: "existing" as const,
          skip: false,
          regenerating: false,
        };
      }

      // No content — generate it only if type + style are set
      const type   = metafields.productTypePt;
      const styles = metafields.productStylePt
        ? metafields.productStylePt.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      if (!type || styles.length === 0) {
        return {
          productId,
          title: product.title,
          imageUrl: product.featuredImage?.url ?? null,
          productTypePt: type,
          productStylePt: metafields.productStylePt,
          summary: "",
          wctBullets: ["", "", "", ""] as [string, string, string, string],
          pfBullets:  ["", "", "", ""] as [string, string, string, string],
          pfIcons:    ["", "", "", ""] as [string, string, string, string],
          source: "needs-classify" as const,
          skip: true,
          regenerating: false,
        };
      }

      const ctx = {
        title: product.title,
        descriptionText: product.descriptionHtml.replace(/<[^>]+>/g, " ").trim(),
        productType: type,
        productStyles: styles,
      };

      const wct = assignWhyChooseThis(ctx, wctLibrary);
      const pf  = assignPerfectFor(ctx, pfLibrary, settings.dateRanges, today, undefined, undefined, settings.interestKeywords);

      let summary = "";
      try {
        const summaryResult = await generateProductSummary({
          title: product.title,
          descriptionHtml: product.descriptionHtml,
          productType: type,
          productStyle: styles.join(", "),
        });
        if (!("error" in summaryResult)) summary = summaryResult.options[0] ?? "";
      } catch { /* leave blank if AI fails */ }

      return {
        productId,
        title: product.title,
        imageUrl: product.featuredImage?.url ?? null,
        productTypePt: type,
        productStylePt: metafields.productStylePt,
        summary,
        wctBullets: [wct.bullet1, wct.bullet2, wct.bullet3, wct.bullet4] as [string, string, string, string],
        pfBullets: [
          pf.bullets[0] ?? "",
          pf.bullets[1] ?? "",
          pf.bullets[2] ?? "",
          pf.bullets[3] ?? "",
        ] as [string, string, string, string],
        pfIcons: [
          pf.icons[0] ?? "",
          pf.icons[1] ?? "",
          pf.icons[2] ?? "",
          pf.icons[3] ?? "",
        ] as [string, string, string, string],
        source: "generated" as const,
        skip: false,
        regenerating: false,
      };
    })
  );

  return NextResponse.json({ rows });
}
