/**
 * One-off script: sets approved = "true" on every product that is fully
 * complete (has both Type + Style AND all three content fields: product
 * summary, Why Choose This bullet 1, and Perfect For bullet 1) but has not
 * yet been approved.
 *
 * Already-approved products are skipped (no unnecessary writes).
 * Christmas-tagged products are included by default; pass --skip-christmas
 * to exclude them.
 *
 * Usage:
 *   npm run approve-complete              (live run)
 *   npm run approve-complete -- --dry-run (preview — nothing is written)
 *   npm run approve-complete -- --skip-christmas
 */

const domain = process.env.SHOPIFY_STORE_DOMAIN!;
const token  = process.env.SHOPIFY_ACCESS_TOKEN!;
const API_VERSION = "2025-10";
const DRY_RUN       = process.argv.includes("--dry-run");
const SKIP_CHRISTMAS = process.argv.includes("--skip-christmas");

async function shopifyGQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(
    `https://${domain}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query, variables }),
    }
  );
  if (!res.ok) throw new Error(`Shopify API ${res.status} ${res.statusText}`);
  const json = await res.json();
  if (json.errors && !json.data) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data as T;
}

const SCAN_QUERY = `
  query ScanProducts($cursor: String) {
    products(first: 250, after: $cursor, query: "-status:archived AND -tag:hidden") {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          tags
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

const SET_APPROVED = `
  mutation SetApproved($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message }
    }
  }
`;

type MF = { value: string } | null;
type Product = {
  id: string;
  title: string;
  tags: string[];
  productTypePt: MF;
  productStylePt: MF;
  productSummary: MF;
  humanReviewed: MF;
  wctBullet1: MF;
  pfBullet1: MF;
};

function isComplete(p: Product): boolean {
  const hasType    = !!p.productTypePt?.value;
  const hasStyle   = !!p.productStylePt?.value;
  const hasSummary = !!p.productSummary?.value;
  const hasWct     = !!p.wctBullet1?.value;
  const hasPf      = !!p.pfBullet1?.value;
  return hasType && hasStyle && hasSummary && hasWct && hasPf;
}

async function main() {
  if (!domain || !token) {
    console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ACCESS_TOKEN in environment.");
    process.exit(1);
  }

  if (DRY_RUN) console.log("--- DRY RUN — nothing will be written ---\n");
  if (SKIP_CHRISTMAS) console.log("Skipping Christmas-tagged products.\n");

  console.log("Scanning products…\n");

  let cursor: string | null = null;
  let totalScanned   = 0;
  let totalSkipped   = 0;   // already approved or christmas-skipped
  let toApprove: Product[] = [];

  // ── Pass 1: collect all products that need approving ────────────────────────
  while (true) {
    const data = await shopifyGQL<{
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string };
        edges: { node: Product }[];
      };
    }>(SCAN_QUERY, { cursor });

    for (const { node } of data.products.edges) {
      totalScanned++;
      const isChristmas = node.tags.some((t) => t.toLowerCase() === "christmas");

      if (SKIP_CHRISTMAS && isChristmas) { totalSkipped++; continue; }
      if (!isComplete(node))             { totalSkipped++; continue; }
      if (node.humanReviewed?.value === "true") { totalSkipped++; continue; }

      toApprove.push(node);
    }

    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }

  console.log(`Scanned ${totalScanned} products.`);
  console.log(`${toApprove.length} complete products need approving, ${totalSkipped} skipped.\n`);

  if (toApprove.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (DRY_RUN) {
    toApprove.forEach((p) => console.log(`  would approve: ${p.title}`));
    console.log(`\nDry run complete — ${toApprove.length} product(s) would be approved.`);
    return;
  }

  // ── Pass 2: write approved = "true" in batches of 25 ───────────────────────
  const CHUNK = 25;
  let totalApproved = 0;
  let totalErrors   = 0;

  for (let i = 0; i < toApprove.length; i += CHUNK) {
    const chunk = toApprove.slice(i, i + CHUNK);
    const metafields = chunk.map((p) => ({
      ownerId:   p.id,
      namespace: "product",
      key:       "approved",
      value:     "true",
      type:      "single_line_text_field",
    }));

    const result = await shopifyGQL<{
      metafieldsSet: {
        metafields: { id: string }[];
        userErrors: { field: string; message: string }[];
      };
    }>(SET_APPROVED, { metafields });

    if (result.metafieldsSet.userErrors.length > 0) {
      console.error(`  ✗ Batch ${Math.floor(i / CHUNK) + 1} errors: ${JSON.stringify(result.metafieldsSet.userErrors)}`);
      totalErrors += chunk.length;
    } else {
      chunk.forEach((p) => console.log(`  ✓ Approved: ${p.title}`));
      totalApproved += chunk.length;
    }
  }

  console.log(`\nDone. Approved ${totalApproved} product(s), ${totalErrors} error(s).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
