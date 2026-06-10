/**
 * Marks all bestseller products with complete content as Approved.
 * "Complete content" means productSummary + wctBullet1 + pfBullet1 are all set.
 *
 * Run:  node scripts/approve-bestsellers.mjs
 * Dry run (no writes): node scripts/approve-bestsellers.mjs --dry-run
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load .env.local ───────────────────────────────────────────────────────────
const envPath = path.join(__dirname, "..", ".env.local");
const envLines = fs.readFileSync(envPath, "utf-8").split("\n");
for (const line of envLines) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?$/);
  if (m) process.env[m[1]] = m[2];
}

const DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const TOKEN  = process.env.SHOPIFY_ACCESS_TOKEN;
const API    = "2025-10";
const DRY_RUN = process.argv.includes("--dry-run");

if (!DOMAIN || !TOKEN) {
  console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ACCESS_TOKEN in .env.local");
  process.exit(1);
}

// ── Shopify GraphQL helper ────────────────────────────────────────────────────
async function gql(query, variables = {}) {
  const res = await fetch(`https://${DOMAIN}/admin/api/${API}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 429) {
    const wait = Math.min(parseFloat(res.headers.get("Retry-After") ?? "2"), 5);
    console.log(`  Rate limited — waiting ${wait}s…`);
    await new Promise(r => setTimeout(r, wait * 1000));
    return gql(query, variables);
  }
  if (!res.ok) throw new Error(`Shopify ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors && !json.data) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

// ── Fetch all bestseller products ─────────────────────────────────────────────
const FETCH_QUERY = `
  query FetchBestsellers($first: Int!, $after: String) {
    products(first: $first, after: $after, query: "-status:archived -tag:hidden tag:*bestseller*") {
      edges {
        cursor
        node {
          id
          title
          productSummary: metafield(namespace: "product",         key: "product_summary")      { value }
          wctBullet1:     metafield(namespace: "why-choose-this", key: "bullet_1")              { value }
          pfBullet1:      metafield(namespace: "perfect-for",     key: "perfect_bullet_1")      { value }
        }
      }
      pageInfo { hasNextPage }
    }
  }
`;

console.log(`\nFetching bestseller products from ${DOMAIN}…`);
if (DRY_RUN) console.log("(DRY RUN — no changes will be written)\n");

const toApprove = [];
let cursor = null;
let total = 0;

while (true) {
  const data = await gql(FETCH_QUERY, { first: 250, after: cursor });
  const edges = data.products.edges;
  total += edges.length;

  for (const { node } of edges) {
    const summary = node.productSummary?.value ?? "";
    const wct     = node.wctBullet1?.value     ?? "";
    const pf      = node.pfBullet1?.value      ?? "";
    if (summary && wct && pf) {
      toApprove.push(node.id);
    }
  }

  if (!data.products.pageInfo.hasNextPage) break;
  cursor = edges[edges.length - 1].cursor;
}

console.log(`Found ${total} bestseller products total.`);
console.log(`${toApprove.length} have complete content and will be approved.\n`);

if (toApprove.length === 0) {
  console.log("Nothing to do.");
  process.exit(0);
}

if (DRY_RUN) {
  console.log("Dry run complete — run without --dry-run to apply.");
  process.exit(0);
}

// ── Set approved metafield in batches of 25 ───────────────────────────────────
const SET_MUTATION = `
  mutation SetApproved($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message }
    }
  }
`;

const BATCH = 25;
let approved = 0;
let failed = 0;

for (let i = 0; i < toApprove.length; i += BATCH) {
  const batch = toApprove.slice(i, i + BATCH);
  const metafields = batch.map(id => ({
    ownerId: id,
    namespace: "product",
    key: "approved",
    value: "true",
    type: "single_line_text_field",
  }));

  try {
    const data = await gql(SET_MUTATION, { metafields });
    const errors = data.metafieldsSet?.userErrors ?? [];
    if (errors.length > 0) {
      console.error(`  Batch ${Math.floor(i / BATCH) + 1} user errors:`, errors);
      failed += batch.length;
    } else {
      approved += batch.length;
    }
  } catch (err) {
    console.error(`  Batch ${Math.floor(i / BATCH) + 1} failed:`, err.message);
    failed += batch.length;
  }

  process.stdout.write(`\rApproved ${approved} / ${toApprove.length}…`);
}

console.log(`\n\nDone. ${approved} products approved, ${failed} failed.`);
