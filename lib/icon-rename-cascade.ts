import { shopifyGraphQL } from "./shopify";
import { setProductsMetafieldsBatch, type ProductMetafieldData } from "./metafields";
import { getPfLibrary } from "./pf-store";
import { savePhraseIcon } from "./pf-store";

const SCAN_QUERY = `
  query ScanIconFields($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        pfIcon1: metafield(namespace: "perfect-for", key: "icon_1") { value }
        pfIcon2: metafield(namespace: "perfect-for", key: "icon_2") { value }
        pfIcon3: metafield(namespace: "perfect-for", key: "icon_3") { value }
        pfIcon4: metafield(namespace: "perfect-for", key: "icon_4") { value }
        sMdIcon: metafield(namespace: "seasonal", key: "mothers_day_icon")      { value }
        sFdIcon: metafield(namespace: "seasonal", key: "fathers_day_icon")      { value }
        sVdIcon: metafield(namespace: "seasonal", key: "valentines_day_icon")   { value }
      }
    }
  }
`;

interface ScanResult {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string };
    nodes: Array<{
      id: string;
      pfIcon1: { value: string } | null;
      pfIcon2: { value: string } | null;
      pfIcon3: { value: string } | null;
      pfIcon4: { value: string } | null;
      sMdIcon: { value: string } | null;
      sFdIcon: { value: string } | null;
      sVdIcon: { value: string } | null;
    }>;
  };
}

function matches(field: { value: string } | null, name: string): boolean {
  const v = field?.value?.trim() ?? "";
  if (!v) return false;
  if (v === name) return true;
  // Legacy: stored as SVG with id="name"
  if (v.startsWith("<svg")) {
    const m = v.match(/\bid="([^"]+)"/);
    return m?.[1] === name;
  }
  return false;
}

export async function cascadeIconRename(
  oldName: string,
  newName: string
): Promise<{ products: number; phrases: number }> {
  // ── Products ────────────────────────────────────────────────────────────────
  const rows: Array<{ productGid: string; data: Partial<ProductMetafieldData> }> = [];
  let cursor: string | undefined;

  while (true) {
    const data = await shopifyGraphQL<ScanResult>(
      SCAN_QUERY,
      cursor ? { cursor } : {}
    );

    for (const p of data.products.nodes) {
      const pf: Partial<ProductMetafieldData["perfectFor"]> = {};
      if (matches(p.pfIcon1, oldName)) pf.icon1 = newName;
      if (matches(p.pfIcon2, oldName)) pf.icon2 = newName;
      if (matches(p.pfIcon3, oldName)) pf.icon3 = newName;
      if (matches(p.pfIcon4, oldName)) pf.icon4 = newName;

      const hasMd = matches(p.sMdIcon, oldName);
      const hasFd = matches(p.sFdIcon, oldName);
      const hasVd = matches(p.sVdIcon, oldName);
      const hasSeasonal = hasMd || hasFd || hasVd;

      const hasPf = Object.keys(pf).length > 0;

      if (hasPf || hasSeasonal) {
        const update: Partial<ProductMetafieldData> = {};
        if (hasPf) update.perfectFor = pf as ProductMetafieldData["perfectFor"];
        if (hasSeasonal) {
          // All three entries must be present; empty icon/phrase values are skipped by setProductsMetafieldsBatch
          update.seasonalOverrides = {
            mothersDay:    { phrase: "", icon: hasMd ? newName : "" },
            fathersDay:    { phrase: "", icon: hasFd ? newName : "" },
            valentinesDay: { phrase: "", icon: hasVd ? newName : "" },
          };
        }
        rows.push({ productGid: p.id, data: update });
      }
    }

    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }

  if (rows.length > 0) {
    await setProductsMetafieldsBatch(rows);
  }

  // ── Phrases ─────────────────────────────────────────────────────────────────
  const library = await getPfLibrary();
  const seen = new Set<string>();
  const phraseIds: string[] = [];

  for (const entry of library) {
    if (seen.has(entry.phraseId)) continue;
    seen.add(entry.phraseId);
    const icon = entry.icon?.trim() ?? "";
    if (icon === oldName || (icon.startsWith("<svg") && icon.match(/\bid="([^"]+)"/)?.[1] === oldName)) {
      phraseIds.push(entry.phraseId);
    }
  }

  for (const phraseId of phraseIds) {
    await savePhraseIcon(phraseId, newName);
  }

  return { products: rows.length, phrases: phraseIds.length };
}
