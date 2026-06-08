/**
 * One-off script: removes all Perfect For bullet content from every product
 * so it can be regenerated using the updated prompt.
 *
 * Touches the `perfect-for` namespace (perfect_bullet_1 – perfect_bullet_4 and icon_1 – icon_4).
 * Why Choose This, summaries, and all other metafields are untouched.
 *
 * Usage:
 *   npm run clear-pf              (live run — deletes content)
 *   npm run clear-pf -- --dry-run (preview only — nothing is deleted)
 */

const domain = process.env.SHOPIFY_STORE_DOMAIN!;
const token  = process.env.SHOPIFY_ACCESS_TOKEN!;
const API_VERSION = "2025-10";
const DRY_RUN = process.argv.includes("--dry-run");

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
  query ScanPF($cursor: String) {
    products(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          pf1: metafield(namespace: "perfect-for", key: "perfect_bullet_1") { value }
          pf2: metafield(namespace: "perfect-for", key: "perfect_bullet_2") { value }
          pf3: metafield(namespace: "perfect-for", key: "perfect_bullet_3") { value }
          pf4: metafield(namespace: "perfect-for", key: "perfect_bullet_4") { value }
          icon1: metafield(namespace: "perfect-for", key: "icon_1") { value }
          icon2: metafield(namespace: "perfect-for", key: "icon_2") { value }
          icon3: metafield(namespace: "perfect-for", key: "icon_3") { value }
          icon4: metafield(namespace: "perfect-for", key: "icon_4") { value }
        }
      }
    }
  }
`;

const DELETE_METAFIELDS = `
  mutation DeleteMetafields($metafields: [MetafieldIdentifierInput!]!) {
    metafieldsDelete(metafields: $metafields) {
      deletedMetafields { key }
      userErrors { field message }
    }
  }
`;

type MF = { value: string } | null;
type ScanProduct = {
  id: string;
  title: string;
  pf1: MF; pf2: MF; pf3: MF; pf4: MF;
  icon1: MF; icon2: MF; icon3: MF; icon4: MF;
};

async function main() {
  if (!domain || !token) {
    console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ACCESS_TOKEN in environment.");
    process.exit(1);
  }

  if (DRY_RUN) console.log("--- DRY RUN — nothing will be deleted ---\n");

  console.log("Scanning products for Perfect For content…\n");

  let cursor: string | null = null;
  let totalScanned = 0;
  let totalCleared = 0;
  let totalErrors  = 0;

  while (true) {
    const data = await shopifyGQL<{
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string };
        edges: { node: ScanProduct }[];
      };
    }>(SCAN_QUERY, { cursor });

    for (const { node: product } of data.products.edges) {
      totalScanned++;

      const bulletsPresent = [product.pf1, product.pf2, product.pf3, product.pf4].filter(Boolean).length;
      const iconsPresent = [product.icon1, product.icon2, product.icon3, product.icon4].filter(Boolean).length;

      if (bulletsPresent === 0 && iconsPresent === 0) continue;

      console.log(`Clearing ${bulletsPresent} bullet(s), ${iconsPresent} icon(s): ${product.title}`);

      if (DRY_RUN) {
        totalCleared++;
        continue;
      }

      const toDelete = [
        "perfect_bullet_1", "perfect_bullet_2", "perfect_bullet_3", "perfect_bullet_4",
        "icon_1", "icon_2", "icon_3", "icon_4",
      ].map((key) => ({ ownerId: product.id, namespace: "perfect-for", key }));

      const result = await shopifyGQL<{
        metafieldsDelete: {
          deletedMetafields: { key: string }[];
          userErrors: { field: string; message: string }[];
        };
      }>(DELETE_METAFIELDS, { metafields: toDelete });

      if (result.metafieldsDelete.userErrors.length > 0) {
        console.error(`  ✗ Error: ${JSON.stringify(result.metafieldsDelete.userErrors)}`);
        totalErrors++;
      } else {
        const deleted = result.metafieldsDelete.deletedMetafields.map((m) => m.key).join(", ");
        console.log(`  ✓ Deleted: ${deleted}`);
        totalCleared++;
      }
    }

    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }

  const action = DRY_RUN ? "would clear" : "cleared";
  console.log(`\nDone. Scanned ${totalScanned} products, ${action} ${totalCleared}, ${totalErrors} error(s).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
