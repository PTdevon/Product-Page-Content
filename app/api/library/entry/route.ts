import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  upsertWCTEdit, upsertPFEdit,
  deleteWCTEdit, deletePFEdit,
  type WCTEdit, type PFEdit,
} from "@/lib/library-edits-store";
import wctData from "@/data/why-choose-this.json";
import pfData from "@/data/perfect-for.json";
import type { WhyChooseThisEntry, PerfectForEntry } from "@/lib/types";

const wctLibrary = wctData as WhyChooseThisEntry[];
const pfLibrary = pfData as PerfectForEntry[];

function formatWCT(text: string, subtext: string) {
  return `<strong>${text}</strong> ${subtext}`;
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const body = await req.json() as {
    type: "wct" | "pf";
    entry: Partial<WCTEdit & PFEdit> & { id?: string };
  };

  if (body.type === "wct") {
    const { id, productType, productStyle, category, text, subtext } = body.entry as WCTEdit;

    const isNew = !id || id.startsWith("wct-custom-");
    const entryId = id || `wct-custom-${Date.now()}`;

    // For existing base entries, searchFormatted is the original JSON value (what's in Shopify)
    // For new entries, there's nothing to search for
    let searchFormatted = "";
    if (!isNew) {
      const base = wctLibrary.find((e) => e.id === entryId);
      // If already has an edit, its current searchFormatted is in the store — caller must pass it
      searchFormatted = (body.entry as WCTEdit).searchFormatted || (base ? formatWCT(base.text, base.subtext) : "");
    }

    await upsertWCTEdit({ id: entryId, productType, productStyle, category, text, subtext, searchFormatted, isNew: !!isNew });
    return NextResponse.json({ ok: true, id: entryId });
  }

  if (body.type === "pf") {
    const { id, productType, productStyle, category, phrase, icon, timeSensitive, filterByInterest, applicabilityCount } = body.entry as PFEdit;

    const isNew = !id || id.startsWith("pf-custom-");
    const entryId = id || `pf-custom-${Date.now()}`;

    let searchPhrase = "";
    if (!isNew) {
      const base = pfLibrary.find((e) => e.id === entryId);
      searchPhrase = (body.entry as PFEdit).searchPhrase || (base?.phrase ?? "");
    }

    await upsertPFEdit({
      id: entryId, productType, productStyle, category, phrase,
      icon: icon ?? "", timeSensitive: timeSensitive ?? null,
      filterByInterest: filterByInterest ?? false,
      applicabilityCount: applicabilityCount ?? 0,
      searchPhrase, isNew: !!isNew,
    });
    return NextResponse.json({ ok: true, id: entryId });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const authError = await requireAuth(req);
  if (authError) return authError;

  const { type, id } = await req.json() as { type: "wct" | "pf"; id: string };
  if (type === "wct") await deleteWCTEdit(id);
  else await deletePFEdit(id);

  return NextResponse.json({ ok: true });
}
