/**
 * One-off script: renames product metafields from namespace "seasonal-override" → "seasonal".
 * For each product that has old metafields, copies values to the new namespace then deletes the old ones.
 *
 * Usage: npm run cleanup-seasonal
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
          metafields(first: 10, namespace: "seasonal-override") {
            edges { node { id key value type } }
          }
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

  console.log('Renaming metafields: "seasonal-override" → "seasonal"...\n');

  let cursor: string | null = null;
  let totalScanned = 0;
  let totalRenamed = 0;
  let totalErrors  = 0;

  while (true) {
    const data = await shopifyGQL<{
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string };
        edges: {
          node: {
            id: string;
            title: string;
            metafields: { edges: { node: { id: string; key: string; value: string; type: string } }[] };
          };
        }[];
      };
    }>(QUERY_PRODUCTS, { cursor });

    for (const { node: product } of data.products.edges) {
      totalScanned++;
      const mfs = product.metafields.edges.map((e) => e.node);
      if (mfs.length === 0) continue;

      console.log(`${product.title} — renaming ${mfs.length} metafield(s)`);

      // Write new metafields under "seasonal" namespace
      const setResult = await shopifyGQL<{
        metafieldsSet: { userErrors: { field: string; message: string }[] };
      }>(SET_METAFIELDS, {
        metafields: mfs.map((mf) => ({
          ownerId:   product.id,
          namespace: "seasonal",
          key:       mf.key,
          value:     mf.value,
          type:      mf.type,
        })),
      });

      if (setResult.metafieldsSet.userErrors.length > 0) {
        console.error(`  ✗ Write failed: ${JSON.stringify(setResult.metafieldsSet.userErrors)}`);
        totalErrors++;
        continue;
      }

      // Delete old metafields from "seasonal-override" namespace
      const delResult = await shopifyGQL<{
        metafieldsDelete: {
          deletedMetafields: { key: string }[];
          userErrors: { field: string; message: string }[];
        };
      }>(DELETE_METAFIELDS, {
        metafields: mfs.map((mf) => ({
          ownerId:   product.id,
          namespace: "seasonal-override",
          key:       mf.key,
        })),
      });

      if (delResult.metafieldsDelete.userErrors.length > 0) {
        console.error(`  ✗ Delete failed: ${JSON.stringify(delResult.metafieldsDelete.userErrors)}`);
        totalErrors++;
      } else {
        for (const mf of mfs) {
          console.log(`  ✓ ${mf.key} = ${mf.value}`);
          totalRenamed++;
        }
      }
    }

    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }

  console.log(`\nDone. Scanned ${totalScanned} products, renamed ${totalRenamed} metafield(s), ${totalErrors} error(s).`);
}

main().catch((err) => { console.error(err); process.exit(1); });
