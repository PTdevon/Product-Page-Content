// One-time script: rename "Practical" → "Utility" for productType "Home"
// in the library edits store (WCT and PF applicability entries).
//
// Usage:
//   node scripts/fix-library-practical-to-utility.mjs            (live run)
//   node scripts/fix-library-practical-to-utility.mjs --dry-run  (preview only, no save)

const DRY_RUN = process.argv.includes("--dry-run");

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// ── Load .env.local ──────────────────────────────────────────────────────────
const envPath = join(root, ".env.local");
const env = {};
for (const line of readFileSync(envPath, "utf-8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const val = trimmed.slice(eq + 1).trim();
  env[trimmed.slice(0, eq).trim()] = val.replace(/^["']|["']$/g, "");
}

const DOMAIN = env.SHOPIFY_STORE_DOMAIN;
const TOKEN  = env.SHOPIFY_ACCESS_TOKEN;
const API    = `https://${DOMAIN}/admin/api/2025-10/graphql.json`;

if (!DOMAIN || !TOKEN) {
  console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ACCESS_TOKEN in .env.local");
  process.exit(1);
}

// ── Shopify GraphQL helper ────────────────────────────────────────────────────
async function gql(query, variables) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": TOKEN },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

// ── Queries / mutations ───────────────────────────────────────────────────────
const QUERY = `
  query {
    metaobjects(type: "pdp_library_edits", first: 1) {
      nodes { id fields { key value } }
    }
  }
`;

const UPDATE = `
  mutation Update($id: ID!, $f: [MetaobjectFieldInput!]!) {
    metaobjectUpdate(id: $id, metaobject: { fields: $f }) {
      metaobject { id }
      userErrors { field message }
    }
  }
`;

// ── Main ──────────────────────────────────────────────────────────────────────
const PRODUCT_TYPE = "Home";
const OLD_STYLE    = "Practical";
const NEW_STYLE    = "Utility";

if (DRY_RUN) console.log("DRY RUN — no changes will be saved.\n");
console.log(`Fetching library edits from Shopify…`);
const data = await gql(QUERY);
const node = data.metaobjects.nodes[0];

if (!node) {
  console.error("No pdp_library_edits metaobject found.");
  process.exit(1);
}

const field = node.fields.find((f) => f.key === "edits_json");
if (!field?.value) {
  console.log("edits_json is empty — nothing to fix.");
  process.exit(0);
}

const edits = JSON.parse(field.value);

let wctUpdated = 0;
let pfUpdated  = 0;

// Update WCT entries
for (const entry of Object.values(edits.wct ?? {})) {
  if (entry.productType === PRODUCT_TYPE && entry.productStyle === OLD_STYLE) {
    console.log(`  WCT: "${entry.text}" (${entry.id}) — changing style ${OLD_STYLE} → ${NEW_STYLE}`);
    entry.productStyle = NEW_STYLE;
    wctUpdated++;
  }
}

// Update PF applicability entries
for (const entry of Object.values(edits.pfApplicability ?? {})) {
  if (entry.productType === PRODUCT_TYPE && entry.productStyle === OLD_STYLE) {
    console.log(`  PF applicability: ${entry.id} — changing style ${OLD_STYLE} → ${NEW_STYLE}`);
    entry.productStyle = NEW_STYLE;
    pfUpdated++;
  }
}

if (wctUpdated === 0 && pfUpdated === 0) {
  console.log(`No entries found with productType="${PRODUCT_TYPE}" and productStyle="${OLD_STYLE}". Nothing to do.`);
  process.exit(0);
}

if (DRY_RUN) {
  console.log(`\nDry run complete — would update ${wctUpdated} WCT and ${pfUpdated} PF applicability entries. No changes saved.`);
  process.exit(0);
}

console.log(`\nSaving ${wctUpdated} WCT and ${pfUpdated} PF applicability entries…`);
const result = await gql(UPDATE, {
  id: node.id,
  f: [{ key: "edits_json", value: JSON.stringify(edits) }],
});

const errors = result.metaobjectUpdate.userErrors;
if (errors.length > 0) {
  console.error("Shopify save failed:", errors);
  process.exit(1);
}

console.log(`Done. ${wctUpdated} WCT and ${pfUpdated} PF applicability entries updated.`);
