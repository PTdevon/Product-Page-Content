import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { setProductMetafields } from "@/lib/metafields";
import { assignSeasonalPhrases } from "@/lib/assignment-engine";
import { getLibraryEdits } from "@/lib/library-edits-store";
import pfBase from "@/data/perfect-for.json";
import type { PerfectForEntry } from "@/lib/types";

interface ContentRowSave {
  productId: string;
  summary: string;
  wctBullets: [string, string, string, string];
  pfBullets: [string, string, string, string];
  pfIcons: [string, string, string, string];
  productTypePt?: string;
  productStylePt?: string;
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { rows } = await req.json() as { rows: ContentRowSave[] };

  const libraryEdits = await getLibraryEdits();
  const pfEditsMap = libraryEdits.pf;
  const pfLibrary: PerfectForEntry[] = [
    ...(pfBase as PerfectForEntry[]).map((e) => pfEditsMap[e.id] ? { ...e, phrase: pfEditsMap[e.id].phrase, icon: pfEditsMap[e.id].icon, timeSensitive: pfEditsMap[e.id].timeSensitive as PerfectForEntry["timeSensitive"] } : e),
    ...Object.values(pfEditsMap).filter((e) => e.isNew).map((e) => ({
      id: e.id, productType: e.productType, productStyle: e.productStyle,
      category: e.category as PerfectForEntry["category"], phrase: e.phrase, icon: e.icon,
      timeSensitive: e.timeSensitive as PerfectForEntry["timeSensitive"],
      filterByInterest: e.filterByInterest, applicabilityCount: e.applicabilityCount,
    })),
  ];

  let saved = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const seasonal = row.productTypePt !== undefined
        ? assignSeasonalPhrases(
            { title: "", descriptionText: "", productType: row.productTypePt, productStyles: row.productStylePt ? row.productStylePt.split(",").map((s) => s.trim()).filter(Boolean) : [] },
            pfLibrary
          )
        : null;

      await setProductMetafields(row.productId, {
        ...(row.productTypePt !== undefined && { productTypePt: row.productTypePt }),
        ...(row.productStylePt !== undefined && { productStylePt: row.productStylePt }),
        ...(seasonal && {
          seasonalOverrides: {
            mothersDay:    seasonal.mothersDay    ?? { phrase: "", icon: "" },
            fathersDay:    seasonal.fathersDay    ?? { phrase: "", icon: "" },
            valentinesDay: seasonal.valentinesDay ?? { phrase: "", icon: "" },
          },
        }),
        productSummary: row.summary,
        whyChooseThis: {
          bullet1: row.wctBullets[0],
          bullet2: row.wctBullets[1],
          bullet3: row.wctBullets[2],
          bullet4: row.wctBullets[3],
        },
        perfectFor: {
          bullet1: row.pfBullets[0],
          bullet2: row.pfBullets[1],
          bullet3: row.pfBullets[2],
          bullet4: row.pfBullets[3],
          icon1: row.pfIcons[0],
          icon2: row.pfIcons[1],
          icon3: row.pfIcons[2],
          icon4: row.pfIcons[3],
        },
      });
      saved++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ saved, failed });
}
