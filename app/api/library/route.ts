import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPfIconOverrides, setPfIconOverride, deletePfIconOverride } from "@/lib/pf-icon-overrides-store";
import { getLibraryEdits } from "@/lib/library-edits-store";
import wctData from "@/data/why-choose-this.json";
import pfData from "@/data/perfect-for.json";
import type { WhyChooseThisEntry, PerfectForEntry } from "@/lib/types";

const wctLibrary = wctData as WhyChooseThisEntry[];
const pfLibrary = pfData as PerfectForEntry[];

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") ?? "why";
  const productType = searchParams.get("productType") ?? "";
  const productStyle = searchParams.get("productStyle") ?? "";
  const category = searchParams.get("category") ?? "";
  const search = (searchParams.get("search") ?? "").toLowerCase();

  const libraryEdits = await getLibraryEdits();

  if (type === "why") {
    // Merge base library with edits: override matching entries, append new ones
    const editsMap = libraryEdits.wct;
    const base: WhyChooseThisEntry[] = wctLibrary.map((e) =>
      editsMap[e.id] ? { ...e, text: editsMap[e.id].text, subtext: editsMap[e.id].subtext } : e
    );
    const newEntries: WhyChooseThisEntry[] = Object.values(editsMap)
      .filter((e) => e.isNew)
      .map((e) => ({ id: e.id, productType: e.productType, productStyle: e.productStyle, category: e.category as WhyChooseThisEntry["category"], text: e.text, subtext: e.subtext }));

    let results = [...base, ...newEntries];
    if (productType) results = results.filter((e) => e.productType === productType);
    if (productStyle) results = results.filter((e) => e.productStyle === productStyle);
    if (category) results = results.filter((e) => e.category === category);
    if (search) results = results.filter((e) =>
      e.text.toLowerCase().includes(search) || e.subtext.toLowerCase().includes(search)
    );

    // Attach edit metadata so the UI can show edit/push state
    const withMeta = results.map((e) => ({ ...e, _edit: editsMap[e.id] ?? null }));
    return NextResponse.json({ entries: withMeta, total: withMeta.length });
  } else {
    const editsMap = libraryEdits.pf;
    const iconOverrides = await getPfIconOverrides();

    const base: PerfectForEntry[] = pfLibrary.map((e) => {
      const edit = editsMap[e.id];
      return {
        ...e,
        phrase: edit ? edit.phrase : e.phrase,
        icon: iconOverrides[e.id] ?? (edit ? edit.icon : e.icon),
      };
    });
    const newEntries: PerfectForEntry[] = Object.values(editsMap)
      .filter((e) => e.isNew)
      .map((e) => ({
        id: e.id, productType: e.productType, productStyle: e.productStyle,
        category: e.category as PerfectForEntry["category"], phrase: e.phrase,
        icon: e.icon, timeSensitive: e.timeSensitive as PerfectForEntry["timeSensitive"],
        filterByInterest: e.filterByInterest, applicabilityCount: e.applicabilityCount,
      }));

    let results = [...base, ...newEntries];
    if (productType) results = results.filter((e) => e.productType === productType || e.productType === "ALL");
    if (productStyle) results = results.filter((e) => e.productStyle === productStyle || e.productStyle === "ALL");
    if (category) results = results.filter((e) => e.category === category);
    if (search) results = results.filter((e) => e.phrase.toLowerCase().includes(search));

    const withMeta = results.map((e) => ({ ...e, _edit: editsMap[e.id] ?? null }));
    return NextResponse.json({ entries: withMeta, total: withMeta.length });
  }
}

export async function PATCH(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { id, icon } = await req.json() as { id: string; icon: string | null };
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  if (icon === null) {
    await deletePfIconOverride(id);
  } else {
    await setPfIconOverride(id, icon);
  }

  return NextResponse.json({ ok: true });
}
