/**
 * One-off script: deletes the old boolean seasonal metafields
 * (seasonal.mothers_day, seasonal.fathers_day, seasonal.valentines_day)
 * from all products. These were replaced by phrase+icon string metafields.
 *
 * Usage:
 *   npm run cleanup-seasonal-booleans           (live run)
 *   npm run cleanup-seasonal-booleans -- --dry-run
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
          oldMD: metafield(namespace: "seasonal", key: "mothers_day")    { id }
          oldFD: metafield(namespace: "seasonal", key: "fathers_day")    { id }
          oldVD: metafield(namespace: "seasonal", key: "valentines_day") { id }
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

  console.log("Scanning products for old boolean seasonal metafields...\n");

  let cursor: string | null = null;
  let totalScanned = 0;
  let totalDeleted = 0;
  let totalErrors  = 0;

  while (true) {
    const data = await shopifyGQL<{
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string };
        edges: { node: { id: string; title: string; oldMD: MF; oldFD: MF; oldVD: MF } }[];
      };
    }>(QUERY_PRODUCTS, { cursor });

    for (const { node: product } of data.products.edges) {
      totalScanned++;

      const keysToDelete: string[] = [];
      if (product.oldMD) keysToDelete.push("mothers_day");
      if (product.oldFD) keysToDelete.push("fathers_day");
      if (product.oldVD) keysToDelete.push("valentines_day");

      if (keysToDelete.length === 0) continue;

      console.log(`${product.title} — removing: ${keysToDelete.join(", ")}`);

      if (DRY_RUN) {
        totalDeleted += keysToDelete.length;
        continue;
      }

      const result = await shopifyGQL<{
        metafieldsDelete: {
          deletedMetafields: { key: string }[];
          userErrors: { field: string; message: string }[];
        };
      }>(DELETE_METAFIELDS, {
        metafields: keysToDelete.map((key) => ({
          ownerId:   product.id,
          namespace: "seasonal",
          key,
        })),
      });

      if (result.metafieldsDelete.userErrors.length > 0) {
        console.error(`  ✗ ${JSON.stringify(result.metafieldsDelete.userErrors)}`);
        totalErrors++;
      } else {
        for (const key of keysToDelete) console.log(`  ✓ deleted seasonal.${key}`);
        totalDeleted += keysToDelete.length;
      }
    }

    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }

  const action = DRY_RUN ? "would delete" : "deleted";
  console.log(`\nDone. Scanned ${totalScanned} products, ${action} ${totalDeleted} metafield(s), ${totalErrors} error(s).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
