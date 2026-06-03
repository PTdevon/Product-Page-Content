/**
 * One-off script: renames product metafield keys in the "product" namespace.
 *   product_type_pt  → product_type
 *   product_style_pt → product_style
 *
 * For each product that has the old keys set, copies the values to the new keys
 * then deletes the old ones.
 *
 * Usage: npm run migrate-metafield-keys
 */

const domain = process.env.SHOPIFY_STORE_DOMAIN!;
const token  = process.env.SHOPIFY_ACCESS_TOKEN!;
const API_VERSION = "2026-01";

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
          oldType:  metafield(namespace: "product", key: "product_type_pt")  { value }
          oldStyle: metafield(namespace: "product", key: "product_style_pt") { value }
        }
      }
    }
  }
`;

const SET_METAFIELDS = `
  mutation($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      userErrors { field message }
    }
  }
`;

const DELETE_METAFIELDS = `
  mutation($metafields: [MetafieldIdentifierInput!]!) {
    metafieldsDelete(metafields: $metafields) {
      deletedMetafields { key namespace ownerId }
      userErrors { field message }
    }
  }
`;

async function main() {
  if (!domain || !token) {
    console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ACCESS_TOKEN in .env.local");
    process.exit(1);
  }

  console.log('Renaming metafield keys: product_type_pt → product_type, product_style_pt → product_style\n');

  let cursor: string | null = null;
  let totalScanned = 0;
  let totalMigrated = 0;
  let totalErrors   = 0;

  while (true) {
    const data = await shopifyGQL<{
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string };
        edges: {
          node: {
            id: string;
            title: string;
            oldType:  { value: string } | null;
            oldStyle: { value: string } | null;
          };
        }[];
      };
    }>(QUERY_PRODUCTS, { cursor });

    for (const { node: product } of data.products.edges) {
      totalScanned++;

      const typeValue  = product.oldType?.value;
      const styleValue = product.oldStyle?.value;

      if (!typeValue && !styleValue) continue;

      console.log(`${product.title}`);

      // Write new keys
      const toSet = [];
      if (typeValue)  toSet.push({ ownerId: product.id, namespace: "product", key: "product_type",  value: typeValue,  type: "single_line_text_field" });
      if (styleValue) toSet.push({ ownerId: product.id, namespace: "product", key: "product_style", value: styleValue, type: "single_line_text_field" });

      const setResult = await shopifyGQL<{
        metafieldsSet: { userErrors: { field: string; message: string }[] };
      }>(SET_METAFIELDS, { metafields: toSet });

      if (setResult.metafieldsSet.userErrors.length > 0) {
        console.error(`  ✗ Write failed: ${JSON.stringify(setResult.metafieldsSet.userErrors)}`);
        totalErrors++;
        continue;
      }

      // Delete old keys
      const toDelete = [];
      if (typeValue)  toDelete.push({ ownerId: product.id, namespace: "product", key: "product_type_pt" });
      if (styleValue) toDelete.push({ ownerId: product.id, namespace: "product", key: "product_style_pt" });

      const delResult = await shopifyGQL<{
        metafieldsDelete: { userErrors: { field: string; message: string }[] };
      }>(DELETE_METAFIELDS, { metafields: toDelete });

      if (delResult.metafieldsDelete.userErrors.length > 0) {
        console.error(`  ✗ Delete failed: ${JSON.stringify(delResult.metafieldsDelete.userErrors)}`);
        totalErrors++;
      } else {
        if (typeValue)  console.log(`  ✓ product_type_pt  → product_type  ("${typeValue}")`);
        if (styleValue) console.log(`  ✓ product_style_pt → product_style ("${styleValue}")`);
        totalMigrated++;
      }
    }

    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }

  console.log(`\nDone. Scanned ${totalScanned} products, migrated ${totalMigrated}, ${totalErrors} error(s).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
