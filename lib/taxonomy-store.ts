import fs from "fs/promises";
import path from "path";
import { PRODUCT_TAXONOMY } from "@/data/taxonomy";

const OVERRIDE_PATH = path.join(process.cwd(), "data", "taxonomy-custom.json");

export async function getTaxonomy(): Promise<Record<string, string[]>> {
  try {
    const raw = await fs.readFile(OVERRIDE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return PRODUCT_TAXONOMY;
  }
}

export async function saveTaxonomy(taxonomy: Record<string, string[]>): Promise<void> {
  await fs.writeFile(OVERRIDE_PATH, JSON.stringify(taxonomy, null, 2), "utf-8");
}
