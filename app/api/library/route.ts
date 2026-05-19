import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
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

  if (type === "why") {
    let results = wctLibrary;
    if (productType) results = results.filter((e) => e.productType === productType);
    if (productStyle) results = results.filter((e) => e.productStyle === productStyle);
    if (category) results = results.filter((e) => e.category === category);
    if (search) results = results.filter((e) =>
      e.text.toLowerCase().includes(search) || e.subtext.toLowerCase().includes(search)
    );
    return NextResponse.json({ entries: results, total: results.length });
  } else {
    let results = pfLibrary;
    if (productType) results = results.filter((e) => e.productType === productType || e.productType === "ALL");
    if (productStyle) results = results.filter((e) => e.productStyle === productStyle || e.productStyle === "ALL");
    if (category) results = results.filter((e) => e.category === category);
    if (search) results = results.filter((e) => e.phrase.toLowerCase().includes(search));
    return NextResponse.json({ entries: results, total: results.length });
  }
}
