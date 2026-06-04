import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getLibraryEdits } from "@/lib/library-edits-store";
import { getPfLibrary, getPfPhraseRows, savePhraseIcon, findPhraseIdByText } from "@/lib/pf-store";
import wctData from "@/data/why-choose-this.json";
import type { WhyChooseThisEntry } from "@/lib/types";

const wctLibrary = wctData as WhyChooseThisEntry[];

export async function GET(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") ?? "why";
  const productType = searchParams.get("productType") ?? "";
  const productStyle = searchParams.get("productStyle") ?? "";
  const category = searchParams.get("category") ?? "";
  const search = (searchParams.get("search") ?? "").toLowerCase();
  const format = searchParams.get("format") ?? "flat";

  const libraryEdits = await getLibraryEdits();

  if (type === "why") {
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

    const withMeta = results.map((e) => ({ ...e, _edit: editsMap[e.id] ?? null }));
    return NextResponse.json({ entries: withMeta, total: withMeta.length });
  } else {
    // Perfect For — two response formats
    if (format === "phrases") {
      // Phrase-centric view for the library management UI
      const rows = await getPfPhraseRows({
        productType: productType || undefined,
        productStyle: productStyle || undefined,
        category: category || undefined,
        search: search || undefined,
      });
      return NextResponse.json({ phrases: rows, total: rows.length });
    } else {
      // Flat view for SwapModal and other consumers
      let results = await getPfLibrary();
      if (productType) results = results.filter((e) => e.productType === productType || e.productType === "ALL");
      if (productStyle) results = results.filter((e) => e.productStyle === productStyle || e.productStyle === "ALL");
      if (category) results = results.filter((e) => e.category === category);
      if (search) results = results.filter((e) => e.phrase.toLowerCase().includes(search));

      const pfPhraseEdits = libraryEdits.pfPhrases;
      const withMeta = results.map((e) => ({ ...e, _edit: pfPhraseEdits[e.phraseId] ?? null }));
      return NextResponse.json({ entries: withMeta, total: withMeta.length });
    }
  }
}

export async function PATCH(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { phraseId, phrase: phraseText, icon } = await req.json() as {
    phraseId?: string;
    phrase?: string;
    icon: string | null;
  };

  // Resolve phraseId — can be passed directly or looked up by phrase text
  let resolvedPhraseId = phraseId;
  if (!resolvedPhraseId && phraseText) {
    resolvedPhraseId = await findPhraseIdByText(phraseText) ?? undefined;
  }

  if (!resolvedPhraseId) {
    return NextResponse.json({ error: "phraseId or phrase required" }, { status: 400 });
  }

  if (icon !== null && icon !== undefined) {
    await savePhraseIcon(resolvedPhraseId, icon);
  }

  return NextResponse.json({ ok: true });
}
