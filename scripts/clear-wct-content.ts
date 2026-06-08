/**
 * One-off script: removes all Why Choose This bullet content from every
 * product so the updated library phrases can be written fresh by the
 * Bulk Content tool.
 *
 * Only touches the `why-choose-this` namespace (bullet_1 – bullet_4).
 * Perfect For, seasonal, icons, and all other metafields are untouched.
 *
 * Usage:
 *   npm run clear-wct              (live run — deletes content)
 *   npm run clear-wct -- --dry-run (preview only — nothing is deleted)
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
  query ScanWCT($cursor: String) {
    products(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          wct1: metafield(namespace: "why-choose-this", key: "bullet_1") { value }
          wct2: metafield(namespace: "why-choose-this", key: "bullet_2") { value }
          wct3: metafield(namespace: "why-choose-this", key: "bullet_3") { value }
          wct4: metafield(namespace: "why-choose-this", key: "bullet_4") { value }
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
  wct1: MF; wct2: MF; wct3: MF; wct4: MF;
};

async function main() {
  if (!domain || !token) {
    console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ACCESS_TOKEN in environment.");
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log("--- DRY RUN — nothing will be deleted ---\n");
  }

  console.log("Scanning products for Why Choose This content…\n");

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

      const bulletsPresent = [product.wct1, product.wct2, product.wct3, product.wct4]
        .filter(Boolean).length;

      if (bulletsPresent === 0) continue;

      console.log(`Clearing ${bulletsPresent} bullet(s): ${product.title}`);

      if (DRY_RUN) {
        totalCleared++;
        continue;
      }

      const toDelete = ["bullet_1", "bullet_2", "bullet_3", "bullet_4"]
        .map((key) => ({ ownerId: product.id, namespace: "why-choose-this", key }));

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
  console.log(
    `\nDone. Scanned ${totalScanned} products, ${action} ${totalCleared}, ${totalErrors} error(s).`
  );
}

main().catch((err) => { console.error(err); process.exit(1); });
