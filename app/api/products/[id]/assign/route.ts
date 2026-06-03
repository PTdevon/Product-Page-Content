import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { setProductMetafields } from "@/lib/metafields";
import { getTaxonomy } from "@/lib/taxonomy-store";
import { assignSeasonalPhrases } from "@/lib/assignment-engine";
import { getLibraryEdits } from "@/lib/library-edits-store";
import pfBase from "@/data/perfect-for.json";
import type { PerfectForEntry } from "@/lib/types";

interface AssignBody {
  productSummary: string;
  productTypePt: string;
  productStylesPt: string[];
  whyChooseThis: { bullet1: string; bullet2: string; bullet3: string; bullet4: string };
  perfectFor: {
    bullet1: string; bullet2: string; bullet3: string; bullet4: string;
    icon1: string; icon2: string; icon3: string; icon4: string;
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { id } = await params;
  const productGid = `gid://shopify/Product/${id}`;

  const body = (await req.json()) as AssignBody;

  const styles = body.productStylesPt ?? [];
  if (body.productTypePt && styles.length > 0) {
    const taxonomy = await getTaxonomy();
    const validStyles = taxonomy[body.productTypePt] ?? [];
    const invalid = styles.find((s) => !validStyles.includes(s));
    if (invalid) {
      return NextResponse.json(
        { error: `"${invalid}" is not a valid style for "${body.productTypePt}"` },
        { status: 400 }
      );
    }
  }

  try {
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

    const ctx = { title: "", descriptionText: "", productType: body.productTypePt, productStyles: styles };
    const seasonal = assignSeasonalPhrases(ctx, pfLibrary);

    await setProductMetafields(productGid, {
      productSummary: body.productSummary,
      productTypePt: body.productTypePt,
      productStylePt: styles.join(","),
      seasonalOverrides: {
        mothersDay:    seasonal.mothersDay    ?? { phrase: "", icon: "" },
        fathersDay:    seasonal.fathersDay    ?? { phrase: "", icon: "" },
        valentinesDay: seasonal.valentinesDay ?? { phrase: "", icon: "" },
      },
      whyChooseThis: body.whyChooseThis,
      perfectFor: {
        bullet1: body.perfectFor.bullet1,
        bullet2: body.perfectFor.bullet2,
        bullet3: body.perfectFor.bullet3,
        bullet4: body.perfectFor.bullet4,
        icon1: body.perfectFor.icon1,
        icon2: body.perfectFor.icon2,
        icon3: body.perfectFor.icon3,
        icon4: body.perfectFor.icon4,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
