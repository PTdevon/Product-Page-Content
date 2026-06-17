/**
 * Scans all products and reports "orphaned" phrases: values stored in product
 * metafields that no longer exist in the master WCT library, PF phrases library,
 * or product type/style taxonomy.
 *
 * Usage:
 *   npm run check-orphaned-phrases
 */

import fs from "fs/promises";
import path from "path";
import { shopifyGraphQL } from "../lib/shopify";
import { getLibraryEdits } from "../lib/library-edits-store";
import { getTaxonomy } from "../lib/taxonomy-store";

const REPORT_PATH = path.join(process.cwd(), "orphaned-phrases-report.json");

const SCAN_QUERY = `
  query ScanProducts($first: Int!, $after: String) {
    products(first: $first, after: $after, query: "-status:archived AND -tag:hidden") {
      edges {
        node {
          id title handle
          wct1: metafield(namespace: "why-choose-this", key: "bullet_1") { value }
          wct2: metafield(namespace: "why-choose-this", key: "bullet_2") { value }
          wct3: metafield(namespace: "why-choose-this", key: "bullet_3") { value }
          wct4: metafield(namespace: "why-choose-this", key: "bullet_4") { value }
          pf1:  metafield(namespace: "perfect-for", key: "perfect_bullet_1") { value }
          pf2:  metafield(namespace: "perfect-for", key: "perfect_bullet_2") { value }
          pf3:  metafield(namespace: "perfect-for", key: "perfect_bullet_3") { value }
          pf4:  metafield(namespace: "perfect-for", key: "perfect_bullet_4") { value }
          productType:  metafield(namespace: "product", key: "product_type")  { value }
          productStyle: metafield(namespace: "product", key: "product_style") { value }
        }
        cursor
      }
      pageInfo { hasNextPage }
    }
  }
`;

type MF = { value: string } | null;
type Product = {
  id: string; title: string; handle: string;
  wct1: MF; wct2: MF; wct3: MF; wct4: MF;
  pf1:  MF; pf2:  MF; pf3:  MF; pf4:  MF;
  productType:  MF;
  productStyle: MF;
};
type ScanResult = {
  products: {
    edges: { node: Product; cursor: string }[];
    pageInfo: { hasNextPage: boolean };
  };
};

type WctOrphan  = { key: string; value: string };
type PfOrphan   = { key: string; value: string };
type TaxOrphan  = { field: "type" | "style"; value: string; note: string };
type ProductReport = {
  id: string; title: string; handle: string;
  wctOrphans:  WctOrphan[];
  pfOrphans:   PfOrphan[];
  taxOrphans:  TaxOrphan[];
};

(async () => {
  if (!process.env.SHOPIFY_STORE_DOMAIN || !process.env.SHOPIFY_ACCESS_TOKEN) {
    console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ACCESS_TOKEN in environment.");
    process.exit(1);
  }

  // ── Build valid sets from master libraries ──────────────────────────────────

  console.log("Loading master libraries…");
  const [edits, PRODUCT_TAXONOMY] = await Promise.all([getLibraryEdits(), getTaxonomy()]);

  const validWct = new Set<string>();
  for (const entry of Object.values(edits.wct)) {
    // Accept either the current text (what a fresh push would write)...
    validWct.add(`<strong>${entry.text}</strong> ${entry.subtext}`);
    // ...or the previously-pushed text still on older products
    if (entry.searchFormatted) validWct.add(entry.searchFormatted);
  }

  const validPf = new Set<string>();
  for (const entry of Object.values(edits.pfPhrases)) {
    if (!entry.deleted && entry.phrase) validPf.add(entry.phrase);
  }

  console.log(`  WCT library: ${validWct.size} entries`);
  console.log(`  PF phrases:  ${validPf.size} entries`);
  console.log(`  Taxonomy:    ${Object.keys(PRODUCT_TAXONOMY).length} product types\n`);

  // ── Scan products ───────────────────────────────────────────────────────────

  console.log("Scanning products…\n");

  const reports: ProductReport[] = [];
  let cursor: string | null = null;
  let total = 0;

  while (true) {
    const data = await shopifyGraphQL<ScanResult>(SCAN_QUERY, { first: 250, after: cursor });
    total += data.products.edges.length;

    for (const { node } of data.products.edges) {
      const wctOrphans:  WctOrphan[]  = [];
      const pfOrphans:   PfOrphan[]   = [];
      const taxOrphans:  TaxOrphan[]  = [];

      // WCT bullets
      const wctBullets: [string, MF][] = [
        ["bullet_1", node.wct1], ["bullet_2", node.wct2],
        ["bullet_3", node.wct3], ["bullet_4", node.wct4],
      ];
      for (const [key, mf] of wctBullets) {
        if (mf?.value && !validWct.has(mf.value)) {
          wctOrphans.push({ key, value: mf.value });
        }
      }

      // PF bullets
      const pfBullets: [string, MF][] = [
        ["perfect_bullet_1", node.pf1], ["perfect_bullet_2", node.pf2],
        ["perfect_bullet_3", node.pf3], ["perfect_bullet_4", node.pf4],
      ];
      for (const [key, mf] of pfBullets) {
        if (mf?.value && !validPf.has(mf.value)) {
          pfOrphans.push({ key, value: mf.value });
        }
      }

      // Taxonomy: type and styles
      const type  = node.productType?.value ?? "";
      const styleRaw = node.productStyle?.value ?? "";
      const styles = styleRaw ? styleRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];

      if (type && !(type in PRODUCT_TAXONOMY)) {
        taxOrphans.push({ field: "type", value: type, note: "not in taxonomy" });
      } else if (type) {
        for (const style of styles) {
          if (!PRODUCT_TAXONOMY[type].includes(style)) {
            taxOrphans.push({ field: "style", value: style, note: `not valid for "${type}"` });
          }
        }
      }

      if (wctOrphans.length || pfOrphans.length || taxOrphans.length) {
        reports.push({ id: node.id, title: node.title, handle: node.handle, wctOrphans, pfOrphans, taxOrphans });
      }
    }

    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.edges[data.products.edges.length - 1]?.cursor ?? null;
    process.stdout.write(`\rScanned ${total} products…`);
  }

  process.stdout.write(`\rScanned ${total} products.   \n\n`);

  // ── Report ──────────────────────────────────────────────────────────────────

  const wctProducts  = reports.filter((r) => r.wctOrphans.length);
  const pfProducts   = reports.filter((r) => r.pfOrphans.length);
  const taxProducts  = reports.filter((r) => r.taxOrphans.length);

  const totalWct = wctProducts.reduce((n, r) => n + r.wctOrphans.length, 0);
  const totalPf  = pfProducts.reduce((n, r) => n + r.pfOrphans.length, 0);

  if (reports.length === 0) {
    console.log("No orphaned phrases found. All product content matches the master libraries.");
  } else {
    if (wctProducts.length) {
      console.log(`── WCT orphans (${totalWct} bullet${totalWct !== 1 ? "s" : ""} across ${wctProducts.length} product${wctProducts.length !== 1 ? "s" : ""}) ──`);
      for (const r of wctProducts) {
        console.log(`  ${r.title} (${r.handle})`);
        for (const o of r.wctOrphans) console.log(`    ${o.key}: ${o.value}`);
      }
      console.log();
    }

    if (pfProducts.length) {
      console.log(`── PF orphans (${totalPf} bullet${totalPf !== 1 ? "s" : ""} across ${pfProducts.length} product${pfProducts.length !== 1 ? "s" : ""}) ──`);
      for (const r of pfProducts) {
        console.log(`  ${r.title} (${r.handle})`);
        for (const o of r.pfOrphans) console.log(`    ${o.key}: ${o.value}`);
      }
      console.log();
    }

    if (taxProducts.length) {
      console.log(`── Taxonomy orphans (${taxProducts.length} product${taxProducts.length !== 1 ? "s" : ""}) ──`);
      for (const r of taxProducts) {
        for (const o of r.taxOrphans) {
          console.log(`  ${r.title} — ${o.field}: "${o.value}" (${o.note})`);
        }
      }
      console.log();
    }
  }

  await fs.writeFile(REPORT_PATH, JSON.stringify({ scanned: total, reports }, null, 2), "utf-8");
  console.log(`Results written to orphaned-phrases-report.json`);
})();
