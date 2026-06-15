import wctBase from "@/data/why-choose-this.json";
import { getLibraryEdits } from "./library-edits-store";
import type { WhyChooseThisEntry } from "./types";

const base = wctBase as WhyChooseThisEntry[];

export async function getWctLibrary(): Promise<WhyChooseThisEntry[]> {
  const edits = await getLibraryEdits();
  const editsMap = edits.wct;

  return [
    ...base.map((e) => {
      const edit = editsMap[e.id];
      if (!edit) return e;
      return {
        ...e,
        productType: edit.productType || e.productType,
        productStyle: edit.productStyle || e.productStyle,
        text: edit.text,
        subtext: edit.subtext,
      };
    }),
    ...Object.values(editsMap)
      .filter((e) => e.isNew)
      .map((e) => ({
        id: e.id,
        productType: e.productType,
        productStyle: e.productStyle,
        category: e.category as WhyChooseThisEntry["category"],
        text: e.text,
        subtext: e.subtext,
      })),
  ];
}
