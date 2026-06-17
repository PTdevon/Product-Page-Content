/**
 * One-off script: generates product summary, Why Choose This, and Perfect For
 * content for every product that has Type + Style classified but is missing
 * content, skipping products that are already content-complete or already
 * approved.
 *
 * Each eligible product is fetched once during the scan (title, description,
 * price, type, style) — no redundant per-product re-fetch. Summary
 * generation calls Anthropic sequentially and retries rate-limited requests
 * with backoff before skipping; credits-exhausted / invalid-key errors stop
 * the run early since they won't recover mid-run. The script is safe to
 * re-run — it only ever targets products that are still missing content.
 *
 * Usage:
 *   npm run populate-content                       (live run)
 *   npm run populate-content -- --dry-run           (preview — nothing is written)
 *   npm run populate-content -- --limit 5           (cap how many products are processed)
 */

import { shopifyGraphQL } from "../lib/shopify";
import { setProductMetafields } from "../lib/metafields";
import { assignWhyChooseThis, assignPerfectFor, type ProductContext } from "../lib/assignment-engine";
import { generateProductSummary } from "../lib/generate-summary";
import { getSettings } from "../lib/settings-store";
import { getPfLibrary } from "../lib/pf-store";
import { getWctLibrary } from "../lib/wct-store";
import { classifyStatus, contentStatus } from "../lib/product-filters";
import { getHiddenProductIds } from "../lib/hidden-products";

const DRY_RUN = process.argv.includes("--dry-run");
const limitArgIndex = process.argv.indexOf("--limit");
const LIMIT = limitArgIndex !== -1 ? parseInt(process.argv[limitArgIndex + 1], 10) : undefined;

const SCAN_QUERY = `
  query ScanProducts($cursor: String) {
    products(first: 250, after: $cursor, query: "-status:archived AND -tag:hidden") {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          descriptionHtml
          priceRangeV2 { minVariantPrice { amount } }
          productTypePt:  metafield(namespace: "product",         key: "product_type")      { value }
          productStylePt: metafield(namespace: "product",         key: "product_style")     { value }
          productSummary: metafield(namespace: "product",         key: "product_summary")   { value }
          humanReviewed:  metafield(namespace: "product",         key: "approved")          { value }
          wctBullet1:     metafield(namespace: "why-choose-this", key: "bullet_1")          { value }
          pfBullet1:      metafield(namespace: "perfect-for",     key: "perfect_bullet_1")  { value }
        }
      }
    }
  }
`;

type MF = { value: string } | null;
type Product = {
  id: string;
  title: string;
  descriptionHtml: string;
  priceRangeV2: { minVariantPrice: { amount: string } } | null;
  productTypePt: MF;
  productStylePt: MF;
  productSummary: MF;
  humanReviewed: MF;
  wctBullet1: MF;
  pfBullet1: MF;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!process.env.SHOPIFY_STORE_DOMAIN || !process.env.SHOPIFY_ACCESS_TOKEN) {
    console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ACCESS_TOKEN in environment.");
    process.exit(1);
  }

  if (DRY_RUN) console.log("--- DRY RUN — nothing will be generated or written ---\n");
  if (LIMIT !== undefined) console.log(`Limiting to ${LIMIT} product(s).\n`);

  console.log("Scanning products…\n");

  const hiddenProductIds = await getHiddenProductIds();

  let cursor: string | null = null;
  let totalScanned = 0;
  let totalSkipped = 0;
  const eligible: Product[] = [];

  while (true) {
    const data = await shopifyGraphQL<{
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string };
        edges: { node: Product }[];
      };
    }>(SCAN_QUERY, { cursor });

    for (const { node } of data.products.edges) {
      totalScanned++;

      if (hiddenProductIds.has(node.id)) { totalSkipped++; continue; }

      const cs = classifyStatus(node);
      const contentSt = contentStatus({
        productSummary: node.productSummary,
        wctBullet1: node.wctBullet1,
        pfBullet1: node.pfBullet1,
        seasonalMdPhrase: null,
        seasonalFdPhrase: null,
        seasonalVdPhrase: null,
      });

      if (cs !== "complete" || contentSt === "complete" || node.humanReviewed?.value === "true") {
        totalSkipped++;
        continue;
      }

      eligible.push(node);
      if (LIMIT !== undefined && eligible.length >= LIMIT) break;
    }

    if (LIMIT !== undefined && eligible.length >= LIMIT) break;
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }

  console.log(`Scanned ${totalScanned} products.`);
  console.log(`${eligible.length} product(s) need content, ${totalSkipped} skipped.\n`);

  if (eligible.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (DRY_RUN) {
    eligible.forEach((p) => console.log(`  would populate: ${p.title}`));
    console.log(`\nDry run complete — ${eligible.length} product(s) would be populated.`);
    return;
  }

  const [settings, pfLibrary, wctLibrary] = await Promise.all([getSettings(), getPfLibrary(), getWctLibrary()]);
  const today = new Date();

  let succeeded = 0;
  let failed = 0;
  let fatalError: string | null = null;

  for (const product of eligible) {
    if (fatalError) {
      failed++;
      console.log(`  ✗ Skipped (fatal error stopped the run): ${product.title}`);
      continue;
    }

    const type = product.productTypePt!.value;
    const styles = product.productStylePt!.value.split(",").map((s) => s.trim()).filter(Boolean);
    const price = parseFloat(product.priceRangeV2?.minVariantPrice?.amount ?? "0") || 0;

    const ctx: ProductContext = {
      title: product.title,
      descriptionText: product.descriptionHtml.replace(/<[^>]+>/g, " ").trim(),
      productType: type,
      productStyles: styles,
      price,
    };

    const wct = assignWhyChooseThis(ctx, wctLibrary);
    const pf = assignPerfectFor(ctx, pfLibrary, settings.dateRanges, today, undefined, undefined, settings.interestKeywords);

    let summaryText: string | undefined;
    const RETRY_DELAYS_MS = [5000, 15000, 30000];
    for (let attempt = 0; ; attempt++) {
      const summaryResult = await generateProductSummary(
        {
          title: product.title,
          descriptionHtml: product.descriptionHtml,
          productType: type,
          productStyle: styles.join(", "),
        },
        1
      );

      if (!("error" in summaryResult)) {
        summaryText = summaryResult.options[0];
        break;
      }

      const isNonTransient = summaryResult.error.type === "credits_exhausted" || summaryResult.error.type === "invalid_key";
      if (isNonTransient) {
        fatalError = summaryResult.error.message;
        break;
      }

      if (summaryResult.error.type === "rate_limited" && attempt < RETRY_DELAYS_MS.length) {
        console.log(`  … rate limited, retrying in ${RETRY_DELAYS_MS[attempt] / 1000}s: ${product.title}`);
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }

      break; // non-retryable or out of retries — leave summaryText undefined and skip
    }

    if (fatalError) {
      failed++;
      console.log(`  ✗ Fatal error, stopping run: ${fatalError}`);
      continue;
    }

    if (!summaryText) {
      failed++;
      console.log(`  ✗ Failed to generate summary: ${product.title}`);
      continue;
    }

    try {
      await setProductMetafields(product.id, {
        productSummary: summaryText,
        humanReviewed: "false",
        whyChooseThis: wct,
        perfectFor: {
          bullet1: pf.bullets[0] ?? "",
          bullet2: pf.bullets[1] ?? "",
          bullet3: pf.bullets[2] ?? "",
          bullet4: pf.bullets[3] ?? "",
          icon1: pf.icons[0] ?? "",
          icon2: pf.icons[1] ?? "",
          icon3: pf.icons[2] ?? "",
          icon4: pf.icons[3] ?? "",
        },
      });
      succeeded++;
      console.log(`  ✓ Populated: ${product.title}`);
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : "Unknown error";
      console.log(`  ✗ Write failed: ${product.title} (${message})`);
    }
  }

  console.log(`\nDone. Populated ${succeeded} product(s), ${failed} failed/skipped.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
