/**
 * One-off script: clears the product.product_summary metafield from all products
 * so they can be regenerated using the updated prompt.
 * All other metafields (why-choose-this, perfect-for, seasonal, etc.) are untouched.
 *
 * Usage:
 *   npm run clear-product-summaries           (live run)
 *   npm run clear-product-summaries -- --dry-run
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
  if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  return json.data as T;
}

const QUERY_PRODUCTS = `
  query($cursor: String) {
    products(first: 250, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          productSummary: metafield(namespace: "product", key: "product_summary") { id }
        }
      }
    }
  }
`;

const DELETE_METAFIELDS = `
  mutation($metafields: [MetafieldIdentifierInput!]!) {
    metafieldsDelete(metafields: $metafields) {
      deletedMetafields { key }
      userErrors { field message }
    }
  }
`;

type MF = { id: string } | null;

async function main() {
  if (!domain || !token) {
    console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ACCESS_TOKEN");
    process.exit(1);
  }

  if (DRY_RUN) console.log("--- DRY RUN — nothing will be deleted ---\n");

  console.log("Scanning products for product_summary metafields...\n");

  let cursor: string | null = null;
  let totalScanned = 0;
  let totalCleared = 0;
  let totalErrors  = 0;

  while (true) {
    const data = await shopifyGQL<{
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string };
        edges: { node: { id: string; title: string; productSummary: MF } }[];
      };
    }>(QUERY_PRODUCTS, { cursor });

    for (const { node: product } of data.products.edges) {
      totalScanned++;

      if (!product.productSummary) continue;

      console.log(`Clearing: ${product.title}`);

      if (DRY_RUN) {
        totalCleared++;
        continue;
      }

      const result = await shopifyGQL<{
        metafieldsDelete: {
          deletedMetafields: { key: string }[];
          userErrors: { field: string; message: string }[];
        };
      }>(DELETE_METAFIELDS, {
        metafields: [{ ownerId: product.id, namespace: "product", key: "product_summary" }],
      });

      if (result.metafieldsDelete.userErrors.length > 0) {
        console.error(`  ✗ ${JSON.stringify(result.metafieldsDelete.userErrors)}`);
        totalErrors++;
      } else {
        console.log(`  ✓ cleared`);
        totalCleared++;
      }
    }

    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }

  const action = DRY_RUN ? "would clear" : "cleared";
  console.log(`\nDone. Scanned ${totalScanned} products, ${action} ${totalCleared} summary/summaries, ${totalErrors} error(s).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
